import { useEffect, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { SATISFACCION_LABELS, type ConformidadRecord } from '@wara/shared';
import { RequireAuth } from '../../src/auth/RequireAuth';
import { useAuth } from '../../src/auth/AuthContext';
import { dbGet } from '../../src/db/database';
import { syncRecord } from '../../src/sync/sync';
import { Badge, Button, Card } from '../../src/components/ui';
import { useToast } from '../../src/components/Toast';
import { colors } from '../../src/theme';
import { fmtDateTime } from '../../src/utils/misc';
import { buildPrintHtml } from '../../src/utils/printHtml';
import { getLogoDataUri } from '../../src/utils/logo';

export default function VerScreen() {
  return (
    <RequireAuth>
      <Ver />
    </RequireAuth>
  );
}

function Ver() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { getIdToken } = useAuth();
  const [record, setRecord] = useState<ConformidadRecord | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [odooRetrying, setOdooRetrying] = useState(false);

  useEffect(() => {
    dbGet(id).then((r) => {
      if (!r) {
        router.replace('/');
        return;
      }
      setRecord(r);
    });
  }, [id, router]);

  if (!record) return null;

  const statusLabel =
    record.status === 'completo' ? 'Completo' : record.status === 'pendiente_post' ? 'Pendiente POST' : 'PRE en progreso';
  const tone = record.status === 'completo' ? 'done' : record.status === 'pendiente_post' ? 'post' : 'pre';
  const synced = record.syncStatus === 'SYNCED';

  async function handleSync() {
    setSyncing(true);
    try {
      const ok = await syncRecord(record!, getIdToken);
      const fresh = await dbGet(id);
      if (fresh) setRecord(fresh);
      showToast(
        ok
          ? { type: 'success', message: 'Sincronizado con el servidor.' }
          : { type: 'error', message: 'No se pudo sincronizar. Revisá tu conexión e intentá de nuevo.' },
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleRetryOdoo() {
    setOdooRetrying(true);
    try {
      await syncRecord(record!, getIdToken);
      const fresh = await dbGet(id);
      if (fresh) setRecord(fresh);
    } finally {
      setOdooRetrying(false);
    }
  }

  async function handlePrint() {
    try {
      const logoDataUri = await getLogoDataUri();
      const html = await buildPrintHtml(record!, { logoDataUri });
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Hoja de Conformidad' });
      }
    } catch {
      showToast({ type: 'error', message: 'No se pudo generar el PDF.' });
    }
  }

  async function handleShareSummary() {
    const text = `Hoja de Conformidad WARA\nCliente: ${record!.cliente}\nMatrícula: ${record!.matricula}\nFecha: ${fmtDateTime(record!.fecha, record!.hora)}\nInstalador: ${record!.instalador}\nEstado: ${statusLabel}`;
    try {
      await Share.share({ message: text });
    } catch {
      // usuario canceló
    }
  }

  async function handleExportJson() {
    try {
      const file = new File(Paths.cache, `servicio_${record!.matricula || record!.id}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(
        JSON.stringify({ app: 'wara-conformidad', exportedAt: new Date().toISOString(), records: [record] }, null, 2),
      );
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Respaldo del servicio' });
      }
    } catch {
      showToast({ type: 'error', message: 'No se pudo exportar el respaldo.' });
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topbar}>
        <Text style={styles.topbarBack} onPress={() => router.replace('/')}>
          ←
        </Text>
        <View>
          <Text style={styles.topbarTitle}>Ver servicio</Text>
          <Text style={styles.topbarSub}>{record.cliente || ''}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Card>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryTitle}>{record.cliente || '(Sin nombre de cliente)'}</Text>
            <Badge label={statusLabel} tone={tone} />
          </View>
          <Text style={styles.summaryLine}>Matrícula: {record.matricula || '—'}</Text>
          <Text style={styles.summaryLine}>Fecha: {fmtDateTime(record.fecha, record.hora)}</Text>
          <Text style={styles.summaryLine}>Instalador: {record.instalador || '—'}</Text>
          {record.numero ? <Text style={styles.summaryLine}>N° hoja: {record.numero}</Text> : null}
        </Card>

        <Card style={styles.syncCard}>
          <View style={styles.syncRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.syncTitle}>{synced ? 'Sincronizado' : 'Sin sincronizar'}</Text>
              <Text style={styles.syncSub}>
                {synced
                  ? 'Este servicio ya está guardado en el servidor y visible en el panel web.'
                  : 'Todavía no llegó al servidor — no va a verse en el panel web hasta que sincronice.'}
              </Text>
            </View>
            {!synced &&
              (syncing ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Button title="Sincronizar" variant="outline" onPress={handleSync} />
              ))}
          </View>
        </Card>

        {record.ticketOdoo && (
          <Card style={styles.syncCard}>
            <View style={styles.syncRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.syncTitle}>Ticket Odoo #{record.ticketOdoo.numero}</Text>
                <Text style={styles.syncSub}>
                  {record.odooSync.status === 'SYNCED'
                    ? 'Enviado a Odoo.'
                    : record.odooSync.status === 'FAILED'
                      ? `Error al enviar a Odoo${record.odooSync.lastError ? `: ${record.odooSync.lastError}` : ''}`
                      : record.status === 'completo'
                        ? 'Pendiente de enviar a Odoo.'
                        : 'Se enviará a Odoo cuando se complete el POST.'}
                </Text>
                {record.post.firma?.satisfaccion && (
                  <Text style={styles.syncSub}>{SATISFACCION_LABELS[record.post.firma.satisfaccion]}</Text>
                )}
              </View>
              {record.status === 'completo' &&
                record.odooSync.status !== 'SYNCED' &&
                (odooRetrying ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Button title="Reintentar" variant="outline" onPress={handleRetryOdoo} />
                ))}
            </View>
          </Card>
        )}

        {record.status === 'completo' ? (
          <>
            <Button title="Imprimir / Guardar PDF" block onPress={handlePrint} />
            <View style={styles.btnRow}>
              <Button title="Compartir resumen" variant="secondary" onPress={handleShareSummary} />
              <Button title="Descargar respaldo (.json)" variant="secondary" onPress={handleExportJson} />
            </View>
            <Text style={styles.helptext}>
              "Imprimir / Guardar PDF" genera el PDF con checklist, fotos y firmas, y abre el menú para compartirlo
              por WhatsApp, email o guardarlo en el celular. Funciona sin conexión a internet.
            </Text>
          </>
        ) : (
          <>
            <Button title="Completar POST" block onPress={() => router.push(`/post/${record.id}`)} />
            <Text style={styles.helptext}>
              Todavía falta completar la POST-instalación — el PDF y las opciones para compartir se habilitan recién
              cuando el servicio queda "Completo".
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
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
  content: { padding: 14 },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1, marginRight: 8 },
  summaryLine: { fontSize: 13, color: colors.muted, marginTop: 2 },
  syncCard: { marginTop: -2 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  syncTitle: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  syncSub: { fontSize: 11.5, color: colors.muted, marginTop: 2, lineHeight: 15 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  helptext: { fontSize: 12, color: colors.muted, marginTop: 12, lineHeight: 17 },
});
