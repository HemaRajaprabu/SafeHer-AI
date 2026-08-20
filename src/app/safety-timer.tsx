import { useEffect, useState, useRef } from 'react';
import {
    Alert,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export default function SafetyTimerScreen() {
    const theme = useTheme();
    const [minutes, setMinutes] = useState<string>('5');
    const [secondsLeft, setSecondsLeft] = useState<number>(0);
    const [isActive, setIsActive] = useState<boolean>(false);
    const intervalRef = useRef<any>(null);

    const startTimer = () => {
        const mins = parseInt(minutes, 10);
        if (isNaN(mins) || mins <= 0 || mins > 180) {
            Alert.alert('Invalid Duration', 'Please enter a timer duration between 1 and 180 minutes.');
            return;
        }
        setSecondsLeft(mins * 60);
        setIsActive(true);
    };

    const stopTimer = () => {
        setIsActive(false);
        setSecondsLeft(0);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    useEffect(() => {
        if (isActive && secondsLeft > 0) {
            intervalRef.current = setInterval(() => {
                setSecondsLeft((prev) => {
                    if (prev <= 1) {
                        setIsActive(false);
                        Alert.alert('🚨 Timer Expired', 'Safety timer expired! Triggering Emergency SOS...');
                        router.push('/sos');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isActive, secondsLeft]);

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
                                ios: 'timer',
                                android: 'timer',
                                web: 'timer',
                            } as any}
                            size={24}
                            tintColor={theme.text}
                        />
                    </Pressable>

                    <ThemedText style={styles.headerTitle}>
                        Safety Timer
                    </ThemedText>

                    <View style={styles.headerSpace} />
                </View>

                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <SymbolView
                            name={{
                                ios: 'timer',
                                android: 'timer',
                                web: 'timer',
                            } as any}
                            size={48}
                            tintColor={isActive ? '#EF4444' : theme.text}
                        />
                    </View>

                    {isActive ? (
                        <View style={styles.activeContainer}>
                            <ThemedText style={styles.activeLabel}>
                                AUTOMATIC SOS IN
                            </ThemedText>
                            <ThemedText style={styles.timerDisplay}>
                                {formatTime(secondsLeft)}
                            </ThemedText>
                            <ThemedText style={styles.activeDescription} themeColor="textSecondary">
                                Keep this app running. If you do not cancel this timer before it reaches zero, Emergency SOS will be triggered automatically.
                            </ThemedText>

                            <Pressable
                                onPress={stopTimer}
                                style={({ pressed }) => [
                                    styles.stopButton,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <ThemedText style={styles.stopButtonText}>
                                    I Am Safe (Cancel Timer)
                                </ThemedText>
                            </Pressable>
                        </View>
                    ) : (
                        <View style={styles.setupContainer}>
                            <ThemedText style={styles.setupTitle}>
                                Set Safety Timer
                            </ThemedText>
                            <ThemedText style={styles.setupDescription} themeColor="textSecondary">
                                Going for a walk or ride? Set a duration. If you do not check in by canceling the timer, SafeHer AI will trigger distress mode automatically.
                            </ThemedText>

                            <View style={styles.inputGroup}>
                                <ThemedText type="small" style={styles.inputLabel} themeColor="textSecondary">
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
                                        },
                                    ]}
                                />
                            </View>

                            <Pressable
                                onPress={startTimer}
                                style={({ pressed }) => [
                                    styles.startButton,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <ThemedText style={styles.startButtonText}>
                                    Start Safety Timer
                                </ThemedText>
                            </Pressable>
                        </View>
                    )}
                </View>
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
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        marginBottom: 28,
    },
    setupContainer: {
        width: '100%',
        alignItems: 'center',
    },
    setupTitle: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 12,
    },
    setupDescription: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 21,
        marginBottom: 32,
        paddingHorizontal: 16,
    },
    inputGroup: {
        width: '100%',
        marginBottom: 24,
        gap: 8,
    },
    inputLabel: {
        fontWeight: '700',
    },
    input: {
        width: '100%',
        height: 52,
        borderWidth: 1.5,
        borderRadius: 14,
        paddingHorizontal: 16,
        fontSize: 16,
        fontWeight: '600',
    },
    startButton: {
        width: '100%',
        backgroundColor: '#2563EB',
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    startButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16,
    },
    activeContainer: {
        width: '100%',
        alignItems: 'center',
    },
    activeLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#EF4444',
        letterSpacing: 1.5,
        marginBottom: 8,
    },
    timerDisplay: {
        fontSize: 64,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
        marginBottom: 16,
    },
    activeDescription: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 21,
        marginBottom: 32,
        paddingHorizontal: 20,
    },
    stopButton: {
        width: '100%',
        backgroundColor: '#10B981',
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stopButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16,
    },
    pressed: {
        opacity: 0.8,
    },
});
