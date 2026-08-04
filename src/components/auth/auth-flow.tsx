import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import LoginScreen from './login-screen';
import SignUpScreen from './signup-screen';
import ForgotPasswordScreen from './forgot-password-screen';
import ResetPasswordScreen from './reset-password-screen';

export default function AuthFlow() {
  const { authScreen } = useAuth();

  const renderScreen = () => {
    switch (authScreen) {
      case 'signup':
        return <SignUpScreen />;
      case 'forgot-password':
        return <ForgotPasswordScreen />;
      case 'reset-password':
        return <ResetPasswordScreen />;
      case 'login':
      default:
        return <LoginScreen />;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {renderScreen()}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
});
