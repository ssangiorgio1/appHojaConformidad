import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { colors } from '../theme';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return <>{children}</>;
}
