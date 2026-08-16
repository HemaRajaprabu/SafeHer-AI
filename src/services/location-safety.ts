import AsyncStorage from '@react-native-async-storage/async-storage';

export type LocationSafetyLevel = 'safe' | 'caution' | 'high';

export interface LocationSafetyResult {
  safetyLevel: LocationSafetyLevel;
  riskScore: number;
  reasons: string[];
  recommendation: string;
  isLocal: boolean;
  assessmentType: 'safe_place' | 'local_rules' | 'ai_generated' | 'fallback';
}

export interface CustomSafePlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

// Default demo safe place (e.g. Googleplex / Android Emulator default coordinate)
const DEFAULT_SAFE_PLACES: CustomSafePlace[] = [
  {
    id: 'demo-googleplex',
    name: 'Safe Haven (Demo)',
    latitude: 37.422,
    longitude: -122.084,
  },
  {
    id: 'demo-sf',
    name: 'Safe Hub (SF)',
    latitude: 37.78825,
    longitude: -122.4324,
  }
];

// Helper to compute distance in km using Haversine formula
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

// Retrieve custom saved safe places from AsyncStorage (falling back to default demo places)
export async function getCustomSafePlaces(): Promise<CustomSafePlace[]> {
  try {
    const saved = await AsyncStorage.getItem('savedSafePlaces');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load saved safe places:', e);
  }
  return DEFAULT_SAFE_PLACES;
}

// Add a custom safe place
export async function saveCustomSafePlace(name: string, latitude: number, longitude: number): Promise<CustomSafePlace> {
  const newPlace: CustomSafePlace = {
    id: Date.now().toString(),
    name,
    latitude,
    longitude,
  };
  try {
    const current = await getCustomSafePlaces();
    const updated = [...current, newPlace];
    await AsyncStorage.setItem('savedSafePlaces', JSON.stringify(updated));
    return newPlace;
  } catch (e) {
    console.error('Failed to save custom safe place:', e);
    throw e;
  }
}

// Main safety evaluation service
export async function evaluateLocationSafety(
  latitude: number,
  longitude: number
): Promise<LocationSafetyResult> {
  // 1. Check proximity to saved custom safe places (within 150 meters)
  try {
    const savedPlaces = await getCustomSafePlaces();
    for (const place of savedPlaces) {
      const distance = getDistanceKm(latitude, longitude, place.latitude, place.longitude);
      if (distance <= 0.150) { // 150 meters
        return {
          safetyLevel: 'safe',
          riskScore: 10,
          reasons: ["You're near a saved safe place."],
          recommendation: 'You are in a recognized safe location. Continue to monitor your surroundings.',
          isLocal: true,
          assessmentType: 'safe_place',
        };
      }
    }
  } catch (e) {
    console.warn('Error reading saved safe places during safety evaluation:', e);
  }

  // 2. Check proximity to Overpass API dynamic safe places (if online and platform permits)
  const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
  if (!isWeb) {
    try {
      const radiusMeters = 150; // 150m proximity
      const query = `
        [out:json][timeout:5];
        (
          node["amenity"="police"](around:${radiusMeters},${latitude},${longitude});
          node["amenity"="hospital"](around:${radiusMeters},${latitude},${longitude});
          node["amenity"="fire_station"](around:${latitude},${longitude});
        );
        out body 1;
      `;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 sec timeout for OSM API

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.elements && data.elements.length > 0) {
          const element = data.elements[0];
          const type = element.tags?.amenity || 'emergency facility';
          const name = element.tags?.name || type.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          return {
            safetyLevel: 'safe',
            riskScore: 15,
            reasons: [`You are near a public safety spot (${name}).`],
            recommendation: 'Proximity to emergency services provides a safety buffer. Remain alert.',
            isLocal: false,
            assessmentType: 'safe_place',
          };
        }
      }
    } catch (e) {
      console.log('Skipping Overpass proximity check (offline or timeout):', e);
    }
  }

  // 3. Attempt Gemini AI Location Safety Analysis (if online and API key is set)
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (apiKey) {
    try {
      // Round coordinates to 3 decimal places (~110m resolution) to protect user privacy
      const roundedLat = Math.round(latitude * 1000) / 1000;
      const roundedLon = Math.round(longitude * 1000) / 1000;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
      const systemInstruction = `You are SafeHer AI, a safety assistant.
Analyze the typical general safety profile for coordinates: Latitude ${roundedLat}, Longitude ${roundedLon}.

CRITICAL REQUIREMENTS:
- Provide an objective location risk assessment based on generalized area attributes (e.g. commercial area, park, transit hub, industrial zone, residential area, etc.).
- NEVER falsely guarantee absolute safety or present assumptions as absolute facts.
- Do NOT invent specific crime statistics, numbers, or claim unsupported facts.
- Return ONLY a raw JSON object matching the schema below. No markdown formatting, no code blocks. Just the JSON.

JSON Schema:
{
  "safetyLevel": "safe" | "caution" | "high",
  "riskScore": number (0 to 100),
  "reasons": ["short reason 1", "short reason 2"],
  "recommendation": "direct safety recommendation"
}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `Analyze the safety level of: Latitude ${roundedLat}, Longitude ${roundedLon}` }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      if (response.ok) {
        const resultJson = await response.json();
        const text = resultJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text.trim());
          // Standardize fields to avoid any missing data
          return {
            safetyLevel: parsed.safetyLevel || 'safe',
            riskScore: typeof parsed.riskScore === 'number' ? parsed.riskScore : 25,
            reasons: Array.isArray(parsed.reasons) ? parsed.reasons : ['Analyzed using regional spatial context.'],
            recommendation: parsed.recommendation || 'Continue to stay alert to your surroundings.',
            isLocal: false,
            assessmentType: 'ai_generated',
          };
        }
      }
    } catch (e) {
      console.log('Gemini AI Location Safety analysis failed (falling back to local rules):', e);
    }
  }

  // 4. Local Rules-Based Fallback (Offline Mode)
  const currentHour = new Date().getHours();
  const isNighttime = currentHour >= 22 || currentHour < 5; // 10 PM to 5 AM

  if (isNighttime) {
    return {
      safetyLevel: 'caution',
      riskScore: 45,
      reasons: [
        'Late-night hours in effect (10 PM - 5 AM).',
        'Local fallback assessment: Reduced visibility and lower activity levels increase general safety risks.'
      ],
      recommendation: 'Stay in well-lit, populated areas and keep emergency shortcuts ready.',
      isLocal: true,
      assessmentType: 'local_rules',
    };
  }

  return {
    safetyLevel: 'safe',
    riskScore: 25,
    reasons: [
      'Daytime hours in effect.',
      'Local fallback assessment: No immediate safety risk flags detected for this area.'
    ],
    recommendation: 'Standard safety parameters active. Remain aware of your environment.',
    isLocal: true,
    assessmentType: 'fallback',
  };
}
