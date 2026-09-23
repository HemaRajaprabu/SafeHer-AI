import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useLocation } from '@/hooks/use-location';

interface SafePlace {
  id: number;
  name: string;
  type: 'police' | 'hospital' | 'fire_station' | 'clinic' | 'other';
  latitude: number;
  longitude: number;
  distanceKm: number;
  address?: string;
}

interface UserCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

type FilterCategory = 'all' | 'police' | 'hospital' | 'fire_station';
type LocationStatus = 'loading' | 'granted' | 'permission_denied' | 'unavailable';



// Browser geolocation helper with graceful multi-stage accuracy for mobile browsers
function getWebCoordinates(): Promise<UserCoordinates> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      const err: any = new Error('Geolocation is not supported by your browser.');
      err.code = 2; // POSITION_UNAVAILABLE
      return reject(err);
    }

    // Two-stage retrieval:
    // Stage 1: Try with enableHighAccuracy: true and 8-second timeout
    // Stage 2: If high-accuracy times out or fails (e.g. mobile indoors), fallback to standard accuracy
    const tryLowAccuracy = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          reject(err);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000, // accept cached position up to 1 minute
        }
      );
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        // If permission was explicitly denied, do not retry
        if (err.code === 1) {
          return reject(err);
        }
        // If high accuracy timed out or was unavailable, try standard accuracy
        tryLowAccuracy();
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000,
      }
    );
  });
}

