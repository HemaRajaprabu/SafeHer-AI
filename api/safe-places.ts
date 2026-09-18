import https from 'https';

export interface SafePlace {
  id: number;
  name: string;
  type: 'police' | 'hospital' | 'fire_station' | 'clinic' | 'other';
  latitude: number;
  longitude: number;
  distanceKm: number;
  address?: string;
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

// Builds lightweight Overpass QL query returning node, way, and relation centroids
export function buildOverpassQuery(lat: number, lon: number, radiusMeters: number): string {
  return `[out:json][timeout:15];
(
  nwr["amenity"="police"](around:${radiusMeters},${lat},${lon});
  nwr["police"="station"](around:${radiusMeters},${lat},${lon});
  nwr["amenity"="police_station"](around:${radiusMeters},${lat},${lon});
  nwr["police"](around:${radiusMeters},${lat},${lon});
  nwr["building"="police"](around:${radiusMeters},${lat},${lon});
  nwr["building"="police_station"](around:${radiusMeters},${lat},${lon});
  nwr["government"="police"](around:${radiusMeters},${lat},${lon});
  nwr["office"="police"](around:${radiusMeters},${lat},${lon});
)->.police;
(
  nwr["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
  nwr["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
  nwr["amenity"="fire_station"](around:${radiusMeters},${lat},${lon});
)->.others;
.police out center;
.others out center 40;`;
}

// Parses raw Overpass elements into SafePlace array preserving category logic and distance sorting
export function parseOverpassElements(
  elements: any[],
  userLat: number,
  userLon: number,
  radiusKm: number
): SafePlace[] {
  const seenIds = new Set<string>();
  const parsedPlaces: SafePlace[] = [];

  for (const el of elements) {
    const placeLat =
      typeof el.lat === 'number'
        ? el.lat
        : typeof el.center?.lat === 'number'
        ? el.center.lat
        : null;
    const placeLon =
      typeof el.lon === 'number'
        ? el.lon
        : typeof el.center?.lon === 'number'
        ? el.center.lon
        : null;

    if (placeLat === null || placeLon === null) {
      continue;
    }

    let placeType: SafePlace['type'] | null = null;
    const amenity = el.tags?.amenity;
    const policeTag = el.tags?.police;
    const isPolice =
      amenity === 'police' ||
      amenity === 'police_station' ||
      amenity === 'police_post' ||
      amenity === 'police_office' ||
      amenity === 'police_booth' ||
      (Boolean(policeTag) && policeTag !== 'no' && policeTag !== 'none' && policeTag !== 'false') ||
      el.tags?.building === 'police' ||
      el.tags?.building === 'police_station' ||
      el.tags?.government === 'police' ||
      el.tags?.office === 'police';

    if (isPolice) placeType = 'police';
    else if (amenity === 'hospital') placeType = 'hospital';
    else if (amenity === 'clinic') placeType = 'clinic';
    else if (amenity === 'fire_station') placeType = 'fire_station';

    if (!placeType) continue;

    const uniqueKey = `${el.type || 'n'}-${el.id}`;
    if (seenIds.has(uniqueKey)) continue;
    seenIds.add(uniqueKey);

    const distanceKm = getDistanceKm(userLat, userLon, placeLat, placeLon);
    if (distanceKm > radiusKm + 0.1) continue;

    const rawName =
      el.tags?.name ||
      el.tags?.['name:en'] ||
      el.tags?.brand ||
      el.tags?.operator;

    let name = rawName;
    if (!name) {
      if (placeType === 'police') {
        if (policeTag && typeof policeTag === 'string' && policeTag !== 'yes') {
          name = `Police ${policeTag.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}`;
        } else {
          name = 'Police Station';
        }
      } else {
        name = `${placeType.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}`;
      }
    }

    const normalizedName = name.toLowerCase().trim();
    // Spatial deduplication: verify if an identical name exists at the same physical location (within 80m)
    const isDuplicate = parsedPlaces.some(
      (p) =>
        p.name.toLowerCase().trim() === normalizedName &&
        getDistanceKm(p.latitude, p.longitude, placeLat, placeLon) < 0.08
    );
    if (isDuplicate) continue;

    const street = el.tags?.['addr:street'] || '';
    const houseNumber = el.tags?.['addr:housenumber'] || '';
    const city = el.tags?.['addr:city'] || '';
    const address =
      street || houseNumber || city
        ? `${houseNumber} ${street}${street && city ? ', ' : ''}${city}`.trim()
        : undefined;

    parsedPlaces.push({
      id: el.id,
      name,
      type: placeType,
      latitude: placeLat,
      longitude: placeLon,
      distanceKm: Math.round(distanceKm * 100) / 100,
      address,
    });
  }

  parsedPlaces.sort((a, b) => a.distanceKm - b.distanceKm);
  return parsedPlaces;
}

// Server-to-server HTTPS POST request with custom User-Agent, IPv4 preference, and socket timeout
function fetchOverpassServer(endpointUrl: string, query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(endpointUrl);
      const postData = `data=${encodeURIComponent(query)}`;

      if (https && typeof https.request === 'function') {
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: parsedUrl.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
            'User-Agent': 'SafeHer-AI/1.0 (Safety Services; contact: https://github.com/HemaRajaprabu/SafeHer-AI)',
            Accept: 'application/json',
          },
          family: 4, // Explicit IPv4 to prevent unreachable IPv6 routes
          timeout: 6000,
        };

