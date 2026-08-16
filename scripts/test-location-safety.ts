// Define mock window global for AsyncStorage under Node
(global as any).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  }
};

// 1. Mock Node's module loading system for react-native and async-storage
const Module = require('module');
const originalRequire = Module.prototype.require;

const asyncStorageStore: Record<string, string> = {};

Module.prototype.require = function (id: string) {
  if (id === 'react-native') {
    return {
      Platform: { OS: 'android' }
    };
  }
  if (id === '@react-native-async-storage/async-storage') {
    const mockStorage = {
      getItem: async (key: string) => {
        return asyncStorageStore[key] || null;
      },
      setItem: async (key: string, value: string) => {
        asyncStorageStore[key] = value;
      },
      removeItem: async (key: string) => {
        delete asyncStorageStore[key];
      }
    };
    return {
      ...mockStorage,
      default: mockStorage
    };
  }
  return originalRequire.apply(this, arguments);
};

// Mock fetch globally
const originalFetch = (global as any).fetch;
let mockFetchHandler: ((url: string, init?: any) => Promise<any>) | null = null;

(global as any).fetch = async (url: string, init?: any) => {
  if (mockFetchHandler) {
    return mockFetchHandler(url, init);
  }
  if (originalFetch) {
    return originalFetch(url, init);
  }
  throw new Error(`No mock fetch handler or original fetch for url: ${url}`);
};

// Mock Date globally for Daytime/Nighttime testing
const originalDate = global.Date;
let mockedHour: number | null = null;

class MockedDate extends originalDate {
  constructor(...args: any[]) {
    if (args.length === 0) {
      super();
    } else {
      super(...(args as [any]));
    }
  }
  getHours() {
    return mockedHour !== null ? mockedHour : super.getHours();
  }
}

function setMockedHour(hour: number | null) {
  mockedHour = hour;
  if (hour !== null) {
    (global as any).Date = MockedDate;
  } else {
    (global as any).Date = originalDate;
  }
}

// 2. Import the service after mocking
import { evaluateLocationSafety, getDistanceKm } from '../src/services/location-safety';

async function runTests() {
  console.log('--- STARTING LOCATION SAFETY SERVICE TESTS ---');

  // Test Case 1: Proximity to Saved Safe Place -> SAFE
  console.log('\n[TEST 1] Testing proximity to a saved Safe Place...');
  // Save a mock safe place in AsyncStorage
  asyncStorageStore['savedSafePlaces'] = JSON.stringify([
    {
      id: 'test-safe-1',
      name: 'Safe Zone Alpha',
      latitude: 34.0522,
      longitude: -118.2437
    }
  ]);

  // Evaluate coordinate (within 150m of 34.0522, -118.2437)
  const result1 = await evaluateLocationSafety(34.05225, -118.24375); // ~8 meters
  console.log('Result:', JSON.stringify(result1, null, 2));
  if (result1.safetyLevel === 'safe' && result1.assessmentType === 'safe_place' && result1.reasons.includes("You're near a saved safe place.")) {
    console.log('✅ TEST 1 PASSED: Correctly identified as near a saved safe place.');
  } else {
    console.error('❌ TEST 1 FAILED!');
  }

  // Clear AsyncStorage mock for subsequent tests
  delete asyncStorageStore['savedSafePlaces'];

  // Test Case 2: Low-risk daytime fallback (Offline / No API Key) -> SAFE
  console.log('\n[TEST 2] Testing daytime local fallback (Offline/No API key)...');
  process.env.EXPO_PUBLIC_GEMINI_API_KEY = ''; // Disable API Key
  setMockedHour(12); // Mock 12:00 PM (Noon)
  mockFetchHandler = async () => { throw new Error('Network error'); }; // Mock Overpass API to fail

  const result2 = await evaluateLocationSafety(37.5, -122.1);
  console.log('Result:', JSON.stringify(result2, null, 2));
  if (result2.safetyLevel === 'safe' && result2.assessmentType === 'fallback' && result2.isLocal === true) {
    console.log('✅ TEST 2 PASSED: Daytime fallback is SAFE (offline).');
  } else {
    console.error('❌ TEST 2 FAILED!');
  }

  // Test Case 3: Moderate-risk nighttime fallback (Offline / No API Key) -> CAUTION
  console.log('\n[TEST 3] Testing nighttime local fallback (Offline/No API key)...');
  setMockedHour(23); // Mock 11:00 PM
  const result3 = await evaluateLocationSafety(37.5, -122.1);
  console.log('Result:', JSON.stringify(result3, null, 2));
  if (result3.safetyLevel === 'caution' && result3.assessmentType === 'local_rules' && result3.isLocal === true) {
    console.log('✅ TEST 3 PASSED: Nighttime fallback is CAUTION (offline).');
  } else {
    console.error('❌ TEST 3 FAILED!');
  }

  // Restore Date mock
  setMockedHour(null);

  // Test Case 4: High risk assessment from Gemini AI (Online) -> HIGH
  console.log('\n[TEST 4] Testing high risk assessment from Gemini AI (Online)...');
  process.env.EXPO_PUBLIC_GEMINI_API_KEY = 'mock-api-key';
  
  // Mock Gemini to return HIGH risk JSON
  mockFetchHandler = async (url) => {
    if (url.includes('generativelanguage.googleapis.com')) {
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  safetyLevel: 'high',
                  riskScore: 82,
                  reasons: ['Isolated area with multiple past crime reports.', 'Low pedestrian traffic.'],
                  recommendation: 'Move toward a populated or known safe location.'
                })
              }]
            }
          }]
        })
      };
    }
    // Fail other URLs (like Overpass)
    throw new Error('Not found');
  };

  const result4 = await evaluateLocationSafety(34.0522, -118.2437);
  console.log('Result:', JSON.stringify(result4, null, 2));
  if (result4.safetyLevel === 'high' && result4.riskScore === 82 && result4.assessmentType === 'ai_generated' && result4.isLocal === false) {
    console.log('✅ TEST 4 PASSED: AI assessment correctly returned HIGH risk.');
  } else {
    console.error('❌ TEST 4 FAILED!');
  }

  // Test Case 5: Network/AI fails (throws error) while online mode is configured -> Local fallback
  console.log('\n[TEST 5] Testing AI/Network failure with fallback...');
  setMockedHour(23); // Nighttime
  mockFetchHandler = async () => {
    throw new Error('Gemini API quota exceeded or connection timed out.');
  };

  const result5 = await evaluateLocationSafety(34.0522, -118.2437);
  console.log('Result:', JSON.stringify(result5, null, 2));
  if (result5.safetyLevel === 'caution' && result5.assessmentType === 'local_rules' && result5.isLocal === true) {
    console.log('✅ TEST 5 PASSED: Failed AI call correctly fell back to local rules.');
  } else {
    console.error('❌ TEST 5 FAILED!');
  }

  // Restore mocks
  setMockedHour(null);
  mockFetchHandler = null;

  console.log('\n--- TESTS COMPLETED ---');
}

runTests().catch(err => {
  console.error('Error running test script:', err);
});
