import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RequireAuth } from '../src/auth/RequireAuth';
import { useAuth } from '../src/auth/AuthContext';
import { Button, Card, Field, SectionTitle } from '../src/components/ui';
import { useToast } from '../src/components/Toast';
import { useConfirm } from '../src/components/ConfirmDialog';
import { updateMe, ApiError } from '../src/api/client';
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topbar}>
        <Text style={styles.topbarBack} onPress={() => router.back()}>
          ←
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.topbarTitle}>Mi perfil</Text>
          <Text style={styles.topbarSub}>{user?.email}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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

        <SectionTitle>Sesión</SectionTitle>
        <Card>
          <Button title="Cerrar sesión" variant="outline" onPress={handleSignOut} block />
        </Card>
      </ScrollView>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topbarBack: { color: '#fff', fontSize: 20, width: 30 },
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
});
