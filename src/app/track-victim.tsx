import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/utils/supabase';

interface LocationState {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    timestamp: number;
    googleMapsLink: string;
}

export default function TrackVictimScreen() {
    const theme = useTheme();
    const { userId } = useLocalSearchParams<{ userId: string }>();
    const { user, profile } = useAuth();

    const [loading, setLoading] = useState<boolean>(true);
    const [victimName, setVictimName] = useState<string>('User');
    const [location, setLocation] = useState<LocationState | null>(null);
    const [isSOSActive, setIsSOSActive] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [errorType, setErrorType] = useState<'unauthorized' | 'inactive' | 'error' | null>(null);

    const openMaps = async () => {
        if (!location) return;
        try {
            await Linking.openURL(location.googleMapsLink);
        } catch (err) {
            Alert.alert('Error', 'Unable to open Google Maps.');
        }
    };

    const formatTimestamp = (ts: number) => {
        const date = new Date(ts);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const loadTrackingData = async () => {
        if (!userId || !user) {
            setErrorMsg('Invalid session or user ID.');
            setErrorType('error');
            setLoading(false);
            return;
        }

        setLoading(true);
        setErrorMsg(null);
        setErrorType(null);

        try {
            // 1. Fetch the victim's name
            const { data: profileData, error: profileErr } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', userId)
                .single();

            if (profileErr) {
                console.log('Error fetching victim profile:', profileErr.message);
            } else if (profileData) {
                setVictimName(profileData.full_name);
            }

            // 2. Check if the currently logged-in contact is authorized (registered in victim's contact list)
            const contactEmail = profile?.email || user.email;
            if (!contactEmail) {
                setErrorMsg('Unable to retrieve your email address for verification.');
                setErrorType('error');
                setLoading(false);
                return;
            }

            const { data: contactData, error: contactErr } = await supabase
                .from('emergency_contacts')
                .select('id')
                .eq('user_id', userId)
                .eq('contact_email', contactEmail.toLowerCase())
                .maybeSingle();

            if (contactErr) {
                console.log('Error checking authorization:', contactErr.message);
                setErrorMsg('Failed to check authorization. Please check network connection.');
                setErrorType('error');
                setLoading(false);
                return;
            }

            if (!contactData) {
                setErrorMsg('Access Denied. You are not registered as an emergency contact for this user.');
                setErrorType('unauthorized');
                setLoading(false);
                return;
            }

            // 3. Fetch the location status from sos_locations
            const { data: locData, error: locErr } = await supabase
                .from('sos_locations')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (locErr) {
                console.log('Error fetching SOS locations:', locErr.message);
                setErrorMsg('Error retrieving location coordinates.');
                setErrorType('error');
                setLoading(false);
                return;
            }

            if (!locData || !locData.is_active) {
                setIsSOSActive(false);
                setErrorMsg('No active emergency SOS found for this user. Tracking is disabled.');
                setErrorType('inactive');
                setLoading(false);
                return;
            }

            // Location is active!
            setIsSOSActive(true);
            setLocation({
                latitude: locData.latitude,
                longitude: locData.longitude,
                accuracy: locData.accuracy,
                timestamp: new Date(locData.updated_at).getTime(),
                googleMapsLink: `https://www.google.com/maps/search/?api=1&query=${locData.latitude},${locData.longitude}`,
            });
            setLoading(false);
        } catch (err) {
            console.log('Tracking load exception:', err);
            setErrorMsg('An unexpected error occurred. Please try again.');
            setErrorType('error');
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTrackingData();
    }, [userId, user, profile]);

    // Supabase Realtime Subscription
    useEffect(() => {
        if (!userId || !isSOSActive) return;

        console.log('Subscribing to Realtime location updates for:', userId);
        const channel = supabase
            .channel(`sos-locations-realtime-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'sos_locations',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    console.log('Realtime location update received:', payload);
                    if (payload.new) {
                        const newLoc = payload.new as any;
                        if (newLoc.is_active) {
                            setLocation({
                                latitude: newLoc.latitude,
                                longitude: newLoc.longitude,
                                accuracy: newLoc.accuracy,
                                timestamp: new Date(newLoc.updated_at).getTime(),
                                googleMapsLink: `https://www.google.com/maps/search/?api=1&query=${newLoc.latitude},${newLoc.longitude}`,
                            });
                            setIsSOSActive(true);
                        } else {
                            setIsSOSActive(false);
                            setErrorMsg('Location tracking has been stopped. The user is safe.');
                            setErrorType('inactive');
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            console.log('Unsubscribing from Realtime location updates');
            supabase.removeChannel(channel);
        };
    }, [userId, isSOSActive]);

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Pressable
                            onPress={() => router.back()}
                            style={[styles.backButton, { backgroundColor: theme.backgroundElement }]}
                        >
                            <SymbolView
                                name={{
                                    ios: 'chevron.left',
                                    android: 'arrow-back',
                                    web: 'arrow-left',
                                } as any}
                                size={24}
                                tintColor={theme.text}
                            />
                        </Pressable>

                        <ThemedText style={styles.headerTitle}>
                            Live Tracker
                        </ThemedText>

                        <View style={styles.headerSpace} />
                    </View>

                    {/* Tracker Banner */}
                    <View style={styles.iconContainer}>
                        <View style={[styles.locationBadge, { backgroundColor: loading ? '#3B82F6' : errorType === 'unauthorized' ? '#EF4444' : isSOSActive ? '#10B981' : '#64748B' }]}>
                            <SymbolView
                                name={{
                                    ios: 'scope',
                                    android: 'gps-fixed',
                                    web: 'target',
                                } as any}
                                size={50}
                                tintColor="#FFFFFF"
                            />
                        </View>
                    </View>

                    {/* Main Tracker Card */}
                    <ThemedView type="backgroundElement" style={styles.mainCard}>
                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#3B82F6" />
                                <ThemedText style={styles.statusText}>
                                    Connecting to secure GPS stream...
                                </ThemedText>
                            </View>
                        ) : errorMsg ? (
                            <View style={styles.errorContainer}>
                                <SymbolView
                                    name={{
                                        ios: errorType === 'unauthorized' ? 'lock.fill' : 'exclamationmark.triangle.fill',
                                        android: errorType === 'unauthorized' ? 'lock' : 'warning',
                                        web: errorType === 'unauthorized' ? 'lock' : 'warning',
                                    } as any}
                                    size={36}
                                    tintColor={errorType === 'unauthorized' ? '#EF4444' : '#64748B'}
                                />
                                <ThemedText style={styles.errorTitle}>
                                    {errorType === 'unauthorized' ? 'Access Unauthorized' : 'Incident Inactive'}
                                </ThemedText>
                                <ThemedText style={styles.errorDescription}>
                                    {errorMsg}
                                </ThemedText>
                                {errorType === 'inactive' && (
                                    <ThemedText style={styles.errorHelp} themeColor="textSecondary">
                                        For safety reasons, location access is immediately revoked when the SOS status becomes inactive.
                                    </ThemedText>
                                )}
                                <Pressable
                                    onPress={loadTrackingData}
                                    style={({ pressed }) => [
                                        styles.retryButton,
                                        { backgroundColor: theme.backgroundSelected },
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <ThemedText style={[styles.retryButtonText, { color: theme.text }]}>
                                        Refresh Status
                                    </ThemedText>
                                </Pressable>
                            </View>
                        ) : location && isSOSActive ? (
                            <View style={styles.locationContainer}>
                                <ThemedText style={styles.victimLabel}>
                                    TRACKING EMERGENCY
                                </ThemedText>
                                <ThemedText style={styles.victimName}>
                                    {victimName}
                                </ThemedText>

                                <View style={styles.badgeRow}>
                                    <View style={styles.gpsActiveBadge}>
                                        <View style={styles.gpsPulseDot} />
                                        <ThemedText style={styles.gpsActiveText}>
                                            🟢 Live Tracking Active
                                        </ThemedText>
                                    </View>
                                    <ThemedText style={styles.timestampText} themeColor="textSecondary">
                                        Updated: {formatTimestamp(location.timestamp)}
                                    </ThemedText>
                                </View>

                                {/* Coordinates */}
                                <View style={styles.coordsGrid}>
                                    <View style={[styles.coordBox, { borderColor: theme.backgroundSelected }]}>
                                        <ThemedText style={styles.coordLabel} themeColor="textSecondary">
                                            LATITUDE
                                        </ThemedText>
                                        <ThemedText style={styles.coordValue}>
                                            {location.latitude.toFixed(6)}
                                        </ThemedText>
                                    </View>

                                    <View style={[styles.coordBox, { borderColor: theme.backgroundSelected }]}>
                                        <ThemedText style={styles.coordLabel} themeColor="textSecondary">
                                            LONGITUDE
                                        </ThemedText>
                                        <ThemedText style={styles.coordValue}>
                                            {location.longitude.toFixed(6)}
                                        </ThemedText>
                                    </View>
                                </View>

                                {/* Accuracy Info */}
                                {location.accuracy !== null && (
                                    <View style={styles.accuracyRow}>
                                        <SymbolView
                                            name={{
                                                ios: 'scope',
                                                android: 'gps-fixed',
                                                web: 'target',
                                            } as any}
                                            size={16}
                                            tintColor={theme.textSecondary}
                                        />
                                        <ThemedText style={styles.accuracyText} themeColor="textSecondary">
                                            Accuracy: ±{location.accuracy.toFixed(1)} meters
                                        </ThemedText>
                                    </View>
                                )}

                                {/* Maps Link Display */}
                                <View style={[styles.linkContainer, { backgroundColor: theme.backgroundSelected }]}>
                                    <SymbolView
                                        name={{
                                            ios: 'link',
                                            android: 'link',
                                            web: 'link',
                                        } as any}
                                        size={16}
                                        tintColor={theme.text}
                                    />
                                    <ThemedText numberOfLines={1} style={styles.linkText}>
                                        {location.googleMapsLink}
                                    </ThemedText>
                                </View>

                                {/* Button */}
                                <Pressable
                                    onPress={openMaps}
                                    style={({ pressed }) => [
                                        styles.mapButton,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <SymbolView
                                        name={{
                                            ios: 'map.fill',
                                            android: 'map',
                                            web: 'map',
                                        } as any}
                                        size={20}
                                        tintColor="#FFFFFF"
                                    />
                                    <ThemedText style={styles.buttonText}>
                                        Open Location in Google Maps
                                    </ThemedText>
                                </Pressable>
                            </View>
                        ) : null}
                    </ThemedView>

                    {/* Information / Safety advice */}
                    <View style={styles.infoCard}>
                        <ThemedText style={styles.infoTitle}>
                            Privacy & Security Policy
                        </ThemedText>
                        <ThemedText style={styles.infoDescription} themeColor="textSecondary">
                            This location feed is encrypted and secured by Supabase RLS. You can only view this coordinate stream because you are registered as a trusted emergency contact by the user. The coordinate stream starts automatically when they activate SOS and is immediately revoked when the incident ends.
                        </ThemedText>
                    </View>
                </ScrollView>
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
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    headerSpace: {
        width: 44,
    },
    iconContainer: {
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 24,
    },
    locationBadge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    mainCard: {
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    statusText: {
        marginTop: 16,
        fontSize: 15,
        fontWeight: '600',
    },
    errorContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#64748B',
        marginTop: 12,
        marginBottom: 8,
    },
    errorDescription: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 12,
        paddingHorizontal: 10,
    },
    errorHelp: {
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    retryButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    retryButtonText: {
        fontWeight: '700',
        fontSize: 14,
    },
    locationContainer: {
        width: '100%',
    },
    victimLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#DC2626',
        letterSpacing: 1,
        marginBottom: 4,
    },
    victimName: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 16,
    },
    badgeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    gpsActiveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 6,
    },
    gpsPulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981',
    },
    gpsActiveText: {
        color: '#065F46',
        fontSize: 11,
        fontWeight: '800',
    },
    timestampText: {
        fontSize: 12,
    },
    coordsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    coordBox: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
    },
    coordLabel: {
        fontSize: 10,
        fontWeight: '800',
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    coordValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    accuracyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 16,
        paddingLeft: 4,
    },
    accuracyText: {
        fontSize: 12,
    },
    linkContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        gap: 8,
        marginBottom: 20,
    },
    linkText: {
        flex: 1,
        fontSize: 12,
    },
    mapButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563EB',
        paddingVertical: 14,
        borderRadius: 14,
        gap: 8,
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14,
    },
    infoCard: {
        paddingHorizontal: 8,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 8,
    },
    infoDescription: {
        fontSize: 13,
        lineHeight: 20,
    },
    pressed: {
        opacity: 0.8,
    },
});
