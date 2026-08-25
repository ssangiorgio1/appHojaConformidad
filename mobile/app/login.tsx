import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';
import { Button } from '../src/components/ui';
import { colors } from '../src/theme';

export default function LoginScreen() {
  const { user, loading, domainError, signInWithGoogle } = useAuth();

  if (!loading && user) {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoBadge}>
        <Text style={styles.logoText}>W</Text>
      </View>
      <Text style={styles.title}>Hoja de Conformidad</Text>
      <Text style={styles.subtitle}>WARA · Seguimiento y Control</Text>

      <View style={styles.spacer} />

      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" />
      ) : (
        <Button title="Ingresar con Google" onPress={signInWithGoogle} block />
      )}

      {domainError ? <Text style={styles.error}>{domainError}</Text> : null}

      <Text style={styles.helptext}>Solo cuentas @waragps.com pueden acceder.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 4 },
  spacer: { height: 40 },
  error: { color: colors.bad, marginTop: 14, textAlign: 'center' },
  helptext: { color: colors.muted, fontSize: 12, marginTop: 20, textAlign: 'center' },
});
