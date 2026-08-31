import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/auth/AuthContext';
import { ToastProvider } from '../src/components/Toast';
import { ConfirmProvider } from '../src/components/ConfirmDialog';
import { colors } from '../src/theme';
import { recoverPendingCapture } from '../src/utils/pendingCapture';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    recoverPendingCapture().then((target) => {
      if (target) router.replace(`/${target.screen}/${target.recordId}`);
    });
  }, [router]);

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ToastProvider>
          <ConfirmProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
          </ConfirmProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </AuthProvider>
  );
}
