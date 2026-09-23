// Type-safe Node declarations without requiring @types/node in tsconfig
declare const Buffer: any;
declare const require: any;

let httpsModule: any = null;
try {
  if (typeof require !== 'undefined') {
    httpsModule = require('https');
  }
} catch {
  // Ignored in runtimes where require is absent
}

export interface NearbyFacility {
  id: string | number;
  name: string;
  type: 'police' | 'women_police' | 'hospital' | 'clinic' | 'transport' | 'other';
  distanceMeters: number;
  distanceText: string;
  latitude?: number;
  longitude?: number;
  isAllWomen?: boolean;
}

export interface NearbyLightingInfo {
  litCount: number;
  unlitCount: number;
  summary: string;
  fetchedSuccessfully?: boolean;
}

export interface SafetyInfrastructureData {
  nearbyPoliceStations: NearbyFacility[];
  nearbyWomenPoliceStations: NearbyFacility[];
  nearbyHospitals: NearbyFacility[];
  nearbyTransportHubs: NearbyFacility[];
  nearbyLighting: NearbyLightingInfo;
  searchRadiusMeters: number;
  fetchedSuccessfully: boolean;
  errorMessage?: string;
}

// Resilient Overpass API interpreter endpoints for reliable server-side failover
const OVERPASS_ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
];

// Haversine formula to compute distance between two coordinates in km
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Format distance in meters to a clean human-readable string
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m away`;
  }
  return `${(meters / 1000).toFixed(1)} km away`;
}

// Detects if a police facility is an All-Women / Women's Police Station
export function isWomenPoliceStation(name?: string, tags?: Record<string, string>): boolean {
  const combined = `${name || ''} ${tags?.operator || ''} ${tags?.description || ''} ${tags?.alt_name || ''} ${tags?.official_name || ''}`.toLowerCase();
  if (tags?.female === 'yes' || tags?.['operator:type'] === 'all_women' || tags?.women === 'yes') {
    return true;
  }
  return /(all[\s-]women|women[\s-]police|awps|mahila|magalir|vanitha)/i.test(combined);
}

// Comprehensive Overpass QL query covering police, medical, fire, transit, and lighting
export function buildInfrastructureQuery(lat: number, lon: number, radiusMeters: number): string {
  return `[out:json][timeout:12];
