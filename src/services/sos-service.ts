import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Linking, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { supabase } from '@/utils/supabase';
import { evaluateLocationSafety, LocationSafetyResult } from '@/services/location-safety';
import { LOCATION_BACKGROUND_TASK } from '@/hooks/use-location';

const { SmsModule } = NativeModules;

export interface Contact {
  id: string;
  name: string;
  phone: string;
}

export type SOSNotificationStatus = 'idle' | 'sending' | 'notified' | 'composer_opened' | 'failed' | 'no_contacts';

export interface SOSDispatchOptions {
  source?: 'manual' | 'voice' | 'silent_guardian';
  silent?: boolean;
  locationCoords?: { latitude: number; longitude: number; accuracy?: number | null; googleMapsLink?: string };
}

export interface SOSDispatchResult {
  success: boolean;
  status: SOSNotificationStatus;
  sentCount: number;
  coords: { latitude: number; longitude: number; accuracy?: number | null; googleMapsLink: string } | null;
  riskAnalysis: LocationSafetyResult | null;
  message: string;
}

/**
 * Checks and requests SMS permission on Android.
 */
export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.SEND_SMS
    );
    if (hasPermission) return true;

    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      {
        title: 'SMS Permission Required',
        message: 'SafeHer AI needs SMS permission to automatically send SOS alerts to your emergency contacts.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );
    return status === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.log('[SOSService] Error checking/requesting SMS permission:', err);
    return false;
  }
}

/**
 * Shared SOS Alert Dispatcher.
 * Coordinates location retrieval, AI risk evaluation, direct SMS,
 * background tracking activation, and Supabase live-location streaming.
 */
