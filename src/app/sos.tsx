import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Linking,
    NativeModules,
    PermissionsAndroid,
    Platform,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    View,
} from 'react-native';

const { SmsModule } = NativeModules;
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/use-auth';
import { useLocation } from '@/hooks/use-location';
import { useVoiceSOS } from '@/hooks/voice-sos-provider';
import { supabase } from '@/utils/supabase';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

interface Contact {
    id: string;
    name: string;
    phone: string;
}

export default function SOSScreen() {
    const [countdown, setCountdown] = useState(5);
    const [isCounting, setIsCounting] = useState(false);
    const [isActivated, setIsActivated] = useState(false);
    const [contacts, setContacts] = useState<Contact[]>([]);

    const smsSentRef = useRef(false);

    const params = useLocalSearchParams();
    const { setVoiceSOSEnabled } = useVoiceSOS();

    const { user } = useAuth();
    const {
        location: liveLocation,
        loading: locationLoading,
        error: locationError,
        isTracking,
        isBackgroundTracking,
        startTracking,
        stopTracking,
        startBackgroundTracking,
        stopBackgroundTracking,
        refresh: refreshLocation,
    } = useLocation();

    const updateSupabaseLocation = async (loc: typeof liveLocation) => {
        if (!user || !loc) return;
        try {
            const { error } = await supabase
                .from('sos_locations')
                .upsert({
                    user_id: user.id,
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    accuracy: loc.accuracy,
                    is_active: true,
                    updated_at: new Date().toISOString(),
                });
            if (error) {
                console.log('Error updating location in Supabase:', error.message);
            }
        } catch (err) {
            console.log('Supabase connection error:', err);
        }
    };

    const endSupabaseSOS = async () => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('sos_locations')
                .update({ is_active: false })
                .eq('user_id', user.id);
            if (error) {
                console.log('Error updating SOS status in Supabase:', error.message);
            }
        } catch (err) {
            console.log('Supabase connection error:', err);
        }
    };

    useEffect(() => {
        const syncActivatedState = async () => {
            try {
                if (isActivated) {
                    await AsyncStorage.setItem('isSOSActive', 'true');

                    // Attempt to start background tracking
                    const bgSuccess = await startBackgroundTracking();
                    if (!bgSuccess) {
                        Alert.alert(
                            "Background Tracking Restricted",
                            "Continuous updates while your screen is locked require background location access. Tracking will proceed in the foreground only.",
                            [{ text: "OK" }]
                        );
                    }

                    // Also start foreground tracking as double-safety / fallback
                    await startTracking((newLoc) => {
                        updateSupabaseLocation(newLoc);
                    });
                } else {
                    await AsyncStorage.setItem('isSOSActive', 'false');
                    await stopBackgroundTracking();
                    stopTracking();
                    await endSupabaseSOS();
                }
            } catch (err) {
                console.log('Error syncing SOS active state:', err);
            }
        };
        syncActivatedState();
    }, [isActivated]);

    const shareSOSLocation = async () => {
        if (liveLocation) {
            try {
                await Share.share({
                    message: `I need help! Here is my live location: ${liveLocation.googleMapsLink}`,
                });
            } catch (err) {
                console.log('Error sharing location:', err);
            }
        } else if (locationError) {
            Alert.alert(
                'Location Error',
                `${locationError}\n\nWould you like to try retrieving your location again?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Retry', onPress: () => refreshLocation() }
                ]
            );
        } else {
            Alert.alert(
                'Retrieving Location',
                'Still waiting for GPS coordinates. Please wait a moment.'
            );
        }
    };

    const requestSmsPermission = async () => {
        if (Platform.OS !== 'android') return true;
        try {
            const hasPermission = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.SEND_SMS
            );
            if (hasPermission) return true;

            const status = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.SEND_SMS,
                {
                    title: "SMS Permission Required",
                    message: "SafeHer AI needs SMS permission to automatically send SOS alerts to your emergency contacts.",
                    buttonNeutral: "Ask Me Later",
                    buttonNegative: "Cancel",
                    buttonPositive: "OK"
                }
            );
            return status === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            console.log('Error checking/requesting SMS permission:', err);
            return false;
        }
    };

    useEffect(() => {
        const loadContacts = async () => {
            try {
                const saved = await AsyncStorage.getItem('emergencyContacts');
                if (saved !== null) {
                    setContacts(JSON.parse(saved));
                }
            } catch (error) {
                console.log('Error loading contacts:', error);
            }
        };
        loadContacts();

        if (Platform.OS === 'android') {
            requestSmsPermission();
        }
    }, []);
    const playSOSSound = async () => {
        try {
            await Audio.setAudioModeAsync({
                playsInSilentMode: true,
                shouldDuckAndroid: false,
            } as any);

            const { sound } = await Audio.Sound.createAsync(
                require('@/assets/sounds/sos-alert.mp3'),
                {
                    shouldPlay: true,
                    volume: 1.0,
                }
            );

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    sound.unloadAsync();
                }
            });
        } catch (error) {
            console.log('SOS Sound Error:', error);
        }
    };

    const handleSOSAlertDispatch = async () => {
        if (smsSentRef.current) {
            console.log('SMS already sent/attempted for this SOS session.');
            return;
        }
        smsSentRef.current = true;

        try {
            // 1. Get current GPS latitude and longitude using existing location functionality
            let coords = liveLocation;
            if (!coords) {
                try {
                    coords = await refreshLocation();
                } catch (locErr) {
                    console.log('Location fetch error during SOS alert:', locErr);
                }
            }

            const lat = coords?.latitude;
            const lon = coords?.longitude;

            // 2. Get all saved emergency contacts from existing storage
            const saved = await AsyncStorage.getItem('emergencyContacts');
            const contactsList: Contact[] = saved ? JSON.parse(saved) : [];

            if (contactsList.length === 0) {
                Alert.alert(
                    'Emergency SOS',
                    'No emergency contacts are saved. Please add an emergency contact to receive SOS alerts.'
                );
                return;
            }

            // 3. Create SOS message matching required format (with double newlines)
            let sosMessage = '';
            if (lat !== undefined && lon !== undefined) {
                sosMessage = `🚨 SafeHer AI SOS Alert!\n\nI may be in danger. Please contact me immediately.\n\n📍 My current location:\nhttps://www.google.com/maps?q=${lat},${lon}`;
            } else {
                sosMessage = `🚨 SafeHer AI SOS Alert!\n\nI may be in danger. Please contact me immediately.\n\n📍 My current location is temporarily unavailable.`;
            }

            // 4. Send SMS
            if (Platform.OS === 'android') {
                const hasPermission = await requestSmsPermission();
                if (!hasPermission) {
                    Alert.alert(
                        "Permission Denied",
                        "Automatic SOS SMS permission is required. Please allow SMS permission in Settings."
                    );
                    return;
                }

                // Send SMS to EVERY saved contact automatically
                let sendErrors = 0;
                for (const contact of contactsList) {
                    const cleanPhone = contact.phone.replace(/[^0-9+]/g, '').trim();
                    if (!cleanPhone) continue;
                    try {
                        await SmsModule.sendSms(cleanPhone, sosMessage);
                        console.log(`Automatic SMS successfully sent to ${contact.name} (${cleanPhone})`);
                    } catch (smsErr) {
                        console.log(`Error sending automatic SMS to ${contact.name}:`, smsErr);
                        sendErrors++;
                    }
                }

                if (sendErrors > 0) {
                    console.log(`Failed to automatically send SMS to ${sendErrors} contact(s).`);
                }
            } else {
                // Fallback for iOS/Web: open SMS composer
                const phoneNumbers = contactsList
                    .map((c) => c.phone.replace(/[^0-9+]/g, '').trim())
                    .filter(Boolean);

                if (phoneNumbers.length > 0) {
                    const separator = Platform.OS === 'ios' ? '&' : '?';
                    const recipientParam = phoneNumbers.join(',');
                    const smsUrl = `sms:${recipientParam}${separator}body=${encodeURIComponent(sosMessage)}`;

                    try {
                        await Linking.openURL(smsUrl);
                    } catch (err) {
                        console.log('Error opening SMS with comma delimiter, trying semicolon:', err);
                        const semicolonUrl = `sms:${phoneNumbers.join(';')}${separator}body=${encodeURIComponent(sosMessage)}`;
                        try {
                            await Linking.openURL(semicolonUrl);
                        } catch (fallbackErr) {
                            console.log('Error opening native SMS app:', fallbackErr);
                            Alert.alert(
                                'Emergency SOS Active',
                                'Could not open SMS application. Please call 112 or share your location manually.'
                            );
                        }
                    }
                }
            }
        } catch (error) {
            console.log('Error dispatching SOS emergency alert:', error);
            Alert.alert(
                'Emergency SOS Active',
                'SOS is active. Could not open SMS composer. Please dial 112 or use Share Location.'
            );
        }
    };

    useEffect(() => {
        if (!isCounting) return;

        const timer = setTimeout(() => {
            setCountdown((previous) => {
                if (previous <= 1) {
                    setIsCounting(false);
                    setIsActivated(true);
                    void playSOSSound();
                    void handleSOSAlertDispatch();

                    return 0;
                }
                return previous - 1;
            });
        }, 1000);

        return () => clearTimeout(timer);
    }, [isCounting, liveLocation]);

    const startSOS = useCallback(() => {
        setCountdown(5);
        setIsCounting(true);
        setIsActivated(false);
        smsSentRef.current = false;
    }, []);

    const cancelSOS = () => {
        setIsCounting(false);
        setCountdown(5);
    };

    const resetSOS = () => {
        setIsActivated(false);
        setIsCounting(false);
        setCountdown(5);
    };

    // Auto-start SOS if redirected via Voice Trigger
    useEffect(() => {
        if (params.autoStart === 'true') {
            const timer = setTimeout(() => {
                startSOS();
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [params.autoStart, startSOS]);

    // Disable Voice SOS monitoring when SOS starts or becomes active
    useEffect(() => {
        if (isCounting || isActivated) {
            setVoiceSOSEnabled(false);
        }
    }, [isCounting, isActivated, setVoiceSOSEnabled]);

    const callEmergency = async () => {
        const phoneNumber = '112';

        try {
            await Linking.openURL(`tel:${phoneNumber}`);
        } catch {
            Alert.alert(
                'Unable to make call',
                'Phone calling is not available on this device.',
            );
        }
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
                        <View style={styles.headerSpace} />

                        <ThemedText style={styles.headerTitle}>
                            Emergency SOS
                        </ThemedText>

                        <View style={styles.headerSpace} />
                    </View>

                    {/* Emergency Icon */}
                    <View style={styles.iconContainer}>
                        <View style={styles.warningCircle}>
                            <SymbolView
                                name={{
                                    ios: 'exclamationmark.triangle.fill',
                                    android: 'warning',
                                    web: 'warning',
                                } as any}
                                size={65}
                                tintColor="#FFFFFF"
                            />
                        </View>
                    </View>

                    {/* Title */}
                    <ThemedText style={styles.title}>
                        {isActivated
                            ? 'SOS ACTIVATED'
                            : isCounting
                                ? 'Activating SOS...'
                                : 'Are you in danger?'}
                    </ThemedText>

                    <ThemedText style={styles.description}>
                        {isActivated
                            ? 'Emergency mode is active. Stay calm and move to a safe place.'
                            : 'Press the button below if you need immediate emergency assistance.'}
                    </ThemedText>

                    {/* Countdown */}
                    {isCounting && (
                        <View style={styles.countdownContainer}>
                            <ThemedText style={styles.countdown}>
                                {countdown}
                            </ThemedText>

                            <ThemedText style={styles.countdownText}>
                                SOS will activate automatically
                            </ThemedText>

                            <Pressable
                                onPress={cancelSOS}
                                style={({ pressed }) => [
                                    styles.cancelButton,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <ThemedText style={styles.cancelText}>
                                    CANCEL
                                </ThemedText>
                            </Pressable>
                        </View>
                    )}

                    {/* SOS Button */}
                    {!isCounting && !isActivated && (
                        <Pressable
                            onPress={startSOS}
                            style={({ pressed }) => [
                                styles.sosButton,
                                pressed && styles.sosPressed,
                            ]}
                        >
                            <SymbolView
                                name={{
                                    ios: 'exclamationmark.triangle.fill',
                                    android: 'warning',
                                    web: 'warning',
                                } as any}
                                size={42}
                                tintColor="#FFFFFF"
                            />

                            <ThemedText style={styles.sosButtonText}>
                                ACTIVATE SOS
                            </ThemedText>

                            <ThemedText style={styles.sosButtonSubtext}>
                                Tap to start emergency assistance
                            </ThemedText>
                        </Pressable>
                    )}

                    {/* Activated State */}
                    {isActivated && (
                        <View style={styles.activatedCard}>
                            <View style={styles.successIcon}>
                                <SymbolView
                                    name={{
                                        ios: 'checkmark',
                                        android: 'check',
                                        web: 'check',
                                    } as any}
                                    size={30}
                                    tintColor="#FFFFFF"
                                />
                            </View>

                            <ThemedText style={styles.activatedTitle}>
                                Emergency Mode Active
                            </ThemedText>

                            <ThemedText style={styles.activatedText}>
                                Your emergency response has been triggered.
                            </ThemedText>
                        </View>
                    )}

                    {/* Emergency Actions */}
                    <View style={styles.actionsCard}>
                        <ThemedText style={styles.sectionTitle}>
                            Emergency Actions
                        </ThemedText>

                        {/* Call 112 */}
                        <Pressable
                            onPress={callEmergency}
                            style={({ pressed }) => [
                                styles.actionButton,
                                pressed && styles.pressed,
                            ]}
                        >
                            <View style={styles.actionIcon}>
                                <SymbolView
                                    name={{
                                        ios: 'phone.fill',
                                        android: 'phone',
                                        web: 'phone',
                                    } as any}
                                    size={22}
                                    tintColor="#FFFFFF"
                                />
                            </View>

                            <View style={styles.actionInfo}>
                                <ThemedText style={styles.actionTitle}>
                                    Call Emergency Services
                                </ThemedText>

                                <ThemedText style={styles.actionDescription}>
                                    Call 112 for immediate assistance
                                </ThemedText>
                            </View>
                        </Pressable>

                        {/* Location */}
                        <Pressable
                            onPress={shareSOSLocation}
                            style={({ pressed }) => [
                                styles.actionButton,
                                pressed && styles.pressed,
                            ]}
                        >
                            <View style={styles.locationIcon}>
                                <SymbolView
                                    name={{
                                        ios: 'location.fill',
                                        android: 'location-on',
                                        web: 'location',
                                    } as any}
                                    size={22}
                                    tintColor="#FFFFFF"
                                />
                            </View>

                            <View style={styles.actionInfo}>
                                <ThemedText style={styles.actionTitle}>
                                    Share My Location
                                </ThemedText>

                                <ThemedText style={styles.actionDescription}>
                                    {isTracking || isBackgroundTracking
                                        ? `${isBackgroundTracking ? '🟢 Background Tracking Active' : '🟢 Tracking Active'}: ${liveLocation ? `${liveLocation.latitude.toFixed(4)}, ${liveLocation.longitude.toFixed(4)}` : 'Syncing...'} (Tap to share)`
                                        : locationLoading
                                            ? 'Fetching live location...'
                                            : liveLocation
                                                ? `⚪ Tracking Stopped: ${liveLocation.latitude.toFixed(4)}, ${liveLocation.longitude.toFixed(4)} (Tap to share)`
                                                : `⚪ Tracking Stopped: ${locationError || 'Unavailable'}. Tap to retry.`}
                                </ThemedText>
                            </View>
                        </Pressable>

                        {/* Contacts */}
                        <View style={styles.actionButton}>
                            <View style={styles.contactIcon}>
                                <SymbolView
                                    name={{
                                        ios: 'person.2.fill',
                                        android: 'group',
                                        web: 'users',
                                    } as any}
                                    size={22}
                                    tintColor="#FFFFFF"
                                />
                            </View>

                            <View style={styles.actionInfo}>
                                <ThemedText style={styles.actionTitle}>
                                    Emergency Contacts
                                </ThemedText>

                                <ThemedText style={styles.actionDescription}>
                                    {contacts.length === 0
                                        ? 'No emergency contacts configured.'
                                        : `${contacts.length} contact(s) configured: ${contacts.map((c) => c.name).join(', ')}`}
                                </ThemedText>
                            </View>
                        </View>
                    </View>

                    {/* Bottom Button */}
                    {isActivated && (
                        <Pressable
                            onPress={resetSOS}
                            style={({ pressed }) => [
                                styles.resetButton,
                                pressed && styles.pressed,
                            ]}
                        >
                            <ThemedText style={styles.resetText}>
                                END EMERGENCY MODE
                            </ThemedText>
                        </Pressable>
                    )}

                    <ThemedText style={styles.disclaimer}>
                        In a real emergency, always contact local emergency services.
                    </ThemedText>
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
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
    },

    warningCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#DC2626',
        alignItems: 'center',
        justifyContent: 'center',
    },

    title: {
        textAlign: 'center',
        fontSize: 30,
        fontWeight: '800',
        marginTop: 24,
    },

    description: {
        textAlign: 'center',
        fontSize: 15,
        color: '#64748B',
        lineHeight: 23,
        marginTop: 10,
        paddingHorizontal: 20,
    },

    countdownContainer: {
        alignItems: 'center',
        marginTop: 30,
    },

    countdown: {
        fontSize: 80,
        fontWeight: '900',
        color: '#DC2626',
    },

    countdownText: {
        fontSize: 14,
        color: '#64748B',
        marginTop: -5,
    },

    cancelButton: {
        marginTop: 20,
        paddingHorizontal: 35,
        paddingVertical: 13,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: '#DC2626',
    },

    cancelText: {
        color: '#DC2626',
        fontSize: 15,
        fontWeight: '800',
    },

    sosButton: {
        marginTop: 30,
        minHeight: 190,
        borderRadius: 28,
        backgroundColor: '#DC2626',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 25,
        elevation: 5,
    },

    sosPressed: {
        transform: [{ scale: 0.97 }],
    },

    sosButtonText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '900',
        marginTop: 12,
    },

    sosButtonSubtext: {
        color: '#FFFFFF',
        fontSize: 13,
        marginTop: 5,
        opacity: 0.9,
    },

    activatedCard: {
        marginTop: 30,
        padding: 24,
        borderRadius: 22,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FCA5A5',
    },

    successIcon: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#16A34A',
        alignItems: 'center',
        justifyContent: 'center',
    },

    activatedTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#991B1B',
        marginTop: 12,
    },

    activatedText: {
        fontSize: 14,
        color: '#7F1D1D',
        textAlign: 'center',
        marginTop: 6,
    },

    actionsCard: {
        marginTop: 30,
        padding: 20,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
    },

    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 15,
    },

    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },

    actionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#DC2626',
        alignItems: 'center',
        justifyContent: 'center',
    },

    locationIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#2563EB',
        alignItems: 'center',
        justifyContent: 'center',
    },

    contactIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#7C3AED',
        alignItems: 'center',
        justifyContent: 'center',
    },

    actionInfo: {
        flex: 1,
        marginLeft: 14,
    },

    actionTitle: {
        fontSize: 15,
        fontWeight: '700',
    },

    actionDescription: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 3,
    },

    resetButton: {
        marginTop: 20,
        height: 52,
        borderRadius: 15,
        backgroundColor: '#1F2937',
        alignItems: 'center',
        justifyContent: 'center',
    },

    resetText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },

    disclaimer: {
        textAlign: 'center',
        color: '#94A3B8',
        fontSize: 11,
        marginTop: 20,
        lineHeight: 17,
    },

    pressed: {
        opacity: 0.75,
    },
});