import { StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';

export function WebBadge() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText themeColor="textSecondary" style={styles.footerText}>
        SafeHer AI • AI-powered women safety & emergency assistance
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.five,
    alignItems: 'center',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
});
