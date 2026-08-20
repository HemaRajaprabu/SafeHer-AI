import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLocation } from '@/hooks/use-location';
import { useTheme } from '@/hooks/use-theme';

export default function LiveLocationScreen() {
    const theme = useTheme();
    const {
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
        refresh,
    } = useLocation();
    const [isSOSActive, setIsSOSActive] = useState<boolean>(false);

    useEffect(() => {
        const checkSOSAndStartTracking = async () => {
            try {
                const active = await AsyncStorage.getItem('isSOSActive');
                const isSOSActiveBool = active === 'true';
                setIsSOSActive(isSOSActiveBool);
                if (isSOSActiveBool) {
                    await startBackgroundTracking();
                    await startTracking();
                }
            } catch (err) {
                console.log('Error checking SOS active status in live-location:', err);
            }
        };
        checkSOSAndStartTracking();

        return () => {
            stopTracking();
        };
    }, [startTracking, stopTracking]);

    const openMaps = async () => {
        if (!location) return;
        try {
            await Linking.openURL(location.googleMapsLink);
        } catch (err) {
            Alert.alert('Error', 'Unable to open Google Maps.');
        }
    };

    const shareLocation = async () => {
        if (!location) return;
        try {
            await Share.share({
                message: `My Live Location (via SafeHer AI):\n${location.googleMapsLink}\n\nLatitude: ${location.latitude}\nLongitude: ${location.longitude}`,
            });
        } catch (err) {
            console.log('Error sharing location:', err);
        }
    };

    const formatTimestamp = (ts: number) => {
        const date = new Date(ts);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

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
                            style={({ pressed }) => [
                                styles.backButton,
                                pressed && styles.pressed,
                            ]}
                        >
                            <SymbolView
                                name={{
                                    ios: 'location.fill',
                                    android: 'location_on',
                                    web: 'location_on',
                                } as any}
                                size={24}
                                tintColor={theme.text}
                            />
                        </Pressable>

                        <ThemedText style={styles.headerTitle}>
                            Live Location
                        </ThemedText>

                        <View style={styles.headerSpace} />
                    </View>

                    {/* Location Icon & Pulse status */}
                    <View style={styles.iconContainer}>
                        <SymbolView
                            name={{
                                ios: 'location.fill',
                                android: 'location_on',
                                web: 'location_on',
                            } as any}
                            size={48}
                            tintColor={loading ? '#3B82F6' : error ? '#EF4444' : '#10B981'}
                        />
                    </View>

                    {/* Main Card */}
                    <ThemedView type="backgroundElement" style={styles.mainCard}>
                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#3B82F6" />
                                <ThemedText style={styles.statusText}>
                                    Retrieving GPS coordinates...
                                </ThemedText>
                            </View>
                        ) : error ? (
                            <View style={styles.errorContainer}>
                                <SymbolView
                                    name={{
                                        ios: 'exclamationmark.triangle.fill',
                                        android: 'warning',
                                        web: 'warning',
                                    } as any}
                                    size={36}
                                    tintColor="#EF4444"
                                />
                                <ThemedText style={styles.errorTitle}>
                                    Location Error
                                </ThemedText>
                                <ThemedText style={styles.errorDescription}>
                                    {error}
                                </ThemedText>
                                {errorType === 'permission_denied' && (
                                    <ThemedText style={styles.errorHelp} themeColor="textSecondary">
                                        Please enable location permissions for SafeHer AI in your device&apos;s settings.
                                    </ThemedText>
                                )}
                                {errorType === 'services_disabled' && (
                                    <ThemedText style={styles.errorHelp} themeColor="textSecondary">
                                        Please toggle your device&apos;s GPS/location service switch on.
                                    </ThemedText>
                                )}
                                <Pressable
                                    onPress={refresh}
                                    style={({ pressed }) => [
                                        styles.retryButton,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <ThemedText style={styles.retryButtonText}>
                                        Try Again
                                    </ThemedText>
                                </Pressable>
                            </View>
                        ) : location ? (
                            <View style={styles.locationContainer}>
                                <View style={styles.badgeRow}>
                                    <View style={isTracking || isBackgroundTracking ? styles.gpsActiveBadge : styles.gpsStoppedBadge}>
                                        <View style={isTracking || isBackgroundTracking ? styles.gpsPulseDot : styles.gpsStoppedDot} />
                                        <ThemedText style={isTracking || isBackgroundTracking ? styles.gpsActiveText : styles.gpsStoppedText}>
                                            {isBackgroundTracking ? '🟢 Background Tracking Active' : isTracking ? '🟢 Live Tracking Active' : '⚪ Live Tracking Stopped'}
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

                                {/* Buttons */}
                                <View style={styles.actionsContainer}>
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
                                            Open in Maps
                                        </ThemedText>
                                    </Pressable>

                                    <Pressable
                                        onPress={shareLocation}
                                        style={({ pressed }) => [
                                            styles.shareButton,
                                            pressed && styles.pressed,
                                        ]}
                                    >
                                        <SymbolView
                                            name={{
                                                ios: 'square.and.arrow.up',
                                                android: 'share',
                                                web: 'share',
                                            } as any}
                                            size={20}
                                            tintColor="#FFFFFF"
                                        />
                                        <ThemedText style={styles.buttonText}>
                                            Share Link
                                        </ThemedText>
                                    </Pressable>
                                </View>

                                <Pressable
                                    onPress={refresh}
                                    style={({ pressed }) => [
                                        styles.refreshButton,
                                        { borderColor: theme.textSecondary },
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <SymbolView
                                        name={{
                                            ios: 'arrow.clockwise',
                                            android: 'refresh',
                                            web: 'refresh',
                                        } as any}
                                        size={16}
                                        tintColor={theme.text}
                                    />
                                    <ThemedText style={[styles.refreshButtonText, { color: theme.text }]}>
                                        Refresh Location
                                    </ThemedText>
                                </Pressable>
                            </View>
                        ) : null}
                    </ThemedView>

                    {/* Information / Safety advice */}
                    <View style={styles.infoCard}>
                        <ThemedText style={styles.infoTitle}>
                            How does Location Sharing work?
                        </ThemedText>
                        <ThemedText style={styles.infoDescription} themeColor="textSecondary">
                            Your live location is fetched securely on your device using hardware GPS sensors. When you trigger the Emergency SOS flow, this location is formatted into a secure Google Maps link and prepared for sharing with your trusted contacts, allowing them to locate you immediately.
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
        backgroundColor: 'transparent',
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
        justifyContent: 'center',
        marginTop: 12,
        marginBottom: 20,
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
        color: '#EF4444',
        marginTop: 12,
        marginBottom: 8,
    },
    errorDescription: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 12,
    },
    errorHelp: {
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: '#EF4444',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14,
    },
    locationContainer: {
        width: '100%',
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
    gpsStoppedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E2E8F0',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 6,
    },
    gpsStoppedDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#64748B',
    },
    gpsStoppedText: {
        color: '#475569',
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
    actionsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    mapButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563EB',
        paddingVertical: 14,
        borderRadius: 14,
        gap: 8,
    },
    shareButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#7C3AED',
        paddingVertical: 14,
        borderRadius: 14,
        gap: 8,
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        paddingVertical: 12,
        borderRadius: 14,
        gap: 8,
    },
    refreshButtonText: {
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
