import { useState } from 'react';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import { Alert, Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

function getResponsiveHeaderTokens(width: number) {
  const isSmallMobile = width < 375;
  const isMediumMobile = width >= 375 && width < 430;
  const isMobile = width < 640;

  return {
    isSmallMobile,
    isMediumMobile,
    isMobile,
    containerPaddingHorizontal: isSmallMobile ? 6 : isMobile ? 8 : Spacing.three,
    containerTop: isMobile ? 8 : 14,
    innerPaddingVertical: isMobile ? 10 : 18,
    innerPaddingHorizontal: isSmallMobile ? 8 : isMediumMobile ? 10 : isMobile ? 14 : 24,
    innerBorderRadius: isMobile ? 28 : 40,
    innerGap: isSmallMobile ? 4 : isMobile ? 6 : Spacing.two,
    brandLogoSize: isSmallMobile ? 24 : isMediumMobile ? 26 : isMobile ? 28 : 32,
    brandIconSize: isSmallMobile ? 11 : isMediumMobile ? 12 : isMobile ? 13 : 14,
    brandGap: isSmallMobile ? 4 : isMobile ? 6 : 8,
    brandFontSize: isSmallMobile ? 14 : isMediumMobile ? 15.5 : isMobile ? 17 : 23,
    triggersGap: isSmallMobile ? 4 : isMediumMobile ? 4 : isMobile ? 5 : 6,
    buttonPaddingVertical: isSmallMobile ? 6 : isMobile ? 8 : 10,
    buttonPaddingHorizontal: isSmallMobile ? 8 : isMediumMobile ? 10 : isMobile ? 12 : 22,
    buttonBorderRadius: isMobile ? 18 : 24,
    buttonFontSize: isSmallMobile ? 12 : isMediumMobile ? 13 : isMobile ? 14 : 16.5,
  };
}

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton>Explore</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const { width } = useWindowDimensions();
  const tokens = getResponsiveHeaderTokens(width);

  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View
        style={[
          styles.tabButtonView,
          {
            paddingVertical: tokens.buttonPaddingVertical,
            paddingHorizontal: tokens.buttonPaddingHorizontal,
            borderRadius: tokens.buttonBorderRadius,
          },
          isFocused ? styles.tabButtonActive : styles.tabButtonInactive,
        ]}>
        <ThemedText
          type="small"
          style={[
            styles.tabButtonText,
            { fontSize: tokens.buttonFontSize },
            isFocused && styles.tabButtonTextActive,
          ]}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function LogoutTabButton() {
  const { signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { width } = useWindowDimensions();
  const tokens = getResponsiveHeaderTokens(width);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      await signOut();
      router.replace('/');
    } catch (err: any) {
      console.error('Logout error:', err);
      Alert.alert('Logout Error', err?.message || 'Failed to sign out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Pressable
      onPress={handleLogout}
      disabled={isLoggingOut}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <View
        style={[
          styles.tabButtonView,
          styles.tabButtonInactive,
          {
            paddingVertical: tokens.buttonPaddingVertical,
            paddingHorizontal: tokens.buttonPaddingHorizontal,
            borderRadius: tokens.buttonBorderRadius,
          },
        ]}
      >
        <ThemedText
          type="small"
          style={[
            styles.tabButtonText,
            { fontSize: tokens.buttonFontSize },
          ]}
        >
          {isLoggingOut ? 'Logging out...' : 'Logout'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const { width } = useWindowDimensions();
  const tokens = getResponsiveHeaderTokens(width);

  return (
    <View
      {...props}
      style={[
        styles.tabListContainer,
        {
          top: tokens.containerTop,
          paddingHorizontal: tokens.containerPaddingHorizontal,
        },
      ]}
    >
      <ThemedView
        type="backgroundElement"
        style={[
          styles.innerContainer,
          {
            paddingVertical: tokens.innerPaddingVertical,
            paddingHorizontal: tokens.innerPaddingHorizontal,
            borderRadius: tokens.innerBorderRadius,
            gap: tokens.innerGap,
          },
        ]}
      >
        <View style={[styles.brandRow, { gap: tokens.brandGap }]}>
          <View
            style={[
              styles.brandLogoBox,
              {
                width: tokens.brandLogoSize,
                height: tokens.brandLogoSize,
                borderRadius: tokens.brandLogoSize / 2,
              },
            ]}
          >
            <SymbolView
              name={{ ios: 'shield.fill', android: 'security', web: 'security' } as any}
              size={tokens.brandIconSize}
              tintColor="#FFFFFF"
            />
          </View>
          <ThemedText
            type="smallBold"
            numberOfLines={1}
            style={[
              styles.brandText,
              {
                fontSize: tokens.brandFontSize,
              },
            ]}
          >
            SafeHer AI
          </ThemedText>
        </View>

        <View style={[styles.tabTriggersRow, { gap: tokens.triggersGap }]}>
          {props.children}
          <LogoutTabButton />
        </View>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    width: '100%',
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    zIndex: 100,
  },
  innerContainer: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 40,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: 1080,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 'auto',
    flexShrink: 0,
  },
  brandLogoBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 23,
    fontWeight: '800',
    color: '#312E81',
    letterSpacing: -0.3,
  },
  tabTriggersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  docsText: {
    color: '#4F46E5',
    fontWeight: '600',
    fontSize: 16.5,
  },
  pressed: {
    opacity: 0.75,
  },
  tabButtonView: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 24,
  },
  tabButtonActive: {
    backgroundColor: '#6366F1',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  tabButtonInactive: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabButtonText: {
    fontSize: 16.5,
    fontWeight: '600',
    color: '#475569',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  externalPressable: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});
