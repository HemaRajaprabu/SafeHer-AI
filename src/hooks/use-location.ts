import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';

export interface LocationData {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    timestamp: number;
    googleMapsLink: string;
}

export type LocationErrorType = 'permission_denied' | 'services_disabled' | 'unavailable' | null;

export const LOCATION_BACKGROUND_TASK = 'background-location-tracking';

// Define background task at module/global scope as required by Expo
TaskManager.defineTask(LOCATION_BACKGROUND_TASK, async ({ data, error }) => {
    if (error) {
        console.log('Background Location Task Error:', error);
        return;
    }
    if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };
        if (locations && locations.length > 0) {
            const latestLoc = locations[0];
            console.log('Background location update:', latestLoc);

            try {
                // 1. Verify SOS is active
                const isSOSActive = await AsyncStorage.getItem('isSOSActive');
                if (isSOSActive !== 'true') {
                    console.log('SOS is inactive. Stopping background updates.');
                    await Location.stopLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
                    return;
                }

                // 2. Fetch authenticated user session
                const { data: { session } } = await supabase.auth.getSession();
                if (session && session.user) {
                    const { latitude, longitude, accuracy } = latestLoc.coords;
                    
                    // 3. Upsert coordinates to Supabase
                    const { error: upsertErr } = await supabase
                        .from('sos_locations')
                        .upsert({
                            user_id: session.user.id,
                            latitude,
                            longitude,
                            accuracy,
                            is_active: true,
                            updated_at: new Date(latestLoc.timestamp).toISOString(),
                        });
                    if (upsertErr) {
                        console.log('Error updating background coordinates in Supabase:', upsertErr.message);
                    }
                }
            } catch (err) {
                console.log('Error in background location task execution:', err);
            }
        }
    }
});

