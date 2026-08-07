import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function SettingsScreen() {
    const [automaticSOS, setAutomaticSOS] = useState(false);

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

        loadAutomaticSOS();
    }, []);

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
                        <Pressable
                            onPress={() => router.back()}
                            style={styles.backButton}
                        >
                            <SymbolView
                                name={{
                                    ios: 'chevron.left',
                                    android: 'arrow-back',
                                    web: 'arrow-left',
                                }}
                                size={24}
                                tintColor="#111827"
                            />
                        </Pressable>

                        <ThemedText style={styles.headerTitle}>
                            Safety Settings
                        </ThemedText>

                        <View style={styles.headerSpace} />
                    </View>

                    {/* AI Safety Automation */}
                    <View style={styles.section}>
                        <ThemedText style={styles.sectionTitle}>
                            🤖 AI Safety Automation
                        </ThemedText>

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

    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
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

    section: {
        marginTop: 20,
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
});