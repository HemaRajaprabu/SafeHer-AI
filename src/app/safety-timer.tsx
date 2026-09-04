import { useEffect, useState, useRef, useCallback } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

// =========================================================================
// AI INTEGRATION EXTENSION POINT:
// In subsequent iterations, SafeHer AI can evaluate contextual risk using
// getAIResponse() from '@/utils/ai' or evaluateLocationSafety() from
// '@/services/location-safety' to dynamically adjust check-in intervals
// or provide real-time recommendations based on threat/risk analysis.
// =========================================================================

type CheckInStatus = 'setup' | 'active' | 'confirming' | 'completed';

const DURATION_PRESETS = [5, 15, 30, 60];

export default function SafetyTimerScreen() {
    const theme = useTheme();
    const [status, setStatus] = useState<CheckInStatus>('setup');
    const [minutes, setMinutes] = useState<string>('15');
    const [totalDurationMinutes, setTotalDurationMinutes] = useState<number>(15);
    const [secondsLeft, setSecondsLeft] = useState<number>(0);
    const [completedTime, setCompletedTime] = useState<string>('');
    const [automaticSOSEnabled, setAutomaticSOSEnabled] = useState<boolean>(false);
    const intervalRef = useRef<any>(null);

    // Load existing Automatic SOS user preference
    useEffect(() => {
        let isMounted = true;
        const loadSettings = async () => {
            try {
                const autoSOS = await AsyncStorage.getItem('automaticSOS');
                if (isMounted && autoSOS !== null) {
                    setAutomaticSOSEnabled(autoSOS === 'true');
                }
            } catch (error) {
                console.log('Error reading Automatic SOS setting:', error);
            }
        };
        loadSettings();
        return () => {
            isMounted = false;
        };
    }, []);

    // Safe interval clearing helper
    const clearCurrentInterval = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    // Start Check-In Timer
    const handleStartCheckIn = () => {
        const mins = parseInt(minutes, 10);
        if (isNaN(mins) || mins < 1 || mins > 180) {
            Alert.alert(
                'Invalid Duration',
                'Please enter a check-in duration between 1 and 180 minutes.'
            );
            return;
        }

        clearCurrentInterval();
        setTotalDurationMinutes(mins);
        setSecondsLeft(mins * 60);
        setStatus('active');
    };

    // User confirms safety: ends timer, marks check-in complete (NO SOS)
    const handleConfirmSafety = () => {
        clearCurrentInterval();
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setCompletedTime(timeStr);
        setSecondsLeft(0);
        setStatus('completed');
    };

    // User explicitly requests help: route to existing SOS screen
    const handleNeedHelp = () => {
        clearCurrentInterval();
        router.push('/sos');
    };

    // Reset workflow to setup state
    const handleResetCheckIn = () => {
        clearCurrentInterval();
        setSecondsLeft(0);
        setStatus('setup');
    };

    // Countdown interval effect
    useEffect(() => {
        if (status === 'active') {
            clearCurrentInterval();
            intervalRef.current = setInterval(() => {
                setSecondsLeft((prev) => {
                    if (prev <= 1) {
                        clearCurrentInterval();
                        setStatus('confirming');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            clearCurrentInterval();
        }

        return () => {
            clearCurrentInterval();
        };
    }, [status, clearCurrentInterval]);

    const formatTime = (totalSecs: number) => {
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
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
                                ios: 'chevron.backward',
                                android: 'arrow_back',
                                web: 'arrow_back',
                            } as any}
                            size={24}
                            tintColor={theme.text}
                        />
                    </Pressable>

                    <ThemedText style={styles.headerTitle}>
                        AI Safety Check-In
                    </ThemedText>

                    <View style={styles.headerSpace} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* STATE 1: SETUP */}
                    {status === 'setup' && (
                        <View style={styles.stateWrapper}>
                            <View style={[styles.iconContainer, { backgroundColor: '#EFF6FF' }]}>
                                <SymbolView
                                    name={{
                                        ios: 'shield.lefthalf.filled',
                                        android: 'security',
                                        web: 'security',
                                    } as any}
                                    size={44}
                                    tintColor="#2563EB"
                                />
                            </View>

                            <ThemedText style={styles.title}>
                                AI Safety Check-In
                            </ThemedText>
                            <ThemedText style={styles.description} themeColor="textSecondary">
                                Going somewhere alone? Start a safety check-in. SafeHer AI will remind you to confirm your safety when the timer ends.
                            </ThemedText>

                            {/* Duration Input Card */}
                            <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                                <ThemedText style={styles.inputLabel}>
                                    Duration (Minutes)
                                </ThemedText>
                                <TextInput
                                    value={minutes}
                                    onChangeText={setMinutes}
                                    keyboardType="number-pad"
                                    maxLength={3}
                                    placeholder="e.g. 15"
                                    placeholderTextColor={theme.textSecondary}
                                    style={[
                                        styles.input,
                                        {
                                            borderColor: theme.backgroundSelected,
                                            color: theme.text,
                                            backgroundColor: theme.background,
                                        },
                                    ]}
                                />

                                {/* Preset Chips */}
                                <View style={styles.presetsRow}>
                                    {DURATION_PRESETS.map((preset) => {
                                        const isSelected = minutes === String(preset);
                                        return (
                                            <Pressable
                                                key={preset}
                                                onPress={() => setMinutes(String(preset))}
                                                style={({ pressed }) => [
                                                    styles.presetChip,
                                                    {
                                                        backgroundColor: isSelected
                                                            ? '#2563EB'
                                                            : theme.backgroundSelected,
                                                    },
                                                    pressed && styles.pressed,
                                                ]}
                                            >
                                                <ThemedText
                                                    style={[
                                                        styles.presetText,
                                                        { color: isSelected ? '#FFFFFF' : theme.text },
                                                    ]}
                                                >
                                                    {preset} min
                                                </ThemedText>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* AI Safety Assurance Banner */}
                            <View style={[styles.aiNoticeCard, { borderColor: '#DBEAFE' }]}>
                                <SymbolView
                                    name={{
                                        ios: 'checkmark.shield.fill',
                                        android: 'verified_user',
                                        web: 'verified_user',
                                    } as any}
                                    size={20}
                                    tintColor="#2563EB"
                                />
                                <ThemedText style={styles.aiNoticeText} themeColor="textSecondary">
                                    SafeHer AI monitors your session. If you don’t confirm safety at the end, emergency assistance options will be presented.
                                </ThemedText>
                            </View>

                            <Pressable
                                onPress={handleStartCheckIn}
                                style={({ pressed }) => [
                                    styles.primaryButton,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <ThemedText style={styles.primaryButtonText}>
                                    Start AI Safety Check-In
                                </ThemedText>
                            </Pressable>
                        </View>
                    )}

                    {/* STATE 2: ACTIVE CHECK-IN */}
                    {status === 'active' && (
                        <View style={styles.stateWrapper}>
                            <View style={styles.badgeActive}>
                                <View style={styles.badgeActiveDot} />
                                <ThemedText style={styles.badgeActiveText}>
                                    SAFETY CHECK-IN ACTIVE
                                </ThemedText>
                            </View>

                            <ThemedText style={styles.timerDisplay}>
                                {formatTime(secondsLeft)}
                            </ThemedText>

                            <ThemedText style={styles.activeDescription} themeColor="textSecondary">
                                SafeHer AI will ask you to confirm your safety when the timer ends.
                            </ThemedText>

                            <View style={[styles.aiInfoBox, { backgroundColor: theme.backgroundElement }]}>
                                <SymbolView
                                    name={{
                                        ios: 'info.circle.fill',
                                        android: 'info',
                                        web: 'info',
                                    } as any}
                                    size={18}
                                    tintColor="#10B981"
                                />
                                <ThemedText style={styles.aiInfoText} themeColor="textSecondary">
                                    Reached your destination safely? Tap &quot;I&apos;m Safe&quot; at any time to complete your check-in.
                                </ThemedText>
                            </View>

                            <Pressable
                                onPress={handleConfirmSafety}
                                style={({ pressed }) => [
                                    styles.safeButton,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <SymbolView
                                    name={{
                                        ios: 'checkmark.circle.fill',
                                        android: 'check_circle',
                                        web: 'check_circle',
                                    } as any}
                                    size={20}
                                    tintColor="#FFFFFF"
                                />
                                <ThemedText style={styles.safeButtonText}>
                                    I&apos;m Safe
                                </ThemedText>
                            </Pressable>

                            {/* Secondary Emergency SOS shortcut */}
                            <Pressable
                                onPress={handleNeedHelp}
                                style={({ pressed }) => [
                                    styles.emergencyLink,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <ThemedText style={styles.emergencyLinkText}>
                                    Need immediate help? Trigger SOS
                                </ThemedText>
                            </Pressable>
                        </View>
                    )}

                    {/* STATE 3: CONFIRMATION ("ARE YOU SAFE?") */}
                    {status === 'confirming' && (
                        <View style={styles.stateWrapper}>
                            <View style={styles.badgePending}>
                                <SymbolView
                                    name={{
                                        ios: 'exclamationmark.triangle.fill',
                                        android: 'warning',
                                        web: 'warning',
                                    } as any}
                                    size={14}
                                    tintColor="#D97706"
                                />
                                <ThemedText style={styles.badgePendingText}>
                                    CHECK-IN PENDING
                                </ThemedText>
                            </View>

                            <View style={[styles.iconContainer, { backgroundColor: '#FEF3C7', marginTop: 12 }]}>
                                <SymbolView
                                    name={{
                                        ios: 'questionmark.shield.fill',
                                        android: 'security',
                                        web: 'security',
                                    } as any}
                                    size={48}
                                    tintColor="#D97706"
                                />
                            </View>

                            <ThemedText style={styles.title}>
                                Are You Safe?
                            </ThemedText>
                            <ThemedText style={styles.description} themeColor="textSecondary">
                                Your safety check-in has ended. Please confirm your current safety status.
                            </ThemedText>

                            {/* Action Buttons */}
                            <View style={styles.confirmationActions}>
                                <Pressable
                                    onPress={handleConfirmSafety}
                                    style={({ pressed }) => [
                                        styles.safeButton,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <SymbolView
                                        name={{
                                            ios: 'checkmark.circle.fill',
                                            android: 'check_circle',
                                            web: 'check_circle',
                                    } as any}
                                        size={20}
                                        tintColor="#FFFFFF"
                                    />
                                    <ThemedText style={styles.safeButtonText}>
                                        I&apos;m Safe
                                    </ThemedText>
                                </Pressable>

                                <Pressable
                                    onPress={handleNeedHelp}
                                    style={({ pressed }) => [
                                        styles.dangerButton,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <SymbolView
                                        name={{
                                            ios: 'sos.circle.fill',
                                            android: 'sos',
                                            web: 'sos',
                                        } as any}
                                        size={20}
                                        tintColor="#FFFFFF"
                                    />
                                    <ThemedText style={styles.dangerButtonText}>
                                        I Need Help
                                    </ThemedText>
                                </Pressable>
                            </View>

                            {/* No-Response Handling Details */}
                            <View style={[styles.noResponseCard, { backgroundColor: theme.backgroundElement }]}>
                                <ThemedText style={styles.noResponseTitle}>
                                    No Response Options
                                </ThemedText>
                                <ThemedText style={styles.noResponseDesc} themeColor="textSecondary">
                                    {automaticSOSEnabled
                                        ? 'Automatic SOS is active in your settings. If you cannot confirm safety, tap "I Need Help" to alert your contacts immediately.'
                                        : 'If you are unable to proceed or need help, tap "I Need Help" to open the emergency SOS screen or alert your contacts.'}
                                </ThemedText>

                                <Pressable
                                    onPress={() => router.push('/emergency-contacts')}
                                    style={({ pressed }) => [
                                        styles.contactsButton,
                                        { borderColor: theme.backgroundSelected },
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <SymbolView
                                        name={{
                                            ios: 'person.2.fill',
                                            android: 'contacts',
                                            web: 'contacts',
                                        } as any}
                                        size={18}
                                        tintColor={theme.text}
                                    />
                                    <ThemedText style={styles.contactsButtonText}>
                                        Emergency Contacts
                                    </ThemedText>
                                </Pressable>
                            </View>
                        </View>
                    )}

                    {/* STATE 4: COMPLETED */}
                    {status === 'completed' && (
                        <View style={styles.stateWrapper}>
                            <View style={[styles.iconContainer, { backgroundColor: '#ECFDF5' }]}>
                                <SymbolView
                                    name={{
                                        ios: 'checkmark.shield.fill',
                                        android: 'check_circle',
                                        web: 'check_circle',
                                    } as any}
                                    size={48}
                                    tintColor="#10B981"
                                />
                            </View>

                            <ThemedText style={styles.title}>
                                Check-In Completed
                            </ThemedText>
                            <ThemedText style={styles.description} themeColor="textSecondary">
                                Glad to know you are safe.
                            </ThemedText>

                            {/* Completion summary card */}
                            <View style={[styles.card, { backgroundColor: theme.backgroundElement, marginVertical: 20 }]}>
                                <View style={styles.summaryRow}>
                                    <ThemedText type="small" themeColor="textSecondary">
                                        Status
                                    </ThemedText>
                                    <View style={styles.summaryStatusBadge}>
                                        <ThemedText style={styles.summaryStatusText}>
                                            Safe &amp; Verified
                                        </ThemedText>
                                    </View>
                                </View>

                                <View style={[styles.summaryDivider, { backgroundColor: theme.backgroundSelected }]} />

                                <View style={styles.summaryRow}>
                                    <ThemedText type="small" themeColor="textSecondary">
                                        Duration Checked
                                    </ThemedText>
                                    <ThemedText style={styles.summaryValue}>
                                        {totalDurationMinutes} min
                                    </ThemedText>
                                </View>

                                {completedTime ? (
                                    <>
                                        <View style={[styles.summaryDivider, { backgroundColor: theme.backgroundSelected }]} />
                                        <View style={styles.summaryRow}>
                                            <ThemedText type="small" themeColor="textSecondary">
                                                Completed At
                                            </ThemedText>
                                            <ThemedText style={styles.summaryValue}>
                                                {completedTime}
                                            </ThemedText>
                                        </View>
                                    </>
                                ) : null}
                            </View>

                            <Pressable
                                onPress={handleResetCheckIn}
                                style={({ pressed }) => [
                                    styles.primaryButton,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <ThemedText style={styles.primaryButtonText}>
                                    Start New Check-In
                                </ThemedText>
                            </Pressable>

                            <Pressable
                                onPress={() => router.back()}
                                style={({ pressed }) => [
                                    styles.secondaryButton,
                                    { borderColor: theme.backgroundSelected },
                                    pressed && styles.pressed,
                                ]}
                            >
                                <ThemedText style={styles.secondaryButtonText}>
                                    Back to Home
                                </ThemedText>
                            </Pressable>
                        </View>
                    )}
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    backButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    headerSpace: {
        width: 44,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
        alignItems: 'center',
    },
    stateWrapper: {
        width: '100%',
        maxWidth: 480,
        alignItems: 'center',
        paddingTop: 12,
    },
    iconContainer: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 8,
        textAlign: 'center',
    },
    description: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 21,
        marginBottom: 24,
        paddingHorizontal: 12,
    },
    card: {
        width: '100%',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
    },
    input: {
        width: '100%',
        height: 50,
        borderWidth: 1.5,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    presetsRow: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'space-between',
    },
    presetChip: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    presetText: {
        fontSize: 13,
        fontWeight: '700',
    },
    aiNoticeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 12,
        gap: 10,
        marginBottom: 24,
        width: '100%',
    },
    aiNoticeText: {
        fontSize: 12,
        lineHeight: 17,
        flex: 1,
    },
    primaryButton: {
        width: '100%',
        backgroundColor: '#2563EB',
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16,
    },
    secondaryButton: {
        width: '100%',
        borderWidth: 1.5,
        height: 50,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        fontWeight: '700',
        fontSize: 15,
    },
    badgeActive: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 8,
        marginTop: 10,
        marginBottom: 20,
    },
    badgeActiveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#2563EB',
    },
    badgeActiveText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#1D4ED8',
        letterSpacing: 1.2,
    },
    timerDisplay: {
        fontSize: 64,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
        marginBottom: 12,
    },
    activeDescription: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 21,
        marginBottom: 20,
        paddingHorizontal: 16,
    },
    aiInfoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        gap: 10,
        marginBottom: 28,
        width: '100%',
    },
    aiInfoText: {
        fontSize: 13,
        lineHeight: 18,
        flex: 1,
    },
    safeButton: {
        width: '100%',
        backgroundColor: '#10B981',
        height: 54,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 14,
    },
    safeButtonText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 17,
    },
    emergencyLink: {
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    emergencyLinkText: {
        color: '#EF4444',
        fontWeight: '700',
        fontSize: 14,
    },
    badgePending: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
        marginBottom: 16,
    },
    badgePendingText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#B45309',
        letterSpacing: 1.2,
    },
    confirmationActions: {
        width: '100%',
        gap: 12,
        marginBottom: 20,
    },
    dangerButton: {
        width: '100%',
        backgroundColor: '#EF4444',
        height: 54,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    dangerButtonText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 17,
    },
    noResponseCard: {
        width: '100%',
        borderRadius: 16,
        padding: 16,
        marginTop: 4,
    },
    noResponseTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 6,
    },
    noResponseDesc: {
        fontSize: 12,
        lineHeight: 17,
        marginBottom: 14,
    },
    contactsButton: {
        width: '100%',
        borderWidth: 1.5,
        height: 44,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    contactsButtonText: {
        fontWeight: '700',
        fontSize: 14,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    summaryStatusBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    summaryStatusText: {
        color: '#059669',
        fontSize: 12,
        fontWeight: '700',
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '700',
    },
    summaryDivider: {
        height: 1,
        width: '100%',
        marginVertical: 10,
    },
    pressed: {
        opacity: 0.82,
    },
});
