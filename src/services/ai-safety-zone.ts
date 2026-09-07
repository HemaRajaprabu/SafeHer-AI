import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { getCustomSafePlaces, getDistanceKm, CustomSafePlace } from './location-safety';

export type SafetyLevel = 'lower_concern' | 'caution' | 'higher_concern';

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

export interface SafetyNewsItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  source: string;
  snippet?: string;
  isRelevant: boolean;
}

export interface RegionalSafetyNewsData {
  articles: SafetyNewsItem[];
  queryUsed: string;
  fetchedSuccessfully: boolean;
  errorMessage?: string;
  noNewsMessage?: string;
}

export interface LocalityDetails {
  areaName: string;
  locality?: string; // village, hamlet, suburb, neighbourhood, town
  city?: string;     // city, municipality, town
  district?: string; // state_district, county, subregion
  region?: string;   // state, province
  countryCode?: string; // ISO 3166-1 alpha-2 (e.g. IN, US, GB, etc.)
}

export interface SafetyZoneAssessment {
  safetyLevel: SafetyLevel;
  shortReason: string;
  recommendation: string;
  areaName: string;
  evaluatedAt: string;
  isLocal: boolean;
  infrastructure: SafetyInfrastructureData;
  safetyNews: RegionalSafetyNewsData;
  dataSourceInfo: {
    officialIncidentDataAvailable: boolean;
    infrastructureDataAvailable: boolean;
    newsDataAvailable: boolean;
    message: string;
    sourcesConsulted: string[];
  };
  contextualFactors: {
    timeOfDay: string;
    isNighttime: boolean;
    accuracyMeters: number | null;
    coordinates: { latitude: number; longitude: number };
    verifiedSafePlacesCount: number;
  };
}

/**
 * In-memory cache for recent assessments to prevent unnecessary repeated API calls
 * while user remains at the same location.
 */
interface CachedSafetyAssessment {
  latitude: number;
  longitude: number;
  timestamp: number;
  assessment: SafetyZoneAssessment;
}

let lastAssessmentCache: CachedSafetyAssessment | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const CACHE_DISTANCE_THRESHOLD_KM = 0.05; // 50 meters

/**
 * Format distance in meters to a clean human-readable string.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m away`;
  }
  return `${(meters / 1000).toFixed(1)} km away`;
}

/**
 * Detects if a police facility is an All-Women / Women's Police Station
 * (Common in India / Tamil Nadu as "AWPS" or "All Women Police Station",
 * and globally as Mahila Thana / Magalir / Women's Police Station).
 */
export function isWomenPoliceStation(name?: string, tags?: Record<string, string>): boolean {
  const combined = `${name || ''} ${tags?.operator || ''} ${tags?.description || ''} ${tags?.alt_name || ''} ${tags?.official_name || ''}`.toLowerCase();
  if (tags?.female === 'yes' || tags?.['operator:type'] === 'all_women' || tags?.women === 'yes') {
    return true;
  }
  return /(all[\s-]women|women[\s-]police|awps|mahila|magalir|vanitha)/i.test(combined);
}

/**
 * Parses structured address components from OpenStreetMap Nominatim reverse geocoding.
 * Strictly adheres to meaningful geographic hierarchy:
 * village -> hamlet -> suburb -> neighbourhood -> town -> city -> municipality -> county -> state_district -> state -> country
 * NEVER assigns road names to locality, city, or district.
 */
