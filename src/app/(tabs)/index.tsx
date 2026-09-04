import * as Device from 'expo-device';
import { Platform, Pressable, StyleSheet, ScrollView, View, useWindowDimensions, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import LocationSafetyCard from '@/components/LocationSafetyCard';

export default function HomeScreen() {
  const theme = useTheme();
  useAuth();
  const { width } = useWindowDimensions();

  const isLarge = width >= 1024;
  const isMedium = width >= 640 && width < 1024;
  const isSmallMobile = width < 480;

  // Compute responsive card width
  // Desktop: null (uses flex: 1 to fill row equally), Tablet: '48%', Mobile: '100%'
  const cardWidth = isLarge ? undefined : isMedium ? '48%' : '100%';

  return (
    <ThemedView style={styles.container}>
      {/* Decorative Pastel Background & Blurred Ambient Bubbles + Stars */}
      <View style={styles.backgroundDecorativeLayer}>
        <View style={styles.bubblePink} />
        <View style={styles.bubblePurple} />
        <View style={styles.bubbleBlue} />
        <View style={styles.bubbleLavender} />
        <View style={styles.bubbleAmber} />
        
        <View style={styles.curvedAccentLine} />
        <View style={styles.curvedAccentLine2} />
        <View style={styles.curvedAccentLine3} />

        {/* Small Glowing Star / Plus Elements */}
        <Text style={[styles.decorStar, { top: 80, left: '12%' }]}>✦</Text>
        <Text style={[styles.decorStar, { top: 160, right: '14%', color: 'rgba(236, 72, 153, 0.45)' }]}>✦</Text>
        <Text style={[styles.decorPlus, { top: 320, left: '6%' }]}>+</Text>
        <Text style={[styles.decorStar, { bottom: 260, left: '18%', color: 'rgba(99, 102, 241, 0.4)' }]}>✦</Text>
        <Text style={[styles.decorPlus, { bottom: 180, right: '8%', color: 'rgba(236, 72, 153, 0.4)' }]}>+</Text>
        <Text style={[styles.decorStar, { bottom: 80, right: '22%' }]}>✦</Text>
        
        {/* Floating circles/dots */}
        <View style={[styles.decorDot, { top: 100, right: '30%', backgroundColor: 'rgba(167, 139, 250, 0.6)' }]} />
        <View style={[styles.decorDot, { bottom: 120, left: '25%', backgroundColor: 'rgba(244, 114, 182, 0.6)' }]} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: width < 640 ? 16 : 24 },
            Platform.OS === 'web' && styles.scrollContentWeb,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* TOP NAVIGATION BAR */}
          <View style={styles.navBarContainer}>
            <View style={[styles.topNavBar, isSmallMobile && { paddingHorizontal: 10, paddingVertical: 8 }]}>
              <View style={[styles.navLeft, isSmallMobile && { gap: 6 }]}>
                <View style={[styles.navShieldIcon, isSmallMobile && { width: 24, height: 24 }]}>
                  <SymbolView
                    name={{
                      ios: 'shield.fill',
                      android: 'security',
                      web: 'shield',
                    } as any}
                    size={isSmallMobile ? 18 : 22}
                    tintColor="#8B5CF6"
                  />
                  <SymbolView
                    name={{
                      ios: 'heart.fill',
                      android: 'favorite',
                      web: 'favorite',
                    } as any}
                    size={isSmallMobile ? 8 : 10}
                    tintColor="#FFFFFF"
                    style={[styles.navShieldHeart, isSmallMobile && { top: 7 }]}
                  />
                </View>
                <Text style={[styles.navLogoText, isSmallMobile && { fontSize: 14 }]}>SafeHer AI</Text>
              </View>

              <View style={[styles.navRight, isSmallMobile && { gap: 4 }]}>
                <View style={[styles.navPill, styles.navPillActive, isSmallMobile && { paddingHorizontal: 8, paddingVertical: 6 }]}>
                  <Text style={[styles.navPillActiveText, isSmallMobile && { fontSize: 11 }]}>Home</Text>
                </View>
                <Pressable style={[styles.navPill, isSmallMobile && { paddingHorizontal: 8, paddingVertical: 6 }]}>
                  <Text style={[styles.navPillInactiveText, isSmallMobile && { fontSize: 11 }]}>Explore</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Header Section */}
          <View style={styles.heroSection}>
            <Text style={[styles.title, { fontSize: width < 640 ? 38 : 52, lineHeight: width < 640 ? 44 : 60 }, styles.titleGradient]}>
              SafeHer AI
            </Text>

            <ThemedText style={[styles.subtitle, { fontSize: width < 640 ? 15 : 18 }]} themeColor="textSecondary">
              Your Safety Companion
            </ThemedText>

            <Pressable
              onPress={() => router.push('/settings')}
              style={({ pressed }) => [
                styles.settingsButton,
                styles.settingsButtonGradient,
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
          </View>

          {/* Hidden Location Safety Provider */}
          <View style={{ display: 'none' }}>
            <LocationSafetyCard />
          </View>

          {/* Four Feature Cards */}
          <View style={[styles.grid, { flexWrap: isLarge ? 'nowrap' : 'wrap' }]}>
            {/* CARD 1: SOS */}
            <Pressable
              onPress={() => router.push('/sos')}
              style={({ pressed }) => [
                styles.card,
                styles.cardSOS,
                isLarge && { flex: 1 },
                { width: cardWidth },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.cardWaveOuter, styles.cardWaveOuterSOS]} />
              <View style={[styles.cardWaveInner, styles.cardWaveInnerSOS]} />

              <View style={[styles.iconContainerCard, styles.iconContainerSOS]}>
                <SymbolView
                  name={{
                    ios: 'light.beacon.max.fill',
                    android: 'crisis_alert',
                    web: 'crisis_alert',
                  } as any}
                  size={32}
                  tintColor="#EF4444"
                />
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>SOS</Text>
                <Text style={styles.cardDesc}>
                  Get immediate help in emergency situations
                </Text>
              </View>

              <View style={[styles.arrowCircle, styles.arrowCircleSOS]}>
                <SymbolView
                  name={{
                    ios: 'chevron.right',
                    android: 'chevron_right',
                    web: 'chevron_right',
                  } as any}
                  size={15}
                  tintColor="#EF4444"
                />
              </View>
            </Pressable>

            {/* CARD 2: Live Location */}
            <Pressable
              onPress={() => router.push('/live-location')}
              style={({ pressed }) => [
                styles.card,
                styles.cardLocation,
                isLarge && { flex: 1 },
                { width: cardWidth },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.cardWaveOuter, styles.cardWaveOuterLocation]} />
              <View style={[styles.cardWaveInner, styles.cardWaveInnerLocation]} />

              <View style={[styles.iconContainerCard, styles.iconContainerLocation]}>
                <SymbolView
                  name={{
                    ios: 'location.fill',
                    android: 'location_on',
                    web: 'location_on',
                  } as any}
                  size={32}
                  tintColor="#10B981"
                />
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Live Location</Text>
                <Text style={styles.cardDesc}>
                  Share your real-time location with trusted contacts
                </Text>
              </View>

              <View style={[styles.arrowCircle, styles.arrowCircleLocation]}>
                <SymbolView
                  name={{
                    ios: 'chevron.right',
                    android: 'chevron_right',
                    web: 'chevron_right',
                  } as any}
                  size={15}
                  tintColor="#10B981"
                />
              </View>
            </Pressable>

            {/* CARD 3: Safety Timer */}
            <Pressable
              onPress={() => router.push('/safety-timer')}
              style={({ pressed }) => [
                styles.card,
                styles.cardTimer,
                isLarge && { flex: 1 },
                { width: cardWidth },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.cardWaveOuter, styles.cardWaveOuterTimer]} />
              <View style={[styles.cardWaveInner, styles.cardWaveInnerTimer]} />

              <View style={[styles.iconContainerCard, styles.iconContainerTimer]}>
                <SymbolView
                  name={{
                    ios: 'timer',
                    android: 'timer',
                    web: 'timer',
                  } as any}
                  size={32}
                  tintColor="#F59E0B"
                />
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>AI Safety Check-In</Text>
                <Text style={styles.cardDesc}>
                  {"Start a safety check-in when traveling alone"}
                </Text>
              </View>

              <View style={[styles.arrowCircle, styles.arrowCircleTimer]}>
                <SymbolView
                  name={{
                    ios: 'chevron.right',
                    android: 'chevron_right',
                    web: 'chevron_right',
                  } as any}
                  size={15}
                  tintColor="#F59E0B"
                />
              </View>
            </Pressable>

            {/* CARD 4: Emergency Contacts */}
            <Pressable
              onPress={() => router.push('/emergency-contacts')}
              style={({ pressed }) => [
                styles.card,
                styles.cardContacts,
                isLarge && { flex: 1 },
                { width: cardWidth },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.cardWaveOuter, styles.cardWaveOuterContacts]} />
              <View style={[styles.cardWaveInner, styles.cardWaveInnerContacts]} />

              <View style={[styles.iconContainerCard, styles.iconContainerContacts]}>
                <SymbolView
                  name={{
                    ios: 'person.2.fill',
                    android: 'contacts',
                    web: 'contacts',
                  } as any}
                  size={32}
                  tintColor="#8B5CF6"
                />
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Emergency Contacts</Text>
                <Text style={styles.cardDesc}>
                  Manage and connect with your emergency contacts
                </Text>
              </View>

              <View style={[styles.arrowCircle, styles.arrowCircleContacts]}>
                <SymbolView
                  name={{
                    ios: 'chevron.right',
                    android: 'chevron_right',
                    web: 'chevron_right',
                  } as any}
                  size={15}
                  tintColor="#8B5CF6"
                />
              </View>
            </Pressable>
          </View>

          {/* Premium Full-Width AI Risk Analysis Banner */}
          <Pressable
            onPress={() => router.push('/safety-analysis')}
            style={({ pressed }) => [
              styles.aiRiskBanner,
              styles.aiRiskBannerGradient,
              {
                paddingHorizontal: width < 640 ? 16 : 32,
                paddingVertical: width < 640 ? 20 : 24,
              },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.circuitLineDecor} />
            <View style={styles.circuitLineDecorInner} />

            <View style={[styles.aiRiskLeft, { gap: width < 640 ? 12 : 20 }]}>
              <View style={[styles.aiIconContainer, {
                width: width < 640 ? 44 : 60,
                height: width < 640 ? 44 : 60,
                borderRadius: width < 640 ? 22 : 30
              }]}>
                <SymbolView
                  name={{
                    ios: 'brain.head.profile',
                    android: 'psychology_alt',
                    web: 'psychology_alt',
                  } as any}
                  size={width < 640 ? 22 : 30}
                  tintColor="#FFFFFF"
                />
              </View>

              <View style={styles.aiRiskInfo}>
                <Text style={[styles.aiRiskTitle, { fontSize: width < 640 ? 18 : 24 }]}>
                  AI Risk Analysis
                </Text>
                <Text style={[styles.aiRiskDescription, {
                  fontSize: width < 640 ? 13 : 16,
                  lineHeight: width < 640 ? 18 : 22
                }]}>
                  Report a dangerous situation and let SafeHer AI analyze the risk.
                </Text>
              </View>
            </View>

            <View style={[styles.arrowCircleAI, {
              width: width < 640 ? 32 : 40,
              height: width < 640 ? 32 : 40,
              borderRadius: width < 640 ? 16 : 20,
              marginLeft: width < 640 ? 10 : 16
            }]}>
              <SymbolView
                name={{
                  ios: 'chevron.right',
                  android: 'chevron_right',
                  web: 'chevron_right',
                } as any}
                size={16}
                tintColor="#FFFFFF"
              />
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
    backgroundColor: '#F8F5FF',
    justifyContent: 'center',
    flexDirection: 'row',
    position: 'relative',
  },
  backgroundDecorativeLayer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    zIndex: 0,
  },
  bubblePink: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(244, 114, 182, 0.1)',
  },
  bubblePurple: {
    position: 'absolute',
    top: 150,
    left: -80,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
  },
  bubbleBlue: {
    position: 'absolute',
    bottom: 200,
    right: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
  },
  bubbleLavender: {
    position: 'absolute',
    bottom: -80,
    left: 10,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(192, 132, 252, 0.08)',
  },
  bubbleAmber: {
    position: 'absolute',
    top: 380,
    right: 40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(251, 191, 36, 0.06)',
  },
  curvedAccentLine: {
    position: 'absolute',
    top: '20%',
    left: -150,
    width: '150%',
    height: 400,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.1)',
    borderRadius: 250,
    transform: [{ rotate: '-10deg' }],
  },
  curvedAccentLine2: {
    position: 'absolute',
    top: '50%',
    right: -150,
    width: '140%',
    height: 350,
    borderWidth: 1,
    borderColor: 'rgba(244, 114, 182, 0.1)',
    borderRadius: 200,
    transform: [{ rotate: '15deg' }],
  },
  curvedAccentLine3: {
    position: 'absolute',
    bottom: '5%',
    left: -100,
    width: '130%',
    height: 300,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.1)',
    borderRadius: 200,
    transform: [{ rotate: '-5deg' }],
  },
  decorStar: {
    position: 'absolute',
    fontSize: 16,
    color: 'rgba(167, 139, 250, 0.4)',
    fontWeight: '700',
  },
  decorPlus: {
    position: 'absolute',
    fontSize: 18,
    color: 'rgba(167, 139, 250, 0.35)',
    fontWeight: '600',
  },
  decorDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: 1200,
    zIndex: 1,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 16,
    paddingBottom: BottomTabInset + 32,
    gap: 32,
  },
  scrollContentWeb: {
    paddingTop: 32,
  },
  navBarContainer: {
    alignItems: 'center',
    width: '100%',
    zIndex: 10,
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 40,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
    maxWidth: 1100,
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(10px)',
      } as any,
    }),
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 4,
  },
  navShieldIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  navShieldHeart: {
    position: 'absolute',
    top: 9,
  },
  navLogoText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4338CA',
    letterSpacing: -0.3,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 30,
    padding: 4,
  },
  navPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  navPillActive: {
    backgroundColor: '#8B5CF6',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)',
      } as any,
    }),
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  navPillActiveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  navPillInactiveText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
  navPillWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    textAlign: 'center',
    fontWeight: '900',
    letterSpacing: -1.2,
    color: '#312E81',
  },
  titleGradient: Platform.select({
    web: {
      backgroundImage: 'linear-gradient(135deg, #4338CA 0%, #8B5CF6 45%, #EC4899 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    } as any,
    default: {
      color: '#312E81',
    },
  }) as any,
  subtitle: {
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 6,
    color: '#475569',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    width: 220,
    height: 48,
    borderRadius: 24,
    gap: 8,
    backgroundColor: '#6366F1',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  settingsButtonGradient: Platform.select({
    web: {
      backgroundImage: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)',
    } as any,
    default: {},
  }),
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
  },
  card: {
    borderRadius: 24,
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 24,
    height: 300,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },

  /* Bottom Layered Waves */
  cardWaveOuter: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    right: -20,
    height: 80,
    borderTopLeftRadius: 140,
    borderTopRightRadius: 140,
    zIndex: 0,
  },
  cardWaveInner: {
    position: 'absolute',
    bottom: -35,
    left: -10,
    right: -10,
    height: 70,
    borderTopLeftRadius: 160,
    borderTopRightRadius: 160,
    zIndex: 0,
  },

  /* SOS Waves & Accent */
  cardSOS: {
    borderColor: 'rgba(254, 202, 202, 0.6)',
  },
  cardWaveOuterSOS: {
    backgroundColor: 'rgba(254, 202, 202, 0.3)',
  },
  cardWaveInnerSOS: {
    backgroundColor: 'rgba(254, 226, 226, 0.6)',
  },
  iconContainerSOS: {
    backgroundColor: '#FEE2E2',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  arrowCircleSOS: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },

  /* Live Location Waves & Accent */
  cardLocation: {
    borderColor: 'rgba(167, 243, 208, 0.6)',
  },
  cardWaveOuterLocation: {
    backgroundColor: 'rgba(167, 243, 208, 0.3)',
  },
  cardWaveInnerLocation: {
    backgroundColor: 'rgba(209, 250, 229, 0.6)',
  },
  iconContainerLocation: {
    backgroundColor: '#D1FAE5',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  arrowCircleLocation: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },

  /* Safety Timer Waves & Accent */
  cardTimer: {
    borderColor: 'rgba(253, 230, 138, 0.6)',
  },
  cardWaveOuterTimer: {
    backgroundColor: 'rgba(253, 230, 138, 0.3)',
  },
  cardWaveInnerTimer: {
    backgroundColor: 'rgba(254, 243, 199, 0.6)',
  },
  iconContainerTimer: {
    backgroundColor: '#FEF3C7',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  arrowCircleTimer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },

  /* Emergency Contacts Waves & Accent */
  cardContacts: {
    borderColor: 'rgba(221, 214, 254, 0.6)',
  },
  cardWaveOuterContacts: {
    backgroundColor: 'rgba(221, 214, 254, 0.3)',
  },
  cardWaveInnerContacts: {
    backgroundColor: 'rgba(237, 233, 254, 0.6)',
  },
  iconContainerContacts: {
    backgroundColor: '#EDE9FE',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  arrowCircleContacts: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },

  iconContainerCard: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    marginBottom: 8,
  },
  cardBody: {
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
    width: '100%',
    zIndex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E1B4B',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginTop: 4,
  },

  /* Full-Width AI Risk Analysis Banner */
  aiRiskBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 24,
    backgroundColor: '#6366F1',
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  aiRiskBannerGradient: Platform.select({
    web: {
      backgroundImage: 'linear-gradient(135deg, #6366F1 0%, #4338CA 50%, #8B5CF6 100%)',
    } as any,
    default: {},
  }),
  circuitLineDecor: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  circuitLineDecorInner: {
    position: 'absolute',
    right: -10,
    top: -10,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  aiRiskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    zIndex: 1,
  },
  aiIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiRiskInfo: {
    flex: 1,
    gap: 6,
  },
  aiRiskTitle: {
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  aiRiskDescription: {
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  arrowCircleAI: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
