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

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const { setAuthScreen, signOut } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleUpdatePassword = async () => {
    if (!password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Update password for currently sessioned user (recovery session)
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      
      // Auto sign out to clean recovery session and enforce fresh login
      await supabase.auth.signOut();
    } catch (err: any) {
      console.error('Update password error:', err);
      setError(err.message || 'An error occurred while updating your password.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.successWrapper}>
          <SymbolView
            name={{ ios: 'checkmark.circle.fill', android: 'check-circle', web: 'check-circle' }}
            size={64}
            tintColor="#10B981"
          />
          <ThemedText type="subtitle" style={styles.successTitle}>
            Password Updated
          </ThemedText>
          <ThemedText style={styles.successText} themeColor="textSecondary">
            Your password has been successfully reset. You can now log in using your new credentials.
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
              Go to Login
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
              New Password
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Set a strong password to recover your account
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

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <ThemedText type="smallBold" style={styles.inputLabel}>
              New Password
            </ThemedText>
            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundElement }]}>
              <SymbolView
                name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                size={16}
                tintColor={theme.textSecondary}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter new password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (error) setError(null);
                }}
                editable={!loading}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.iconButton}>
                <SymbolView
                  name={{
                    ios: showPassword ? 'eye.fill' : 'eye.slash.fill',
                    android: showPassword ? 'visibility' : 'visibility-off',
                    web: showPassword ? 'eye' : 'eye-slash',
                  }}
                  size={16}
                  tintColor={theme.textSecondary}
                />
              </Pressable>
            </View>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputGroup}>
            <ThemedText type="smallBold" style={styles.inputLabel}>
              Confirm New Password
            </ThemedText>
            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundElement }]}>
              <SymbolView
                name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                size={16}
                tintColor={theme.textSecondary}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Re-enter new password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (error) setError(null);
                }}
                editable={!loading}
              />
              <Pressable
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.iconButton}
              >
                <SymbolView
                  name={{
                    ios: showConfirmPassword ? 'eye.fill' : 'eye.slash.fill',
                    android: showConfirmPassword ? 'visibility' : 'visibility-off',
                    web: showConfirmPassword ? 'eye' : 'eye-slash',
                  }}
                  size={16}
                  tintColor={theme.textSecondary}
                />
              </Pressable>
            </View>
          </View>

          {/* Update Password Button */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.text },
              pressed && styles.pressed,
              loading && styles.disabled,
            ]}
            onPress={handleUpdatePassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText style={[styles.buttonText, { color: theme.background }]}>
                Update Password
              </ThemedText>
            )}
          </Pressable>

          {/* Back to Login Link */}
          <View style={styles.footer}>
            <Pressable
              onPress={async () => {
                await signOut();
                setAuthScreen('login');
              }}
            >
              <ThemedText type="smallBold" themeColor="text">
                Cancel
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
  iconButton: {
    padding: Spacing.one,
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