function parseNominatimAddress(addr: Record<string, any>, lat: number, lon: number): LocalityDetails {
  // 1. Settlement / neighbourhood level (hyper-local)
  const locality =
    addr.village ||
    addr.hamlet ||
    addr.suburb ||
    addr.neighbourhood ||
    addr.subdivision ||
    addr.quarter ||
    addr.city_district ||
    addr.isolated_dwelling ||
    addr.croft ||
    (addr.town && addr.town !== addr.city ? addr.town : undefined) ||
    undefined;

  // 2. City / municipality level
  const city =
    addr.city ||
    (addr.town && addr.town !== locality ? addr.town : undefined) ||
    addr.municipality ||
    (addr.state_district && addr.state_district !== locality ? addr.state_district : undefined) ||
    (addr.county && addr.county !== locality ? addr.county : undefined) ||
    undefined;

  // 3. District / county level
  const district =
    addr.state_district ||
    addr.county ||
    (addr.district && addr.district !== locality ? addr.district : undefined) ||
    undefined;

  // 4. State / province level
  const region = addr.state || addr.province || addr.region || undefined;

  // 5. Country ISO code
  const countryCode = addr.country_code ? String(addr.country_code).toUpperCase() : undefined;

  // 6. Area display name: Uses locality, city, district, region. Road is only a display fallback.
  const displayLocality = locality || addr.road || addr.street;
  const parts = [displayLocality, city, district, region].filter(Boolean) as string[];
  const areaName = parts.length > 0 ? parts.join(', ') : `Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;

  return {
    areaName,
    locality: locality ? String(locality).trim() : undefined,
    city: city ? String(city).trim() : undefined,
    district: district ? String(district).trim() : undefined,
    region: region ? String(region).trim() : undefined,
    countryCode: countryCode ? String(countryCode).trim() : undefined,
  };
}

/**
 * Fetches OpenStreetMap Nominatim reverse geocoding with strict timeout.
 */
async function fetchNominatimReverse(latitude: number, longitude: number): Promise<LocalityDetails | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500); // 4.5s timeout
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
      {
        headers: { Accept: 'application/json', 'User-Agent': 'SafeHer-AI/1.0 (Safety Zone Service)' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        return parseNominatimAddress(data.address, latitude, longitude);
      }
    }
  } catch {
    // Network or timeout failure in Nominatim reverse geocode
  }
  return null;
}

/**
 * Resolves structured locality details from GPS coordinates via reverse geocoding.
 * Supports mobile (expo-location with Nominatim fallback) and web (Nominatim).
 * Prioritizes meaningful geographic hierarchy without using road names as primary terms.
 */
export async function getLocalityDetails(
  latitude: number,
  longitude: number
): Promise<LocalityDetails> {
  let fallbackAreaName = `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

  if (Platform.OS === 'web') {
    const nominatimDetails = await fetchNominatimReverse(latitude, longitude);
    if (nominatimDetails) {
      return nominatimDetails;
    }
    return { areaName: fallbackAreaName };
  }

  // Native iOS / Android: Use expo-location first
  try {
    const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (addresses && addresses.length > 0) {
      const addr = addresses[0];

      // Exclude road names from locality
      const isRoadLike = (val?: string | null) => {
        if (!val) return false;
        return /\b(road|rd|street|st|avenue|ave|lane|ln|drive|dr|highway|expressway|salai|marg)\b/i.test(val);
      };

      // Extract hierarchy without road pollution
      const localityCandidate = addr.district || (addr.name && !isRoadLike(addr.name) && addr.name !== addr.street ? addr.name : undefined);
      const locality = localityCandidate && localityCandidate !== addr.city ? localityCandidate : undefined;
      const city = addr.city || (addr.subregion && addr.subregion !== locality ? addr.subregion : undefined);
      const district = addr.subregion || (addr.district && addr.district !== locality ? addr.district : undefined);
      const region = addr.region || undefined;
      const countryCode = addr.isoCountryCode ? addr.isoCountryCode.toUpperCase() : undefined;

      const displayLocality = locality || addr.street || addr.name;
      const parts = [displayLocality, city, district, region].filter(Boolean) as string[];
      const areaName = parts.length > 0 ? parts.slice(0, 3).join(', ') : fallbackAreaName;

      // If expo-location gave minimal data (e.g. no locality and no city), try Nominatim fallback
      if (!locality && !city && !district) {
        const nominatimFallback = await fetchNominatimReverse(latitude, longitude);
        if (nominatimFallback) {
          return nominatimFallback;
        }
      }

      return {
        areaName,
        locality: locality?.trim() || undefined,
        city: city?.trim() || undefined,
        district: district?.trim() || undefined,
        region: region?.trim() || undefined,
        countryCode,
      };
    }
  } catch (error) {
    console.log('Native reverse geocoding failed, trying Nominatim fallback:', error);
  }

  // Fallback to Nominatim if native geocoder threw an error or was unavailable
  const nominatimFallback = await fetchNominatimReverse(latitude, longitude);
  if (nominatimFallback) {
    return nominatimFallback;
  }

  return { areaName: fallbackAreaName };
}

/**
 * Resolves a human-readable area name from GPS coordinates via reverse geocoding.
 */
export async function getAreaName(latitude: number, longitude: number): Promise<string> {
  const details = await getLocalityDetails(latitude, longitude);
  return details.areaName;
}

/**
 * Dynamically builds a regional Google News RSS search query using the user's actual location hierarchy.
 * Combines available settlement names (village/suburb/town) with broader administrative names (city/district).
 * Never hardcodes any locality, city, district, or road.
 * Example patterns:
 * - ("{Village/Suburb}" OR "{City/District}") (police OR crime OR accident OR safety OR incident) when:7d
 * - ("Camden" OR "London") (police OR crime OR accident OR safety OR incident) when:7d
 * - "San Francisco" (police OR crime OR accident OR safety OR incident) when:7d
 */
