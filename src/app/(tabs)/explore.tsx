import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, MaxContentWidth, BottomTabInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { router, useFocusEffect } from 'expo-router';

export default function ExploreScreen() {
  const theme = useTheme();
  const isDark = theme.text === '#ffffff';
  const cardBg = isDark ? '#1E293B' : '#FFFFFF';

  const [safetyState, setSafetyState] = useState<{
    status: 'safe' | 'low' | 'medium' | 'high' | 'emergency';
    message: string;
    color: string;
  }>({
    status: 'safe',
    message: 'You are currently in normal safety mode.',
    color: '#10B981',
  });

  useFocusEffect(
    useCallback(() => {
      const loadSafetyState = async () => {
        try {
          const isSOSActive = await AsyncStorage.getItem('isSOSActive');
          if (isSOSActive === 'true') {
            setSafetyState({
              status: 'emergency',
              message: 'Emergency mode is active.',
              color: '#DC2626',
            });
            return;
          }

          const level = await AsyncStorage.getItem('currentRiskLevel');
          if (level === 'high') {
            setSafetyState({
              status: 'high',
              message: 'High risk detected. Consider activating SOS.',
              color: '#EF4444',
            });
          } else if (level === 'medium') {
            setSafetyState({
              status: 'medium',
              message: 'Increased risk detected. Stay alert.',
              color: '#F59E0B',
            });
          } else if (level === 'low') {
            setSafetyState({
              status: 'low',
              message: 'Low risk detected. Stay aware of your surroundings.',
              color: '#10B981',
            });
          } else {
            setSafetyState({
              status: 'safe',
              message: 'You are currently in normal safety mode.',
              color: '#10B981',
            });
          }
        } catch (e) {
          console.log('Error reading safety state:', e);
        }
      };

      loadSafetyState();
    }, [])
  );

  const showComingSoon = (feature: string) => {
    Alert.alert(
      feature,
      `${feature} feature will be connected in the next step.`
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Safety Center
            </ThemedText>

            <ThemedText
              themeColor="textSecondary"
              style={styles.subtitle}
            >
              Stay safe. Stay connected.
            </ThemedText>
          </View>

          {/* SOS Button */}
          <Pressable
            onPress={() => router.push('/sos')}
            style={({ pressed }) => [
              styles.sosCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.sosIcon}>
              <SymbolView
                name={{
                  ios: 'exclamationmark.triangle.fill',
                  android: 'warning',
                  web: 'warning',
                }}
                size={40}
                tintColor="#FFFFFF"
              />
            </View>

            <View style={styles.sosContent}>
              <ThemedText style={styles.sosTitle}>
                EMERGENCY SOS
              </ThemedText>

              <ThemedText style={styles.sosSubtitle}>
                Tap for emergency assistance
              </ThemedText>
            </View>
          </Pressable>

          {/* Quick Actions */}
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Quick Safety Actions
          </ThemedText>

          <View style={styles.grid}>
            {/* Emergency Contacts */}
            <Pressable
              onPress={() => router.push('/emergency-contacts' as any)}
              style={({ pressed }) => [
                styles.actionItem,
                { backgroundColor: 'transparent', borderWidth: 0, elevation: 0, shadowOpacity: 0 },
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{
                  ios: 'person.2.fill',
                  android: 'group',
                  web: 'group',
                } as any}
                size={28}
                tintColor={isDark ? '#C084FC' : '#7C3AED'}
              />

              <View style={styles.cardContent}>
                <ThemedText style={styles.cardTitle}>
                  Emergency Contacts
                </ThemedText>

                <ThemedText
                  style={styles.cardSubtitle}
                  themeColor="textSecondary"
                  numberOfLines={1}
                >
                  Manage trusted contacts
                </ThemedText>
              </View>
            </Pressable>

            {/* Location */}
            <Pressable
              onPress={() => router.push('/live-location' as any)}
              style={({ pressed }) => [
                styles.actionItem,
                { backgroundColor: 'transparent', borderWidth: 0, elevation: 0, shadowOpacity: 0 },
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{
                  ios: 'location.fill',
                  android: 'location_on',
                  web: 'location_on',
                } as any}
                size={28}
                tintColor={isDark ? '#60A5FA' : '#2563EB'}
              />

              <View style={styles.cardContent}>
                <ThemedText style={styles.cardTitle}>
                  Live Location
                </ThemedText>

                <ThemedText
                  style={styles.cardSubtitle}
                  themeColor="textSecondary"
                  numberOfLines={1}
                >
                  Share your location
                </ThemedText>
              </View>
            </Pressable>

            {/* Safety Timer */}
            <Pressable
              onPress={() => router.push('/safety-timer')}
              style={({ pressed }) => [
                styles.actionItem,
                { backgroundColor: 'transparent', borderWidth: 0, elevation: 0, shadowOpacity: 0 },
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{
                  ios: 'timer',
                  android: 'timer',
                  web: 'timer',
                } as any}
                size={28}
                tintColor={isDark ? '#FBBF24' : '#D97706'}
              />

              <View style={styles.cardContent}>
                <ThemedText style={styles.cardTitle}>
                  Safety Timer
                </ThemedText>

                <ThemedText
                  style={styles.cardSubtitle}
                  themeColor="textSecondary"
                  numberOfLines={1}
                >
                  Automatic safety check
                </ThemedText>
              </View>
            </Pressable>

            {/* Safe Places */}
            <Pressable
              onPress={() => router.push('/safe-places')}
              style={({ pressed }) => [
                styles.actionItem,
                { backgroundColor: 'transparent', borderWidth: 0, elevation: 0, shadowOpacity: 0 },
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{
                  ios: 'mappin.and.ellipse',
                  android: 'place',
                  web: 'place',
                } as any}
                size={28}
                tintColor={isDark ? '#34D399' : '#059669'}
              />

              <View style={styles.cardContent}>
                <ThemedText style={styles.cardTitle}>
                  Safe Places
                </ThemedText>

                <ThemedText
                  style={styles.cardSubtitle}
                  themeColor="textSecondary"
                  numberOfLines={1}
                >
                  Find nearby safe spots
                </ThemedText>
              </View>
            </Pressable>
          </View>

          {/* AI Assistant */}
          <Pressable
            onPress={() => router.push('/ai-assistant')}
            style={({ pressed }) => [
              styles.aiCard,
              { 
                backgroundColor: isDark ? '#3B0764' : '#F3E8FF',
                borderColor: isDark ? '#5B21B6' : '#E9D5FF',
                borderWidth: 1,
                shadowColor: isDark ? '#000000' : '#7C3AED',
                shadowOpacity: isDark ? 0.15 : 0.05,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 6,
                elevation: 3,
              },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.aiIcon}>
              <ThemedText style={styles.aiIconText}>AI</ThemedText>
            </View>

            <View style={styles.aiContent}>
              <ThemedText style={styles.aiTitle}>
                SafeHer AI Assistant
              </ThemedText>

              <ThemedText
                style={styles.cardSubtitle}
                themeColor="textSecondary"
              >
                Get safety guidance and quick assistance.
              </ThemedText>
            </View>

            <ThemedText style={[styles.arrow, { color: isDark ? '#C084FC' : '#7C3AED' }]}>›</ThemedText>
          </Pressable>

          {/* Safety Status */}
          <View
            style={[
              styles.statusCard,
              {
                backgroundColor: cardBg,
                borderColor: isDark ? '#334155' : '#E2E8F0',
                borderWidth: 1,
                borderLeftWidth: 4,
                borderLeftColor: safetyState.color,
                shadowColor: '#000000',
                shadowOpacity: isDark ? 0.1 : 0.02,
                shadowOffset: { width: 0, height: 1 },
                shadowRadius: 2,
                elevation: 1,
              }
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: safetyState.color }]} />

            <View style={styles.statusContent}>
              <ThemedText style={styles.cardTitle}>
                Safety Status
              </ThemedText>

              <ThemedText
                style={styles.cardSubtitle}
                themeColor="textSecondary"
              >
                {safetyState.message}
              </ThemedText>
            </View>
          </View>

          {/* Info */}
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.footerText}
          >
            SafeHer AI is designed to provide quick access
            to safety tools when you need them.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },

  scrollView: {
    flex: 1,
    width: '100%',
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: 16,
  },

  header: {
    paddingTop: 24,
    paddingBottom: Spacing.two,
    gap: Spacing.one,
  },

  title: {
    fontWeight: '800',
  },

  subtitle: {
    fontSize: 15,
  },

  sectionTitle: {
    fontWeight: '800',
  },

  sosCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.four,
    borderRadius: 20,
    backgroundColor: '#DC2626',
    gap: Spacing.three,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  sosIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  sosContent: {
    flex: 1,
    gap: 4,
  },

  sosTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  sosSubtitle: {
    color: '#FFFFFF',
    fontSize: 13,
    opacity: 0.9,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },

  actionItem: {
    width: '48%',
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },

  cardContent: {
    alignItems: 'center',
    gap: 1,
  },

  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },

  cardSubtitle: {
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
  },

  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    gap: 14,
  },

  aiIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
  },

  aiIconText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },

  aiTitle: {
    fontSize: 16,
    fontWeight: '800',
  },

  aiContent: {
    flex: 1,
    gap: 4,
  },

  arrow: {
    fontSize: 24,
    fontWeight: '600',
    opacity: 0.6,
  },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },

  statusContent: {
    flex: 1,
    gap: 4,
  },

  footerText: {
    textAlign: 'center',
    lineHeight: 18,
    fontSize: 11,
    marginTop: Spacing.two,
  },

  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
});