(
  nwr["amenity"="police"](around:${radiusMeters},${lat},${lon});
  nwr["police"="station"](around:${radiusMeters},${lat},${lon});
  nwr["amenity"="police_station"](around:${radiusMeters},${lat},${lon});
  nwr["building"="police"](around:${radiusMeters},${lat},${lon});
  nwr["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
  nwr["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
  nwr["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});
  nwr["emergency"="ambulance_station"](around:${radiusMeters},${lat},${lon});
  nwr["amenity"="fire_station"](around:${radiusMeters},${lat},${lon});
  nwr["railway"="station"](around:${radiusMeters},${lat},${lon});
  nwr["amenity"="bus_station"](around:${radiusMeters},${lat},${lon});
  node["highway"="bus_stop"](around:${radiusMeters},${lat},${lon});
  way["highway"]["lit"](around:500,${lat},${lon});
);
out center 80;`;
}

// Lightweight fallback query focusing strictly on critical emergency facilities
export function buildFallbackQuery(lat: number, lon: number, radiusMeters: number): string {
  const r = Math.min(radiusMeters, 1500);
  return `[out:json][timeout:8];
(
  nwr["amenity"="police"](around:${r},${lat},${lon});
  nwr["amenity"="hospital"](around:${r},${lat},${lon});
  nwr["amenity"="clinic"](around:${r},${lat},${lon});
  nwr["railway"="station"](around:${r},${lat},${lon});
  nwr["amenity"="bus_station"](around:${r},${lat},${lon});
  way["highway"]["lit"](around:500,${lat},${lon});
);
out center 40;`;
}

// Parses raw Overpass elements into SafetyInfrastructureData structure
export function parseInfrastructureElements(
  elements: any[],
  userLat: number,
  userLon: number,
  searchRadiusMeters: number,
  lightingQueried: boolean = true
): SafetyInfrastructureData {
  const police: NearbyFacility[] = [];
  const womenPolice: NearbyFacility[] = [];
  const hospitals: NearbyFacility[] = [];
  const transport: NearbyFacility[] = [];
  let litWays = 0;
  let unlitWays = 0;
  const seenIds = new Set<string>();

  for (const el of elements) {
    const lat = typeof el.lat === 'number' ? el.lat : el.center?.lat;
    const lon = typeof el.lon === 'number' ? el.lon : el.center?.lon;
    const tags = el.tags || {};

    if (tags.lit === 'yes' || tags.lit === '24/7' || tags.lit === 'dusk-dawn') {
      litWays++;
    } else if (tags.lit === 'no') {
      unlitWays++;
    }

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      continue;
    }

    const uniqueKey = `${el.type || 'n'}-${el.id}`;
    if (seenIds.has(uniqueKey)) continue;
    seenIds.add(uniqueKey);

    const distKm = getDistanceKm(userLat, userLon, lat, lon);
    const distanceMeters = Math.round(distKm * 1000);
    const distanceText = formatDistance(distanceMeters);

    if (distanceMeters > searchRadiusMeters + 100) continue;

    const isPolice =
      tags.amenity === 'police' ||
      tags.amenity === 'police_station' ||
      tags.police === 'station' ||
      tags.building === 'police';

    if (isPolice) {
      const isWomen = isWomenPoliceStation(tags.name, tags);
      const facName =
        tags.name ||
        tags['name:en'] ||
        (isWomen ? 'All-Women Police Station' : 'Police Station');
      const fac: NearbyFacility = {
        id: el.id,
        name: facName,
        type: isWomen ? 'women_police' : 'police',
        distanceMeters,
        distanceText,
        latitude: lat,
        longitude: lon,
        isAllWomen: isWomen,
      };

      if (isWomen) {
        womenPolice.push(fac);
      }
      police.push(fac);
    } else if (
      tags.amenity === 'hospital' ||
      tags.amenity === 'clinic' ||
      tags.amenity === 'pharmacy' ||
      tags.emergency === 'ambulance_station'
    ) {
      const facName =
        tags.name ||
        tags['name:en'] ||
        (tags.amenity === 'hospital'
          ? 'Hospital'
          : tags.amenity === 'pharmacy'
          ? 'Pharmacy'
          : tags.emergency === 'ambulance_station'
          ? 'Ambulance Station'
          : 'Medical Clinic');
      hospitals.push({
        id: el.id,
        name: facName,
        type: tags.amenity === 'clinic' ? 'clinic' : 'hospital',
        distanceMeters,
        distanceText,
        latitude: lat,
        longitude: lon,
      });
    } else if (tags.amenity === 'fire_station') {
      const facName = tags.name || tags['name:en'] || 'Fire Station';
      hospitals.push({
        id: el.id,
        name: facName,
        type: 'other',
        distanceMeters,
        distanceText,
        latitude: lat,
        longitude: lon,
      });
    } else if (
      tags.railway === 'station' ||
      tags.amenity === 'bus_station' ||
      tags.highway === 'bus_stop'
    ) {
      let defaultLabel = 'Bus Stop';
      if (tags.railway === 'station') defaultLabel = 'Railway Station';
      else if (tags.amenity === 'bus_station') defaultLabel = 'Bus Station';

      const facName = tags.name || tags['name:en'] || defaultLabel;
      transport.push({
        id: el.id,
        name: facName,
        type: 'transport',
        distanceMeters,
        distanceText,
        latitude: lat,
        longitude: lon,
      });
    }
  }

  police.sort((a, b) => a.distanceMeters - b.distanceMeters);
  womenPolice.sort((a, b) => a.distanceMeters - b.distanceMeters);
  hospitals.sort((a, b) => a.distanceMeters - b.distanceMeters);
  transport.sort((a, b) => a.distanceMeters - b.distanceMeters);

  let lightingSummary = 'No street lighting tags recorded within 500m.';
  if (!lightingQueried) {
    lightingSummary = 'Street lighting data is temporarily unavailable.';
  } else if (litWays > 0 && unlitWays === 0) {
    lightingSummary = `${litWays} lit road segments detected within 500m.`;
  } else if (litWays > 0 && unlitWays > 0) {
    lightingSummary = `Mixed street lighting (${litWays} lit, ${unlitWays} unlit segments within 500m).`;
  } else if (unlitWays > 0 && litWays === 0) {
    lightingSummary = `${unlitWays} unlit road segments detected within 500m.`;
  }

  return {
    nearbyPoliceStations: police.slice(0, 5),
    nearbyWomenPoliceStations: womenPolice.slice(0, 3),
    nearbyHospitals: hospitals.slice(0, 5),
    nearbyTransportHubs: transport.slice(0, 5),
    nearbyLighting: {
      litCount: litWays,
      unlitCount: unlitWays,
      summary: lightingSummary,
      fetchedSuccessfully: lightingQueried,
    },
    searchRadiusMeters,
    fetchedSuccessfully: true,
  };
}

// Server-to-server HTTPS POST request with IPv4 preference and socket timeout
function fetchOverpassServer(endpointUrl: string, query: string, timeoutMs: number = 7000): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(endpointUrl);
      const postData = `data=${encodeURIComponent(query)}`;

      if (httpsModule && typeof httpsModule.request === 'function') {
        const byteLength =
          typeof Buffer !== 'undefined' && typeof Buffer.byteLength === 'function'
            ? Buffer.byteLength(postData)
            : postData.length;

        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: parsedUrl.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': byteLength,
            'User-Agent': 'SafeHer-AI/1.0 (Safety Zone Infrastructure Service; contact: https://github.com/HemaRajaprabu/SafeHer-AI)',
            Accept: 'application/json',
          },
          family: 4, // Explicit IPv4 to prevent unreachable IPv6 routes
          timeout: timeoutMs,
        };

        const req = httpsModule.request(options, (res: any) => {
          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
            res.resume();
            return reject(new Error(`Upstream Overpass returned HTTP ${res.statusCode}`));
          }

          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: any) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (e: any) {
              reject(new Error(`Failed to parse Overpass response: ${e.message}`));
            }
          });
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Overpass request timed out'));
        });

        req.on('error', (err: any) => {
          reject(err);
        });

        req.write(postData);
        req.end();
      } else {
        // Fallback to fetch for runtimes where https module is absent
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

        fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'SafeHer-AI/1.0 (Safety Zone Infrastructure Service; contact: https://github.com/HemaRajaprabu/SafeHer-AI)',
            Accept: 'application/json',
          },
          body: postData,
          signal: controller?.signal,
        })
          .then(async (res) => {
            if (timer) clearTimeout(timer);
            if (!res.ok) throw new Error(`Upstream Overpass returned HTTP ${res.status}`);
            return res.json();
          })
          .then(resolve)
          .catch((err) => {
            if (timer) clearTimeout(timer);
            reject(err);
          });
      }
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Vercel Serverless Function Handler for AI Safety Zone Infrastructure Proxy.
 * Proxies Overpass API requests server-to-server to avoid browser CORS and User-Agent blocks.
 * Completely free, open-data solution with zero API cost.
 */
export default async function handler(req: any, res: any) {
  // CORS Headers
  if (res?.setHeader) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=240');
  }

  // Preflight check
  if (req?.method === 'OPTIONS') {
    if (res?.status) return res.status(200).end();
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    let lat = 0;
    let lon = 0;
    let radiusMeters = 2000;
    let rawRadius: string | null = null;

    // Parse query parameters from Node req.query or Web Fetch req.url
    if (req?.query) {
      lat = parseFloat(req.query.lat || req.query.latitude || '0');
      lon = parseFloat(req.query.lon || req.query.lng || req.query.longitude || '0');
      rawRadius = req.query.radius || req.query.radiusMeters || req.query.radiusKm || null;
    } else if (req?.url) {
      try {
        const urlObj = new URL(req.url, 'http://localhost');
        lat = parseFloat(urlObj.searchParams.get('lat') || urlObj.searchParams.get('latitude') || '0');
        lon = parseFloat(urlObj.searchParams.get('lon') || urlObj.searchParams.get('lng') || urlObj.searchParams.get('longitude') || '0');
        rawRadius = urlObj.searchParams.get('radius') || urlObj.searchParams.get('radiusMeters') || urlObj.searchParams.get('radiusKm') || null;
      } catch {
        // Ignore URL parse errors
      }
    }

    if (rawRadius) {
      const parsed = parseFloat(rawRadius);
      if (!isNaN(parsed) && parsed > 0) {
        if (parsed > 100) {
          radiusMeters = Math.round(parsed);
        } else {
          radiusMeters = Math.round(parsed * 1000);
        }
      }
    }

    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
      const errorPayload = {
        success: false,
        error: 'Missing or invalid latitude/longitude parameters.',
        fetchedSuccessfully: false,
        nearbyPoliceStations: [],
        nearbyWomenPoliceStations: [],
        nearbyHospitals: [],
        nearbyTransportHubs: [],
        nearbyLighting: {
          litCount: 0,
          unlitCount: 0,
          summary: 'Street lighting data is temporarily unavailable.',
          fetchedSuccessfully: false,
        },
        searchRadiusMeters: radiusMeters,
      };
      if (res?.status) return res.status(400).json(errorPayload);
      return new Response(JSON.stringify(errorPayload), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const query = buildInfrastructureQuery(lat, lon, radiusMeters);
    let rawData: any = null;
    let lastError: any = null;
    let lightingQueried = false;

    // Failover across Overpass mirrors using standard HTTP POST
    for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
      const endpoint = OVERPASS_ENDPOINTS[i];

      try {
        rawData = await fetchOverpassServer(endpoint, query, 6500);
        if (rawData && Array.isArray(rawData.elements)) {
          lightingQueried = true;
          break;
        } else {
          throw new Error('Invalid JSON structure: missing elements array');
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[AISafetyZone API] Endpoint ${endpoint} failed: ${err?.message || err}`);
        if (i < OVERPASS_ENDPOINTS.length - 1) {
          await new Promise((r) => setTimeout(r, 150));
        }
      }
    }

    // Fallback lean query if comprehensive query timed out on all mirrors
    if (!rawData || !Array.isArray(rawData.elements)) {
      const fallbackQuery = buildFallbackQuery(lat, lon, radiusMeters);
      for (const endpoint of OVERPASS_ENDPOINTS) {
        try {
          rawData = await fetchOverpassServer(endpoint, fallbackQuery, 4500);
          if (rawData && Array.isArray(rawData.elements)) {
            lightingQueried = true;
            break;
          }
        } catch {
          // Continue to next mirror
        }
      }
    }

    if (!rawData || !Array.isArray(rawData.elements)) {
      const errorPayload = {
        success: false,
        error: lastError?.message || 'All Overpass mirrors failed to respond.',
        fetchedSuccessfully: false,
        errorMessage: 'Safety infrastructure data is temporarily unavailable.',
        nearbyPoliceStations: [],
        nearbyWomenPoliceStations: [],
        nearbyHospitals: [],
        nearbyTransportHubs: [],
        nearbyLighting: {
          litCount: 0,
          unlitCount: 0,
          summary: 'Street lighting data is temporarily unavailable.',
          fetchedSuccessfully: false,
        },
        searchRadiusMeters: radiusMeters,
      };
      if (res?.status) return res.status(502).json(errorPayload);
      return new Response(JSON.stringify(errorPayload), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const infrastructureData = parseInfrastructureElements(
      rawData.elements,
      lat,
      lon,
      radiusMeters,
      lightingQueried
    );

    const payload = {
      success: true,
      ...infrastructureData,
      elements: rawData.elements,
    };

    if (res?.status) return res.status(200).json(payload);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    console.error('[AISafetyZone API] Internal Error:', err?.message || err);
    const errorPayload = {
      success: false,
      error: err?.message || 'Internal server error while searching safety infrastructure.',
      fetchedSuccessfully: false,
      errorMessage: 'Safety infrastructure data is temporarily unavailable.',
      nearbyPoliceStations: [],
      nearbyWomenPoliceStations: [],
      nearbyHospitals: [],
      nearbyTransportHubs: [],
      nearbyLighting: {
        litCount: 0,
        unlitCount: 0,
        summary: 'Street lighting data is temporarily unavailable.',
        fetchedSuccessfully: false,
      },
      searchRadiusMeters: 2000,
    };
    if (res?.status) return res.status(500).json(errorPayload);
    return new Response(JSON.stringify(errorPayload), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
