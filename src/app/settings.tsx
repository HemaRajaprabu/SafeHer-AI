import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useVoiceSOS } from '@/hooks/voice-sos-provider';
import { useSilentGuardian } from '@/hooks/use-silent-guardian';
import { useTheme } from '@/hooks/use-theme';

const PREDEFINED_PHRASES = ['help help', 'danger danger', 'emergency', 'safeher activate'];

export default function SettingsScreen() {
    const theme = useTheme();
    const [automaticSOS, setAutomaticSOS] = useState(false);
    const [autoLocationMonitoring, setAutoLocationMonitoring] = useState(false);

    const {
        voiceSOSEnabled,
        voiceSOSStatus,
        emergencyPhrase,
        transcription,
        setVoiceSOSEnabled,
        setEmergencyPhrase,
    } = useVoiceSOS();

    const {
        isEnabled: silentGuardianEnabled,
        status: silentGuardianStatus,
        toggleSilentGuardian,
    } = useSilentGuardian();

    const [customPhraseInput, setCustomPhraseInput] = useState(
        !PREDEFINED_PHRASES.includes(emergencyPhrase) ? emergencyPhrase : ''
    );

    const handleCustomPhraseChange = (text: string) => {
        setCustomPhraseInput(text);
        setEmergencyPhrase(text);
    };

    useEffect(() => {
        const loadAutomaticSOS = async () => {
            try {
                const savedValue = await AsyncStorage.getItem('automaticSOS');

                if (savedValue !== null) {
                    setAutomaticSOS(savedValue === 'true');
                }
            } catch (error) {
                console.log('Error loading Automatic SOS setting:', error);
            }
        };

        const loadAutoLocationMonitoring = async () => {
            try {
                const savedValue = await AsyncStorage.getItem('autoLocationMonitoring');

                if (savedValue !== null) {
                    setAutoLocationMonitoring(savedValue === 'true');
                }
            } catch (error) {
                console.log('Error loading Auto Location Monitoring setting:', error);
            }
        };

        loadAutomaticSOS();
        loadAutoLocationMonitoring();
    }, []);

    const toggleAutoLocationMonitoring = async (value: boolean) => {
        try {
            setAutoLocationMonitoring(value);

            await AsyncStorage.setItem(
                'autoLocationMonitoring',
                value.toString()
            );

            if (value) {
                Alert.alert(
                    '📍 Location Monitoring Enabled',
                    'SafeHer AI will automatically monitor safety profiles as your coordinates change.'
                );
            }
        } catch (error) {
            console.log('Error saving Auto Location Monitoring setting:', error);
        }
    };

    const toggleAutomaticSOS = async (value: boolean) => {
        try {
            setAutomaticSOS(value);

            await AsyncStorage.setItem(
                'automaticSOS',
                value.toString()
            );

            if (value) {
                Alert.alert(
                    '🤖 Automatic SOS Enabled',
                    'SafeHer AI can automatically trigger SOS when a high-risk situation is detected.'
                );
            }
        } catch (error) {
            console.log('Error saving Automatic SOS setting:', error);
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
                            Safety Settings
                        </ThemedText>

                        <View style={styles.headerSpace} />
                    </View>

                    {/* AI Safety Automation */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeaderRow}>
                            <SymbolView
                                name={{
                                    ios: 'sparkles',
                                    android: 'smart_toy',
                                    web: 'smart_toy',
                                } as any}
                                size={24}
                                tintColor={theme.text}
                            />
                            <ThemedText style={styles.sectionTitle}>
                                AI Safety Automation
                            </ThemedText>
                        </View>

                        <ThemedText style={styles.sectionDescription}>
                            Configure how SafeHer AI responds when it detects
                            a potentially dangerous situation.
                        </ThemedText>

                        {/* Automatic SOS */}
                        <View style={styles.settingCard}>
                            <View style={styles.iconContainer}>
                                <SymbolView
                                    name={{
                                        ios: 'shield.fill',
                                        android: 'security',
                                        web: 'shield',
                                    }}
                                    size={26}
                                    tintColor="#FFFFFF"
                                />
                            </View>

                            <View style={styles.settingInfo}>
                                <ThemedText style={styles.settingTitle}>
                                    Automatic SOS
                                </ThemedText>

                                <ThemedText style={styles.settingDescription}>
                                    Automatically trigger SOS when AI detects
                                    a high-risk situation.
                                </ThemedText>
                            </View>

                            <Switch
                                value={automaticSOS}
                                onValueChange={toggleAutomaticSOS}
                            />
                        </View>

                        {/* Automatic Location Monitoring Toggle */}
                        <View style={[styles.settingCard, { marginTop: 12 }]}>
                            <View style={[styles.iconContainer, { backgroundColor: 'transparent' }]}>
                                <SymbolView
                                    name={{
                                        ios: 'location.fill',
                                        android: 'location_on',
                                        web: 'location_on',
                                    } as any}
                                    size={28}
                                    tintColor="#7C3AED"
                                />
                            </View>

                            <View style={styles.settingInfo}>
                                <ThemedText style={styles.settingTitle}>
                                    Automatic Location Monitoring
                                </ThemedText>

                                <ThemedText style={styles.settingDescription}>
                                    Monitor safety profiles in real-time as your GPS coordinates change.
                                </ThemedText>
                            </View>

                            <Switch
                                value={autoLocationMonitoring}
                                onValueChange={toggleAutoLocationMonitoring}
                            />
                        </View>
                    </View>

                    {/* Current Status */}
                    <View
                        style={[
                            styles.statusCard,
                            automaticSOS
                                ? styles.statusEnabled
                                : styles.statusDisabled,
                        ]}
                    >
                        <ThemedText style={styles.statusTitle}>
                            {automaticSOS
                                ? '🟢 Automatic SOS is ON'
                                : '⚪ Automatic SOS is OFF'}
                        </ThemedText>

                        <ThemedText style={styles.statusText}>
                            {automaticSOS
                                ? 'AI can recommend automatic emergency activation when a high-risk situation is detected.'
                                : 'You will manually activate SOS when you need emergency assistance.'}
                        </ThemedText>
                    </View>

                    {/* 🎙️ Voice SOS Trigger */}
                    <View style={styles.section}>
                        <ThemedText style={styles.sectionTitle}>
                            🎙️ Voice SOS Trigger
                        </ThemedText>

                        <ThemedText style={styles.sectionDescription}>
                            Trigger emergency assistance hands-free using your voice. All processing is done locally on your device for absolute privacy.
                        </ThemedText>

                        {/* Voice SOS Toggle */}
                        <View style={styles.settingCard}>
                            <View style={[styles.iconContainer, { backgroundColor: '#EC4899' }]}>
                                <SymbolView
                                    name={{
                                        ios: 'mic.fill',
                                        android: 'mic',
                                        web: 'mic',
                                    }}
                                    size={26}
                                    tintColor="#FFFFFF"
                                />
                            </View>

                            <View style={styles.settingInfo}>
                                <ThemedText style={styles.settingTitle}>
                                    Voice Activation
                                </ThemedText>

                                <ThemedText style={styles.settingDescription}>
                                    Start monitoring microphone to detect the emergency phrase.
                                </ThemedText>
                            </View>

                            <Switch
                                value={voiceSOSEnabled}
                                onValueChange={setVoiceSOSEnabled}
                            />
                        </View>

                        {/* Phrase Selector */}
                        {voiceSOSEnabled && (
                            <View style={styles.phraseContainer}>
                                <ThemedText style={styles.settingTitle}>Emergency Phrase</ThemedText>
                                <ThemedText style={styles.settingDescription}>
                                    Select or type the phrase to trigger SOS. Say this phrase clearly in the foreground.
                                </ThemedText>
                                <View style={styles.phraseSelector}>
                                    {PREDEFINED_PHRASES.map((phrase) => (
                                        <Pressable
                                            key={phrase}
                                            onPress={() => setEmergencyPhrase(phrase)}
                                            style={[
                                                styles.phraseOption,
                                                emergencyPhrase === phrase && styles.phraseOptionSelected
                                            ]}
                                        >
                                            <ThemedText style={[
                                                styles.phraseOptionText,
                                                emergencyPhrase === phrase && styles.phraseOptionTextSelected
                                            ]}>
                                                &quot;{phrase}&quot;
                                            </ThemedText>
                                        </Pressable>
                                    ))}
                                    <Pressable
                                        onPress={() => setEmergencyPhrase('')}
                                        style={[
                                            styles.phraseOption,
                                            !PREDEFINED_PHRASES.includes(emergencyPhrase) && styles.phraseOptionSelected
                                        ]}
                                    >
                                        <ThemedText style={[
                                            styles.phraseOptionText,
                                            !PREDEFINED_PHRASES.includes(emergencyPhrase) && styles.phraseOptionTextSelected
                                        ]}>
                                            Custom
                                        </ThemedText>
                                    </Pressable>
                                </View>

                                {!PREDEFINED_PHRASES.includes(emergencyPhrase) && (
                                    <TextInput
                                        style={styles.customInput}
                                        value={customPhraseInput}
                                        onChangeText={handleCustomPhraseChange}
                                        placeholder="Type custom phrase (e.g. 'help me now')"
                                        placeholderTextColor="#94A3B8"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                )}
                            </View>
                        )}
                    </View>

                    {/* Voice SOS Status Card */}
                    <View
                        style={[
                            styles.statusCard,
                            voiceSOSEnabled
                                ? (voiceSOSStatus === 'listening' ? styles.statusListening : styles.statusEnabled)
                                : (voiceSOSStatus === 'permission_denied' ? styles.statusError : styles.statusDisabled),
                        ]}
                    >
                        <ThemedText style={styles.statusTitle}>
                            {voiceSOSStatus === 'listening' && '🔊 Voice SOS: Listening'}
                            {voiceSOSStatus === 'on' && '🟢 Voice SOS: ON'}
                            {voiceSOSStatus === 'off' && '⚪ Voice SOS: OFF'}
                            {voiceSOSStatus === 'permission_denied' && '🔴 Microphone Permission Denied'}
                            {voiceSOSStatus === 'error' && '🔴 Voice SOS: Error'}
                        </ThemedText>

                        <ThemedText style={styles.statusText}>
                            {voiceSOSStatus === 'listening' && 'Microphone is actively monitoring. Try speaking the emergency phrase clearly.'}
                            {voiceSOSStatus === 'on' && 'Monitoring is enabled but paused. It will run when the app is in the foreground.'}
                            {voiceSOSStatus === 'off' && 'Voice SOS monitoring is OFF.'}
                            {voiceSOSStatus === 'permission_denied' && 'Speech recognition or microphone permissions were denied. Please enable them in your device Settings.'}
                            {voiceSOSStatus === 'error' && 'An error occurred with the local voice recognition system.'}
                        </ThemedText>

                        {voiceSOSStatus === 'listening' && transcription !== '' && (
                            <View style={styles.transcriptionContainer}>
                                <ThemedText style={styles.transcriptionLabel}>Live Speech Transcript:</ThemedText>
                                <ThemedText style={styles.transcriptionText}>&quot;{transcription}&quot;</ThemedText>
                            </View>
                        )}
                    </View>

                    {/* 🛡️ Silent Guardian */}
                    <View style={styles.section}>
                        <ThemedText style={styles.sectionTitle}>
                            🛡️ Silent Guardian
                        </ThemedText>

                        <ThemedText style={styles.sectionDescription}>
                            Trigger emergency protection discreetly with a phone gesture.
                        </ThemedText>

                        {/* Silent Guardian Toggle Card */}
                        <View style={styles.settingCard}>
                            <View style={[styles.iconContainer, { backgroundColor: '#4F46E5' }]}>
                                <SymbolView
                                    name={{
                                        ios: 'shield.lefthalf.filled',
                                        android: 'security',
                                        web: 'shield',
                                    } as any}
                                    size={26}
                                    tintColor="#FFFFFF"
                                />
                            </View>

                            <View style={styles.settingInfo}>
                                <ThemedText style={styles.settingTitle}>
                                    Silent Guardian Mode
                                </ThemedText>

                                <ThemedText style={styles.settingDescription}>
                                    Shake your phone with the configured gesture to start emergency protection.
                                </ThemedText>
                            </View>

                            <Switch
                                value={silentGuardianEnabled}
                                onValueChange={toggleSilentGuardian}
                                disabled={Platform.OS === 'web'}
                            />
                        </View>
                    </View>

                    {/* Silent Guardian Status Card */}
                    <View
                        style={[
                            styles.statusCard,
                            silentGuardianEnabled
                                ? (silentGuardianStatus === 'monitoring' ? styles.statusListening : styles.statusEnabled)
                                : (silentGuardianStatus === 'unsupported' ? styles.statusError : styles.statusDisabled),
                        ]}
                    >
                        <ThemedText style={styles.statusTitle}>
                            {Platform.OS === 'web' && '⚪ Silent Guardian: Unavailable on Web'}
                            {Platform.OS !== 'web' && silentGuardianStatus === 'monitoring' && '🟢 Silent Guardian: Active & Monitoring'}
                            {Platform.OS !== 'web' && silentGuardianStatus === 'countdown' && '⚠️ Silent Guardian: Countdown Active'}
                            {Platform.OS !== 'web' && silentGuardianStatus === 'triggered' && '🚨 Silent Guardian: SOS Dispatched'}
                            {Platform.OS !== 'web' && silentGuardianStatus === 'unsupported' && '🔴 Silent Guardian: Sensor Unsupported'}
                            {Platform.OS !== 'web' && !silentGuardianEnabled && '⚪ Silent Guardian: OFF'}
                        </ThemedText>

                        <ThemedText style={styles.statusText}>
                            {Platform.OS === 'web'
                                ? 'Hardware motion sensors are not available in web browsers. Use the SafeHer mobile app on Android or iOS.'
                                : silentGuardianEnabled
                                    ? 'Requires 3 deliberate rapid shakes within 1.5 seconds to trigger. Accidental single movements are automatically ignored.'
                                    : 'When enabled, a deliberate 3-shake gesture will discreetly start the 5-second countdown without exposing sensitive screens or sounding alarms.'}
                        </ThemedText>

                        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(148, 163, 184, 0.2)' }}>
                            <ThemedText style={{ fontSize: 11, color: '#94A3B8' }}>
                                {Platform.OS === 'android'
                                    ? '📱 Android: Runs via native low-power background service while app is active or minimized. Does not monitor if app is force-stopped.'
                                    : Platform.OS === 'ios'
                                        ? '📱 iOS: Operates while the SafeHer AI app is active in the foreground.'
                                        : '🌐 Web: Simulated/fallback mode.'}
                            </ThemedText>
                        </View>
                    </View>

                    {/* How it works */}
                    <View style={styles.infoCard}>
                        <ThemedText style={styles.infoTitle}>
                            How Smart SOS works
                        </ThemedText>

                        <View style={styles.step}>
                            <View style={styles.stepNumber}>
                                <ThemedText style={styles.stepNumberText}>
                                    1
                                </ThemedText>
                            </View>

                            <ThemedText style={styles.stepText}>
                                User reports a dangerous situation
                            </ThemedText>
                        </View>

                        <View style={styles.step}>
                            <View style={styles.stepNumber}>
                                <ThemedText style={styles.stepNumberText}>
                                    2
                                </ThemedText>
                            </View>

                            <ThemedText style={styles.stepText}>
                                AI analyzes the reported threat
                            </ThemedText>
                        </View>

                        <View style={styles.step}>
                            <View style={styles.stepNumber}>
                                <ThemedText style={styles.stepNumberText}>
                                    3
                                </ThemedText>
                            </View>

                            <ThemedText style={styles.stepText}>
                                AI calculates the risk level
                            </ThemedText>
                        </View>

                        <View style={styles.step}>
                            <View style={styles.stepNumber}>
                                <ThemedText style={styles.stepNumberText}>
                                    4
                                </ThemedText>
                            </View>

                            <ThemedText style={styles.stepText}>
                                High-risk situations can trigger SOS
                            </ThemedText>
                        </View>
                    </View>

                    {/* Risk Levels */}
                    <View style={styles.riskCard}>
                        <ThemedText style={styles.infoTitle}>
                            AI Risk Levels
                        </ThemedText>

                        <View style={styles.riskRow}>
                            <ThemedText style={styles.riskEmoji}>
                                🟢
                            </ThemedText>

                            <View style={styles.riskInfo}>
                                <ThemedText style={styles.riskTitle}>
                                    Low Risk
                                </ThemedText>

                                <ThemedText style={styles.riskDescription}>
                                    No immediate threat detected
                                </ThemedText>
                            </View>
                        </View>

                        <View style={styles.riskRow}>
                            <ThemedText style={styles.riskEmoji}>
                                🟡
                            </ThemedText>

                            <View style={styles.riskInfo}>
                                <ThemedText style={styles.riskTitle}>
                                    Medium Risk
                                </ThemedText>

                                <ThemedText style={styles.riskDescription}>
                                    User should be cautious
                                </ThemedText>
                            </View>
                        </View>

                        <View style={styles.riskRow}>
                            <ThemedText style={styles.riskEmoji}>
                                🔴
                            </ThemedText>

                            <View style={styles.riskInfo}>
                                <ThemedText style={styles.riskTitle}>
                                    High Risk
                                </ThemedText>

                                <ThemedText style={styles.riskDescription}>
                                    Emergency action may be required
                                </ThemedText>
                            </View>
                        </View>
                    </View>

                    <ThemedText style={styles.disclaimer}>
                        Automatic SOS should be configured according to your
                        safety preferences. Always contact emergency services
                        during a real emergency.
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

    section: {
        marginTop: 20,
        backgroundColor: 'transparent',
    },

    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'transparent',
    },

    sectionTitle: {
        fontSize: 24,
        fontWeight: '800',
    },

    sectionDescription: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 21,
        marginTop: 8,
    },

    settingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        padding: 18,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        elevation: 3,
    },

    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#7C3AED',
        alignItems: 'center',
        justifyContent: 'center',
    },

    settingInfo: {
        flex: 1,
        marginLeft: 14,
        marginRight: 10,
    },

    settingTitle: {
        fontSize: 17,
        fontWeight: '800',
    },

    settingDescription: {
        fontSize: 12,
        color: '#64748B',
        lineHeight: 18,
        marginTop: 4,
    },

    statusCard: {
        marginTop: 20,
        padding: 18,
        borderRadius: 18,
        borderWidth: 1,
    },

    statusEnabled: {
        backgroundColor: '#F0FDF4',
        borderColor: '#86EFAC',
    },

    statusDisabled: {
        backgroundColor: '#F8FAFC',
        borderColor: '#CBD5E1',
    },

    statusTitle: {
        fontSize: 16,
        fontWeight: '800',
    },

    statusText: {
        fontSize: 13,
        color: '#64748B',
        lineHeight: 19,
        marginTop: 6,
    },

    infoCard: {
        marginTop: 20,
        padding: 20,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
    },

    infoTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 15,
    },

    step: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },

    stepNumber: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#EDE9FE',
        alignItems: 'center',
        justifyContent: 'center',
    },

    stepNumberText: {
        color: '#7C3AED',
        fontWeight: '800',
    },

    stepText: {
        flex: 1,
        marginLeft: 12,
        fontSize: 13,
        color: '#475569',
    },

    riskCard: {
        marginTop: 20,
        padding: 20,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
    },

    riskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },

    riskEmoji: {
        fontSize: 22,
    },

    riskInfo: {
        marginLeft: 12,
    },

    riskTitle: {
        fontSize: 14,
        fontWeight: '700',
    },

    riskDescription: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },

    disclaimer: {
        textAlign: 'center',
        color: '#94A3B8',
        fontSize: 11,
        lineHeight: 17,
        marginTop: 25,
    },
    phraseContainer: {
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    phraseSelector: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
    },
    phraseOption: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    phraseOptionSelected: {
        backgroundColor: '#7C3AED',
        borderColor: '#7C3AED',
    },
    phraseOptionText: {
        fontSize: 13,
        color: '#475569',
    },
    phraseOptionTextSelected: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    customInput: {
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        padding: 12,
        marginTop: 10,
        backgroundColor: '#FFFFFF',
        fontSize: 14,
        color: '#1E293B',
    },
    statusListening: {
        backgroundColor: '#F0FDF4',
        borderColor: '#86EFAC',
    },
    statusError: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FCA5A5',
    },
    transcriptionContainer: {
        marginTop: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
    },
    transcriptionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    transcriptionText: {
        fontSize: 14,
        fontStyle: 'italic',
        color: '#1E293B',
        marginTop: 2,
    },
});