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

export default function LoginScreen() {
  const theme = useTheme();
  const { setAuthScreen } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
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

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (signInError) {
        throw signInError;
      }
      
      // onAuthStateChange handles loading the session state
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardView}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.formContainer}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              Welcome Back
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Sign in to secure your peace of mind
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
                placeholder="Enter your password"
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
            
            {/* Forgot Password Link */}
            <Pressable
              onPress={() => setAuthScreen('forgot-password')}
              style={styles.forgotPasswordPressable}
            >
              <ThemedText type="small" themeColor="textSecondary" style={styles.forgotPasswordLink}>
                Forgot Password?
              </ThemedText>
            </Pressable>
          </View>

          {/* Login Button */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.text },
              pressed && styles.pressed,
              loading && styles.disabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText style={[styles.buttonText, { color: theme.background }]}>
                Login
              </ThemedText>
            )}
          </Pressable>

          {/* Switch to SignUp Link */}
          <View style={styles.footer}>
            <ThemedText type="small" themeColor="textSecondary">
              Don&apos;t have an account?{' '}
            </ThemedText>
            <Pressable onPress={() => setAuthScreen('signup')}>
              <ThemedText type="smallBold" themeColor="text">
                Sign Up
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
  forgotPasswordPressable: {
    alignSelf: 'flex-end',
    marginTop: Spacing.one,
  },
  forgotPasswordLink: {
    fontSize: 13,
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
});