export default function SafePlacesScreen() {
  const theme = useTheme();
  const isDark = theme.text === '#ffffff';

  const {
    location: hookLocation,
    loading: hookLoading,
    error: hookError,
    errorType: hookErrorType,
    refresh: refreshHookLocation,
  } = useLocation();

  const [coords, setCoords] = useState<UserCoordinates | null>(() => {
    if (hookLocation?.latitude && hookLocation?.longitude) {
      return {
        latitude: hookLocation.latitude,
        longitude: hookLocation.longitude,
        accuracy: hookLocation.accuracy,
      };
    }
    return null;
  });

  const [locationStatus, setLocationStatus] = useState<LocationStatus>(() => {
    if (hookLocation?.latitude && hookLocation?.longitude) {
      return 'granted';
    }
    return 'loading';
  });

  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  const [places, setPlaces] = useState<SafePlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [searchRadiusKm, setSearchRadiusKm] = useState<number>(3); // 3km default

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<number>(0);

  const fetchNearbyPlaces = useCallback(async (lat: number, lon: number, radiusKm: number) => {
    // Abort any ongoing in-flight fetch to avoid multiple parallel requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const currentRequestId = ++activeRequestIdRef.current;

    setPlacesLoading(true);
    setApiError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 16000);

    try {
      const baseUrl =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : (process.env.EXPO_PUBLIC_API_URL || '');
      const apiUrl = `${baseUrl}/api/safe-places?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&radius=${encodeURIComponent(radiusKm)}`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // If superseded by a newer request, exit silently
      if (currentRequestId !== activeRequestIdRef.current) {
        return;
      }

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data || !data.success || !Array.isArray(data.places)) {
        throw new Error(data?.error || 'Invalid response from safe places server');
      }

      setPlaces(data.places);
      setApiError(null);
      setPlacesLoading(false);
    } catch (err: any) {
      clearTimeout(timeoutId);

      // If superseded by a newer request, exit silently
      if (currentRequestId !== activeRequestIdRef.current) {
        return;
      }

      console.error('[SafePlaces] Server API fetch failed:', err?.message || err);
      setApiError('Unable to load nearby safety spots due to server or network issues. Please check your connection.');
      setPlacesLoading(false);
    }
  }, []);

  const acquireLocation = useCallback(async (): Promise<UserCoordinates | null> => {
    setLocationStatus('loading');
    setLocationMessage(null);
    setApiError(null);

    if (Platform.OS === 'web') {
      try {
        const webCoords = await getWebCoordinates();
        setCoords(webCoords);
        setLocationStatus('granted');
        setLocationMessage(null);
        return webCoords;
      } catch (err: any) {
        console.warn('[SafePlaces] Web geolocation error:', err);
        if (err?.code === 1) {
          // PERMISSION_DENIED
          setLocationStatus('permission_denied');
          setLocationMessage(
            'Location access was blocked. Please allow location permissions in your mobile browser settings to discover nearby safe spots.'
          );
        } else {
          // POSITION_UNAVAILABLE or TIMEOUT
          setLocationStatus('unavailable');
          setLocationMessage(
            'Unable to detect your current location. Please verify your device GPS is enabled and try again.'
          );
        }
        return null;
      }
    } else {
      // Native platforms use hook / expo-location
      try {
        const fresh = await refreshHookLocation();
        if (fresh?.latitude && fresh?.longitude) {
          const nativeCoords: UserCoordinates = {
            latitude: fresh.latitude,
            longitude: fresh.longitude,
            accuracy: fresh.accuracy,
          };
          setCoords(nativeCoords);
          setLocationStatus('granted');
          setLocationMessage(null);
          return nativeCoords;
        } else {
          if (hookErrorType === 'permission_denied') {
            setLocationStatus('permission_denied');
            setLocationMessage(
              hookError || 'Location permission denied. Please allow location access in settings.'
            );
          } else {
            setLocationStatus('unavailable');
            setLocationMessage(
              hookError || 'Unable to retrieve GPS location. Please check location settings.'
            );
          }
          return null;
        }
      } catch (err: any) {
        setLocationStatus('unavailable');
        setLocationMessage('Failed to obtain device location.');
        return null;
      }
    }
  }, [refreshHookLocation, hookError, hookErrorType]);

  // Clean up any pending network requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Initial location acquisition on mount
  useEffect(() => {
    if (hookLocation?.latitude && hookLocation?.longitude) {
      setCoords({
        latitude: hookLocation.latitude,
        longitude: hookLocation.longitude,
        accuracy: hookLocation.accuracy,
      });
      setLocationStatus('granted');
      return;
    }

    if (Platform.OS === 'web') {
      void acquireLocation();
    } else if (!hookLoading) {
      if (hookError) {
        if (hookErrorType === 'permission_denied') {
          setLocationStatus('permission_denied');
          setLocationMessage(hookError);
        } else {
          setLocationStatus('unavailable');
          setLocationMessage(hookError);
        }
      } else {
        void acquireLocation();
      }
    }
  }, [hookLocation?.latitude, hookLocation?.longitude, hookLoading, hookError, hookErrorType, acquireLocation]);

  // Re-fetch places when coordinates or radius change
  useEffect(() => {
    if (coords?.latitude && coords?.longitude) {
      void fetchNearbyPlaces(coords.latitude, coords.longitude, searchRadiusKm);
    }
  }, [coords?.latitude, coords?.longitude, searchRadiusKm, fetchNearbyPlaces]);

  const handleRefresh = useCallback(async () => {
    setApiError(null);
    const refreshedCoords = await acquireLocation();
    if (refreshedCoords?.latitude && refreshedCoords?.longitude) {
      void fetchNearbyPlaces(refreshedCoords.latitude, refreshedCoords.longitude, searchRadiusKm);
    }
  }, [acquireLocation, fetchNearbyPlaces, searchRadiusKm]);

  const handleRetrySearch = useCallback(() => {
    if (coords?.latitude && coords?.longitude) {
      void fetchNearbyPlaces(coords.latitude, coords.longitude, searchRadiusKm);
    } else {
      void handleRefresh();
    }
  }, [coords, fetchNearbyPlaces, searchRadiusKm, handleRefresh]);

  const openNavigation = async (place: SafePlace) => {
    if (!coords) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${coords.latitude},${coords.longitude}&destination=${place.latitude},${place.longitude}&travelmode=walking`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open Google Maps direction link.');
      }
    } catch (e) {
      console.log('Error launching navigation link:', e);
      Alert.alert('Error', 'An unexpected error occurred opening Google Maps.');
    }
  };

  const filteredPlaces = places.filter((place) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'hospital') {
      return place.type === 'hospital' || place.type === 'clinic';
    }
    return place.type === activeCategory;
  });

  const getPlaceIcon = (type: SafePlace['type']): { name: string; color: string; emoji: string } => {
    switch (type) {
      case 'police':
        return { name: 'shield', color: '#3B82F6', emoji: '👮' };
      case 'hospital':
      case 'clinic':
        return { name: 'heart', color: '#EF4444', emoji: '🏥' };
      case 'fire_station':
        return { name: 'flame', color: '#F97316', emoji: '🚒' };
      default:
        return { name: 'map-pin', color: '#10B981', emoji: '📍' };
    }
  };

  const getCategoryLabel = () => {
    switch (activeCategory) {
      case 'police': return 'police stations';
      case 'hospital': return 'medical services';
      case 'fire_station': return 'fire departments';
      default: return 'emergency services';
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <SymbolView
              name={{
                ios: 'mappin.and.ellipse',
                android: 'place',
                web: 'place',
              } as any}
              size={24}
              tintColor={isDark ? '#34D399' : '#059669'}
            />
          </Pressable>

          <View style={styles.headerInfo}>
            <ThemedText style={styles.headerTitle}>Nearby Safe Places</ThemedText>
            <ThemedText style={styles.headerSubtitle} themeColor="textSecondary">
              Emergency amenities within {searchRadiusKm}km
            </ThemedText>
          </View>

          <Pressable onPress={handleRefresh} style={styles.refreshButton}>
            <SymbolView
              name={{
                ios: 'arrow.clockwise',
                android: 'refresh',
                web: 'refresh',
              } as any}
              size={20}
              tintColor={isDark ? '#FFFFFF' : '#111827'}
            />
          </Pressable>
        </View>

        {/* User Location Bar */}
        {coords && (
          <View style={styles.locationBar}>
            <SymbolView
              name={{
                ios: 'location.fill',
                android: 'location_on',
                web: 'location_on',
              } as any}
              size={16}
              tintColor={isDark ? '#A78BFA' : '#7C3AED'}
            />
            <ThemedText style={styles.locationBarText}>
              Current GPS: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
            </ThemedText>
          </View>
        )}

        {/* Filter Categories */}
        <View style={styles.filterRow}>
          {(['all', 'police', 'hospital', 'fire_station'] as FilterCategory[]).map((cat) => {
            const isSelected = activeCategory === cat;
            const label =
              cat === 'all'
                ? 'All'
                : cat === 'police'
                ? 'Police'
                : cat === 'hospital'
                ? 'Medical'
                : 'Fire Dept';

            return (
              <Pressable
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={[
                  styles.filterTab,
                  isSelected && { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
                  !isSelected && {
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.filterTabText,
                    isSelected && { color: '#FFFFFF', fontWeight: '800' },
                  ]}
                >
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Main content body */}
        {locationStatus === 'loading' ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <ThemedText style={styles.loadingText} themeColor="textSecondary">
              Retrieving current location...
            </ThemedText>
          </View>
        ) : locationStatus === 'permission_denied' ? (
          <View style={styles.centerContainer}>
            <SymbolView
              name={{
                ios: 'location.slash.fill',
                android: 'location_disabled',
                web: 'location_off',
              } as any}
              size={48}
              tintColor="#EF4444"
            />
            <ThemedText style={styles.errorTitle}>Location Permission Required</ThemedText>
            <ThemedText style={styles.errorText} themeColor="textSecondary">
              {locationMessage || 'Please allow location access in your browser settings so Safe Places can find emergency amenities near you.'}
            </ThemedText>
            <Pressable onPress={handleRefresh} style={styles.retryButton}>
              <ThemedText style={styles.retryButtonText}>Grant Permission & Retry</ThemedText>
            </Pressable>
          </View>
        ) : locationStatus === 'unavailable' || !coords ? (
          <View style={styles.centerContainer}>
            <SymbolView
              name={{
                ios: 'exclamationmark.circle.fill',
                android: 'error',
                web: 'exclamation-circle',
              } as any}
              size={48}
              tintColor="#EF4444"
            />
            <ThemedText style={styles.errorTitle}>Location Unavailable</ThemedText>
            <ThemedText style={styles.errorText} themeColor="textSecondary">
              {locationMessage || 'Unable to detect your current location. Please check your GPS signal and network.'}
            </ThemedText>
            <Pressable onPress={handleRefresh} style={styles.retryButton}>
              <ThemedText style={styles.retryButtonText}>Enable GPS & Retry</ThemedText>
            </Pressable>
          </View>
        ) : placesLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <ThemedText style={styles.loadingText} themeColor="textSecondary">
              Searching nearby amenities in OpenStreetMap...
            </ThemedText>
          </View>
        ) : apiError ? (
          <View style={styles.centerContainer}>
            <SymbolView
              name={{
                ios: 'wifi.slash',
                android: 'wifi-off',
                web: 'wifi-off',
              } as any}
              size={48}
              tintColor="#D97706"
            />
            <ThemedText style={styles.errorTitle}>Search Failed</ThemedText>
            <ThemedText style={styles.errorText} themeColor="textSecondary">
              {apiError}
            </ThemedText>
            <Pressable onPress={handleRetrySearch} style={styles.retryButton}>
              <ThemedText style={styles.retryButtonText}>Retry Search</ThemedText>
            </Pressable>
          </View>
        ) : filteredPlaces.length === 0 ? (
          <View style={styles.centerContainer}>
            <SymbolView
              name={{
                ios: 'mappin.slash',
                android: 'location-off',
                web: 'location-off',
              } as any}
              size={48}
              tintColor="#64748B"
            />
            <ThemedText style={styles.errorTitle}>No Safe Places Found</ThemedText>
            <ThemedText style={styles.errorText} themeColor="textSecondary">
              No {getCategoryLabel()} found within {searchRadiusKm}km of your current location.
            </ThemedText>
            {(() => {
              const nextRadius = searchRadiusKm === 3 ? 5 : searchRadiusKm === 5 ? 10 : null;
              if (nextRadius === null) return null;
              return (
                <View style={styles.radiusControlRow}>
                  <Pressable
                    onPress={() => setSearchRadiusKm(nextRadius)}
                    style={styles.radiusButton}
                  >
                    <ThemedText style={styles.radiusButtonText}>
                      Expand Search to {nextRadius}km
                    </ThemedText>
                  </Pressable>
                </View>
              );
            })()}
          </View>
        ) : (
          <FlatList
            data={filteredPlaces}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const info = getPlaceIcon(item.type);
              return (
                <View
                  style={[
                    styles.placeCard,
                    {
                      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                      borderColor: isDark ? '#334155' : '#E2E8F0',
                    },
                  ]}
                >
                  <View style={[styles.iconCircle, { backgroundColor: `${info.color}15` }]}>
                    <ThemedText style={styles.emojiIcon}>{info.emoji}</ThemedText>
                  </View>

                  <View style={styles.placeMeta}>
                    <ThemedText style={styles.placeName}>{item.name}</ThemedText>
                    {item.address && (
                      <ThemedText style={styles.placeAddress} themeColor="textSecondary">
                        {item.address}
                      </ThemedText>
                    )}
                    <ThemedText style={[styles.distanceText, { color: info.color }]}>
                      {item.distanceKm.toFixed(2)} km away
                    </ThemedText>
                  </View>

                  <Pressable
                    onPress={() => openNavigation(item)}
                    style={({ pressed }) => [
                      styles.navigateBtn,
                      { backgroundColor: info.color },
                      pressed && styles.pressed,
                    ]}
                  >
                    <SymbolView
                      name={{
                        ios: 'location.north.fill',
                        android: 'navigation',
                        web: 'navigation',
                      } as any}
                      size={15}
                      tintColor="#FFFFFF"
                    />
                    <ThemedText style={styles.navigateBtnText}>Go</ThemedText>
                  </Pressable>
                </View>
              );
            }}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'transparent',
    gap: 8,
  },
  locationBarText: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: '#7C3AED',
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  radiusControlRow: {
    marginTop: 10,
  },
  radiusButton: {
    borderColor: '#7C3AED',
    borderWidth: 1.5,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusButtonText: {
    color: '#7C3AED',
    fontWeight: '700',
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiIcon: {
    fontSize: 20,
  },
  placeMeta: {
    flex: 1,
    gap: 2,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '700',
  },
  placeAddress: {
    fontSize: 11,
    lineHeight: 15,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  navigateBtn: {
    flexDirection: 'row',
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  navigateBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
});
