import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  Platform,
  NativeModules,
  DeviceEventEmitter,
  StyleSheet,
  View,
  Text,
  Pressable,
  Vibration,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Accelerometer } from 'expo-sensors';
import { dispatchSOSAlert } from '@/services/sos-service';
import { evaluateLocationSafety, LocationSafetyResult } from '@/services/location-safety';
import * as Location from 'expo-location';

const { SilentGuardianModule } = NativeModules;

export type SilentGuardianStatus =
  | 'idle'
  | 'monitoring'
  | 'countdown'
  | 'triggered'
  | 'cancelled'
  | 'unsupported';

interface SilentGuardianContextType {
  isEnabled: boolean;
  isMonitoring: boolean;
  status: SilentGuardianStatus;
  countdown: number;
  riskAssessment: LocationSafetyResult | null;
  toggleSilentGuardian: (enabled: boolean) => Promise<void>;
  cancelCountdown: () => void;
  triggerManuallyForTesting?: () => void;
}

const SilentGuardianContext = createContext<SilentGuardianContextType | undefined>(undefined);

const DELIBERATE_THRESHOLD = 2.2; // G-force magnitude threshold (~21.5 m/s^2)
const WINDOW_MS = 1500; // 1.5 second window
const MIN_INTERVAL_MS = 150; // Minimum interval between peaks
const MAX_INTERVAL_MS = 550; // Maximum interval between peaks
const COOLDOWN_MS = 8000; // 8 second lockout after trigger

