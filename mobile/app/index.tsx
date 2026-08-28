import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ConformidadRecord, EstadoServicio } from '@wara/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { RequireAuth } from '../src/auth/RequireAuth';
import { useAuth } from '../src/auth/AuthContext';
import { dbDelete, dbGetAll, dbPut } from '../src/db/database';
import { Badge, Button } from '../src/components/ui';
import { useConfirm } from '../src/components/ConfirmDialog';
import { colors, cardShadow } from '../src/theme';
import { fmtDateTime, newRecordFor } from '../src/utils/records';
import { syncRecord } from '../src/sync/sync';
import { pullMyConformidades } from '../src/sync/pull';
import { trimSyncedAssets } from '../src/sync/trim';
import { getSavedStep } from '../src/utils/wizardStep';

type Filter = 'todos' | 'pre' | 'post' | 'done';

export default function HomeScreen() {
  return (
    <RequireAuth>
      <Home />
    </RequireAuth>
  );
}

function Home() {
  const router = useRouter();
  const { usuario, getIdToken } = useAuth();
  const { confirm } = useConfirm();
  const [records, setRecords] = useState<ConformidadRecord[]>([]);
  const [filter, setFilter] = useState<Filter>('todos');
  const [search, setSearch] = useState('');
  const [deletableIds, setDeletableIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const all = await dbGetAll();
    setRecords(all);

    // A borrador_pre can only be deleted while it's still on step 1 (before
    // any real work — checklist, fotos, firma — has gone into it). Once it's
    // moved past that, or it's pendiente_post/completo, deleting it would
    // throw away real field work.
    const drafts = all.filter((r) => r.status === 'borrador_pre');
    const savedSteps = await Promise.all(drafts.map((r) => getSavedStep(r.id, 'pre')));
    setDeletableIds(new Set(drafts.filter((_, i) => !savedSteps[i] || savedSteps[i]! <= 0).map((r) => r.id)));

    // Retry any records that finished a PRE/POST offline (or whose sync
    // failed) — runs in the background, doesn't block the list render. Also
    // retries a record whose Mongo sync already succeeded but whose Odoo
    // push (a separate, independently-tracked step) is still pending/failed.
    const pending = all.filter(
      (r) =>
        (r.syncStatus === 'PENDING_SYNC' && r.status !== 'borrador_pre') ||
        (r.status === 'completo' && r.ticketOdoo && r.odooSync.status !== 'SYNCED'),
    );
    if (pending.length) {
      (async () => {
        let anySynced = false;
        for (const record of pending) {
          if (await syncRecord(record, getIdToken)) anySynced = true;
        }
        if (anySynced) setRecords(await dbGetAll());
      })();
    }

    // Fills in anything this device is missing (repopulates after a
    // shared-device account switch, a reinstall, etc.) — cheap no-op once
    // the local cache is already complete.
    (async () => {
      try {
        const token = await getIdToken();
        await pullMyConformidades(token);
        setRecords(await dbGetAll());
      } catch {
        // offline or transient failure — next focus retries
      }
    })();

    // Older SYNCED records may still be carrying local base64 dataUrl
    // copies of photos/firma from before this cleanup existed — trim those
    // too, purely local, no network needed.
    (async () => {
      let anyTrimmed = false;
      for (const record of all) {
        if (record.syncStatus !== 'SYNCED') continue;
        const { record: trimmed, changed } = trimSyncedAssets(record);
        if (changed) {
          await dbPut(trimmed);
          anyTrimmed = true;
        }
      }
      if (anyTrimmed) setRecords(await dbGetAll());
    })();
  }, [getIdToken]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const counts = {
    todos: records.length,
    pre: records.filter((r) => r.status === 'borrador_pre').length,
    post: records.filter((r) => r.status === 'pendiente_post').length,
    done: records.filter((r) => r.status === 'completo').length,
  };

  const matchesFilter = (r: ConformidadRecord): boolean => {
    const map: Record<Filter, EstadoServicio | null> = {
      todos: null,
      pre: 'borrador_pre',
      post: 'pendiente_post',
      done: 'completo',
    };
    const wanted = map[filter];
    if (wanted && r.status !== wanted) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = `${r.cliente} ${r.matricula} ${r.instalador} ${r.numero}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  };

  const filtered = records.filter(matchesFilter);

  async function handleNew() {
    const rec = await newRecordFor(usuario?.nombre ?? '');
    await dbPut(rec);
    router.push(`/pre/${rec.id}`);
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Eliminar servicio',
      message: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    await dbDelete(id);
    load();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topbarTitle}>Hoja de Conformidad</Text>
          <Text style={styles.topbarSub}>WARA · Seguimiento y Control</Text>
        </View>
        <Pressable style={styles.iconBtn} onPress={() => router.push('/perfil')}>
          <Text style={styles.iconBtnText}>⋮</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por cliente, matrícula, instalador..."
          placeholderTextColor="#b0a6a3"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.tabs}>
        {(['todos', 'pre', 'post', 'done'] as Filter[]).map((f) => (
          <Pressable key={f} style={[styles.tab, filter === f && styles.tabActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.tabText, filter === f && styles.tabTextActive]}>
              {{ todos: 'Todos', pre: 'En PRE', post: 'Pendiente POST', done: 'Completos' }[f]} ({counts[f]})
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No hay servicios para mostrar.{'\n'}Tocá "Nuevo servicio" para empezar.</Text>
        }
        renderItem={({ item }) => (
          <RecordCard record={item} canDelete={deletableIds.has(item.id)} onDelete={() => handleDelete(item.id)} />
        )}
      />

      <Pressable style={styles.fabWrap} onPress={handleNew}>
        <LinearGradient colors={[colors.accent, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
          <Text style={styles.fabText}>+ Nuevo servicio</Text>
        </LinearGradient>
      </Pressable>
    </SafeAreaView>
  );
}

function RecordCard({
  record,
  canDelete,
  onDelete,
}: {
  record: ConformidadRecord;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const router = useRouter();

  return (
    <View style={styles.record}>
      <View style={styles.recordTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.recordTitle}>Cliente: {record.cliente || '(Sin nombre de cliente)'}</Text>
          <Text style={styles.recordSub}>Matrícula: {record.matricula || '—'} · {fmtDateTime(record.fecha, record.hora)}</Text>
          <Text style={styles.recordSub}>
            Instalador: {record.instalador || '—'} {record.numero ? `· N° ${record.numero}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 5 }}>
          {record.status === 'borrador_pre' && <Badge label="PRE en progreso" tone="pre" />}
          {record.status === 'pendiente_post' && <Badge label="Pendiente POST" tone="post" />}
          {record.status === 'completo' && <Badge label="Completo" tone="done" />}
          {record.status !== 'borrador_pre' && record.syncStatus !== 'SYNCED' && (
            <Badge label="Sin sincronizar" tone="warn" />
          )}
        </View>
      </View>
      <View style={styles.recordActions}>
        {record.status === 'borrador_pre' && (
          <Button title="Continuar PRE" onPress={() => router.push(`/pre/${record.id}`)} />
        )}
        {record.status === 'pendiente_post' && (
          <>
            <Button title="Completar POST" onPress={() => router.push(`/post/${record.id}`)} />
            <Button title="Ver" variant="outline" onPress={() => router.push(`/ver/${record.id}`)} />
          </>
        )}
        {record.status === 'completo' && (
          <Button title="Ver / Compartir" variant="outline" onPress={() => router.push(`/ver/${record.id}`)} />
        )}
        {canDelete && <Button title="Eliminar" variant="ghost" onPress={onDelete} />}
      </View>
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
  topbarTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  topbarSub: { color: '#fff', opacity: 0.85, fontSize: 11 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  searchWrap: { paddingHorizontal: 14, paddingTop: 10 },
  searchInput: {
    borderRadius: 30,
    borderWidth: 0,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    ...cardShadow,
  },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 10, flexWrap: 'wrap' },
  tab: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 20, backgroundColor: colors.card },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 12.5, fontWeight: '600', color: colors.primaryDark },
  tabTextActive: { color: '#fff' },
  list: { paddingHorizontal: 14, paddingBottom: 90 },
  empty: { textAlign: 'center', color: colors.muted, padding: 50, fontSize: 14 },
  record: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    ...cardShadow,
  },
  recordTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  recordTitle: { fontWeight: '700', fontSize: 15.5, color: colors.text },
  recordSub: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  recordActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  fabWrap: {
    position: 'absolute',
    bottom: 22,
    right: 20,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fab: {
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 22,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
