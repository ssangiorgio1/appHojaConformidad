import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { TicketOdooRef } from '@wara/shared';
import { searchOdooTickets, type OdooTicketResult } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { buildTicketOdooRef } from '../utils/ticketOdoo';
import { Button, Card } from './ui';
import { colors, radius } from '../theme';

export function TicketOdooPicker({
  value,
  onChange,
}: {
  value: TicketOdooRef | null;
  onChange: (next: TicketOdooRef | null) => void;
}) {
  const { getIdToken } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OdooTicketResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const idToken = await getIdToken();
      const { data } = await searchOdooTickets(idToken, query);
      setResults(data);
      if (!data.length) setError('Sin resultados. Verificá el nombre o número de ticket.');
    } catch {
      setError('No se pudo buscar en Odoo. Revisá tu conexión.');
    } finally {
      setSearching(false);
    }
  }

  function pick(ticket: OdooTicketResult) {
    onChange(buildTicketOdooRef(ticket));
    setModalVisible(false);
    setResults([]);
    setQuery('');
  }

  function openModal() {
    setResults([]);
    setError(null);
    setQuery('');
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setResults([]);
    setQuery('');
  }

  function openTrigger() {
    // A ticket is already picked: show its detail instead of jumping straight
    // to search, so tapping it doesn't risk swapping the linked ticket by accident.
    if (value) setDetailVisible(true);
    else openModal();
  }

  function changeTicket() {
    setDetailVisible(false);
    openModal();
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.fieldLabel}>N° de ticket Odoo</Text>

      {/* Trigger — looks like a Field but opens the modal on press */}
      <Pressable style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]} onPress={openTrigger}>
        <View style={styles.triggerContent}>
          {value?.verified ? (
            <Text style={styles.triggerVerified} numberOfLines={1}>
              #{value.numero}{value.clienteOdoo ? ` · ${value.clienteOdoo}` : ''}
            </Text>
          ) : value?.numero ? (
            <Text style={styles.triggerValue}>#{value.numero}</Text>
          ) : (
            <Text style={styles.triggerPlaceholder}>Tocar para buscar ticket en Odoo…</Text>
          )}
        </View>
        {value ? (
          // Stop propagation so the X doesn't also open the modal
          <Pressable
            hitSlop={10}
            onPress={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            style={styles.clearBtn}
          >
            <Text style={styles.clearBtnText}>✕</Text>
          </Pressable>
        ) : (
          <Text style={styles.triggerIcon}>🔍</Text>
        )}
      </Pressable>

      {value?.verified ? (
        <Text style={styles.hintOk}>✓ Vinculado a Odoo{value.clienteOdoo ? ` — ${value.clienteOdoo}` : ''}</Text>
      ) : value?.numero ? (
        <Text style={styles.hintWarn}>No verificado contra Odoo — se confirmará cuando haya conexión.</Text>
      ) : null}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.dialogWrap}>
            <Card>
              <Text style={styles.title}>Buscar ticket de Odoo</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Nombre del cliente o número de ticket"
                placeholderTextColor={colors.muted}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={runSearch}
                returnKeyType="search"
                autoFocus
              />
              <View style={styles.btnRow}>
                <Button title={searching ? 'Buscando…' : 'Buscar'} onPress={runSearch} disabled={searching} />
              </View>
              {searching && <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} />}
              {error && !searching ? <Text style={styles.error}>{error}</Text> : null}
              <FlatList
                data={results}
                keyExtractor={(t) => String(t.id)}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable style={styles.resultRow} onPress={() => pick(item)}>
                    <Text style={styles.resultTitle}>#{item.id} · {item.label}</Text>
                    <Text style={styles.resultSub}>
                      {item.partnerName ?? 'Sin cliente asignado'}
                      {item.stage ? ` · ${item.stage}` : ''}
                    </Text>
                  </Pressable>
                )}
              />
              <View style={styles.btnRow}>
                <Button title="Cerrar" variant="ghost" onPress={closeModal} />
              </View>
            </Card>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={detailVisible} transparent animationType="fade" onRequestClose={() => setDetailVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setDetailVisible(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.dialogWrap}>
            <Card>
              <Text style={styles.title}>Ticket #{value?.numero}</Text>
              <Text style={styles.detailLabel}>Asunto</Text>
              <Text style={styles.detailValue}>{value?.asunto ?? 'Sin asunto disponible'}</Text>
              {value?.clienteOdoo ? (
                <>
                  <Text style={styles.detailLabel}>Cliente</Text>
                  <Text style={styles.detailValue}>{value.clienteOdoo}</Text>
                </>
              ) : null}
              {value?.etapa ? (
                <>
                  <Text style={styles.detailLabel}>Etapa</Text>
                  <Text style={styles.detailValue}>{value.etapa}</Text>
                </>
              ) : null}
              {!value?.verified ? (
                <Text style={styles.hintWarn}>No verificado contra Odoo — se confirmará cuando haya conexión.</Text>
              ) : null}
              <View style={styles.btnRow}>
                <Button title="Cambiar ticket" variant="outline" onPress={changeTicket} />
              </View>
              <View style={styles.btnRow}>
                <Button title="Cerrar" variant="ghost" onPress={() => setDetailVisible(false)} />
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 4 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: colors.muted, marginBottom: 4 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius - 4,
    paddingHorizontal: 12,
    paddingVertical: 13,
    marginBottom: 6,
  },
  triggerPressed: { opacity: 0.7 },
  triggerContent: { flex: 1 },
  triggerPlaceholder: { fontSize: 15, color: colors.muted },
  triggerValue: { fontSize: 15, color: colors.text },
  triggerVerified: { fontSize: 15, color: colors.text, fontWeight: '500' },
  triggerIcon: { fontSize: 16, marginLeft: 8 },
  clearBtn: { marginLeft: 8, paddingHorizontal: 4 },
  clearBtnText: { fontSize: 14, color: colors.muted },
  hintOk: { fontSize: 12, color: colors.ok, marginBottom: 10, fontWeight: '600' },
  hintWarn: { fontSize: 12, color: colors.warn, marginBottom: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialogWrap: { width: '100%', maxWidth: 460, maxHeight: '80%' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 },
  detailLabel: { fontSize: 11.5, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginTop: 10 },
  detailValue: { fontSize: 15, color: colors.text, marginTop: 2 },
  searchInput: {
    borderRadius: radius - 4,
    padding: 12,
    fontSize: 15,
    backgroundColor: colors.bg,
    color: colors.text,
  },
  btnRow: { marginTop: 8, marginBottom: 2 },
  error: { fontSize: 12.5, color: colors.bad, marginTop: 8 },
  list: { marginTop: 10, maxHeight: 280 },
  resultRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  resultSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
