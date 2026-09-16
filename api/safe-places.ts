let httpsModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  httpsModule = typeof require !== 'undefined' ? require('https') : null;
} catch {
  // Fallback for runtimes without require
}

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
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
];

// Haversine formula to compute distance between two coordinates in km
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  node["amenity"="police"](around:${radiusMeters},${lat},${lon});
  way["amenity"="police"](around:${radiusMeters},${lat},${lon});
  relation["amenity"="police"](around:${radiusMeters},${lat},${lon});
  node["amenity"="police_station"](around:${radiusMeters},${lat},${lon});
  way["amenity"="police_station"](around:${radiusMeters},${lat},${lon});
  node["police"](around:${radiusMeters},${lat},${lon});
  way["police"](around:${radiusMeters},${lat},${lon});
  relation["police"](around:${radiusMeters},${lat},${lon});
  node["building"="police"](around:${radiusMeters},${lat},${lon});
  way["building"="police"](around:${radiusMeters},${lat},${lon});
  relation["building"="police"](around:${radiusMeters},${lat},${lon});
  node["government"="police"](around:${radiusMeters},${lat},${lon});
  way["government"="police"](around:${radiusMeters},${lat},${lon});
  node["office"="police"](around:${radiusMeters},${lat},${lon});
  way["office"="police"](around:${radiusMeters},${lat},${lon});
)->.police;
(
  node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
  way["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
  node["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
  way["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
  node["amenity"="fire_station"](around:${radiusMeters},${lat},${lon});
  way["amenity"="fire_station"](around:${radiusMeters},${lat},${lon});
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
    const isPolice =
      amenity === 'police' ||
      amenity === 'police_station' ||
      amenity === 'police_post' ||
      amenity === 'police_office' ||
      amenity === 'police_booth' ||
      (Boolean(el.tags?.police) && el.tags?.police !== 'no' && el.tags?.police !== 'none') ||
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
        const policeTag = el.tags?.police;
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
    const isDuplicate = parsedPlaces.some(
      (p) =>
        p.name.toLowerCase().trim() === normalizedName &&
        Math.abs(p.distanceKm - distanceKm) < 0.08
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

// Server-to-server HTTPS request with custom User-Agent and IPv4 preference
function fetchOverpassServer(endpointUrl: string): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      if (httpsModule && typeof httpsModule.request === 'function') {
        const parsedUrl = new URL(endpointUrl);
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          headers: {
            'User-Agent': 'SafeHer-AI/1.0 (Safety Services; contact: https://github.com/HemaRajaprabu/SafeHer-AI)',
            Accept: 'application/json',
          },
          family: 4, // Explicit IPv4 to prevent unreachable IPv6 routes
          timeout: 12000,
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

        req.end();
      } else {
        // Fallback to fetch for runtimes where https module is absent
        fetch(endpointUrl, {
          headers: {
            'User-Agent': 'SafeHer-AI/1.0 (Safety Services; contact: https://github.com/HemaRajaprabu/SafeHer-AI)',
            Accept: 'application/json',
          },
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
 */
export default async function handler(req: any, res: any) {
  // CORS Headers
  if (res?.setHeader) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    let lat = 0;
    let lon = 0;
    let radiusKm = 3;

    // Parse query parameters
    if (req?.query) {
      lat = parseFloat(req.query.lat || req.query.latitude || '0');
      lon = parseFloat(req.query.lon || req.query.lng || req.query.longitude || '0');
      if (req.query.radius || req.query.radiusKm) {
        radiusKm = parseFloat(req.query.radius || req.query.radiusKm);
      }
    } else if (req?.url) {
      try {
        const urlObj = new URL(req.url, 'http://localhost');
        lat = parseFloat(urlObj.searchParams.get('lat') || urlObj.searchParams.get('latitude') || '0');
        lon = parseFloat(urlObj.searchParams.get('lon') || urlObj.searchParams.get('lng') || urlObj.searchParams.get('longitude') || '0');
        const r = urlObj.searchParams.get('radius') || urlObj.searchParams.get('radiusKm');
        if (r) radiusKm = parseFloat(r);
      } catch {
        // Ignore URL parse errors
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

    const radiusMeters = Math.round((radiusKm || 3) * 1000);
    const query = buildOverpassQuery(lat, lon, radiusMeters);
    const encodedQuery = encodeURIComponent(query);

    let rawData: any = null;
    let lastError: any = null;

    // Failover across Overpass mirrors
    for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
      const endpoint = OVERPASS_ENDPOINTS[i];
      const getUrl = `${endpoint}?data=${encodedQuery}`;

      try {
        rawData = await fetchOverpassServer(getUrl);
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
