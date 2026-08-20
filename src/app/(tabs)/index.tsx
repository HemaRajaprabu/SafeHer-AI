import * as Device from 'expo-device';

import { Platform, Pressable, StyleSheet, ScrollView, View, useWindowDimensions, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { AnimatedIcon } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import LocationSafetyCard from '@/components/LocationSafetyCard';

function getDevMenuHint() {
  if (Platform.OS === 'web') {
    return <ThemedText type="small">use browser devtools</ThemedText>;
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        shake device or press <ThemedText type="code">m</ThemedText> in terminal
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === 'android' ? 'cmd+m (or ctrl+m)' : 'cmd+d';
  return (
    <ThemedText type="small">
      press <ThemedText type="code">{shortcut}</ThemedText>
    </ThemedText>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  useAuth();
  const { width } = useWindowDimensions();

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const isDark = theme.text === '#ffffff';

  // Responsive card widths: 4 in a row for desktop, 2 for tablet, stacked vertically or 2 per row for mobile
  const isLarge = width >= 1024;
  const isMedium = width >= 768 && width < 1024;
  const cardWidth = isLarge ? '23.5%' : isMedium ? '48%' : '100%';

  // Local color configuration that adapts to light/dark themes
  const colors = {
    bg: isDark ? '#0C0812' : '#FAF9FF', // Deep eggplant / soft lilac-lavender
    cardBg: isDark ? '#15101F' : '#FFFFFF', // Dark card / white card
    border: isDark ? '#2D253A' : '#F0E6EC',
    text: isDark ? '#FFFFFF' : '#1E1B1D',
    textSec: isDark ? '#A195B0' : '#786E75',
    primary: '#7C3AED', // Brand Purple
    primaryLight: isDark ? '#2E1065' : '#F3E8FF', // Dark purple / soft purple tint
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.bg }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <ThemedView style={[styles.heroSection, { backgroundColor: colors.bg }]}>
            <AnimatedIcon />
            <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
              SafeHer AI
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSec }]} themeColor="textSecondary">
              Your Safety Companion
            </ThemedText>
            <Pressable
              onPress={() => router.push('/settings')}
              style={({ pressed }) => [
                styles.settingsButton,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{
                  ios: 'gearshape.fill',
                  android: 'settings',
                  web: 'settings',
                } as any}
                size={18}
                tintColor="#FFFFFF"
              />

              <ThemedText style={styles.settingsButtonText}>
                Safety Settings
              </ThemedText>
            </Pressable>

          </ThemedView>

          {/* Keep LocationSafetyCard functional but visually hidden from UI */}
          <View style={{ display: 'none' }}>
            <LocationSafetyCard />
          </View>

          {/* Feature-Card Dashboard Grid */}
          <View style={[styles.grid, { flexWrap: isLarge ? 'nowrap' : 'wrap' }]}>
            {/* CARD 1: SOS */}
            <Pressable
              onPress={() => router.push('/sos')}
              style={({ pressed }) => [
                styles.card,
                { width: cardWidth, backgroundColor: colors.cardBg, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: isDark ? '#451A1A' : '#FEE2E2' }]}>
                  <SymbolView name={"light.beacon.max.fill" as any} size={22} tintColor="#EF4444" />
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>SOS</Text>
                <Text style={[styles.cardDesc, { color: colors.textSec }]}>
                  Get immediate help in emergency situations
                </Text>
              </View>
              <View style={[styles.arrowCircle, { backgroundColor: colors.primaryLight }]}>
                <SymbolView name={"chevron.right" as any} size={12} tintColor={colors.primary} />
              </View>
            </Pressable>

            {/* CARD 2: Live Location */}
            <Pressable
              onPress={() => router.push('/live-location')}
              style={({ pressed }) => [
                styles.card,
                { width: cardWidth, backgroundColor: colors.cardBg, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: isDark ? '#064E3B' : '#D1FAE5' }]}>
                  <SymbolView name={"mappin.and.ellipse" as any} size={22} tintColor="#10B981" />
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Live Location</Text>
                <Text style={[styles.cardDesc, { color: colors.textSec }]}>
                  Share your real-time location with trusted contacts
                </Text>
              </View>
              <View style={[styles.arrowCircle, { backgroundColor: colors.primaryLight }]}>
                <SymbolView name={"chevron.right" as any} size={12} tintColor={colors.primary} />
              </View>
            </Pressable>

            {/* CARD 3: Safety Timer */}
            <Pressable
              onPress={() => router.push('/safety-timer')}
              style={({ pressed }) => [
                styles.card,
                { width: cardWidth, backgroundColor: colors.cardBg, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: isDark ? '#451E0E' : '#FEF3C7' }]}>
                  <SymbolView name={"clock.fill" as any} size={22} tintColor="#F59E0B" />
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Safety Timer</Text>
                <Text style={[styles.cardDesc, { color: colors.textSec }]}>
                  {"Set a safety timer and get alerted if you don't check-in"}
                </Text>
              </View>
              <View style={[styles.arrowCircle, { backgroundColor: colors.primaryLight }]}>
                <SymbolView name={"chevron.right" as any} size={12} tintColor={colors.primary} />
              </View>
            </Pressable>

            {/* CARD 4: Emergency Contacts */}
            <Pressable
              onPress={() => router.push('/emergency-contacts')}
              style={({ pressed }) => [
                styles.card,
                { width: cardWidth, backgroundColor: colors.cardBg, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                  <SymbolView name={"person.2.fill" as any} size={22} tintColor={colors.primary} />
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Emergency Contacts</Text>
                <Text style={[styles.cardDesc, { color: colors.textSec }]}>
                  Manage and connect with your emergency contacts
                </Text>
              </View>
              <View style={[styles.arrowCircle, { backgroundColor: colors.primaryLight }]}>
                <SymbolView name={"chevron.right" as any} size={12} tintColor={colors.primary} />
              </View>
            </Pressable>
          </View>

          {/* AI Risk Analysis Wide Card */}
          <Pressable
            onPress={() => router.push('/safety-analysis')}
            style={({ pressed }) => [
              styles.aiRiskCard,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.aiRiskLeft}>
              <View style={[styles.aiIconCircle, { backgroundColor: colors.primaryLight }]}>
                <SymbolView name={"sparkles" as any} size={22} tintColor={colors.primary} />
              </View>
              <View style={styles.aiRiskInfo}>
                <Text style={[styles.aiRiskTitle, { color: colors.text }]}>
                  AI Risk Analysis
                </Text>
                <Text style={[styles.aiRiskDescription, { color: colors.textSec }]}>
                  Report a dangerous situation and let SafeHer AI analyze the risk.
                </Text>
              </View>
            </View>
            <View style={[styles.arrowCircleWide, { backgroundColor: colors.primaryLight }]}>
              <SymbolView name={"chevron.right" as any} size={12} tintColor={colors.primary} />
            </View>
          </Pressable>

          {Platform.OS === 'web' && <WebBadge />}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: BottomTabInset + 24,
    gap: 24,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.5,
    marginTop: 18,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    minHeight: 220,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  aiRiskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  aiRiskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  aiIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiRiskInfo: {
    flex: 1,
    gap: 2,
  },
  aiRiskTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  aiRiskDescription: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  arrowCircleWide: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  infoCard: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 20,
    height: 46,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
