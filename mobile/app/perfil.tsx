import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { RequireAuth } from '../src/auth/RequireAuth';
import { useAuth } from '../src/auth/AuthContext';
import { Button, Card, Field, SectionTitle, TopbarBackButton } from '../src/components/ui';
import { useToast } from '../src/components/Toast';
import { useConfirm } from '../src/components/ConfirmDialog';
import { updateMe, linkOdooAccount, unlinkOdooAccount, ApiError } from '../src/api/client';
import { colors } from '../src/theme';

const ROLE_LABELS: Record<string, string> = {
  tecnico: 'Técnico',
  admin: 'Administrador',
  superadmin: 'Super administrador',
  coordinacion: 'Coordinación',
  mesa_ayuda: 'Mesa de ayuda',
};

export default function PerfilScreen() {
  return (
    <RequireAuth>
      <Perfil />
    </RequireAuth>
  );
}

function Perfil() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, usuario, signOut, getIdToken, refreshUsuario } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  // Only admins/superadmins can rename an account — técnicos see their data
  // read-only here and have to ask an admin to change it (mirrors the check
  // in api/src/controllers/auth.controller.ts's updateMe).
  const canEdit = usuario?.role === 'admin' || usuario?.role === 'superadmin';
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [legajo, setLegajo] = useState(usuario?.legajo ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!nombre.trim()) {
      showToast({ type: 'error', message: 'Ingresá un nombre.' });
      return;
    }
    setSaving(true);
    try {
      const idToken = await getIdToken();
      await updateMe(idToken, { nombre: nombre.trim(), legajo: legajo.trim() });
      await refreshUsuario();
      showToast({ type: 'success', message: 'Perfil actualizado.' });
    } catch (err) {
      showToast({ type: 'error', message: err instanceof ApiError ? err.message : 'No se pudo guardar.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    const ok = await confirm({
      title: 'Cerrar sesión',
      message: user?.email ?? '',
      confirmLabel: 'Cerrar sesión',
      destructive: true,
    });
    if (ok) signOut();
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={[styles.topbar, { paddingTop: insets.top + 14 }]}>
        <TopbarBackButton onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Text style={styles.topbarTitle}>Mi perfil</Text>
          <Text style={styles.topbarSub}>{user?.email}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.summaryCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(usuario?.nombre || user?.email || '?').trim().charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.summaryName}>{usuario?.nombre || 'Sin nombre'}</Text>
          <Text style={styles.summaryEmail}>{user?.email}</Text>
          {usuario?.role ? (
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>{ROLE_LABELS[usuario.role] ?? usuario.role}</Text>
            </View>
          ) : null}
        </Card>

        <SectionTitle>Datos personales</SectionTitle>
        <Card>
          {canEdit ? (
            <>
              <Field label="Nombre" value={nombre} onChangeText={setNombre} placeholder="Tu nombre completo" />
              <Field label="ID" value={legajo} onChangeText={setLegajo} placeholder="Tu ID" />
              <Button title="Guardar cambios" onPress={handleSave} disabled={saving} block />
            </>
          ) : (
            <>
              <ReadOnlyField label="Nombre" value={usuario?.nombre} />
              <ReadOnlyField label="ID" value={usuario?.legajo} last />
            </>
          )}
        </Card>

        

        <SectionTitle>Cuenta de Odoo</SectionTitle>
        <OdooSection />
        <SectionTitle>Sesión</SectionTitle>
        <Card>
          <Button title="Cerrar sesión" variant="outline" onPress={handleSignOut} block />
        </Card>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ReadOnlyField({ label, value, last }: { label: string; value?: string; last?: boolean }) {
  return (
    <View style={[styles.roField, last && styles.roFieldLast]}>
      <Text style={styles.roLabel}>{label}</Text>
      <Text style={styles.roValue}>{value || '—'}</Text>
    </View>
  );
}

function OdooSection() {
  const { usuario, getIdToken, refreshUsuario } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const linked = usuario?.odoo?.linked === true;

  async function handleLink() {
    if (!login.trim() || !password.trim()) {
      showToast({ type: 'error', message: 'Ingresá tu usuario y contraseña de Odoo.' });
      return;
    }
    setLinking(true);
    try {
      const idToken = await getIdToken();
      await linkOdooAccount(idToken, login.trim(), password);
      await refreshUsuario();
      setLogin('');
      setPassword('');
      showToast({ type: 'success', message: 'Cuenta de Odoo vinculada correctamente.' });
    } catch (err) {
      showToast({ type: 'error', message: err instanceof ApiError ? err.message : 'No se pudo vincular la cuenta.' });
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink() {
    const ok = await confirm({
      title: 'Desvincular cuenta de Odoo',
      message: '¿Seguro que querés desvincular tu cuenta de Odoo? Ya no se podrán enviar hojas al ticket automáticamente.',
      confirmLabel: 'Desvincular',
      destructive: true,
    });
    if (!ok) return;
    setUnlinking(true);
    try {
      const idToken = await getIdToken();
      await unlinkOdooAccount(idToken);
      await refreshUsuario();
      showToast({ type: 'success', message: 'Cuenta de Odoo desvinculada.' });
    } catch (err) {
      showToast({ type: 'error', message: err instanceof ApiError ? err.message : 'No se pudo desvincular.' });
    } finally {
      setUnlinking(false);
    }
  }

  if (linked && usuario?.odoo) {
    const odoo = usuario.odoo as { linked: true; displayName: string; login: string };
    return (
      <Card>
        <View style={styles.odooLinkedRow}>
          <View style={styles.odooLinkedDot} />
          <Text style={styles.odooLinkedText}>Vinculada</Text>
        </View>
        <ReadOnlyField label="Nombre en Odoo" value={odoo.displayName} />
        <ReadOnlyField label="Usuario" value={odoo.login} last />
        <View style={{ marginTop: 12 }}>
          <Button title="Desvincular cuenta" variant="outline" onPress={handleUnlink} disabled={unlinking} block />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <Text style={styles.odooHint}>
        Vincular tu cuenta de Odoo permite enviar la hoja de conformidad al ticket del cliente automáticamente al finalizar.
      </Text>
      <Field
        label="Usuario Odoo"
        value={login}
        onChangeText={setLogin}
        placeholder="tu.usuario@waragps.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field
        label="Contraseña Odoo"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
      />
      <Button title={linking ? 'Verificando...' : 'Vincular cuenta'} onPress={handleLink} disabled={linking} block />
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topbarTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  topbarSub: { color: '#fff', opacity: 0.85, fontSize: 11 },
  content: { padding: 16, paddingBottom: 40 },
  summaryCard: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  summaryName: { fontSize: 16.5, fontWeight: '800', color: colors.text },
  summaryEmail: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  rolePill: { marginTop: 10, backgroundColor: colors.bg, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 14 },
  rolePillText: { fontSize: 11.5, fontWeight: '700', color: colors.primaryDark },
  roField: { marginBottom: 12 },
  roFieldLast: { marginBottom: 0 },
  roLabel: { fontSize: 12.5, fontWeight: '600', color: colors.muted, marginBottom: 4 },
  roValue: { fontSize: 15, color: colors.text, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.bg },
  odooHint: { fontSize: 13, color: colors.muted, marginBottom: 14, lineHeight: 19 },
  odooLinkedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  odooLinkedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ok },
  odooLinkedText: { fontSize: 13.5, fontWeight: '700', color: colors.ok },
});
