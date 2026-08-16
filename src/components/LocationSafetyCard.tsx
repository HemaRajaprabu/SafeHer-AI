import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useLocation } from '@/hooks/use-location';
import {
  evaluateLocationSafety,
  saveCustomSafePlace,
  getDistanceKm,
  LocationSafetyResult,
  LocationSafetyLevel,
} from '@/services/location-safety';

const MOVEMENT_THRESHOLD_METERS = 150; // trigger analysis when user moves > 150 meters

export default function LocationSafetyCard() {
  const theme = useTheme();
  const isDark = theme.text === '#ffffff';

  const {
    location,
    loading: locationLoading,
    error: locationError,
    errorType: locationErrorType,
    startTracking,
    stopTracking,
    isTracking,
    refresh,
  } = useLocation();

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<LocationSafetyResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<string | null>(null);
  const [savingSafePlace, setSavingSafePlace] = useState(false);

  const lastAnalyzedCoords = useRef<{ latitude: number; longitude: number } | null>(null);
  const prevSafetyLevel = useRef<LocationSafetyLevel | null>(null);

  // 1. Load preference and cache from AsyncStorage on mount
  useEffect(() => {
    const loadPreferenceAndCache = async () => {
      try {
        const val = await AsyncStorage.getItem('autoLocationMonitoring');
        if (val === 'true') {
          setIsMonitoring(true);
        }
        const cached = await AsyncStorage.getItem('lastLocationSafetyResult');
        if (cached) {
          const parsed = JSON.parse(cached);
          setAnalysisResult(parsed.result);
          setLastCheckedTime(parsed.timestamp);
          lastAnalyzedCoords.current = parsed.coords;
          prevSafetyLevel.current = parsed.result.safetyLevel;
        }
      } catch (e) {
        console.error('Error loading autoLocationMonitoring preference or cache:', e);
      }
    };
    loadPreferenceAndCache();
  }, []);

  // 2. Start/stop continuous location watching based on toggle
  useEffect(() => {
    if (isMonitoring) {
      startTracking();
    } else {
      stopTracking();
      setAnalysisResult(null);
      lastAnalyzedCoords.current = null;
      prevSafetyLevel.current = null;
    }
  }, [isMonitoring, startTracking, stopTracking]);

  // 3. Clean up watcher on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  // 4. Perform safety evaluation
  const runSafetyAnalysis = async (lat: number, lon: number) => {
    setAnalyzing(true);
    try {
      const result = await evaluateLocationSafety(lat, lon);
      setAnalysisResult(result);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastCheckedTime(timeStr);

      // Save to cache
      await AsyncStorage.setItem('lastLocationSafetyResult', JSON.stringify({
        result,
        coords: { latitude: lat, longitude: lon },
        timestamp: timeStr,
      }));

      // 5. Trigger transition alerts
      if (prevSafetyLevel.current && prevSafetyLevel.current !== result.safetyLevel) {
        if (prevSafetyLevel.current === 'safe' && result.safetyLevel === 'caution') {
          Alert.alert(
            '⚠️ Location Warning (Caution)',
            `You entered a caution-level safety zone.\nReason: ${result.reasons.join('\n')}`
          );
        } else if (result.safetyLevel === 'high') {
          Alert.alert(
            '🚨 High Safety Risk Area',
            `SafeHer AI detected a higher safety risk profile for this area.\nReason: ${result.reasons.join('\n')}\n\nRecommendation: ${result.recommendation}`
          );
        }
      }
      prevSafetyLevel.current = result.safetyLevel;
    } catch (e) {
      console.error('Error running location safety analysis:', e);
    } finally {
      setAnalyzing(false);
    }
  };

  // 6. Handle location updates and filter by distance threshold
  useEffect(() => {
    if (!isMonitoring || !location) return;

    const { latitude, longitude } = location;

    if (!lastAnalyzedCoords.current) {
      // First analysis
      lastAnalyzedCoords.current = { latitude, longitude };
      runSafetyAnalysis(latitude, longitude);
    } else {
      const distance = getDistanceKm(
        latitude,
        longitude,
        lastAnalyzedCoords.current.latitude,
        lastAnalyzedCoords.current.longitude
      );
      const distanceMeters = distance * 1000;

      // Only perform safety analysis if user has moved more than the movement threshold
      if (distanceMeters >= MOVEMENT_THRESHOLD_METERS) {
        lastAnalyzedCoords.current = { latitude, longitude };
        runSafetyAnalysis(latitude, longitude);
      }
    }
  }, [location, isMonitoring]);

  const handleToggle = async (val: boolean) => {
    setIsMonitoring(val);
    try {
      await AsyncStorage.setItem('autoLocationMonitoring', val ? 'true' : 'false');
    } catch (e) {
      console.error('Error saving autoLocationMonitoring preference:', e);
    }
  };

  const handleManualRefresh = async () => {
    if (!isMonitoring) return;
    const loc = await refresh();
    if (loc) {
      lastAnalyzedCoords.current = { latitude: loc.latitude, longitude: loc.longitude };
      await runSafetyAnalysis(loc.latitude, loc.longitude);
    }
  };

  const handleAddCurrentAsSafePlace = async () => {
    if (!location) return;
    setSavingSafePlace(true);
    try {
      const name = `Safe Zone #${Math.floor(100 + Math.random() * 900)}`;
      await saveCustomSafePlace(name, location.latitude, location.longitude);
      Alert.alert(
        '📍 Safe Place Saved',
        `Current location saved as a custom Safe Place: "${name}". Proximity evaluations will now register this area as SAFE.`
      );
      // Trigger a re-analysis now that we saved the safe place
      await runSafetyAnalysis(location.latitude, location.longitude);
    } catch (e) {
      Alert.alert('Error', 'Failed to save current location as safe place.');
    } finally {
      setSavingSafePlace(false);
    }
  };

  const getSafetyLevelStyle = (level: LocationSafetyLevel) => {
    switch (level) {
      case 'safe':
        return { color: '#10B981', label: 'SAFE', bg: 'rgba(16, 185, 129, 0.1)', icon: 'checkmark.shield.fill' };
      case 'caution':
        return { color: '#F59E0B', label: 'CAUTION', bg: 'rgba(245, 158, 11, 0.1)', icon: 'exclamationmark.triangle.fill' };
      case 'high':
        return { color: '#EF4444', label: 'HIGH RISK', bg: 'rgba(239, 68, 68, 0.1)', icon: 'exclamationmark.shield.fill' };
      default:
        return { color: '#6B7280', label: 'UNKNOWN', bg: 'rgba(107, 114, 128, 0.1)', icon: 'questionmark.circle.fill' };
    }
  };

  const renderStatus = () => {
    if (locationError) {
      return (
        <View style={styles.errorContainer}>
          <SymbolView
            name="exclamationmark.circle.fill"
            size={24}
            tintColor="#EF4444"
          />
          <ThemedText style={styles.errorText}>
            {locationErrorType === 'permission_denied'
              ? 'Location permission denied. Please enable location permissions in device settings.'
              : locationErrorType === 'services_disabled'
              ? 'GPS is disabled. Please turn on location services.'
              : 'Location service unavailable. Check connection.'}
          </ThemedText>
        </View>
      );
    }

    if (analyzing || (isMonitoring && !analysisResult)) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#7C3AED" />
          <ThemedText style={styles.loadingText}>Running safety risk assessment...</ThemedText>
        </View>
      );
    }

    if (!analysisResult) return null;

    const safetyInfo = getSafetyLevelStyle(analysisResult.safetyLevel);

    return (
      <View style={styles.resultContainer}>
        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: safetyInfo.bg }]}>
            <SymbolView
              name={safetyInfo.icon as any}
              size={14}
              tintColor={safetyInfo.color}
            />
            <ThemedText style={[styles.badgeText, { color: safetyInfo.color }]}>
              {safetyInfo.label}
            </ThemedText>
          </View>

          <ThemedText style={styles.scoreText}>
            Risk Score: <ThemedText style={{ fontWeight: 'bold' }}>{analysisResult.riskScore}/100</ThemedText>
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary" style={styles.timeText}>
            Last: {lastCheckedTime}
          </ThemedText>
        </View>

        <View style={styles.infoBox}>
          <ThemedText type="small" style={styles.coordinateLabel}>
            📍 Current Location: {location?.latitude.toFixed(5)}, {location?.longitude.toFixed(5)}
          </ThemedText>

          <View style={styles.divider} />

          {analysisResult.reasons.map((reason, idx) => (
            <ThemedText key={idx} style={styles.reasonText} type="small">
              • {reason}
            </ThemedText>
          ))}

          <View style={styles.divider} />

          <ThemedText style={styles.recommendationText} type="smallBold">
            💡 {analysisResult.recommendation}
          </ThemedText>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              { borderColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}
            onPress={handleManualRefresh}
          >
            <SymbolView name="arrow.clockwise" size={14} tintColor={theme.text} />
            <ThemedText type="small">Refresh</ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              { borderColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}
            disabled={savingSafePlace}
            onPress={handleAddCurrentAsSafePlace}
          >
            <SymbolView name="pin.fill" size={14} tintColor="#7C3AED" />
            <ThemedText type="small" style={{ color: '#7C3AED' }}>Save as Safe Place</ThemedText>
          </Pressable>
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.sourceFooter}>
          Source: {analysisResult.assessmentType === 'safe_place' ? 'Saved Safe Place Match' : analysisResult.isLocal ? 'Offline Local Rules' : 'Cloud AI Spatial Assessment'}
        </ThemedText>
      </View>
    );
  };

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <SymbolView
            name={{
              ios: 'location.fill',
              android: 'location-on',
              web: 'map-marker',
            } as any}
            size={24}
            tintColor="#7C3AED"
          />
          <View style={styles.titleMeta}>
            <ThemedText style={styles.title}>Real-Time Safety Monitor</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Automatic location risk assessment
            </ThemedText>
          </View>
        </View>

        <Switch
          value={isMonitoring}
          onValueChange={handleToggle}
        />
      </View>

      {!isMonitoring ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.disabledText}>
          Automatic Location Safety Monitoring is turned off. Enable it to monitor safety in real-time as you move.
        </ThemedText>
      ) : (
        renderStatus()
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 20,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleMeta: {
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  disabledText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: 10,
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    flex: 1,
    lineHeight: 16,
  },
  resultContainer: {
    gap: 10,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  scoreText: {
    fontSize: 13,
  },
  timeText: {
    fontSize: 11,
  },
  infoBox: {
    padding: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.06)',
    borderRadius: 12,
    gap: 6,
  },
  coordinateLabel: {
    color: '#475569',
    fontSize: 11,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    marginVertical: 2,
  },
  reasonText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
  },
  recommendationText: {
    fontSize: 12,
    color: '#1E293B',
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  sourceFooter: {
    fontSize: 10,
    textAlign: 'right',
    marginTop: 2,
    fontStyle: 'italic',
  },
});
