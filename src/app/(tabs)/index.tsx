import * as Device from 'expo-device';

import { Platform, Pressable, StyleSheet, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';

import { AnimatedIcon } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';




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
  const { profile, signOut } = useAuth();



  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <ThemedView style={styles.heroSection}>
            <AnimatedIcon />
            <ThemedText type="title" style={styles.title}>
              SafeHer AI
            </ThemedText>
            <ThemedText style={styles.subtitle} themeColor="textSecondary">
              Your Safety Companion
            </ThemedText>
            <Pressable
              onPress={() => router.push('/settings')}
              style={({ pressed }) => [
                styles.settingsButton,
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{
                  ios: 'gearshape.fill',
                  android: 'settings',
                  web: 'settings',
                }}
                size={20}
                tintColor="#FFFFFF"
              />

              <ThemedText style={styles.settingsButtonText}>
                Safety Settings
              </ThemedText>
            </Pressable>

          </ThemedView>

          {/* User Profile Card */}
          {profile && (
            <ThemedView type="backgroundElement" style={styles.profileCard}>
              <View style={styles.profileInfo}>
                <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
                  <SymbolView
                    name={{ ios: 'person.crop.circle.fill', android: 'account-circle', web: 'user' }}
                    size={40}
                    tintColor={theme.text}
                  />
                </View>
                <View style={styles.profileMeta}>
                  <ThemedText type="small" themeColor="textSecondary">Welcome back,</ThemedText>
                  <ThemedText type="subtitle" style={styles.profileName}>
                    {profile.full_name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.profileEmail}>
                    {profile.email}
                  </ThemedText>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.logoutButton,
                  { borderColor: theme.textSecondary },
                  pressed && styles.pressed,
                ]}
                onPress={signOut}
              >
                <SymbolView
                  name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
                  size={16}
                  tintColor={theme.text}
                />
                <ThemedText style={styles.logoutText}>Sign Out</ThemedText>
              </Pressable>
            </ThemedView>
          )}
          {/* AI Risk Analysis */}
          <Pressable
            onPress={() => router.push('/safety-analysis')}
            style={({ pressed }) => [
              styles.aiRiskCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.aiRiskIcon}>
              <ThemedText style={styles.aiRiskEmoji}>🤖</ThemedText>
            </View>

            <View style={styles.aiRiskInfo}>
              <ThemedText style={styles.aiRiskTitle}>
                AI Risk Analysis
              </ThemedText>

              <ThemedText style={styles.aiRiskDescription}>
                Report a dangerous situation and let SafeHer AI analyze the risk.
              </ThemedText>
            </View>

            <SymbolView
              name={{
                ios: 'chevron.right',
                android: 'chevron-right',
                web: 'chevron-right',
              }}
              size={22}
              tintColor="#7C3AED"
            />
          </Pressable>

          {/* Supabase Connection Status Card */}
          <ThemedView type="backgroundElement" style={styles.statusCard}>
            <ThemedView style={styles.statusHeader}>
              <ThemedView
                style={[
                  styles.statusIndicator,
                  { backgroundColor: supabaseUrl ? '#10B981' : '#EF4444' }
                ]}
              />
              <ThemedText type="smallBold">
                Supabase Connection Status
              </ThemedText>
            </ThemedView>
            <ThemedText type="small" themeColor="textSecondary" style={styles.statusDetails}>
              {supabaseUrl
                ? `Connected to project url: \n${supabaseUrl}`
                : 'Disconnected. Missing EXPO_PUBLIC_SUPABASE_URL in env configuration.'
              }
            </ThemedText>
          </ThemedView>



          {/* Dev Info Section */}
          <ThemedView type="backgroundElement" style={styles.infoCard}>
            <ThemedText type="smallBold">Dev Menu Hint</ThemedText>
            {getDevMenuHint()}
          </ThemedView>

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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.four,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.one,
  },
  title: {
    textAlign: 'center',
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  profileCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileMeta: {
    flex: 1,
    gap: Spacing.half,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  profileEmail: {
    fontSize: 13,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: Spacing.two,
    borderWidth: 1,
    gap: Spacing.two,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDetails: {
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'CourierNewPSMT', android: 'monospace', web: 'monospace' }),
    backgroundColor: 'transparent',
  },

  infoCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  aiRiskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },

  aiRiskIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },

  aiRiskEmoji: {
    fontSize: 26,
  },

  aiRiskInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },

  aiRiskTitle: {
    fontSize: 17,
    fontWeight: '800',
  },

  aiRiskDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.8,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    gap: Spacing.two,
  },

  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
