import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { router } from 'expo-router';

export default function ExploreScreen() {
  const theme = useTheme();

  const showComingSoon = (feature: string) => {
    Alert.alert(
      feature,
      `${feature} feature will be connected in the next step.`
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
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
                size={42}
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
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Quick Safety Actions
          </ThemedText>

          <View style={styles.grid}>
            {/* Emergency Contacts */}
            <Pressable
              onPress={() => showComingSoon('Emergency Contacts')}
              style={({ pressed }) => [
                styles.featureCard,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.iconCircle}>
                <SymbolView
                  name={{
                    ios: 'person.2.fill',
                    android: 'group',
                    web: 'users',
                  }}
                  size={25}
                  tintColor={theme.text}
                />
              </View>

              <ThemedText type="smallBold">
                Emergency Contacts
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Manage trusted contacts
              </ThemedText>
            </Pressable>

            {/* Location */}
            <Pressable
              onPress={() => showComingSoon('Live Location')}
              style={({ pressed }) => [
                styles.featureCard,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.iconCircle}>
                <SymbolView
                  name={{
                    ios: 'location.fill',
                    android: 'location-on',
                    web: 'location',
                  }}
                  size={25}
                  tintColor={theme.text}
                />
              </View>

              <ThemedText type="smallBold">
                Live Location
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Share your current location
              </ThemedText>
            </Pressable>

            {/* Safety Timer */}
            <Pressable
              onPress={() => showComingSoon('Safety Timer')}
              style={({ pressed }) => [
                styles.featureCard,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.iconCircle}>
                <SymbolView
                  name={{
                    ios: 'timer',
                    android: 'timer',
                    web: 'clock',
                  }}
                  size={25}
                  tintColor={theme.text}
                />
              </View>

              <ThemedText type="smallBold">
                Safety Timer
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Automatic safety check
              </ThemedText>
            </Pressable>

            {/* Safe Places */}
            <Pressable
              onPress={() => showComingSoon('Nearby Safe Places')}
              style={({ pressed }) => [
                styles.featureCard,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.iconCircle}>
                <SymbolView
                  name={{
                    ios: 'map.fill',
                    android: 'map',
                    web: 'map',
                  }}
                  size={25}
                  tintColor={theme.text}
                />
              </View>

              <ThemedText type="smallBold">
                Safe Places
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Find nearby safe locations
              </ThemedText>
            </Pressable>
          </View>

          {/* AI Assistant */}
          <Pressable
            onPress={() => showComingSoon('SafeHer AI Assistant')}
            style={({ pressed }) => [
              styles.aiCard,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.aiIcon}>
              <ThemedText style={styles.aiIconText}>AI</ThemedText>
            </View>

            <View style={styles.aiContent}>
              <ThemedText type="subtitle">
                SafeHer AI Assistant
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                Get safety guidance and quick assistance.
              </ThemedText>
            </View>

            <ThemedText style={styles.arrow}>›</ThemedText>
          </Pressable>

          {/* Safety Status */}
          <ThemedView
            type="backgroundElement"
            style={styles.statusCard}
          >
            <View style={styles.statusDot} />

            <View style={styles.statusContent}>
              <ThemedText type="smallBold">
                Safety Status
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
              >
                You are currently in normal safety mode.
              </ThemedText>
            </View>
          </ThemedView>

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
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },

  header: {
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },

  title: {
    fontWeight: '700',
  },

  subtitle: {
    fontSize: 15,
  },

  sectionTitle: {
    marginTop: Spacing.two,
    fontWeight: '600',
  },

  sosCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.four,
    borderRadius: 18,
    backgroundColor: '#DC2626',
    gap: Spacing.three,
  },

  sosIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  sosContent: {
    flex: 1,
    gap: 4,
  },

  sosTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
  },

  sosSubtitle: {
    color: '#FFFFFF',
    fontSize: 13,
    opacity: 0.9,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },

  featureCard: {
    width: '47%',
    minHeight: 145,
    padding: Spacing.three,
    borderRadius: 16,
    gap: Spacing.two,
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(128,128,128,0.12)',
  },

  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 16,
    gap: Spacing.three,
  },

  aiIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
  },

  aiIconText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },

  aiContent: {
    flex: 1,
    gap: Spacing.one,
  },

  arrow: {
    fontSize: 30,
    opacity: 0.6,
  },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 16,
    gap: Spacing.two,
  },

  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },

  statusContent: {
    flex: 1,
    gap: Spacing.one,
  },

  footerText: {
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.two,
  },

  pressed: {
    opacity: 0.75,
  },
});