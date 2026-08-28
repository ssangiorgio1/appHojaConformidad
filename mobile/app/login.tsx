import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthContext';
import { Button, Field } from '../src/components/ui';
import { colors, radius, cardShadow } from '../src/theme';

type Mode = 'signin' | 'reset';

export default function LoginScreen() {
  const { user, loading, authError, signIn, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (!loading && user) {
    return <Redirect href="/" />;
  }

  async function handleSubmit() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await resetPassword(email);
        setInfo('Te mandamos un email para restablecer tu contraseña.');
        setMode('signin');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const message = error || (!error ? authError : null);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={keyboardVisible}
          bounces={false}
          overScrollMode="never"
        >
          <View style={styles.card}>
            <Image source={require('../assets/logo-wara.png')} style={styles.logo} accessibilityLabel="WARA" />

            <Text style={styles.title}>{mode === 'signin' ? 'Iniciar sesión' : 'Restablecer contraseña'}</Text>

            <View style={styles.form}>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="nombre@waragps.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              {mode !== 'reset' && (
                <Field
                  label="Contraseña"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password"
                />
              )}

              {message ? <Text style={styles.error}>{message}</Text> : null}
              {info ? <Text style={styles.info}>{info}</Text> : null}

              {busy ? (
                <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 6 }} />
              ) : (
                <Button title={{ signin: 'Ingresar', reset: 'Enviar email' }[mode]} onPress={handleSubmit} block />
              )}
            </View>

            <View style={styles.divider} />

            {mode === 'signin' ? (
              <>
                <Text
                  style={[styles.link, busy && styles.linkDisabled]}
                  onPress={busy ? undefined : () => { setMode('reset'); setError(null); setInfo(null); }}
                >
                  Olvidé mi contraseña
                </Text>
              </>
            ) : (
              <Text
                style={[styles.link, busy && styles.linkDisabled]}
                onPress={busy ? undefined : () => { setMode('signin'); setError(null); setInfo(null); }}
              >
                Volver a iniciar sesión
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: radius + 6,
    paddingHorizontal: 26,
    paddingTop: 32,
    paddingBottom: 26,
    alignItems: 'center',
    ...cardShadow,
  },
  logo: { width: 152, height: 42, resizeMode: 'contain', marginBottom: 18 },
  title: { fontSize: 19, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 5, textAlign: 'center', fontWeight: '500' },
  form: { width: '100%', marginTop: 22, gap: 2 },
  error: { color: colors.bad, fontSize: 12.5, fontWeight: '600', marginBottom: 8 },
  info: { color: colors.ok, fontSize: 12.5, fontWeight: '600', marginBottom: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  pillTextStrong: { color: colors.text, fontWeight: '800' },
  divider: { width: '100%', height: 1, backgroundColor: colors.border, marginVertical: 18 },
  link: { color: colors.primary, fontSize: 13.5, fontWeight: '700' },
  linkDisabled: { opacity: 0.4 },
  helptext: { color: colors.muted, fontSize: 12, marginTop: 10, textAlign: 'center', lineHeight: 17 },
});