export function buildNewsSearchQuery(localityDetails: LocalityDetails): string | null {
  const { locality, city, district, region } = localityDetails;

  const loc = locality?.trim();
  const cit = city?.trim();
  const dist = district?.trim();
  const reg = region?.trim();

  // Local settlement term (village, hamlet, suburb, neighbourhood, town)
  const localName = loc || (cit && cit !== dist ? cit : undefined);

  // Broader regional administrative term (district, county, city, or state)
  const regionalName = (dist && dist !== localName)
    ? dist
    : (cit && cit !== localName)
    ? cit
    : (reg && reg !== localName)
    ? reg
    : undefined;

  let geoTerm = '';
  if (localName && regionalName && localName.toLowerCase() !== regionalName.toLowerCase()) {
    // Both hyper-local and regional names are available: query both disjunctively
    geoTerm = `("${localName}" OR "${regionalName}")`;
  } else if (localName) {
    geoTerm = `"${localName}"`;
  } else if (regionalName) {
    geoTerm = `"${regionalName}"`;
  } else if (reg) {
    geoTerm = `"${reg}"`;
  } else {
    return null;
  }

  // Balanced safety keyword set for query
  const safetyKeywords = '(police OR crime OR accident OR safety OR incident)';
  return `${geoTerm} ${safetyKeywords} when:7d`;
}

export interface RawRssItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  snippet?: string;
}

/**
 * Parses raw XML from Google News RSS feed without external dependencies.
 */
export function parseGoogleNewsRss(xmlText: string): RawRssItem[] {
  const results: RawRssItem[] = [];

  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  const decodeEntities = (str: string) =>
    str
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ');

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1];

    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/i);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const sourceMatch = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
    const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/i);

    let rawTitle = titleMatch ? titleMatch[1] : '';
    let link = linkMatch ? linkMatch[1] : '';
    let pubDate = pubDateMatch ? pubDateMatch[1] : '';
    let source = sourceMatch ? sourceMatch[1] : '';
    const rawDesc = descMatch ? descMatch[1] : '';

    rawTitle = rawTitle.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
    link = link.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
    pubDate = pubDate.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
    source = source.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();

    let cleanTitle = decodeEntities(rawTitle).trim();
    const cleanSource = decodeEntities(source).trim();

    // In Google News, titles often end with ` - SourceName`. Extract source if missing.
    if (!cleanSource && cleanTitle.includes(' - ')) {
      const parts = cleanTitle.split(' - ');
      source = parts.pop() || 'Regional News';
      cleanTitle = parts.join(' - ').trim();
    }

    const strippedDesc = decodeEntities(rawDesc.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

    if (cleanTitle) {
      results.push({
        title: cleanTitle,
        link,
        pubDate,
        source: cleanSource || source || 'Regional Media',
        snippet: strippedDesc || undefined,
      });
    }
  }

  return results;
}

/**
 * Evaluates whether a news article is genuinely relevant to public and personal safety.
 * Excludes entertainment, sports, corporate stock market, and election campaign noise.
 * Does NOT over-filter legitimate local safety advisories and incidents.
 */
export function isSafetyRelevant(title: string, snippet?: string): boolean {
  const text = `${title} ${snippet || ''}`.toLowerCase();

  // Targeted exclusion patterns for non-safety domains
  const exclusionPatterns = [
    /\b(box office|movie trailer|trailer release|film teaser|ott release|cinema review|actor birthday|actress photoshoot|song promo|teaser out)\b/i,
    /\b(cricket match|ipl score|ipl auction|badminton championship|tennis grand slam|football goal|fifa world cup|world cup qualifier)\b/i,
    /\b(stock market|quarterly profit|quarterly revenue|share price|sensex|nifty|ipo allotment|crypto coin|bitcoin trading|mutual fund)\b/i,
    /\b(election rally|campaigning|bypoll campaign|press briefing by|cabinet reshuffle|seat sharing|manifesto release)\b/i,
  ];

  for (const pattern of exclusionPatterns) {
    if (pattern.test(text)) {
      return false;
    }
  }

  // Comprehensive public safety & personal security keywords
  const safetyKeywords = [
    'police', 'cop', 'patrol', 'advisory', 'alert', 'warning', 'checkpoint',
    'curfew', 'section 144', 'traffic advisory', 'diversion', 'road closure',
    'crowd control', 'stampede', 'evacuation', 'safety', 'emergency',
    'rescue', 'fire', 'accident', 'collision', 'crash', 'mishap',
    'assault', 'harassment', 'eve teasing', 'eve-teasing', 'theft', 'robbery', 'burglary',
    'snatching', 'crime', 'arrest', 'arrested', 'nabbed', 'apprehended', 'bust',
    'investigation', 'fir', 'helpline', 'women safety', 'safe zone', 'women',
    'missing', 'abduction', 'kidnap', 'found dead', 'homicide', 'murder',
    'flood', 'waterlogging', 'landslide', 'disaster', 'shelter', 'hazard',
    'storm', 'cyclone', 'tornado', 'earthquake', 'tsunami',
    'vigilance', 'security', 'law and order', 'public safety', 'emergency services',
    'ambulance', 'hospitalized', 'injured', 'casualty',
  ];

  return safetyKeywords.some(keyword => text.includes(keyword));
}

