import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useRouter } from 'expo-router';

export type VoiceSOSStatus = 'off' | 'on' | 'listening' | 'permission_denied' | 'error';

interface VoiceSOSContextType {
  voiceSOSEnabled: boolean;
  voiceSOSStatus: VoiceSOSStatus;
  emergencyPhrase: string;
  transcription: string;
  setVoiceSOSEnabled: (enabled: boolean) => Promise<void>;
  setEmergencyPhrase: (phrase: string) => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => void;
}

const VoiceSOSContext = createContext<VoiceSOSContextType | undefined>(undefined);

export function VoiceSOSProvider({ children }: { children: React.ReactNode }) {
  const [voiceSOSEnabled, setVoiceSOSEnabledState] = useState(false);
  const [voiceSOSStatus, setVoiceSOSStatus] = useState<VoiceSOSStatus>('off');
  const [emergencyPhrase, setEmergencyPhraseState] = useState('help help');
  const [transcription, setTranscription] = useState('');

  const appStateRef = useRef(AppState.currentState);
  const isListeningRef = useRef(false);
  const isEnabledRef = useRef(false);
  const emergencyPhraseRef = useRef('help help');
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const stopListeningNative = useCallback(() => {
    isListeningRef.current = false;
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (e) {
      console.log('[VoiceSOS] Error calling stop():', e);
    }
  }, []);

  const startListeningNative = useCallback(async (): Promise<boolean> => {
    if (isListeningRef.current) return true;

    try {
      // Verify permissions before starting
      const perms = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (!perms.granted) {
        setVoiceSOSStatus('permission_denied');
        setVoiceSOSEnabledState(false);
        isEnabledRef.current = false;
        await AsyncStorage.setItem('voiceSOSEnabled', 'false');
        return false;
      }

      setTranscription('');
      isListeningRef.current = true;

      const phrase = emergencyPhraseRef.current;
      console.log('[VoiceSOS] Starting speech recognition for phrase:', phrase);

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: false,
        contextualStrings: [
          phrase,
          'help help',
          'danger danger',
          'emergency',
          'safeher activate',
        ],
      });

      setVoiceSOSStatus('listening');
      return true;
    } catch (err) {
      console.log('[VoiceSOS] Error starting speech recognition:', err);
      isListeningRef.current = false;
      return false;
    }
  }, []);

  const triggerSOS = useCallback(async () => {
    console.log('[VoiceSOS] Emergency phrase detected! Triggering SOS flow...');

    // 1. Turn OFF Voice SOS monitoring immediately to avoid double triggers
    isEnabledRef.current = false;
    setVoiceSOSEnabledState(false);
    await AsyncStorage.setItem('voiceSOSEnabled', 'false');

    // 2. Stop native recognition
    stopListeningNative();
    setVoiceSOSStatus('off');

    // 3. Navigate to SOS page with auto-start parameter (existing SOS flow)
    router.push('/sos?autoStart=true');
  }, [router, stopListeningNative]);

  const setVoiceSOSEnabled = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      isEnabledRef.current = false;
      stopListeningNative();
      setVoiceSOSEnabledState(false);
      setVoiceSOSStatus('off');
      await AsyncStorage.setItem('voiceSOSEnabled', 'false');
      return;
    }

    try {
      // 1. Check if speech recognition is available on this platform/device
      let available = true;
      try {
        if (typeof ExpoSpeechRecognitionModule.isRecognitionAvailable === 'function') {
          available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
        }
      } catch (e) {
        console.log('[VoiceSOS] Error checking isRecognitionAvailable:', e);
      }

      if (!available) {
        isEnabledRef.current = false;
        setVoiceSOSEnabledState(false);
        setVoiceSOSStatus('error');
        await AsyncStorage.setItem('voiceSOSEnabled', 'false');
        return;
      }

      // 2. Request and verify microphone/speech permissions
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        isEnabledRef.current = false;
        stopListeningNative();
        setVoiceSOSEnabledState(false);
        setVoiceSOSStatus('permission_denied');
        await AsyncStorage.setItem('voiceSOSEnabled', 'false');
        return;
      }

      // 3. Start microphone monitoring - only set ON if monitoring successfully started
      isEnabledRef.current = true;
      const started = await startListeningNative();
      if (started) {
        setVoiceSOSEnabledState(true);
        setVoiceSOSStatus('listening');
        await AsyncStorage.setItem('voiceSOSEnabled', 'true');
      } else {
        isEnabledRef.current = false;
        stopListeningNative();
        setVoiceSOSEnabledState(false);
        setVoiceSOSStatus('error');
        await AsyncStorage.setItem('voiceSOSEnabled', 'false');
      }
    } catch (err) {
      console.log('[VoiceSOS] Error enabling voice SOS:', err);
      isEnabledRef.current = false;
      stopListeningNative();
      setVoiceSOSEnabledState(false);
      setVoiceSOSStatus('error');
      await AsyncStorage.setItem('voiceSOSEnabled', 'false');
    }
  }, [startListeningNative, stopListeningNative]);

  const setEmergencyPhrase = useCallback(async (phrase: string) => {
    try {
      setEmergencyPhraseState(phrase);
      emergencyPhraseRef.current = phrase;
      await AsyncStorage.setItem('emergencyPhrase', phrase);
    } catch (err) {
      console.log('[VoiceSOS] Error setting emergency phrase:', err);
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedEnabled = await AsyncStorage.getItem('voiceSOSEnabled');
        const savedPhrase = await AsyncStorage.getItem('emergencyPhrase');

        if (savedPhrase !== null) {
          setEmergencyPhraseState(savedPhrase);
          emergencyPhraseRef.current = savedPhrase;
        }

        if (savedEnabled === 'true') {
          // Verify permission still granted before restoring ON
          const perms = await ExpoSpeechRecognitionModule.getPermissionsAsync();
          if (perms.granted) {
            isEnabledRef.current = true;
            setVoiceSOSEnabledState(true);
            setVoiceSOSStatus('listening');
            void startListeningNative();
          } else {
            isEnabledRef.current = false;
            setVoiceSOSEnabledState(false);
            setVoiceSOSStatus('off');
            await AsyncStorage.setItem('voiceSOSEnabled', 'false');
          }
        } else {
          isEnabledRef.current = false;
          setVoiceSOSEnabledState(false);
          setVoiceSOSStatus('off');
        }
      } catch (err) {
        console.log('[VoiceSOS] Error loading settings:', err);
      }
    };
    void loadSettings();
  }, [startListeningNative]);

  // Handle Speech Recognition events
  useEffect(() => {
    // Normalization helper: strips punctuation and extra spaces
    const normalize = (str: string) =>
      str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    // Listen for speech results
    const resultSubscription = ExpoSpeechRecognitionModule.addListener('result', (event) => {
      const results = event.results || [];
      const primaryTranscript = results[0]?.transcript || '';
      if (primaryTranscript) {
        setTranscription(primaryTranscript);
      }

      const targetPhrase = normalize(emergencyPhraseRef.current || 'help help');
      if (!targetPhrase) return;

      // Candidate strings to check: each alternative and full concatenated text
      const candidates = [
        ...results.map((r) => normalize(r.transcript)),
        normalize(results.map((r) => r.transcript).join(' ')),
      ];

      const matched = candidates.some((cand) => cand.includes(targetPhrase));

      if (matched) {
        console.log(`[VoiceSOS] Phrase matched! Transcript: "${primaryTranscript}" matches phrase: "${targetPhrase}"`);
        void triggerSOS();
      }
    });

    // Listen for start and audiostart
    const startSubscription = ExpoSpeechRecognitionModule.addListener('start', () => {
      isListeningRef.current = true;
      if (isEnabledRef.current) {
        setVoiceSOSStatus('listening');
      }
    });

    // Listen for errors
    const errorSubscription = ExpoSpeechRecognitionModule.addListener('error', (event) => {
      console.log('[VoiceSOS] Speech recognition error event:', event.error, event.message);
      if (event.error === 'not-allowed') {
        isEnabledRef.current = false;
        isListeningRef.current = false;
        setVoiceSOSStatus('permission_denied');
        setVoiceSOSEnabledState(false);
        void AsyncStorage.setItem('voiceSOSEnabled', 'false');
      } else if (event.error === 'no-speech' || event.error === 'speech-timeout') {
        // Normal silence timeout on Android - recognition ends and will auto-restart
      } else if (event.error === 'busy') {
        // Speech service busy - will recover on next cycle
      } else {
        console.log('[VoiceSOS] Speech recognition warning:', event.error);
      }
    });

    // Listen for end event to handle continuous auto-restart
    const endSubscription = ExpoSpeechRecognitionModule.addListener('end', () => {
      isListeningRef.current = false;

      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }

      // Auto-restart continuous recognition if enabled, app active, and SOS not active
      restartTimeoutRef.current = setTimeout(async () => {
        const enabled = await AsyncStorage.getItem('voiceSOSEnabled');
        const active = await AsyncStorage.getItem('isSOSActive');
        if (enabled === 'true' && active !== 'true' && appStateRef.current === 'active' && isEnabledRef.current) {
          console.log('[VoiceSOS] Session ended. Auto-restarting continuous monitoring...');
          void startListeningNative();
        } else {
          setVoiceSOSStatus(enabled === 'true' ? 'on' : 'off');
        }
      }, 300);
    });

    return () => {
      resultSubscription.remove();
      startSubscription.remove();
      errorSubscription.remove();
      endSubscription.remove();
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, [triggerSOS, startListeningNative]);

  // Monitor AppState to stop in background and resume in foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const isSOSActive = await AsyncStorage.getItem('isSOSActive');
      const prevAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (prevAppState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[VoiceSOS] App has come to the foreground, checking if we should resume...');
        const enabled = await AsyncStorage.getItem('voiceSOSEnabled');
        if (enabled === 'true' && isSOSActive !== 'true' && isEnabledRef.current) {
          void startListeningNative();
        }
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('[VoiceSOS] App went to the background, pausing listener...');
        if (isListeningRef.current) {
          stopListeningNative();
          setVoiceSOSStatus('on');
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [startListeningNative, stopListeningNative]);

  return (
    <VoiceSOSContext.Provider
      value={{
        voiceSOSEnabled,
        voiceSOSStatus,
        emergencyPhrase,
        transcription,
        setVoiceSOSEnabled,
        setEmergencyPhrase,
        startListening: async () => {
          void startListeningNative();
        },
        stopListening: stopListeningNative,
      }}
    >
      {children}
    </VoiceSOSContext.Provider>
  );
}

export function useVoiceSOS() {
  const context = useContext(VoiceSOSContext);
  if (!context) {
    throw new Error('useVoiceSOS must be used within a VoiceSOSProvider');
  }
  return context;
}
