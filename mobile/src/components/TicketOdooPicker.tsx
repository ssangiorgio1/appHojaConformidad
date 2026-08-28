import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TicketOdooRef } from '@wara/shared';
import { searchOdooTickets, type OdooTicketResult } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, Field } from './ui';
import { colors } from '../theme';

export function TicketOdooPicker({
  value,
  onChange,
}: {
  value: TicketOdooRef | null;
  onChange: (next: TicketOdooRef | null) => void;
}) {
  const { getIdToken } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OdooTicketResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setNumero(numero: string) {
    if (!numero.trim()) {
      onChange(null);
      return;
    }
    // Typing over a previously-verified ticket number invalidates that
    // verification — it needs to resolve again against Odoo.
    onChange({ numero, verified: false });
  }

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const idToken = await getIdToken();
      const { data } = await searchOdooTickets(idToken, query);
      setResults(data);
      if (!data.length) setError('Sin resultados. Podés escribir el número de ticket manualmente.');
    } catch {
      setError('No se pudo buscar en Odoo. Revisá tu conexión — igual podés escribir el número manualmente.');
    } finally {
      setSearching(false);
    }
  }

  function pick(ticket: OdooTicketResult) {
    onChange({ numero: String(ticket.id), odooId: ticket.id, clienteOdoo: ticket.partnerName ?? ticket.label, verified: true });
    setModalVisible(false);
    setResults([]);
    setQuery('');
  }

  return (
    <View>
      <Field
        label="N° de ticket Odoo (opcional)"
        value={value?.numero ?? ''}
        onChangeText={setNumero}
        placeholder="Escribí el número o buscalo"
        keyboardType="number-pad"
      />
      {value?.verified ? (
        <Text style={styles.hintOk}>✓ Vinculado a Odoo{value.clienteOdoo ? ` — ${value.clienteOdoo}` : ''}</Text>
      ) : value?.numero ? (
        <Text style={styles.hintWarn}>Todavía no se verificó contra Odoo — se confirmará cuando haya conexión.</Text>
      ) : null}

      <View style={styles.btnRow}>
        <Button title="Buscar ticket en Odoo" variant="outline" onPress={() => setModalVisible(true)} />
      </View>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)}>
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
              />
              <View style={styles.btnRow}>
                <Button title={searching ? 'Buscando...' : 'Buscar'} onPress={runSearch} disabled={searching} />
              </View>
              {searching && <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} />}
              {error && !searching ? <Text style={styles.error}>{error}</Text> : null}
              <FlatList
                data={results}
                keyExtractor={(t) => String(t.id)}
                style={styles.list}
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
                <Button title="Cerrar" variant="ghost" onPress={() => setModalVisible(false)} />
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  hintOk: { fontSize: 12, color: colors.ok, marginTop: -6, marginBottom: 10, fontWeight: '600' },
  hintWarn: { fontSize: 12, color: colors.warn, marginTop: -6, marginBottom: 10 },
  btnRow: { marginTop: 4, marginBottom: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialogWrap: { width: '100%', maxWidth: 460, maxHeight: '80%' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 },
  searchInput: {
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: colors.bg,
    color: colors.text,
  },
  error: { fontSize: 12.5, color: colors.bad, marginTop: 8 },
  list: { marginTop: 10, maxHeight: 280 },
  resultRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  resultSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