export async function dispatchSOSAlert(options: SOSDispatchOptions = {}): Promise<SOSDispatchResult> {
  console.log(`[SOSService] Dispatching SOS alert (source: ${options.source || 'unknown'}, silent: ${!!options.silent})`);

  let coords: { latitude: number; longitude: number; accuracy?: number | null; googleMapsLink: string } | null = null;
  let riskAnalysis: LocationSafetyResult | null = null;

  // 1. Obtain GPS coordinates
  try {
    if (options.locationCoords) {
      coords = {
        ...options.locationCoords,
        googleMapsLink:
          options.locationCoords.googleMapsLink ||
          `https://maps.google.com/?q=${options.locationCoords.latitude},${options.locationCoords.longitude}`,
      };
    } else {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        ...(Platform.OS === 'web' ? { timeout: 10000 } : {}),
      }).catch(async () => {
        return await Location.getLastKnownPositionAsync({ maxAge: 60000 });
      });

      if (pos && pos.coords) {
        coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          googleMapsLink: `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`,
        };
      }
    }
  } catch (locErr) {
    console.log('[SOSService] Location fetch error during SOS alert:', locErr);
  }

  // 2. Run AI risk analysis if coordinates are available
  if (coords) {
    try {
      riskAnalysis = await evaluateLocationSafety(coords.latitude, coords.longitude);
      console.log(`[SOSService] AI Safety Assessment: Level=${riskAnalysis.safetyLevel}, Score=${riskAnalysis.riskScore}`);
    } catch (aiErr) {
      console.log('[SOSService] AI risk evaluation error:', aiErr);
    }
  }

  // 3. Persist SOS state as Active
  try {
    await AsyncStorage.setItem('isSOSActive', 'true');
  } catch (e) {
    console.log('[SOSService] Error setting isSOSActive:', e);
  }

  // 4. Start background location tracking & sync with Supabase
  try {
    if (Platform.OS !== 'web') {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_BACKGROUND_TASK).catch(() => false);
      if (!hasStarted) {
        await Location.startLocationUpdatesAsync(LOCATION_BACKGROUND_TASK, {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 5,
          foregroundService: {
            notificationTitle: 'SafeHer Live Protection Active',
            notificationBody: 'Broadcasting live coordinates to trusted contacts.',
            notificationColor: '#EF4444',
          },
        }).catch((e) => console.log('[SOSService] Background tracking start error:', e));
      }
    }

    // Direct Supabase location push
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user && coords) {
      try {
        await supabase
          .from('sos_locations')
          .upsert({
            user_id: session.user.id,
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy ?? null,
            is_active: true,
            updated_at: new Date().toISOString(),
          });
      } catch (e) {
        console.log('[SOSService] Supabase initial upsert error:', e);
      }
    }
  } catch (syncErr) {
    console.log('[SOSService] Error syncing background tracking/Supabase:', syncErr);
  }

  // 5. Load configured emergency contacts
  let contactsList: Contact[] = [];
  try {
    const saved = await AsyncStorage.getItem('emergencyContacts');
    if (saved) {
      contactsList = JSON.parse(saved);
    }
  } catch (contactErr) {
    console.log('[SOSService] Error reading emergency contacts:', contactErr);
  }

  if (contactsList.length === 0) {
    console.log('[SOSService] No emergency contacts configured.');
    return {
      success: false,
      status: 'no_contacts',
      sentCount: 0,
      coords,
      riskAnalysis,
      message: 'No emergency contacts are saved. Please add an emergency contact to receive SOS alerts.',
    };
  }

  // 6. Generate emergency message
  let sosMessage = '';
  if (coords) {
    sosMessage = `⚠️ SafeHer AI Emergency Alert\n\nI may be at risk and need help.\n\nMy current location:\n${coords.googleMapsLink}\n\nPlease contact me immediately.`;
  } else {
    sosMessage = `⚠️ SafeHer AI Emergency Alert\n\nI may be at risk and need help.\n\nMy current location:\nLocation temporarily unavailable.\n\nPlease contact me immediately.`;
  }

  // 7. Send SMS via Native Module or Fallback
  const canUseNativeSms =
    Platform.OS === 'android' &&
    NativeModules.SmsModule &&
    typeof NativeModules.SmsModule.sendSms === 'function';

  if (canUseNativeSms) {
    const hasPermission = await requestSmsPermission();
    if (hasPermission) {
      let sentCount = 0;
      for (const contact of contactsList) {
        const cleanPhone = contact.phone.replace(/[^0-9+]/g, '').trim();
        if (!cleanPhone) continue;
        try {
          await SmsModule.sendSms(cleanPhone, sosMessage);
          sentCount++;
          console.log(`[SOSService] Direct SMS dispatched to ${contact.name} (${cleanPhone})`);
        } catch (smsErr) {
          console.log(`[SOSService] Direct SMS failed for ${contact.name}:`, smsErr);
        }
      }

      if (sentCount > 0) {
        return {
          success: true,
          status: 'notified',
          sentCount,
          coords,
          riskAnalysis,
          message: `Discreet SOS dispatched to ${sentCount} contact(s).`,
        };
      }
    }
  }

  // Fallback for iOS/Web or if direct SMS failed: open SMS composer
  const phoneNumbers = contactsList
    .map((c) => c.phone.replace(/[^0-9+]/g, '').trim())
    .filter(Boolean);

  if (phoneNumbers.length > 0) {
    const separator = Platform.OS === 'ios' ? '&' : '?';
    const recipientParam = phoneNumbers.join(',');
    const smsUrl = `sms:${recipientParam}${separator}body=${encodeURIComponent(sosMessage)}`;

    try {
      const supported = await Linking.canOpenURL(smsUrl);
      if (supported) {
        await Linking.openURL(smsUrl);
        return {
          success: true,
          status: 'composer_opened',
          sentCount: phoneNumbers.length,
          coords,
          riskAnalysis,
          message: 'Opened SMS composer with emergency message.',
        };
      }
    } catch (err) {
      console.log('[SOSService] Error opening SMS URL:', err);
    }
  }

  return {
    success: false,
    status: 'failed',
    sentCount: 0,
    coords,
    riskAnalysis,
    message: 'Unable to notify emergency contacts automatically.',
  };
}