export function SilentGuardianProvider({ children }: { children: React.ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [status, setStatus] = useState<SilentGuardianStatus>('idle');
  const [countdown, setCountdown] = useState(5);
  const [riskAssessment, setRiskAssessment] = useState<LocationSafetyResult | null>(null);
  const [discreetMessage, setDiscreetMessage] = useState<string | null>(null);

  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTriggerTimeRef = useRef<number>(0);
  const isEnabledRef = useRef<boolean>(false);
  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  // Accidental trigger tracking state for JS fallback
  const lastShakeTimeRef = useRef<number>(0);
  const shakePeaksRef = useRef<number[]>([]);
  const accelSubRef = useRef<any>(null);

  // Discreet haptic feedback
  const vibrateDiscreetly = useCallback(() => {
    try {
      Vibration.vibrate([0, 100, 100, 100]);
    } catch (e) {
      console.log('[SilentGuardian] Vibration error:', e);
    }
  }, []);

  // Cancel running countdown
  const cancelCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(5);
    setStatus('cancelled');
    setDiscreetMessage('🛡️ Silent Guardian: Emergency flow cancelled.');

    setTimeout(() => {
      setStatus(isEnabledRef.current ? 'monitoring' : 'idle');
      setDiscreetMessage(null);
    }, 3000);
  }, []);

  // Dispatch SOS alert when countdown completes
  const handleConfirmedTrigger = useCallback(async () => {
    console.log('[SilentGuardian] Countdown reached 0. Confirming emergency SOS dispatch...');
    setStatus('triggered');
    setDiscreetMessage('🛡️ Silent Guardian: Emergency alert dispatched to contacts.');

    try {
      const result = await dispatchSOSAlert({
        source: 'silent_guardian',
        silent: true,
      });

      if (result.riskAnalysis) {
        setRiskAssessment(result.riskAnalysis);
      }

      if (result.success) {
        setDiscreetMessage('🛡️ Silent Guardian: Alert & live location sent to trusted contacts.');
      } else if (result.status === 'no_contacts') {
        setDiscreetMessage('🛡️ Silent Guardian: No emergency contacts saved in app.');
      } else {
        setDiscreetMessage('🛡️ Silent Guardian: Direct SMS failed. Opening emergency flow.');
      }
    } catch (err) {
      console.log('[SilentGuardian] Dispatch error:', err);
      setDiscreetMessage('🛡️ Silent Guardian: Alert dispatch failed.');
    }

    // Keep confirmation banner for 8 seconds, then return to monitoring
    setTimeout(() => {
      setStatus(isEnabledRef.current ? 'monitoring' : 'idle');
      setDiscreetMessage(null);
    }, 8000);
  }, []);

  // Initiate countdown upon deliberate shake detection
  const handleGestureDetected = useCallback(async () => {
    const now = Date.now();
    if (now - lastTriggerTimeRef.current < COOLDOWN_MS) {
      console.log('[SilentGuardian] Cooldown active. Ignoring gesture.');
      return;
    }

    if (!isEnabledRef.current) {
      return;
    }

    lastTriggerTimeRef.current = now;
    console.log('[SilentGuardian] Deliberate shake pattern detected! Starting discreet countdown.');

    // Tactile feedback
    vibrateDiscreetly();

    // Start location and AI safety check in background early
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then(async (pos) => {
        if (pos?.coords) {
          const assessment = await evaluateLocationSafety(pos.coords.latitude, pos.coords.longitude);
          setRiskAssessment(assessment);
        }
      })
      .catch((e) => console.log('[SilentGuardian] Pre-fetch location warning:', e));

    // Start countdown
    setStatus('countdown');
    setCountdown(5);

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    let remaining = 5;
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        handleConfirmedTrigger();
      }
    }, 1000);
  }, [vibrateDiscreetly, handleConfirmedTrigger]);

  // Start native sensor monitoring (Android Native Module or fallback)
  const startMonitoring = useCallback(async () => {
    if (Platform.OS === 'web') {
      setStatus('unsupported');
      setIsMonitoring(false);
      return;
    }

    // Try Android Native Module first
    if (Platform.OS === 'android' && SilentGuardianModule?.startMonitoring) {
      try {
        await SilentGuardianModule.startMonitoring();
        setIsMonitoring(true);
        setStatus('monitoring');
        console.log('[SilentGuardian] Native Android service started');
        return;
      } catch (err) {
        console.log('[SilentGuardian] Native module start failed, falling back to expo-sensors:', err);
      }
    }

    // Expo Sensors (JS Accelerometer) fallback
    try {
      const isAvail = await Accelerometer.isAvailableAsync();
      if (!isAvail) {
        console.log('[SilentGuardian] Accelerometer is not available on this device');
        setStatus('unsupported');
        setIsMonitoring(false);
        return;
      }

      Accelerometer.setUpdateInterval(100);
      if (accelSubRef.current) {
        accelSubRef.current.remove();
      }

      accelSubRef.current = Accelerometer.addListener(({ x, y, z }) => {
        const now = Date.now();
        if (now - lastTriggerTimeRef.current < COOLDOWN_MS) return;

        // Total G-force magnitude
        const totalForce = Math.sqrt(x * x + y * y + z * z);
        const dynamicDelta = Math.abs(totalForce - 1.0);

        if (dynamicDelta > DELIBERATE_THRESHOLD) {
          const lastPeak = lastShakeTimeRef.current;
          if (lastPeak === 0 || (now - lastPeak >= MIN_INTERVAL_MS && now - lastPeak <= MAX_INTERVAL_MS)) {
            shakePeaksRef.current.push(now);
            lastShakeTimeRef.current = now;
          } else if (now - lastPeak > MAX_INTERVAL_MS) {
            shakePeaksRef.current = [now];
            lastShakeTimeRef.current = now;
          }

          // Retain only peaks within window
          shakePeaksRef.current = shakePeaksRef.current.filter((t) => now - t <= WINDOW_MS);

          if (shakePeaksRef.current.length >= 3) {
            shakePeaksRef.current = [];
            lastShakeTimeRef.current = 0;
            handleGestureDetected();
          }
        }
      });

      setIsMonitoring(true);
      setStatus('monitoring');
      console.log('[SilentGuardian] JS Accelerometer listener active');
    } catch (sensorErr) {
      console.log('[SilentGuardian] Sensor subscription error:', sensorErr);
      setStatus('unsupported');
      setIsMonitoring(false);
    }
  }, [handleGestureDetected]);

  // Stop sensor monitoring
  const stopMonitoring = useCallback(async () => {
    if (Platform.OS === 'android' && SilentGuardianModule?.stopMonitoring) {
      try {
        await SilentGuardianModule.stopMonitoring();
      } catch (err) {
        console.log('[SilentGuardian] Native module stop failed:', err);
      }
    }

    if (accelSubRef.current) {
      accelSubRef.current.remove();
      accelSubRef.current = null;
    }

    setIsMonitoring(false);
    setStatus('idle');
    console.log('[SilentGuardian] Sensor monitoring stopped');
  }, []);

  // Toggle Silent Guardian setting
  const toggleSilentGuardian = useCallback(
    async (enabled: boolean) => {
      try {
        setIsEnabled(enabled);
        await AsyncStorage.setItem('silentGuardianEnabled', enabled ? 'true' : 'false');

        if (enabled) {
          await startMonitoring();
        } else {
          await stopMonitoring();
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          setCountdown(5);
        }
      } catch (err) {
        console.log('[SilentGuardian] Error toggling setting:', err);
      }
    },
    [startMonitoring, stopMonitoring]
  );

  // Load saved preference on mount
  useEffect(() => {
    const loadSaved = async () => {
      try {
        const saved = await AsyncStorage.getItem('silentGuardianEnabled');
        if (saved === 'true') {
          setIsEnabled(true);
          await startMonitoring();
        } else {
          setIsEnabled(false);
          setStatus('idle');
        }
      } catch (err) {
        console.log('[SilentGuardian] Error loading preference:', err);
      }
    };
    loadSaved();

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      if (accelSubRef.current) {
        accelSubRef.current.remove();
      }
    };
  }, [startMonitoring]);

  // Listen for native Android events
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let sub: any = null;
    try {
      sub = DeviceEventEmitter.addListener('onSilentGuardianShake', () => {
        console.log('[SilentGuardian] Native shake event received from Android Service');
        handleGestureDetected();
      });
    } catch (e) {
      console.log('[SilentGuardian] Native listener registration warning:', e);
    }

    return () => {
      if (sub && typeof sub.remove === 'function') {
        sub.remove();
      }
    };
  }, [handleGestureDetected]);

  return (
    <SilentGuardianContext.Provider
      value={{
        isEnabled,
        isMonitoring,
        status,
        countdown,
        riskAssessment,
        toggleSilentGuardian,
        cancelCountdown,
        triggerManuallyForTesting: handleGestureDetected,
      }}
    >
      {children}

      {/* Discreet Banner for Active Countdown or Dispatched Alert */}
      {(status === 'countdown' || discreetMessage) && (
        <View style={styles.discreetOverlay} pointerEvents="box-none">
          <View style={styles.discreetCard}>
            <View style={styles.discreetLeft}>
              <Text style={styles.shieldEmoji}>🛡️</Text>
              <View style={styles.textContainer}>
                {status === 'countdown' ? (
                  <>
                    <Text style={styles.discreetTitle}>
                      Silent Guardian Triggered ({countdown}s)
                    </Text>
                    <Text style={styles.discreetSubtitle}>
                      Emergency SOS dispatching in {countdown} seconds...
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.discreetTitle}>Silent Guardian</Text>
                    <Text style={styles.discreetSubtitle}>{discreetMessage}</Text>
                  </>
                )}
              </View>
            </View>

            {status === 'countdown' && (
              <Pressable
                onPress={cancelCountdown}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.cancelButtonPressed,
                ]}
              >
                <Text style={styles.cancelButtonText}>CANCEL</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </SilentGuardianContext.Provider>
  );
}

export function useSilentGuardian() {
  const context = useContext(SilentGuardianContext);
  if (!context) {
    throw new Error('useSilentGuardian must be used within a SilentGuardianProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  discreetOverlay: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'center',
  },
  discreetCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  discreetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  shieldEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  discreetTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  discreetSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  cancelButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButtonPressed: {
    opacity: 0.8,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
