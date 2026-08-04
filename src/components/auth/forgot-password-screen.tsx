import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/utils/supabase';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const { setAuthScreen } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Reset password request
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'safeherai://',
      });

      if (resetError) {
        throw resetError;
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('Reset password error:', err);
      setError(err.message || 'An error occurred while requesting password reset.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.successWrapper}>
          <SymbolView
            name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }}
            size={64}
            tintColor="#10B981"
          />
          <ThemedText type="subtitle" style={styles.successTitle}>
            Check Your Email
          </ThemedText>
          <ThemedText style={styles.successText} themeColor="textSecondary">
            We have sent a password reset link to <ThemedText type="smallBold">{email}</ThemedText>.
          </ThemedText>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.text },
              pressed && styles.pressed,
            ]}
            onPress={() => setAuthScreen('login')}
          >
            <ThemedText style={[styles.buttonText, { color: theme.background }]}>
              Back to Login
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardView}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.formContainer}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              Reset Password
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Enter your email address to receive a recovery link
            </ThemedText>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <SymbolView
                name={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }}
                size={16}
                tintColor="#EF4444"
              />
              <ThemedText type="small" style={styles.errorText}>
                {error}
              </ThemedText>
            </View>
          )}

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <ThemedText type="smallBold" style={styles.inputLabel}>
              Email Address
            </ThemedText>
            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundElement }]}>
              <SymbolView
                name={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
                size={16}
                tintColor={theme.textSecondary}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter your email address"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError(null);
                }}
                editable={!loading}
              />
            </View>
          </View>

          {/* Submit Button */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.text },
              pressed && styles.pressed,
              loading && styles.disabled,
            ]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText style={[styles.buttonText, { color: theme.background }]}>
                Send Reset Link
              </ThemedText>
            )}
          </Pressable>

          {/* Back to Login Footer */}
          <View style={styles.footer}>
            <Pressable onPress={() => setAuthScreen('login')}>
              <ThemedText type="smallBold" themeColor="text">
                Back to Login
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  formContainer: {
    gap: Spacing.four,
    maxWidth: 450,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.one,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  errorText: {
    color: '#EF4444',
    flex: 1,
  },
  inputGroup: {
    gap: Spacing.two,
  },
  inputLabel: {
    fontSize: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    height: 52,
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
    padding: 0,
  },
  button: {
    height: 52,
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  successWrapper: {
    alignItems: 'center',
    gap: Spacing.four,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    padding: Spacing.four,
  },
  successTitle: {
    fontWeight: '700',
    textAlign: 'center',
  },
  successText: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: Spacing.two,
  },
});
