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

export default function SignUpScreen() {
  const theme = useTheme();
  const { setAuthScreen } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSignUp = async () => {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
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

      // 1. Sign up user in Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      const user = data.user;
      if (!user) {
        throw new Error('Sign up failed. Please try again.');
      }

      // 2. Try inserting profile record
      try {
        await supabase
          .from('profiles')
          .insert({
            id: user.id,
            full_name: fullName.trim(),
            email: email.trim(),
          });
      } catch (profileErr) {
        console.warn('Silent profiles table insert failed (expected if table does not exist):', profileErr);
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.message || 'An error occurred during account creation.');
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
            Account Created!
          </ThemedText>
          <ThemedText style={styles.successText} themeColor="textSecondary">
            Please check your email inbox to verify your account before logging in.
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
              Create Account
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Join SafeHer AI safety network
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

          {/* Full Name Input */}
          <View style={styles.inputGroup}>
            <ThemedText type="smallBold" style={styles.inputLabel}>
              Full Name
            </ThemedText>
            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundElement }]}>
              <SymbolView
                name={{ ios: 'person.fill', android: 'person', web: 'person' }}
                size={16}
                tintColor={theme.textSecondary}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter your name"
                placeholderTextColor={theme.textSecondary}
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (error) setError(null);
                }}
                editable={!loading}
              />
            </View>
          </View>

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
                placeholder="Enter your email"
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

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <ThemedText type="smallBold" style={styles.inputLabel}>
              Password
            </ThemedText>
            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundElement }]}>
              <SymbolView
                name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                size={16}
                tintColor={theme.textSecondary}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Create password"
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
              Confirm Password
            </ThemedText>
            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundElement }]}>
              <SymbolView
                name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                size={16}
                tintColor={theme.textSecondary}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Re-enter password"
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

          {/* Sign Up Button */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.text },
              pressed && styles.pressed,
              loading && styles.disabled,
            ]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText style={[styles.buttonText, { color: theme.background }]}>
                Create Account
              </ThemedText>
            )}
          </Pressable>

          {/* Switch to Login Link */}
          <View style={styles.footer}>
            <ThemedText type="small" themeColor="textSecondary">
              Already have an account?{' '}
            </ThemedText>
            <Pressable onPress={() => setAuthScreen('login')}>
              <ThemedText type="smallBold" themeColor="text">
                Login
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
