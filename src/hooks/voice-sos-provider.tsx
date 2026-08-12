import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
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
  const router = useRouter();

  const stopListeningNative = useCallback(() => {
    if (Platform.OS === 'web') return;
    if (!isListeningRef.current) return;
    
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (e) {
      console.log('[VoiceSOS] Error calling stop():', e);
    }
    isListeningRef.current = false;
  }, []);

  const startListeningNative = useCallback(async () => {
    if (Platform.OS === 'web') return;
    if (isListeningRef.current) return;
    
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        setVoiceSOSStatus('permission_denied');
        setVoiceSOSEnabledState(false);
        await AsyncStorage.setItem('voiceSOSEnabled', 'false');
        return;
      }

      setVoiceSOSStatus('listening');
      isListeningRef.current = true;
      setTranscription('');
      
      console.log('[VoiceSOS] Starting speech recognition (on-device)...');
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: true,
      });
    } catch (err) {
      console.log('[VoiceSOS] Error starting speech recognition (on-device):', err);
      // Fallback in case requiresOnDeviceRecognition: true is not supported on this device/locale
      try {
        console.log('[VoiceSOS] Retrying with requiresOnDeviceRecognition: false...');
        ExpoSpeechRecognitionModule.start({
          lang: 'en-US',
          interimResults: true,
          continuous: true,
          requiresOnDeviceRecognition: false,
        });
      } catch (fallbackErr) {
        console.log('[VoiceSOS] Speech recognition fallback failed:', fallbackErr);
        setVoiceSOSStatus('error');
        setVoiceSOSEnabledState(false);
        await AsyncStorage.setItem('voiceSOSEnabled', 'false');
        isListeningRef.current = false;
      }
    }
  }, []);

  const triggerSOS = useCallback(async () => {
    // 1. Turn OFF Voice SOS monitoring immediately to avoid double triggers
    setVoiceSOSEnabledState(false);
    await AsyncStorage.setItem('voiceSOSEnabled', 'false');
    
    // 2. Stop native recognition
    stopListeningNative();
    setVoiceSOSStatus('off');

    // 3. Navigate to SOS page with auto-start parameter
    router.push('/sos?autoStart=true');
  }, [router, stopListeningNative]);

  const setVoiceSOSEnabled = useCallback(async (enabled: boolean) => {
    try {
      setVoiceSOSEnabledState(enabled);
      await AsyncStorage.setItem('voiceSOSEnabled', enabled ? 'true' : 'false');
      
      if (enabled) {
        setVoiceSOSStatus('on');
        await startListeningNative();
      } else {
        stopListeningNative();
        setVoiceSOSStatus('off');
      }
    } catch (err) {
      console.log('[VoiceSOS] Error toggling voice SOS setting:', err);
    }
  }, [startListeningNative, stopListeningNative]);

  const setEmergencyPhrase = useCallback(async (phrase: string) => {
    try {
      setEmergencyPhraseState(phrase);
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
        }
        
        if (savedEnabled === 'true') {
          setVoiceSOSEnabledState(true);
          setVoiceSOSStatus('on');
        } else {
          setVoiceSOSEnabledState(false);
          setVoiceSOSStatus('off');
        }
      } catch (err) {
        console.log('[VoiceSOS] Error loading settings:', err);
      }
    };
    loadSettings();
  }, []);

  // Handle Speech Recognition events
  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Listen for results
    const resultSubscription = ExpoSpeechRecognitionModule.addListener('result', (event) => {
      const text = event.results?.map(r => r.transcript).join(' ') || '';
      setTranscription(text);
      
      const cleanedText = text.toLowerCase().trim();
      const cleanedPhrase = emergencyPhrase.toLowerCase().trim();
      
      if (cleanedText.includes(cleanedPhrase)) {
        console.log(`[VoiceSOS] Phrase matched! Cleaned transcript: "${cleanedText}" matches phrase: "${cleanedPhrase}"`);
        triggerSOS();
      }
    });

    // Listen for errors
    const errorSubscription = ExpoSpeechRecognitionModule.addListener('error', (event) => {
      console.log('[VoiceSOS] Speech recognition error event:', event.error, event.message);
      if (event.error === 'not-allowed') {
        setVoiceSOSStatus('permission_denied');
        setVoiceSOSEnabledState(false);
        AsyncStorage.setItem('voiceSOSEnabled', 'false');
      } else if (event.error === 'no-speech') {
        // Normal silence error, can be ignored
      } else {
        // Log other errors, but don't crash
      }
    });

    // Listen for end event to handle continuous auto-restart
    const endSubscription = ExpoSpeechRecognitionModule.addListener('end', () => {
      isListeningRef.current = false;
      
      // Auto-restart if it should be listening, app is active, and SOS not triggered yet
      AsyncStorage.getItem('voiceSOSEnabled').then(async (val) => {
        const active = await AsyncStorage.getItem('isSOSActive');
        if (val === 'true' && active !== 'true' && appStateRef.current === 'active') {
          console.log('[VoiceSOS] Native session ended. Auto-restarting recognition...');
          startListeningNative();
        } else {
          setVoiceSOSStatus(val === 'true' ? 'on' : 'off');
        }
      });
    });

    return () => {
      resultSubscription.remove();
      errorSubscription.remove();
      endSubscription.remove();
    };
  }, [emergencyPhrase, triggerSOS, startListeningNative]);

  // Monitor AppState to stop in background and start in foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const isSOSActive = await AsyncStorage.getItem('isSOSActive');
      const prevAppState = appStateRef.current;
      appStateRef.current = nextAppState;
      
      if (prevAppState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[VoiceSOS] App has come to the foreground, checking if we should resume...');
        
        // Resume listening if enabled and SOS is not active
        const enabled = await AsyncStorage.getItem('voiceSOSEnabled');
        if (enabled === 'true' && isSOSActive !== 'true') {
          startListeningNative();
        }
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('[VoiceSOS] App went to the background, pausing listener...');
        
        // Stop listening in background
        if (isListeningRef.current) {
          try {
            ExpoSpeechRecognitionModule.stop();
          } catch (e) {
            console.log('[VoiceSOS] Error stopping on background transition:', e);
          }
          isListeningRef.current = false;
          setVoiceSOSStatus('on');
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [startListeningNative]);

  // Trigger listening if enabled and app is active on mount/changes
  useEffect(() => {
    if (voiceSOSEnabled && appStateRef.current === 'active') {
      AsyncStorage.getItem('isSOSActive').then((active) => {
        if (active !== 'true') {
          startListeningNative();
        }
      });
    } else {
      stopListeningNative();
    }
  }, [voiceSOSEnabled, startListeningNative, stopListeningNative]);

  return (
    <VoiceSOSContext.Provider
      value={{
        voiceSOSEnabled,
        voiceSOSStatus,
        emergencyPhrase,
        transcription,
        setVoiceSOSEnabled,
        setEmergencyPhrase,
        startListening: startListeningNative,
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