export function useLocation() {
    const [location, setLocation] = useState<LocationData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [errorType, setErrorType] = useState<LocationErrorType>(null);
    
    // Tracking state
    const [isTracking, setIsTracking] = useState<boolean>(false);
    const [isBackgroundTracking, setIsBackgroundTracking] = useState<boolean>(false);
    const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

    const fetchLocation = useCallback(async () => {
        setLoading(true);
        setError(null);
        setErrorType(null);

        try {
            // Check if services are enabled (Mobile only)
            if (Platform.OS !== 'web') {
                const servicesEnabled = await Location.hasServicesEnabledAsync();
                if (!servicesEnabled) {
                    setError('Location services are disabled. Please enable GPS.');
                    setErrorType('services_disabled');
                    setLoading(false);
                    return null;
                }
            }

            // Check and request permissions
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setError('Location permission denied. Please allow location access in settings.');
                setErrorType('permission_denied');
                setLoading(false);
                return null;
            }

            // Get position
            const pos = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            if (pos && pos.coords) {
                const { latitude, longitude, accuracy } = pos.coords;
                const data: LocationData = {
                    latitude,
                    longitude,
                    accuracy,
                    timestamp: pos.timestamp,
                    googleMapsLink: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
                };
                setLocation(data);
                setLoading(false);
                return data;
            } else {
                throw new Error('No coordinates returned');
            }
        } catch (err: any) {
            console.log('Error getting location:', err);
            
            // Fallback to last known location if possible
            try {
                const lastKnown = await Location.getLastKnownPositionAsync();
                if (lastKnown && lastKnown.coords) {
                    const { latitude, longitude, accuracy } = lastKnown.coords;
                    const data: LocationData = {
                        latitude,
                        longitude,
                        accuracy,
                        timestamp: lastKnown.timestamp,
                        googleMapsLink: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
                    };
                    setLocation(data);
                    setLoading(false);
                    return data;
                }
            } catch (fallbackErr) {
                console.log('Fallback to last known location failed:', fallbackErr);
            }

            setError('Location unavailable. Please check GPS and network.');
            setErrorType('unavailable');
            setLoading(false);
            return null;
        }
    }, []);

    const startTracking = useCallback(async (onLocationUpdate?: (loc: LocationData) => void) => {
        // Clean up any existing subscription first to prevent duplicates
        if (subscriptionRef.current) {
            subscriptionRef.current.remove();
            subscriptionRef.current = null;
        }

        setError(null);
        setErrorType(null);
        setIsTracking(true);

        try {
            // Check if services are enabled (Mobile only)
            if (Platform.OS !== 'web') {
                const servicesEnabled = await Location.hasServicesEnabledAsync();
                if (!servicesEnabled) {
                    setError('Location services are disabled. Please enable GPS.');
                    setErrorType('services_disabled');
                    setIsTracking(false);
                    return;
                }
            }

            // Check permissions
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setError('Location permission denied. Please allow location access in settings.');
                setErrorType('permission_denied');
                setIsTracking(false);
                return;
            }

            // Start subscription
            const sub = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 10000, // Update every 10 seconds to save battery
                    distanceInterval: 10, // Or every 10 meters
                },
                (pos) => {
                    if (pos && pos.coords) {
                        const { latitude, longitude, accuracy } = pos.coords;
                        const data: LocationData = {
                            latitude,
                            longitude,
                            accuracy,
                            timestamp: pos.timestamp,
                            googleMapsLink: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
                        };
                        setLocation(data);
                        if (onLocationUpdate) {
                            onLocationUpdate(data);
                        }
                    }
                }
            );

            subscriptionRef.current = sub;
        } catch (err: any) {
            console.log('Error starting tracking:', err);
            setError('Unable to start continuous location tracking.');
            setErrorType('unavailable');
            setIsTracking(false);
        }
    }, []);

    const stopTracking = useCallback(() => {
        if (subscriptionRef.current) {
            subscriptionRef.current.remove();
            subscriptionRef.current = null;
        }
        setIsTracking(false);
    }, []);

    // Background Tracking Management
    const startBackgroundTracking = useCallback(async () => {
        if (Platform.OS === 'web') return false;

        setError(null);
        setErrorType(null);
        setIsBackgroundTracking(true);

        try {
            // 1. Verify foreground permission first
            const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
            if (foregroundStatus !== 'granted') {
                setError('Location permission denied.');
                setErrorType('permission_denied');
                setIsBackgroundTracking(false);
                return false;
            }

            // 2. Request background permission
            const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
            if (backgroundStatus !== 'granted') {
                setError('Background location permission denied.');
                setErrorType('permission_denied');
                setIsBackgroundTracking(false);
                return false;
            }

            // 3. Start background location updates task
            const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
            if (!hasStarted) {
                await Location.startLocationUpdatesAsync(LOCATION_BACKGROUND_TASK, {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 10000, // 10 seconds to optimize battery
                    distanceInterval: 10, // 10 meters
                    foregroundService: {
                        notificationTitle: "SafeHer AI Active Tracking",
                        notificationBody: "Tracking user coordinates in background.",
                        notificationColor: "#DC2626",
                    },
                });
            }
            return true;
        } catch (err) {
            console.log('Error starting background tracking:', err);
            setError('Unable to start background location tracking.');
            setErrorType('unavailable');
            setIsBackgroundTracking(false);
            return false;
        }
    }, []);

    const stopBackgroundTracking = useCallback(async () => {
        if (Platform.OS === 'web') return;

        setIsBackgroundTracking(false);
        try {
            const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
            if (hasStarted) {
                await Location.stopLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
            }
        } catch (err) {
            console.log('Error stopping background tracking:', err);
        }
    }, []);

    useEffect(() => {
        fetchLocation();
        
        // Cleanup foreground subscription on unmount
        return () => {
            if (subscriptionRef.current) {
                subscriptionRef.current.remove();
                subscriptionRef.current = null;
            }
        };
    }, [fetchLocation]);

    return {
        location,
        loading,
        error,
        errorType,
        isTracking,
        isBackgroundTracking,
        startTracking,
        stopTracking,
        startBackgroundTracking,
        stopBackgroundTracking,
        refresh: fetchLocation,
    };
}
