import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type RiskLevel = 'low' | 'medium' | 'high';

interface Situation {
    id: string;
    title: string;
    description: string;
    risk: number;
    icon: string;
}

const situations: Situation[] = [
    {
        id: 'following',
        title: 'Someone is following me',
        description: 'I think someone is following or tracking me.',
        risk: 85,
        icon: '👤',
    },
    {
        id: 'threatened',
        title: 'Someone is threatening me',
        description: 'Someone is verbally or physically threatening me.',
        risk: 95,
        icon: '⚠️',
    },
    {
        id: 'isolated',
        title: 'I am in an isolated area',
        description: 'I am alone in an unfamiliar or isolated location.',
        risk: 65,
        icon: '🌙',
    },
    {
        id: 'unsafe',
        title: 'I feel unsafe',
        description: 'I feel uncomfortable or unsafe in my current situation.',
        risk: 55,
        icon: '😟',
    },
    {
        id: 'suspicious',
        title: 'Suspicious person nearby',
        description: 'There is someone nearby behaving suspiciously.',
        risk: 70,
        icon: '👀',
    },
];

export default function SafetyAnalysisScreen() {
    const [selectedSituation, setSelectedSituation] =
        useState<Situation | null>(null);

    const [riskScore, setRiskScore] = useState<number | null>(null);

    const [riskLevel, setRiskLevel] = useState<RiskLevel | null>(null);
    const [automaticSOS, setAutomaticSOS] = useState(false);
    useEffect(() => {
        const loadAutomaticSOS = async () => {
            try {
                const savedValue =
                    await AsyncStorage.getItem('automaticSOS');

                if (savedValue !== null) {
                    setAutomaticSOS(savedValue === 'true');
                }
            } catch (error) {
                console.log('Error loading Automatic SOS setting:', error);
            }
        };

        loadAutomaticSOS();
    }, []);

    const analyzeRisk = () => {
        if (!selectedSituation) {
            Alert.alert(
                'Select a situation',
                'Please select what is happening before starting the AI risk analysis.'
            );
            return;
        }

        const score = selectedSituation.risk;

        setRiskScore(score);

        if (score >= 70) {
            setRiskLevel('high');
        } else if (score >= 40) {
            setRiskLevel('medium');
        } else {
            setRiskLevel('low');
        }
    };

    const getRiskTitle = () => {
        if (riskLevel === 'high') {
            return '🔴 HIGH RISK';
        }

        if (riskLevel === 'medium') {
            return '🟡 MEDIUM RISK';
        }

        return '🟢 LOW RISK';
    };

    const getRiskDescription = () => {
        if (riskLevel === 'high') {
            return 'A potentially dangerous situation has been detected. Emergency assistance may be required.';
        }

        if (riskLevel === 'medium') {
            return 'Some warning signs were detected. Stay alert and consider moving to a safer location.';
        }

        return 'No immediate high-risk pattern was detected. Continue to stay aware of your surroundings.';
    };
    useEffect(() => {
        if (riskLevel === 'high' && automaticSOS) {
            Alert.alert(
                '🚨 Automatic SOS',
                'High-risk situation detected. Automatic SOS is enabled.',
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                    },
                    {
                        text: 'Open SOS',
                        onPress: () => {
                            router.push('/sos');
                        },
                    },
                ]
            );
        }
    }, [riskLevel, automaticSOS]);

    const handleSOSRecommendation = () => {
        if (riskLevel !== 'high') {
            Alert.alert(
                'Safety Recommendation',
                'The current risk level does not require immediate SOS activation. Stay alert and move to a safe location if possible.'
            );
            return;
        }

        router.push('/sos');
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
                            AI Risk Analysis
                        </ThemedText>

                        <View style={styles.headerSpace} />
                    </View>

                    {/* AI Header */}
                    <View style={styles.aiHeader}>
                        <View style={styles.aiIcon}>
                            <ThemedText style={styles.aiEmoji}>
                                🤖
                            </ThemedText>
                        </View>

                        <ThemedText style={styles.title}>
                            AI Safety Risk Analysis
                        </ThemedText>

                        <ThemedText style={styles.subtitle}>
                            Tell SafeHer AI what is happening and get a
                            safety risk assessment.
                        </ThemedText>
                    </View>

                    {/* Situation */}
                    <ThemedText style={styles.sectionTitle}>
                        What is happening?
                    </ThemedText>

                    <View style={styles.situationList}>
                        {situations.map((situation) => {
                            const selected =
                                selectedSituation?.id === situation.id;

                            return (
                                <Pressable
                                    key={situation.id}
                                    onPress={() => {
                                        setSelectedSituation(situation);
                                        setRiskScore(null);
                                        setRiskLevel(null);
                                    }}
                                    style={({ pressed }) => [
                                        styles.situationCard,
                                        selected &&
                                        styles.selectedSituation,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <View style={styles.situationIcon}>
                                        <ThemedText style={styles.emoji}>
                                            {situation.icon}
                                        </ThemedText>
                                    </View>

                                    <View style={styles.situationInfo}>
                                        <ThemedText
                                            style={styles.situationTitle}
                                        >
                                            {situation.title}
                                        </ThemedText>

                                        <ThemedText
                                            style={styles.situationDescription}
                                        >
                                            {situation.description}
                                        </ThemedText>
                                    </View>

                                    {selected && (
                                        <View style={styles.checkCircle}>
                                            <SymbolView
                                                name={{
                                                    ios: 'checkmark',
                                                    android: 'check',
                                                    web: 'check',
                                                }}
                                                size={16}
                                                tintColor="#FFFFFF"
                                            />
                                        </View>
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>

                    {/* Analyze Button */}
                    <Pressable
                        onPress={analyzeRisk}
                        style={({ pressed }) => [
                            styles.analyzeButton,
                            pressed && styles.pressed,
                        ]}
                    >
                        <ThemedText style={styles.analyzeButtonText}>
                            🤖 ANALYZE RISK
                        </ThemedText>
                    </Pressable>

                    {/* Result */}
                    {riskLevel && riskScore !== null && (
                        <View
                            style={[
                                styles.resultCard,
                                riskLevel === 'high'
                                    ? styles.highRisk
                                    : riskLevel === 'medium'
                                        ? styles.mediumRisk
                                        : styles.lowRisk,
                            ]}
                        >
                            <ThemedText style={styles.resultTitle}>
                                {getRiskTitle()}
                            </ThemedText>

                            <ThemedText style={styles.scoreLabel}>
                                Risk Score
                            </ThemedText>

                            <ThemedText style={styles.score}>
                                {riskScore}
                                <ThemedText style={styles.scoreMax}>
                                    /100
                                </ThemedText>
                            </ThemedText>

                            <View style={styles.progressBackground}>
                                <View
                                    style={[
                                        styles.progress,
                                        {
                                            width: `${riskScore}%`,
                                        },
                                    ]}
                                />
                            </View>

                            <ThemedText style={styles.resultDescription}>
                                {getRiskDescription()}
                            </ThemedText>

                            {riskLevel === 'high' && (
                                <Pressable
                                    onPress={handleSOSRecommendation}
                                    style={({ pressed }) => [
                                        styles.sosRecommendation,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <ThemedText
                                        style={styles.sosRecommendationText}
                                    >
                                        🚨 OPEN EMERGENCY SOS
                                    </ThemedText>
                                </Pressable>
                            )}
                        </View>
                    )}

                    {/* How it works */}
                    <View style={styles.infoCard}>
                        <ThemedText style={styles.infoTitle}>
                            How AI Risk Analysis works
                        </ThemedText>

                        <ThemedText style={styles.infoText}>
                            1. You report what is happening.
                        </ThemedText>

                        <ThemedText style={styles.infoText}>
                            2. SafeHer AI evaluates the situation.
                        </ThemedText>

                        <ThemedText style={styles.infoText}>
                            3. A risk score is calculated.
                        </ThemedText>

                        <ThemedText style={styles.infoText}>
                            4. High-risk situations can lead to SOS
                            recommendations.
                        </ThemedText>
                    </View>

                    <ThemedText style={styles.disclaimer}>
                        AI risk analysis is a safety-support feature and may
                        not always correctly identify danger. In an actual
                        emergency, contact local emergency services.
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

    aiHeader: {
        alignItems: 'center',
        marginTop: 15,
        marginBottom: 30,
    },

    aiIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EDE9FE',
        alignItems: 'center',
        justifyContent: 'center',
    },

    aiEmoji: {
        fontSize: 40,
    },

    title: {
        fontSize: 26,
        fontWeight: '800',
        marginTop: 15,
        textAlign: 'center',
    },

    subtitle: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 21,
        marginTop: 8,
        textAlign: 'center',
    },

    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 14,
    },

    situationList: {
        gap: 12,
    },

    situationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: 'transparent',
    },

    selectedSituation: {
        borderColor: '#7C3AED',
        backgroundColor: '#F5F3FF',
    },

    situationIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },

    emoji: {
        fontSize: 24,
    },

    situationInfo: {
        flex: 1,
        marginLeft: 14,
        marginRight: 8,
    },

    situationTitle: {
        fontSize: 15,
        fontWeight: '800',
    },

    situationDescription: {
        fontSize: 12,
        color: '#64748B',
        lineHeight: 18,
        marginTop: 3,
    },

    checkCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#7C3AED',
        alignItems: 'center',
        justifyContent: 'center',
    },

    analyzeButton: {
        marginTop: 24,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#7C3AED',
        alignItems: 'center',
        justifyContent: 'center',
    },

    analyzeButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
    },

    resultCard: {
        marginTop: 24,
        padding: 22,
        borderRadius: 22,
        borderWidth: 1,
    },

    highRisk: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FCA5A5',
    },

    mediumRisk: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FCD34D',
    },

    lowRisk: {
        backgroundColor: '#F0FDF4',
        borderColor: '#86EFAC',
    },

    resultTitle: {
        fontSize: 22,
        fontWeight: '900',
        textAlign: 'center',
    },

    scoreLabel: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 14,
    },

    score: {
        fontSize: 52,
        fontWeight: '900',
        textAlign: 'center',
        marginTop: 2,
    },

    scoreMax: {
        fontSize: 20,
        fontWeight: '600',
        color: '#64748B',
    },

    progressBackground: {
        height: 10,
        borderRadius: 5,
        backgroundColor: '#E2E8F0',
        overflow: 'hidden',
        marginTop: 12,
    },

    progress: {
        height: '100%',
        backgroundColor: '#DC2626',
        borderRadius: 5,
    },

    resultDescription: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 21,
        textAlign: 'center',
        marginTop: 15,
    },

    sosRecommendation: {
        marginTop: 18,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#DC2626',
        alignItems: 'center',
        justifyContent: 'center',
    },

    sosRecommendationText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
    },

    infoCard: {
        marginTop: 24,
        padding: 20,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
    },

    infoTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 12,
    },

    infoText: {
        fontSize: 13,
        color: '#475569',
        lineHeight: 21,
        marginBottom: 7,
    },

    disclaimer: {
        textAlign: 'center',
        color: '#94A3B8',
        fontSize: 11,
        lineHeight: 17,
        marginTop: 22,
    },

    pressed: {
        opacity: 0.75,
    },
});