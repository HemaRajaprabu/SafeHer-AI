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

// --- Shared Global Location State for Multi-Subscriber Watcher ---
let sharedSubscription: Location.LocationSubscription | null = null;
let sharedLocation: LocationData | null = null;
let sharedError: string | null = null;
let sharedErrorType: LocationErrorType = null;
let activeTrackersCount = 0;

interface SharedState {
    location: LocationData | null;
    loading: boolean;
    error: string | null;
    errorType: LocationErrorType;
}

const sharedCallbacks = new Set<(loc: LocationData) => void>();
const sharedStateSetters = new Set<(state: SharedState) => void>();

function updateSharedState(state: Partial<SharedState>) {
    if (state.location !== undefined) sharedLocation = state.location;
    if (state.error !== undefined) sharedError = state.error;
    if (state.errorType !== undefined) sharedErrorType = state.errorType;

    const fullState: SharedState = {
        location: sharedLocation,
        loading: !sharedLocation && sharedSubscription === null && sharedError === null,
        error: sharedError,
        errorType: sharedErrorType,
    };

    sharedStateSetters.forEach(setter => {
        try {
            setter(fullState);
        } catch (e) {
            console.error('Error updating subscriber state setter:', e);
        }
    });
}

export function useLocation() {
    const [location, setLocation] = useState<LocationData | null>(sharedLocation);
    const [loading, setLoading] = useState<boolean>(!sharedLocation && sharedSubscription === null && sharedError === null);
    const [error, setError] = useState<string | null>(sharedError);
    const [errorType, setErrorType] = useState<LocationErrorType>(sharedErrorType);
    
    // Tracking state
    const [isTracking, setIsTracking] = useState<boolean>(sharedSubscription !== null);
    const [isBackgroundTracking, setIsBackgroundTracking] = useState<boolean>(false);
    
    // Local tracking request flags
    const hasRequestedTrackingRef = useRef<boolean>(false);
    const currentCallbackRef = useRef<((loc: LocationData) => void) | null>(null);

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
                sharedLocation = data;
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
                    sharedLocation = data;
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
        // Unregister any previous callback from this specific hook instance first
        if (currentCallbackRef.current) {
            sharedCallbacks.delete(currentCallbackRef.current);
            currentCallbackRef.current = null;
        }

        // Register new callback
        if (onLocationUpdate) {
            currentCallbackRef.current = onLocationUpdate;
            sharedCallbacks.add(onLocationUpdate);
        }

        setIsTracking(true);

        // If this hook instance hasn't recorded its active tracking request yet, increment counter
        if (!hasRequestedTrackingRef.current) {
            hasRequestedTrackingRef.current = true;
            activeTrackersCount++;
        }

        // If a shared subscription is already active, we just return the cached coordinates to the new callback
        if (sharedSubscription) {
            if (sharedLocation) {
                setLocation(sharedLocation);
                if (onLocationUpdate) {
                    onLocationUpdate(sharedLocation);
                }
            }
            return;
        }

        // Otherwise, start the global subscription
        sharedError = null;
        sharedErrorType = null;
        updateSharedState({ location: sharedLocation, error: null, errorType: null });

        try {
            if (Platform.OS !== 'web') {
                const servicesEnabled = await Location.hasServicesEnabledAsync();
                if (!servicesEnabled) {
                    const errMsg = 'Location services are disabled. Please enable GPS.';
                    sharedError = errMsg;
                    sharedErrorType = 'services_disabled';
                    setIsTracking(false);
                    hasRequestedTrackingRef.current = false;
                    activeTrackersCount = Math.max(0, activeTrackersCount - 1);
                    updateSharedState({ location: null, error: errMsg, errorType: 'services_disabled' });
                    return;
                }
            }

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                const errMsg = 'Location permission denied. Please allow location access in settings.';
                sharedError = errMsg;
                sharedErrorType = 'permission_denied';
                setIsTracking(false);
                hasRequestedTrackingRef.current = false;
                activeTrackersCount = Math.max(0, activeTrackersCount - 1);
                updateSharedState({ location: null, error: errMsg, errorType: 'permission_denied' });
                return;
            }

            sharedSubscription = await Location.watchPositionAsync(
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
                        sharedLocation = data;
                        updateSharedState({ location: data, error: null, errorType: null });
                        
                        // Fire all callbacks
                        sharedCallbacks.forEach(cb => {
                            try {
                                cb(data);
                            } catch (e) {
                                console.error('Error in shared location callback:', e);
                            }
                        });
                    }
                }
            );
        } catch (err: any) {
            console.log('Error starting tracking:', err);
            const errMsg = 'Unable to start continuous location tracking.';
            sharedError = errMsg;
            sharedErrorType = 'unavailable';
            setIsTracking(false);
            hasRequestedTrackingRef.current = false;
            activeTrackersCount = Math.max(0, activeTrackersCount - 1);
            updateSharedState({ location: null, error: errMsg, errorType: 'unavailable' });
        }
    }, []);

    const stopTracking = useCallback(() => {
        setIsTracking(false);

        // Remove our callback
        if (currentCallbackRef.current) {
            sharedCallbacks.delete(currentCallbackRef.current);
            currentCallbackRef.current = null;
        }

        // Decrement active trackers count
        if (hasRequestedTrackingRef.current) {
            hasRequestedTrackingRef.current = false;
            activeTrackersCount = Math.max(0, activeTrackersCount - 1);

            // Clean up native subscription if no active trackers remain
            if (activeTrackersCount === 0 && sharedSubscription) {
                sharedSubscription.remove();
                sharedSubscription = null;
            }
        }
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
        const stateSetter = (state: SharedState) => {
            setLocation(state.location);
            setLoading(state.loading);
            setError(state.error);
            setErrorType(state.errorType);
            setIsTracking(sharedSubscription !== null);
        };

        sharedStateSetters.add(stateSetter);

        if (!sharedLocation) {
            fetchLocation();
        }

        return () => {
            sharedStateSetters.delete(stateSetter);
            
            // Clean up foreground callback if this instance had one
            if (currentCallbackRef.current) {
                sharedCallbacks.delete(currentCallbackRef.current);
                currentCallbackRef.current = null;
            }

            // Decrement tracker count if this hook was tracking
            if (hasRequestedTrackingRef.current) {
                hasRequestedTrackingRef.current = false;
                activeTrackersCount = Math.max(0, activeTrackersCount - 1);
                if (activeTrackersCount === 0 && sharedSubscription) {
                    sharedSubscription.remove();
                    sharedSubscription = null;
                }
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
