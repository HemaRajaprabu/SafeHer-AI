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
  locality?: string;
  city?: string;
  district?: string;
  region?: string;
  countryCode?: string;
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
 * (Common in India / Tamil Nadu as "AWPS" or "All Women Police Station").
 */
function isWomenPoliceStation(name?: string, tags?: Record<string, string>): boolean {
  const combined = `${name || ''} ${tags?.operator || ''} ${tags?.description || ''} ${tags?.alt_name || ''}`.toLowerCase();
  if (tags?.female === 'yes' || tags?.['operator:type'] === 'all_women') {
    return true;
  }
  return /(all[\s-]women|women[\s-]police|awps|mahila|magalir)/i.test(combined);
}

/**
 * Resolves structured locality details from GPS coordinates via reverse geocoding.
 * Supports mobile (expo-location) and web (OpenStreetMap Nominatim fallback).
 */
export async function getLocalityDetails(
  latitude: number,
  longitude: number
): Promise<LocalityDetails> {
  let areaName = `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`;
  let locality: string | undefined;
  let city: string | undefined;
  let district: string | undefined;
  let region: string | undefined;
  let countryCode: string | undefined;

  if (Platform.OS === 'web') {
    try {
      // Lightweight OpenStreetMap Nominatim reverse geocode for Web environment
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        {
          headers: { Accept: 'application/json', 'User-Agent': 'SafeHer-AI' },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        // Hierarchy prioritizing village / hamlet / suburb / neighbourhood / town / county over road
        // Avoids road names (e.g. "Kottanathampatti - Kodukkampatti Road") becoming the primary query term
        locality =
          addr.village ||
          addr.hamlet ||
          addr.suburb ||
          addr.neighbourhood ||
          addr.isolated_dwelling ||
          addr.town ||
          addr.county ||
          undefined;

        city =
          addr.city ||
          (addr.town && addr.town !== locality ? addr.town : undefined) ||
          addr.municipality ||
          (addr.state_district && addr.state_district !== locality ? addr.state_district : undefined) ||
          undefined;

        district = addr.state_district || addr.county || undefined;
        region = addr.state || undefined;
        countryCode = addr.country_code ? addr.country_code.toUpperCase() : undefined;

        // For human-readable areaName display: show locality/road, city, and region
        const displayLocality = locality || addr.road;
        const parts = [displayLocality, city, region].filter(Boolean) as string[];
        if (parts.length > 0) {
          areaName = parts.join(', ');
        }
      }
    } catch {
      areaName = `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
  } else {
    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addresses && addresses.length > 0) {
        const addr = addresses[0];
        const parts: string[] = [];

        if (addr.name && addr.name !== addr.street) {
          parts.push(addr.name);
        }
        if (addr.street) {
          parts.push(addr.street);
        }
        if (addr.district || addr.subregion) {
          const loc = addr.district || addr.subregion;
          if (loc && !parts.includes(loc)) {
            parts.push(loc);
          }
        }
        if (addr.city && !parts.includes(addr.city)) {
          parts.push(addr.city);
        }
        if (addr.region && !parts.includes(addr.region)) {
          parts.push(addr.region);
        }

        if (parts.length > 0) {
          areaName = parts.slice(0, 3).join(', ');
        }

        locality = addr.district || addr.subregion || (addr.name !== addr.street ? addr.name : undefined) || undefined;
        city = addr.city || addr.subregion || undefined;
        district = addr.district || undefined;
        region = addr.region || undefined;
        countryCode = addr.isoCountryCode || undefined;
      }
    } catch (error) {
      console.log('Reverse geocoding error:', error);
    }
  }

  return {
    areaName,
    locality,
    city,
    district,
    region,
    countryCode,
  };
}

/**
 * Resolves a human-readable area name from GPS coordinates via reverse geocoding.
 */
export async function getAreaName(latitude: number, longitude: number): Promise<string> {
  const details = await getLocalityDetails(latitude, longitude);
  return details.areaName;
}

/**
 * Dynamically builds a Google News RSS search query using the user's actual locality/city.
 * Pattern: {Locality} {City} police OR safety OR incident when:7d
 * Never hardcodes any municipality or locality.
 */
export function buildNewsSearchQuery(localityDetails: LocalityDetails): string | null {
  const { locality, city, district, region } = localityDetails;

  const loc = locality?.trim();
  const cit = city?.trim();
  const dist = district?.trim();
  const reg = region?.trim();

  const locationParts: string[] = [];

  if (loc) {
    locationParts.push(loc);
  }
  if (cit && cit.toLowerCase() !== loc?.toLowerCase()) {
    locationParts.push(cit);
  } else if (!cit && dist && dist.toLowerCase() !== loc?.toLowerCase()) {
    locationParts.push(dist);
  }

  // If neither locality nor city could be found, fall back to region
  if (locationParts.length === 0 && reg) {
    locationParts.push(reg);
  }

  if (locationParts.length === 0) {
    return null;
  }

  const locationQuery = locationParts.join(' ');
  return `${locationQuery} police OR safety OR incident when:7d`;
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

    // In Google News, titles often end with ` - SourceName`. If source is missing from <source>, extract it.
    if (!cleanSource && cleanTitle.includes(' - ')) {
      const parts = cleanTitle.split(' - ');
      source = parts.pop() || 'Regional News';
      cleanTitle = parts.join(' - ').trim();
    }

    // Strip HTML tags from description and clean up
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
 * Evaluates whether a news article is genuinely relevant to public/local safety.
 * Filters out unrelated political maneuvering, entertainment, sports, and business news.
 */
export function isSafetyRelevant(title: string, snippet?: string): boolean {
  const text = `${title} ${snippet || ''}`.toLowerCase();

  // Exclusion patterns: topics that often mention "police" or "incident" in unrelated contexts
  const exclusionPatterns = [
    /\b(movie|film|trailer|teaser|box office|actor|actress|bollywood|kollywood|hollywood|ott release|cinema)\b/i,
    /\b(cricket|ipl|match|tournament|trophy|goal|wicket|badminton|tennis)\b/i,
    /\b(stock|shares|sensex|nifty|market cap|quarterly profit|revenue surge|ipo|crypto|bitcoin)\b/i,
    /\b(election rally|campaigning|bypoll|press conference|mla seat|cabinet reshuffle)\b/i,
    /\b(anti-corruption bureau|vigilance raid|ed raid|cbi court|disproportionate assets|income tax raid)\b/i,
  ];

  for (const pattern of exclusionPatterns) {
    if (pattern.test(text)) {
      return false;
    }
  }

  // Positive relevance keywords for public and personal street safety
  const safetyKeywords = [
    'police', 'cop', 'patrol', 'advisory', 'alert', 'warning', 'checkpoint',
    'curfew', 'section 144', 'traffic advisory', 'diversion', 'road closure',
    'crowd control', 'stampede', 'evacuation', 'safety', 'emergency',
    'rescue', 'fire', 'accident', 'collision', 'crash', 'mishap',
    'assault', 'harassment', 'eve-teasing', 'theft', 'robbery', 'burglary',
    'snatching', 'crime', 'arrest', 'nabbed', 'apprehended', 'bust',
    'investigation', 'fir', 'helpline', 'women safety', 'safe zone',
    'flood', 'waterlogging', 'landslide', 'disaster', 'shelter', 'hazard',
    'vigilance', 'security', 'law and order',
  ];

  return safetyKeywords.some(keyword => text.includes(keyword));
}

/**
 * Fetches recent regional public safety news from Google News RSS.
 * - Dynamically searches by locality and city
 * - Filters for articles in the last 7 days
 * - Strict relevance filtering for safety-critical information
 * - Limits articles returned to a small, relevant set (up to 5 for UI, 2-4 for AI)
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
  const hl = countryCode === 'US' ? 'en-US' : countryCode === 'GB' ? 'en-GB' : 'en-IN';
  const gl = countryCode;
  const ceid = `${countryCode}:en`;

  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

  try {
    let rawItems: RawRssItem[] = [];

    if (Platform.OS === 'web') {
      // In Web, call the first-party serverless API route to eliminate browser CORS restrictions
      const apiUrl = `/api/safety-news?q=${encodeURIComponent(query)}&country=${encodeURIComponent(countryCode)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 sec timeout

      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
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

      const json = await response.json();
      rawItems = (json.articles || []) as RawRssItem[];
    } else {
      // In Native iOS/Android, fetch directly from Google News RSS (no browser CORS)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 sec timeout

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
          // Omit snippet if it is just a mirror of the title and publication name
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
 * Queries the real OpenStreetMap Overpass API for nearby safety-critical infrastructure:
 * - Police stations & All-Women Police Stations
 * - Hospitals & medical facilities
 * - Major transport hubs
 * - Street lighting indications
 */
export async function fetchNearbySafetyInfrastructure(
  latitude: number,
  longitude: number,
  searchRadiusMeters: number = 2000
): Promise<SafetyInfrastructureData> {
  const query = `
    [out:json][timeout:10];
    (
      node["amenity"="police"](around:${searchRadiusMeters},${latitude},${longitude});
      way["amenity"="police"](around:${searchRadiusMeters},${latitude},${longitude});
      node["amenity"="hospital"](around:${searchRadiusMeters},${latitude},${longitude});
      way["amenity"="hospital"](around:${searchRadiusMeters},${latitude},${longitude});
      node["amenity"="clinic"](around:${searchRadiusMeters},${latitude},${longitude});
      node["emergency"="ambulance_station"](around:${searchRadiusMeters},${latitude},${longitude});
      node["railway"="station"](around:${searchRadiusMeters},${latitude},${longitude});
      node["amenity"="bus_station"](around:${searchRadiusMeters},${latitude},${longitude});
      node["highway"="bus_stop"](around:${searchRadiusMeters},${latitude},${longitude});
      way["highway"]["lit"](around:500,${latitude},${longitude});
    );
    out center 45;
  `;

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
  ];

  let rawData: any = null;
  let fetchError: string | null = null;

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000); // 9 sec timeout

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        rawData = await response.json();
        break;
      }
    } catch (err: any) {
      fetchError = err?.message || 'Network timeout querying Overpass';
    }
  }

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
      errorMessage: fetchError || 'Unable to load real-time OpenStreetMap safety infrastructure.',
    };
  }

  const police: NearbyFacility[] = [];
  const womenPolice: NearbyFacility[] = [];
  const hospitals: NearbyFacility[] = [];
  const transport: NearbyFacility[] = [];
  let litWays = 0;
  let unlitWays = 0;

  for (const el of rawData.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const tags = el.tags || {};

    // Check lighting tags
    if (tags.lit === 'yes' || tags.lit === '24/7') {
      litWays++;
    } else if (tags.lit === 'no') {
      unlitWays++;
    }

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      continue;
    }

    const distKm = getDistanceKm(latitude, longitude, lat, lon);
    const distanceMeters = Math.round(distKm * 1000);
    const distanceText = formatDistance(distanceMeters);

    // Police Stations
    if (tags.amenity === 'police') {
      const isWomen = isWomenPoliceStation(tags.name, tags);
      const facName = tags.name || (isWomen ? "All-Women Police Station" : "Police Station");
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
    // Hospitals & Medical
    else if (tags.amenity === 'hospital' || tags.amenity === 'clinic' || tags.emergency === 'ambulance_station') {
      const facName = tags.name || (tags.amenity === 'hospital' ? 'Hospital' : 'Medical Clinic');
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
    // Transport Hubs
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

  // Sort by closest proximity
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
 * Adheres strictly to the rule: NEVER hallucinate fake crime statistics.
 * Ingests REAL OpenStreetMap infrastructure data.
 */
export async function analyzeSafetyZone(
  latitude: number,
  longitude: number,
  accuracy: number | null
): Promise<SafetyZoneAssessment> {
  const evaluatedAt = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const now = new Date();
  const currentHour = now.getHours();
  const isNighttime = currentHour >= 22 || currentHour < 5; // 10 PM - 5 AM
  const timeOfDay = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  // 1. Resolve structured location & locality details
  const localityDetails = await getLocalityDetails(latitude, longitude);
  const areaName = localityDetails.areaName;

  // 2. Concurrently fetch Layer 1 (OpenStreetMap infrastructure) & Layer 2 (Google News RSS)
  const [infrastructure, safetyNews] = await Promise.all([
    fetchNearbySafetyInfrastructure(latitude, longitude, 2000),
    fetchRegionalSafetyNews(localityDetails),
  ]);

  // 3. Collect verified real local safe places
  let savedPlaces: CustomSafePlace[] = [];
  try {
    savedPlaces = await getCustomSafePlaces();
  } catch (err) {
    console.warn('Failed to load saved safe places in safety zone analysis:', err);
  }

  // 4. Record consulted sources
  const sourcesConsulted = [
    'Device GPS Hardware',
    'OpenStreetMap Overpass API (Real Infrastructure)',
    safetyNews.fetchedSuccessfully
      ? 'Google News RSS (Recent Public Safety Advisories & Incidents)'
      : 'Google News RSS (Attempted - Temporarily Unavailable)',
    'Local Environmental Context (Time of Day)',
    savedPlaces.length > 0 ? 'User Verified Safe Places' : null,
  ].filter(Boolean) as string[];

  const noOfficialDataMessage =
    'No official municipal crime blotter connected. Assessment is derived strictly from real OpenStreetMap emergency infrastructure, regional safety news, time of day, and location accuracy.';

  // Build structured summary for Gemini - Layer 1
  const policeSummary = infrastructure.nearbyPoliceStations.length > 0
    ? infrastructure.nearbyPoliceStations.map(p => `${p.name} (${p.distanceText}${p.isAllWomen ? ' - All-Women PS' : ''})`).join(', ')
    : 'No police station found within 2 km radius';

  const hospitalSummary = infrastructure.nearbyHospitals.length > 0
    ? infrastructure.nearbyHospitals.map(h => `${h.name} (${h.distanceText})`).join(', ')
    : 'No hospital found within 2 km radius';

  const transportSummary = infrastructure.nearbyTransportHubs.length > 0
    ? infrastructure.nearbyTransportHubs.map(t => `${t.name} (${t.distanceText})`).join(', ')
    : 'No major transport hubs found within 2 km radius';

  // Build structured summary for Gemini - Layer 2 (2-4 relevant articles)
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
    newsSummaryText = 'Regional safety news feed was temporarily unavailable. Rely strictly on infrastructure, time of day, and environmental context.';
  }

  // 5. Check for Gemini API key
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (apiKey) {
    try {
      const roundedLat = Math.round(latitude * 1000) / 1000;
      const roundedLon = Math.round(longitude * 1000) / 1000;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

      const systemInstruction = `You are SafeHer AI's Safety Zone Assessment Engine.
Your task is to analyze the provided REAL spatial, infrastructure, and recent regional safety news context, and return an objective, reassuring, and practical safety evaluation.

INPUT CONTEXT:
- Area / Locality: ${areaName}
- Generalized Coordinates: Latitude ${roundedLat}, Longitude ${roundedLon}
- Local Time: ${timeOfDay} (${isNighttime ? 'Nighttime / Low Visibility' : 'Daylight Hours'})
- GPS Accuracy: ${accuracy ? Math.round(accuracy) + ' meters' : 'Moderate'}
- User-Saved Safe Havens: ${savedPlaces.length} registered

REAL OPENSTREETMAP SAFETY INFRASTRUCTURE (2000m Radius - Layer 1):
- Police Stations: ${policeSummary}
- All-Women Police Stations: ${infrastructure.nearbyWomenPoliceStations.length > 0 ? infrastructure.nearbyWomenPoliceStations.map(w => `${w.name} (${w.distanceText})`).join(', ') : 'None detected in 2 km radius'}
- Hospitals & Emergency Clinics: ${hospitalSummary}
- Transport Hubs: ${transportSummary}
- Street Lighting Context: ${infrastructure.nearbyLighting.summary}

REAL RECENT REGIONAL SAFETY NEWS (Layer 2 - Past 7 Days via Google News RSS):
${newsSummaryText}

CRITICAL RULES:
1. Synthesize BOTH the OpenStreetMap infrastructure data AND the recent regional safety news context together with local time, day/night visibility, and GPS accuracy.
2. Nearby emergency facilities alone must NOT be treated as proof that an area is definitely safe or dangerous.
3. The presence of nearby police stations or hospitals provides emergency recourse and safety buffering; their absence means emergency response may take longer.
4. REGIONAL SAFETY NEWS RULES:
   - A single news headline must NOT automatically mean that the entire area or neighborhood is dangerous. News reports isolated occurrences or advisories.
   - If there are no relevant recent articles (or if news context indicates none were found), explicitly state in your reason: "No recent public safety advisories or incidents were found in regional media for this area (past 7 days)."
   - Do NOT interpret "no news" as proof that the area is definitely safe.
   - Never invent, assume, or hallucinate crime statistics, numbers, or incidents.
   - Never claim an area is definitely safe or definitely dangerous.
5. Your safetyLevel must be one of:
   - "lower_concern": Daytime with accessible infrastructure, active transit, or close emergency services, with no active emergency advisories.
   - "caution": Late night hours (10 PM - 5 AM), low lighting, isolated areas, long distance from emergency facilities, or minor crowd/traffic/safety advisories.
   - "higher_concern": Extreme risk combination (e.g. late night + isolated + no emergency facilities nearby, or urgent active safety advisory in immediate vicinity).
6. "shortReason": A concise 1-2 sentence explanation reflecting the REAL infrastructure, temporal context, and regional safety news context.
7. "recommendation": A practical, realistic safety recommendation.
8. Return ONLY a valid raw JSON object matching the schema below. Do not wrap in markdown backticks.

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
              parts: [{ text: `Analyze safety context for ${areaName} based on available infrastructure data and recent regional safety news.` }],
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

          return {
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
    localReason += ` No recent public safety advisories or incidents were found in regional media for this area (past 7 days).`;
  }

  return {
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
}
