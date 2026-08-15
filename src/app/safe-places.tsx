import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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
import { useLocation, LocationData } from '@/hooks/use-location';

interface SafePlace {
  id: number;
  name: string;
  type: 'police' | 'hospital' | 'fire_station' | 'clinic' | 'other';
  latitude: number;
  longitude: number;
  distanceKm: number;
  address?: string;
}

type FilterCategory = 'all' | 'police' | 'hospital' | 'fire_station';

// Haversine formula to compute distance between two coordinates
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
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

export default function SafePlacesScreen() {
  const theme = useTheme();
  const isDark = theme.text === '#ffffff';

  const {
    location,
    loading: locationLoading,
    error: locationError,
    errorType: locationErrorType,
    refresh: refreshLocation,
  } = useLocation();

  const [places, setPlaces] = useState<SafePlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [searchRadiusKm, setSearchRadiusKm] = useState<number>(3); // 3km default

  const fetchNearbyPlaces = useCallback(async (lat: number, lon: number, radiusKm: number) => {
    setPlacesLoading(true);
    setApiError(null);

    const radiusMeters = radiusKm * 1000;

    // Overpass API Query for Safe Places (police, hospitals, fire stations, clinics)
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"="police"](around:${radiusMeters},${lat},${lon});
        way["amenity"="police"](around:${radiusMeters},${lat},${lon});
        node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
        way["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
        node["amenity"="fire_station"](around:${radiusMeters},${lat},${lon});
        way["amenity"="fire_station"](around:${radiusMeters},${lat},${lon});
        node["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
        way["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
      );
      out body 35;
    `;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error(`Failed to load safe places. Status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.elements) {
        setPlaces([]);
        setPlacesLoading(false);
        return;
      }

      const parsedPlaces: SafePlace[] = data.elements.map((el: any) => {
        // Overpass elements can be nodes (have lat/lon) or ways (have center or average coordinate)
        const placeLat = el.lat || el.center?.lat || lat;
        const placeLon = el.lon || el.center?.lon || lon;

        let placeType: SafePlace['type'] = 'other';
        const amenity = el.tags?.amenity;
        if (amenity === 'police') placeType = 'police';
        else if (amenity === 'hospital') placeType = 'hospital';
        else if (amenity === 'clinic') placeType = 'clinic';
        else if (amenity === 'fire_station') placeType = 'fire_station';

        const name =
          el.tags?.name ||
          el.tags?.brand ||
          el.tags?.operator ||
          `${placeType.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`;

        const street = el.tags?.['addr:street'] || '';
        const houseNumber = el.tags?.['addr:housenumber'] || '';
        const city = el.tags?.['addr:city'] || '';
        const address =
          street || houseNumber || city
            ? `${houseNumber} ${street}${street && city ? ', ' : ''}${city}`.trim()
            : undefined;

        return {
          id: el.id,
          name,
          type: placeType,
          latitude: placeLat,
          longitude: placeLon,
          distanceKm: getDistanceKm(lat, lon, placeLat, placeLon),
          address,
        };
      });

      // Sort by closest distance first
      parsedPlaces.sort((a, b) => a.distanceKm - b.distanceKm);
      setPlaces(parsedPlaces);
    } catch (err: any) {
      console.log('Error fetching safe places from Overpass API:', err);
      setApiError('Unable to load nearby safety spots due to network or server issues.');
    } finally {
      setPlacesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (location?.latitude && location?.longitude) {
      fetchNearbyPlaces(location.latitude, location.longitude, searchRadiusKm);
    }
  }, [location, searchRadiusKm, fetchNearbyPlaces]);

  const handleRefresh = async () => {
    const loc = await refreshLocation();
    if (loc?.latitude && loc?.longitude) {
      fetchNearbyPlaces(loc.latitude, loc.longitude, searchRadiusKm);
    }
  };

  const openNavigation = async (place: SafePlace) => {
    if (!location) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${location.latitude},${location.longitude}&destination=${place.latitude},${place.longitude}&travelmode=walking`;
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
                ios: 'chevron.left',
                android: 'arrow_back',
                web: 'arrow-left',
              } as any}
              size={24}
              tintColor={isDark ? '#FFFFFF' : '#111827'}
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
                web: 'sync',
              } as any}
              size={20}
              tintColor={isDark ? '#FFFFFF' : '#111827'}
            />
          </Pressable>
        </View>

        {/* User Location Bar */}
        {location && (
          <View style={[styles.locationBar, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
            <SymbolView
              name={{
                ios: 'location.circle.fill',
                android: 'my-location',
                web: 'location-arrow',
              } as any}
              size={16}
              tintColor="#7C3AED"
            />
            <ThemedText style={styles.locationBarText}>
              Current GPS: {location?.latitude?.toFixed(5)}, {location?.longitude?.toFixed(5)}
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
        {locationLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <ThemedText style={styles.loadingText} themeColor="textSecondary">
              Retrieving hardware GPS location...
            </ThemedText>
          </View>
        ) : locationError ? (
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
            <ThemedText style={styles.errorTitle}>Location Offline</ThemedText>
            <ThemedText style={styles.errorText} themeColor="textSecondary">
              {locationError}
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
            <Pressable onPress={handleRefresh} style={styles.retryButton}>
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
                        ios: 'safari.fill',
                        android: 'directions',
                        web: 'location-arrow',
                      } as any}
                      size={18}
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
    borderRadius: 20,
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
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
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