/**
 * Fetches recent regional public safety news from Google News RSS.
 * - Dynamic regional query based on location hierarchy.
 * - Enforces last 7 days window (with 8-day buffer for timezone differences).
 * - Balanced relevance filtering.
 * - Web calls first-party serverless route (/api/safety-news); Native calls RSS directly.
 */
export async function fetchRegionalSafetyNews(
  localityDetails: LocalityDetails
): Promise<RegionalSafetyNewsData> {
  const query = buildNewsSearchQuery(localityDetails);

  if (!query) {
    return {
      articles: [],
      queryUsed: '',
      fetchedSuccessfully: true,
      noNewsMessage: 'No recent public safety advisories or incidents found for this area in the past 7 days.',
    };
  }

  const countryCode = localityDetails.countryCode || 'IN';
  const hl = countryCode === 'US' ? 'en-US' : countryCode === 'GB' ? 'en-GB' : countryCode === 'CA' ? 'en-CA' : countryCode === 'AU' ? 'en-AU' : 'en-IN';
  const gl = countryCode;
  const ceid = `${countryCode}:en`;

  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

  try {
    let rawItems: RawRssItem[] = [];

    if (Platform.OS === 'web') {
      // In Web, call the first-party serverless API route to eliminate browser CORS restrictions
      const apiUrl = `/api/safety-news?q=${encodeURIComponent(query)}&country=${encodeURIComponent(countryCode)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          articles: [],
          queryUsed: query,
          fetchedSuccessfully: false,
          errorMessage: 'Recent safety news is temporarily unavailable.',
        };
      }

      const json = await response.json();
      rawItems = (json.articles || []) as RawRssItem[];
    } else {
      // In Native iOS/Android, fetch directly from Google News RSS
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          articles: [],
          queryUsed: query,
          fetchedSuccessfully: false,
          errorMessage: 'Recent safety news is temporarily unavailable.',
        };
      }

      const xmlText = await response.text();
      rawItems = parseGoogleNewsRss(xmlText);
    }

    const now = Date.now();
    const maxAgeMs = 8 * 24 * 60 * 60 * 1000; // 8-day threshold for timezone buffer

    const relevantArticles: SafetyNewsItem[] = [];

    for (const raw of rawItems) {
      const pubTime = Date.parse(raw.pubDate);
      if (!isNaN(pubTime) && (now - pubTime) > maxAgeMs) {
        continue;
      }

      if (isSafetyRelevant(raw.title, raw.snippet)) {
        let displayDate = raw.pubDate;
        if (!isNaN(pubTime)) {
          const d = new Date(pubTime);
          displayDate = d.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }

        let cleanSnippet = raw.snippet;
        if (cleanSnippet) {
          const normSnippet = cleanSnippet.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normTitle = raw.title.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normSource = raw.source.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normSnippet === normTitle || normSnippet === `${normTitle}${normSource}`) {
            cleanSnippet = undefined;
          }
        }

        relevantArticles.push({
          id: raw.link || `${raw.title}-${pubTime}`,
          title: raw.title,
          link: raw.link,
          pubDate: displayDate,
          source: raw.source || 'Regional News',
          snippet: cleanSnippet,
          isRelevant: true,
        });
      }
    }

    return {
      articles: relevantArticles.slice(0, 5),
      queryUsed: query,
      fetchedSuccessfully: true,
      noNewsMessage:
        relevantArticles.length === 0
          ? 'No recent public safety advisories or incidents found for this area in the past 7 days.'
          : undefined,
    };
  } catch (err: any) {
    console.log('Error fetching regional safety news feed:', err?.message || err);
    return {
      articles: [],
      queryUsed: query,
      fetchedSuccessfully: false,
      errorMessage: 'Recent safety news is temporarily unavailable.',
    };
  }
}

/**
 * Builds the comprehensive Overpass QL query including both node and way elements
 * for police, medical, fire, transport, and street lighting.
 */
function buildOverpassQuery(lat: number, lon: number, radiusMeters: number): string {
  return `
    [out:json][timeout:9];
    (
      node["amenity"="police"](around:${radiusMeters},${lat},${lon});
      way["amenity"="police"](around:${radiusMeters},${lat},${lon});
      node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      way["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      node["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
      way["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
      node["emergency"="ambulance_station"](around:${radiusMeters},${lat},${lon});
      way["emergency"="ambulance_station"](around:${radiusMeters},${lat},${lon});
      node["amenity"="fire_station"](around:${radiusMeters},${lat},${lon});
      way["amenity"="fire_station"](around:${radiusMeters},${lat},${lon});
      node["railway"="station"](around:${radiusMeters},${lat},${lon});
      way["railway"="station"](around:${radiusMeters},${lat},${lon});
      node["amenity"="bus_station"](around:${radiusMeters},${lat},${lon});
      way["amenity"="bus_station"](around:${radiusMeters},${lat},${lon});
      node["highway"="bus_stop"](around:${radiusMeters},${lat},${lon});
      way["highway"]["lit"](around:500,${lat},${lon});
    );
    out center 75;
  `;
}

/**
 * Lightweight fallback Overpass query focusing strictly on critical emergency facilities.
 */
function buildFallbackOverpassQuery(lat: number, lon: number, radiusMeters: number): string {
  return `
    [out:json][timeout:6];
    (
      node["amenity"="police"](around:${radiusMeters},${lat},${lon});
      way["amenity"="police"](around:${radiusMeters},${lat},${lon});
      node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      way["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      node["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
      way["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
    );
    out center 40;
  `;
}

/**
 * Queries real OpenStreetMap Overpass API for nearby safety-critical infrastructure.
 * - Uses current GPS coordinates dynamically.
 * - Multi-endpoint failover across primary and fallback mirrors.
 * - Correctly parses both node and way/relation elements (center.lat / center.lon).
 * - Never returns fake or hallucinated facilities.
 */
export async function fetchNearbySafetyInfrastructure(
  latitude: number,
  longitude: number,
  searchRadiusMeters: number = 2000
): Promise<SafetyInfrastructureData> {
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  let rawData: any = null;
  let fetchError: string | null = null;

  // 1. Try comprehensive query across available endpoints
  const comprehensiveQuery = buildOverpassQuery(latitude, longitude, searchRadiusMeters);
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7500); // 7.5s per endpoint

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(comprehensiveQuery)}`,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        if (json && Array.isArray(json.elements)) {
          rawData = json;
          break;
        }
      }
    } catch (err: any) {
      fetchError = err?.message || 'Endpoint timeout or network failure';
    }
  }

  // 2. If comprehensive query failed, try lean emergency fallback query
  if (!rawData || !Array.isArray(rawData.elements)) {
    const fallbackQuery = buildFallbackOverpassQuery(latitude, longitude, Math.min(searchRadiusMeters, 1500));
    for (const endpoint of [endpoints[1], endpoints[2], endpoints[0]]) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5500);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(fallbackQuery)}`,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const json = await response.json();
          if (json && Array.isArray(json.elements)) {
            rawData = json;
            break;
          }
        }
      } catch (err: any) {
        fetchError = err?.message || 'Fallback endpoint timeout';
      }
    }
  }

  // 3. If all attempts failed: return clean failure state without fake facilities
  if (!rawData || !Array.isArray(rawData.elements)) {
    return {
      nearbyPoliceStations: [],
      nearbyWomenPoliceStations: [],
      nearbyHospitals: [],
      nearbyTransportHubs: [],
      nearbyLighting: {
        litCount: 0,
        unlitCount: 0,
        summary: 'Lighting data unavailable (network timeout or offline).',
      },
      searchRadiusMeters,
      fetchedSuccessfully: false,
      errorMessage: fetchError ? `Data temporarily unavailable (${fetchError})` : 'Data temporarily unavailable (OpenStreetMap service unreachable).',
    };
  }

  const police: NearbyFacility[] = [];
  const womenPolice: NearbyFacility[] = [];
  const hospitals: NearbyFacility[] = [];
  const transport: NearbyFacility[] = [];
  let litWays = 0;
  let unlitWays = 0;

  for (const el of rawData.elements) {
    // Robust coordinate resolution: node has el.lat / el.lon; way and relation have el.center.lat / el.center.lon
    const lat = typeof el.lat === 'number' ? el.lat : el.center?.lat;
    const lon = typeof el.lon === 'number' ? el.lon : el.center?.lon;
    const tags = el.tags || {};

    // Check street lighting tags
    if (tags.lit === 'yes' || tags.lit === '24/7') {
      litWays++;
    } else if (tags.lit === 'no') {
      unlitWays++;
    }

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      continue;
    }

    // Real distance calculation based on user's actual GPS coordinates
    const distKm = getDistanceKm(latitude, longitude, lat, lon);
    const distanceMeters = Math.round(distKm * 1000);
    const distanceText = formatDistance(distanceMeters);

    // Police Stations & Women's Police Stations
    if (tags.amenity === 'police') {
      const isWomen = isWomenPoliceStation(tags.name, tags);
      const facName = tags.name || (isWomen ? 'All-Women Police Station' : 'Police Station');
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
    }
    // Hospitals, Clinics & Ambulance Stations
    else if (tags.amenity === 'hospital' || tags.amenity === 'clinic' || tags.emergency === 'ambulance_station') {
      const facName = tags.name || (tags.amenity === 'hospital' ? 'Hospital' : tags.emergency === 'ambulance_station' ? 'Ambulance Station' : 'Medical Clinic');
      hospitals.push({
        id: el.id,
        name: facName,
        type: tags.amenity === 'clinic' ? 'clinic' : 'hospital',
        distanceMeters,
        distanceText,
        latitude: lat,
        longitude: lon,
      });
    }
    // Fire Stations
    else if (tags.amenity === 'fire_station') {
      const facName = tags.name || 'Fire Station';
      hospitals.push({
        id: el.id,
        name: facName,
        type: 'other',
        distanceMeters,
        distanceText,
        latitude: lat,
        longitude: lon,
      });
    }
    // Transport Hubs (Railway Stations, Bus Stations, Bus Stops)
    else if (tags.railway === 'station' || tags.amenity === 'bus_station' || tags.highway === 'bus_stop') {
      let defaultLabel = 'Bus Stop';
      if (tags.railway === 'station') defaultLabel = 'Railway Station';
      else if (tags.amenity === 'bus_station') defaultLabel = 'Bus Station';

      const facName = tags.name || defaultLabel;
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

  // Sort facilities by closest proximity
  police.sort((a, b) => a.distanceMeters - b.distanceMeters);
  womenPolice.sort((a, b) => a.distanceMeters - b.distanceMeters);
  hospitals.sort((a, b) => a.distanceMeters - b.distanceMeters);
  transport.sort((a, b) => a.distanceMeters - b.distanceMeters);

  let lightingSummary = 'No street lighting tags recorded within 500m.';
  if (litWays > 0 && unlitWays === 0) {
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
    },
    searchRadiusMeters,
    fetchedSuccessfully: true,
  };
}

/**
 * Analyzes the user's current spatial and environmental safety context.
 * Ingests real OpenStreetMap infrastructure and real Google News RSS articles.
 * Never invents, assumes, or hallucinates fake crime statistics or facilities.
 * Dynamically adapts to any coordinates on Earth.
 */
export async function analyzeSafetyZone(
  latitude: number,
  longitude: number,
  accuracy: number | null,
  forceRefresh: boolean = false
): Promise<SafetyZoneAssessment> {
  const now = Date.now();

  // In-memory proximity cache check: reuse if within 50m and 2 minutes, unless forceRefresh
  if (
    !forceRefresh &&
    lastAssessmentCache &&
    now - lastAssessmentCache.timestamp < CACHE_TTL_MS
  ) {
    const distFromCache = getDistanceKm(
      latitude,
      longitude,
      lastAssessmentCache.latitude,
      lastAssessmentCache.longitude
    );
    if (distFromCache < CACHE_DISTANCE_THRESHOLD_KM) {
      return lastAssessmentCache.assessment;
    }
  }

  const currentDate = new Date();
  const currentHour = currentDate.getHours();
  const isNighttime = currentHour >= 22 || currentHour < 5; // 10 PM - 5 AM
  const timeOfDay = `${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}`;
  const evaluatedAt = currentDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // 1. Resolve structured location & locality details
  const localityDetails = await getLocalityDetails(latitude, longitude);
  const areaName = localityDetails.areaName;

  // 2. Concurrently fetch Layer 1 (OpenStreetMap infrastructure) & Layer 2 (Google News RSS)
  const [infrastructure, safetyNews] = await Promise.all([
    fetchNearbySafetyInfrastructure(latitude, longitude, 2000),
    fetchRegionalSafetyNews(localityDetails),
  ]);

  // 3. Collect verified real local safe places (exclude default demo places)
  let savedPlaces: CustomSafePlace[] = [];
  try {
    const allPlaces = await getCustomSafePlaces();
    savedPlaces = allPlaces.filter(p => !p.id.startsWith('demo-'));
  } catch (err) {
    console.warn('Failed to load saved safe places:', err);
  }

  // 4. Record consulted sources
  const sourcesConsulted = [
    'Device GPS Hardware',
    infrastructure.fetchedSuccessfully
      ? 'OpenStreetMap Overpass API (Real Infrastructure)'
      : 'OpenStreetMap Overpass API (Temporarily Unavailable)',
    safetyNews.fetchedSuccessfully
      ? 'Google News RSS (Recent Public Safety Advisories & Incidents)'
      : 'Google News RSS (Temporarily Unavailable)',
    'Local Environmental Context (Time of Day)',
    savedPlaces.length > 0 ? 'User Verified Safe Places' : null,
  ].filter(Boolean) as string[];

  const noOfficialDataMessage =
    'No official municipal crime blotter connected. Assessment is derived strictly from real OpenStreetMap emergency infrastructure, regional safety news, time of day, and location accuracy.';

  // Build structured summary for Gemini - Layer 1
  const policeSummary = infrastructure.nearbyPoliceStations.length > 0
    ? infrastructure.nearbyPoliceStations.map(p => `${p.name} (${p.distanceText}${p.isAllWomen ? ' - All-Women PS' : ''})`).join(', ')
    : 'No police station mapped within 2 km radius in OpenStreetMap';

  const womenPoliceSummary = infrastructure.nearbyWomenPoliceStations.length > 0
    ? infrastructure.nearbyWomenPoliceStations.map(w => `${w.name} (${w.distanceText})`).join(', ')
    : 'None detected in 2 km radius';

  const hospitalSummary = infrastructure.nearbyHospitals.length > 0
    ? infrastructure.nearbyHospitals.map(h => `${h.name} (${h.distanceText})`).join(', ')
    : 'No hospital or clinic mapped within 2 km radius in OpenStreetMap';

  const transportSummary = infrastructure.nearbyTransportHubs.length > 0
    ? infrastructure.nearbyTransportHubs.map(t => `${t.name} (${t.distanceText})`).join(', ')
    : 'No major transport hubs mapped within 2 km radius in OpenStreetMap';

  // Build structured summary for Gemini - Layer 2 (Up to 4 relevant articles)
  let newsSummaryText = '';
  if (safetyNews.fetchedSuccessfully) {
    if (safetyNews.articles.length > 0) {
      const geminiArticles = safetyNews.articles.slice(0, 4);
      newsSummaryText = geminiArticles
        .map(
          (art, idx) =>
            `- [${idx + 1}] "${art.title}" (Source: ${art.source}, Date: ${art.pubDate})${
              art.snippet ? `\n    Snippet: ${art.snippet}` : ''
            }`
        )
        .join('\n');
    } else {
      newsSummaryText = 'No recent public safety advisories or incidents were found in regional media for this area (past 7 days).';
    }
  } else {
    newsSummaryText = 'Regional safety news feed was temporarily unavailable.';
  }

  // 5. Check for Gemini API key
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (apiKey) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

      const systemInstruction = `You are SafeHer AI's Safety Zone Assessment Engine.
Your task is to analyze the provided REAL spatial, infrastructure, and recent regional safety news context, and return an objective, reassuring, and practical safety evaluation.

INPUT CONTEXT:
- Area Display: ${areaName}
- Locality (Village/Suburb/Neighbourhood): ${localityDetails.locality || 'Not specified'}
- City / Town: ${localityDetails.city || 'Not specified'}
- District / County: ${localityDetails.district || 'Not specified'}
- State / Region: ${localityDetails.region || 'Not specified'}
- Country: ${localityDetails.countryCode || 'Not specified'}
- GPS Coordinates: Latitude ${latitude.toFixed(4)}, Longitude ${longitude.toFixed(4)}
- GPS Accuracy: ${accuracy ? Math.round(accuracy) + ' meters' : 'Moderate'}
- Local Time: ${timeOfDay} (${isNighttime ? 'Nighttime / Low Visibility' : 'Daylight Hours'})
- User-Saved Safe Havens: ${savedPlaces.length} registered

REAL OPENSTREETMAP SAFETY INFRASTRUCTURE (2000m Radius - Layer 1):
- Police Stations: ${policeSummary}
- All-Women Police Stations: ${womenPoliceSummary}
- Hospitals & Emergency Clinics: ${hospitalSummary}
- Transport Hubs: ${transportSummary}
- Street Lighting Context: ${infrastructure.nearbyLighting.summary}

REAL RECENT REGIONAL SAFETY NEWS (Layer 2 - Past 7 Days via Google News RSS):
${newsSummaryText}

CRITICAL RULES:
1. Synthesize BOTH the OpenStreetMap infrastructure data AND the recent regional safety news context together with local time, day/night visibility, and GPS accuracy.
2. DO NOT make safety decisions from locality or area name alone.
3. DO NOT claim that an area is safe simply because a police station or hospital is nearby. Proximity to facilities provides emergency recourse and response buffering, but personal awareness is always advised.
4. DO NOT claim that an area is dangerous simply because infrastructure is missing or not mapped in OpenStreetMap.
5. REGIONAL SAFETY NEWS RULES:
   - A single news headline must NOT automatically mean that the entire area or neighborhood is dangerous. News reports isolated occurrences or advisories.
   - If there are no relevant recent articles (or if news context indicates none were found), explicitly state in your reason: "No recent public safety advisories or incidents found for this area in the past 7 days."
   - DO NOT interpret "no news" as proof that the area is definitely safe.
   - Never invent, assume, or hallucinate crime statistics, numbers, or incidents.
6. Your safetyLevel must be one of:
   - "lower_concern": Daytime with accessible infrastructure, active transit, or close emergency services, with no active emergency advisories.
   - "caution": Late night hours (10 PM - 5 AM), low lighting, isolated areas, long distance from emergency facilities, or minor crowd/traffic/safety advisories.
   - "higher_concern": Extreme risk combination (e.g. late night + isolated + no emergency facilities nearby, or urgent active safety advisory in immediate vicinity).
7. "shortReason": A concise 1-2 sentence explanation reflecting the REAL infrastructure, temporal context, and regional safety news context.
8. "recommendation": A practical, realistic safety recommendation.
9. Return ONLY a valid raw JSON object matching the schema below. Do not wrap in markdown backticks.

JSON Schema:
{
  "safetyLevel": "lower_concern" | "caution" | "higher_concern",
  "shortReason": "string",
  "recommendation": "string"
}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `Analyze safety context for ${areaName} (Lat ${latitude.toFixed(4)}, Lon ${longitude.toFixed(4)}) based on available infrastructure data and recent regional safety news.` }],
            },
          ],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      if (response.ok) {
        const resultJson = await response.json();
        const rawText = resultJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText.trim());
          const validLevels: SafetyLevel[] = ['lower_concern', 'caution', 'higher_concern'];
          const finalLevel: SafetyLevel = validLevels.includes(parsed.safetyLevel)
            ? parsed.safetyLevel
            : isNighttime
              ? 'caution'
              : 'lower_concern';

          const assessment: SafetyZoneAssessment = {
            safetyLevel: finalLevel,
            shortReason: parsed.shortReason || (isNighttime ? 'Late night hours present reduced natural lighting.' : 'Daytime hours with active surrounding transit.'),
            recommendation: parsed.recommendation || 'Stay alert and keep emergency contacts easily accessible.',
            areaName,
            evaluatedAt,
            isLocal: false,
            infrastructure,
            safetyNews,
            dataSourceInfo: {
              officialIncidentDataAvailable: false,
              infrastructureDataAvailable: infrastructure.fetchedSuccessfully,
              newsDataAvailable: safetyNews.fetchedSuccessfully && safetyNews.articles.length > 0,
              message: noOfficialDataMessage,
              sourcesConsulted,
            },
            contextualFactors: {
              timeOfDay,
              isNighttime,
              accuracyMeters: accuracy,
              coordinates: { latitude, longitude },
              verifiedSafePlacesCount: savedPlaces.length,
            },
          };

          lastAssessmentCache = {
            latitude,
            longitude,
            timestamp: Date.now(),
            assessment,
          };

          return assessment;
        }
      }
    } catch (apiError) {
      console.log('Gemini API call failed for Safety Zone, using local rule fallback:', apiError);
    }
  }

  // 6. Local Rule-Based Engine (Offline or no Gemini API key)
  const closestPolice = infrastructure.nearbyPoliceStations[0];
  const closestHospital = infrastructure.nearbyHospitals[0];

  let localReason = '';
  let localRec = '';
  let localLevel: SafetyLevel = 'lower_concern';

  if (isNighttime) {
    localLevel = 'caution';
    localReason = `Late-night hours in effect (${timeOfDay}). Reduced natural visibility.`;
    if (closestPolice) {
      localReason += ` Closest police station is ${closestPolice.name} (${closestPolice.distanceText}).`;
    } else {
      localReason += ` No police stations detected within 2 km.`;
    }
    localRec = 'Walk along well-lit primary corridors, avoid isolated shortcuts, and consider sharing your live location with trusted contacts.';
  } else {
    localLevel = 'lower_concern';
    localReason = `Daytime conditions with regular transit activity.`;
    if (closestPolice) {
      localReason += ` Nearby emergency response: ${closestPolice.name} is ${closestPolice.distanceText}.`;
    }
    if (closestHospital) {
      localReason += ` Medical facility ${closestHospital.name} is ${closestHospital.distanceText}.`;
    }
    localRec = 'Standard safety awareness recommended. Keep your device accessible and stay observant.';
  }

  // Synthesize regional news into local rule reason
  if (safetyNews.fetchedSuccessfully && safetyNews.articles.length > 0) {
    localReason += ` Regional advisory: "${safetyNews.articles[0].title}".`;
  } else if (safetyNews.fetchedSuccessfully && safetyNews.articles.length === 0) {
    localReason += ` No recent public safety advisories or incidents found for this area in the past 7 days.`;
  }

  const localAssessment: SafetyZoneAssessment = {
    safetyLevel: localLevel,
    shortReason: localReason,
    recommendation: localRec,
    areaName,
    evaluatedAt,
    isLocal: true,
    infrastructure,
    safetyNews,
    dataSourceInfo: {
      officialIncidentDataAvailable: false,
      infrastructureDataAvailable: infrastructure.fetchedSuccessfully,
      newsDataAvailable: safetyNews.fetchedSuccessfully && safetyNews.articles.length > 0,
      message: noOfficialDataMessage,
      sourcesConsulted,
    },
    contextualFactors: {
      timeOfDay,
      isNighttime,
      accuracyMeters: accuracy,
      coordinates: { latitude, longitude },
      verifiedSafePlacesCount: savedPlaces.length,
    },
  };

  lastAssessmentCache = {
    latitude,
    longitude,
    timestamp: Date.now(),
    assessment: localAssessment,
  };

  return localAssessment;
}