        const req = https.request(options, (res: any) => {
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
        fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'SafeHer-AI/1.0 (Safety Services; contact: https://github.com/HemaRajaprabu/SafeHer-AI)',
            Accept: 'application/json',
          },
          body: postData,
        })
          .then(async (res) => {
            if (!res.ok) throw new Error(`Upstream Overpass returned HTTP ${res.status}`);
            return res.json();
          })
          .then(resolve)
          .catch(reject);
      }
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Vercel Serverless Function Handler for Safe Places Overpass Proxy.
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
    let radiusKm = 10;
    let radiusMeters = 10000;

    let rawRadius: string | null = null;

    // Parse query parameters
    if (req?.query) {
      lat = parseFloat(req.query.lat || req.query.latitude || '0');
      lon = parseFloat(req.query.lon || req.query.lng || req.query.longitude || '0');
      rawRadius = req.query.radius || req.query.radiusKm || null;
    } else if (req?.url) {
      try {
        const urlObj = new URL(req.url, 'http://localhost');
        lat = parseFloat(urlObj.searchParams.get('lat') || urlObj.searchParams.get('latitude') || '0');
        lon = parseFloat(urlObj.searchParams.get('lon') || urlObj.searchParams.get('lng') || urlObj.searchParams.get('longitude') || '0');
        rawRadius = urlObj.searchParams.get('radius') || urlObj.searchParams.get('radiusKm') || null;
      } catch {
        // Ignore URL parse errors
      }
    }

    // Transparently handle radius specified in meters (e.g. 10000) or km (e.g. 10 or 3)
    if (rawRadius) {
      const parsed = parseFloat(rawRadius);
      if (!isNaN(parsed) && parsed > 0) {
        if (parsed > 100) {
          radiusMeters = Math.round(parsed);
          radiusKm = radiusMeters / 1000;
        } else {
          radiusKm = parsed;
          radiusMeters = Math.round(parsed * 1000);
        }
      }
    }

    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
      const errorPayload = {
        success: false,
        error: 'Missing or invalid latitude/longitude parameters.',
        places: [],
      };
      if (res?.status) return res.status(400).json(errorPayload);
      return new Response(JSON.stringify(errorPayload), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const query = buildOverpassQuery(lat, lon, radiusMeters);

    let rawData: any = null;
    let lastError: any = null;

    // Failover across Overpass mirrors using standard HTTP POST
    for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
      const endpoint = OVERPASS_ENDPOINTS[i];

      try {
        rawData = await fetchOverpassServer(endpoint, query);
        if (rawData && Array.isArray(rawData.elements)) {
          break;
        } else {
          throw new Error('Invalid JSON structure: missing elements array');
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[SafePlaces API] Endpoint ${endpoint} failed: ${err?.message || err}`);
        if (i < OVERPASS_ENDPOINTS.length - 1) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    }

    if (!rawData || !Array.isArray(rawData.elements)) {
      const errorPayload = {
        success: false,
        error: lastError?.message || 'All Overpass mirrors failed to respond.',
        places: [],
      };
      if (res?.status) return res.status(502).json(errorPayload);
      return new Response(JSON.stringify(errorPayload), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const places = parseOverpassElements(rawData.elements, lat, lon, radiusKm);

    const payload = {
      success: true,
      places,
      count: places.length,
      elements: rawData.elements,
    };

    if (res?.status) return res.status(200).json(payload);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    console.error('[SafePlaces API] Internal Error:', err?.message || err);
    const errorPayload = {
      success: false,
      error: err?.message || 'Internal server error while searching safe places.',
      places: [],
    };
    if (res?.status) return res.status(500).json(errorPayload);
    return new Response(JSON.stringify(errorPayload), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
