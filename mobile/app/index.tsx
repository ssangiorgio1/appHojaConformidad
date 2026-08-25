import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ConformidadRecord, EstadoServicio } from '@wara/shared';
import { RequireAuth } from '../src/auth/RequireAuth';
import { useAuth } from '../src/auth/AuthContext';
import { dbDelete, dbGetAll, dbPut } from '../src/db/database';
import { Badge, Button } from '../src/components/ui';
import { colors } from '../src/theme';
import { fmtDateTime, newRecordFor } from '../src/utils/records';

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
  const { user, signOut } = useAuth();
  const [records, setRecords] = useState<ConformidadRecord[]>([]);
  const [filter, setFilter] = useState<Filter>('todos');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const all = await dbGetAll();
    setRecords(all);
  }, []);

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
    const rec = newRecordFor(user?.displayName ?? '');
    await dbPut(rec);
    router.push(`/pre/${rec.id}`);
  }

  function handleDelete(id: string) {
    Alert.alert('Eliminar servicio', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await dbDelete(id);
          load();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topbarTitle}>Hoja de Conformidad</Text>
          <Text style={styles.topbarSub}>WARA · Seguimiento y Control</Text>
        </View>
        <Pressable style={styles.iconBtn} onPress={() => Alert.alert('Sesión', user?.email ?? '', [
          { text: 'Cerrar sesión', style: 'destructive', onPress: signOut },
          { text: 'Cancelar', style: 'cancel' },
        ])}>
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
          <RecordCard record={item} onDelete={() => handleDelete(item.id)} />
        )}
      />

      <Pressable style={styles.fab} onPress={handleNew}>
        <Text style={styles.fabText}>+ Nuevo servicio</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function RecordCard({ record, onDelete }: { record: ConformidadRecord; onDelete: () => void }) {
  const router = useRouter();

  return (
    <View style={styles.record}>
      <View style={styles.recordTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.recordTitle}>{record.cliente || '(Sin nombre de cliente)'}</Text>
          <Text style={styles.recordSub}>Matrícula: {record.matricula || '—'} · {fmtDateTime(record.fecha, record.hora)}</Text>
          <Text style={styles.recordSub}>
            Instalador: {record.instalador || '—'} {record.numero ? `· N° ${record.numero}` : ''}
          </Text>
        </View>
        {record.status === 'borrador_pre' && <Badge label="PRE en progreso" tone="pre" />}
        {record.status === 'pendiente_post' && <Badge label="Pendiente POST" tone="post" />}
        {record.status === 'completo' && <Badge label="Completo" tone="done" />}
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
        <Button title="Eliminar" variant="ghost" onPress={onDelete} />
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
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 10, flexWrap: 'wrap' },
  tab: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 20, backgroundColor: '#efe6e3' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 12.5, fontWeight: '600', color: colors.primaryDark },
  tabTextActive: { color: '#fff' },
  list: { paddingHorizontal: 14, paddingBottom: 90 },
  empty: { textAlign: 'center', color: colors.muted, padding: 50, fontSize: 14 },
  record: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
  },
  recordTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  recordTitle: { fontWeight: '700', fontSize: 15.5, color: colors.text },
  recordSub: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  recordActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  fab: {
    position: 'absolute',
    bottom: 22,
    right: 20,
    backgroundColor: colors.primary,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
