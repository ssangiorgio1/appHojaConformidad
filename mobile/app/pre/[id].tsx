import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CHECKLIST_ITEMS, type ChecklistValue, type ConformidadRecord } from '@wara/shared';
import { RequireAuth } from '../../src/auth/RequireAuth';
import { dbGet, dbPut } from '../../src/db/database';
import { ChecklistEditor } from '../../src/components/ChecklistEditor';
import { PhotoGrid } from '../../src/components/PhotoGrid';
import { SignaturePad, type SignaturePadHandle } from '../../src/components/SignaturePad';
import { Button, Card, Field, SectionTitle } from '../../src/components/ui';
import { colors } from '../../src/theme';
import { nowIso } from '../../src/utils/misc';

export default function PreScreen() {
  return (
    <RequireAuth>
      <PreForm />
    </RequireAuth>
  );
}

function PreForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<ConformidadRecord | null>(null);
  const sigRef = useRef<SignaturePadHandle>(null);
  const pendingAction = useRef<'draft' | 'finish' | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    dbGet(id).then((r) => {
      if (!r) {
        router.replace('/');
        return;
      }
      setRecord(r);
    });
  }, [id, router]);

  const persist = useCallback((next: ConformidadRecord, immediate = false) => {
    setRecord(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const doSave = () => dbPut({ ...next, updatedAt: nowIso() });
    if (immediate) doSave();
    else saveTimer.current = setTimeout(doSave, 400);
  }, []);

  if (!record) return null;

  function set<K extends keyof ConformidadRecord>(key: K, value: ConformidadRecord[K]) {
    persist({ ...record!, [key]: value });
  }

  function setChecklistValue(key: string, value: ChecklistValue) {
    persist({ ...record!, pre: { ...record!.pre, checklist: { ...record!.pre.checklist, [key]: value } } });
  }

  function onSignatureCaptured(dataUrl: string) {
    const action = pendingAction.current;
    pendingAction.current = null;
    const next: ConformidadRecord = {
      ...record!,
      pre: { ...record!.pre, firma: { dataUrl, firmedAt: nowIso() } },
    };
    if (action === 'finish') {
      finalize(next);
    } else {
      persist(next, true);
      if (action === 'draft') Alert.alert('Guardado', 'Borrador guardado.');
    }
  }

  function onSignatureEmpty() {
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action === 'finish') {
      Alert.alert('Falta la firma', 'Falta la firma del cliente para autorizar el inicio del servicio.');
    } else if (action === 'draft') {
      persist({ ...record! }, true);
      Alert.alert('Guardado', 'Borrador guardado.');
    }
  }

  async function finalize(base: ConformidadRecord) {
    const next: ConformidadRecord = { ...base, status: 'pendiente_post' };
    await dbPut({ ...next, updatedAt: nowIso() });
    router.replace('/');
  }

  function handleSaveDraft() {
    pendingAction.current = 'draft';
    sigRef.current?.capture();
  }

  function handleFinish() {
    const unanswered = CHECKLIST_ITEMS.filter((it) => !record!.pre.checklist[it.key]);
    const proceed = () => {
      pendingAction.current = 'finish';
      sigRef.current?.capture();
    };
    if (unanswered.length) {
      Alert.alert(
        'Checklist incompleto',
        `Hay ${unanswered.length} punto(s) del checklist sin responder. ¿Continuar igual?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Continuar', onPress: proceed },
        ],
      );
    } else {
      proceed();
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topbar}>
        <Text style={styles.topbarBack} onPress={() => router.replace('/')}>
          ←
        </Text>
        <View>
          <Text style={styles.topbarTitle}>Pre-instalación</Text>
          <Text style={styles.topbarSub}>Revisión antes de comenzar</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <Field label="N° de hoja (impresa en papel)" value={record.numero} onChangeText={(v) => set('numero', v)} placeholder="Ej: 023751" />
            <Field label="Cliente" value={record.cliente} onChangeText={(v) => set('cliente', v)} placeholder="Nombre del cliente" />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Field label="Fecha" value={record.fecha} onChangeText={(v) => set('fecha', v)} placeholder="YYYY-MM-DD" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Hora" value={record.hora} onChangeText={(v) => set('hora', v)} placeholder="HH:mm" />
              </View>
            </View>
            <Field label="Matrícula" value={record.matricula} onChangeText={(v) => set('matricula', v)} placeholder="Patente del vehículo" />
            <Field label="Instalador" value={record.instalador} onChangeText={(v) => set('instalador', v)} placeholder="Nombre del técnico" />
            <Field
              label="Responsable de empresa"
              value={record.responsableEmpresa}
              onChangeText={(v) => set('responsableEmpresa', v)}
              placeholder="Responsable / contacto en la empresa cliente"
            />
          </Card>

          <SectionTitle>Revisión general del vehículo (PRE)</SectionTitle>
          <Card>
            <ChecklistEditor checklist={record.pre.checklist} onChange={setChecklistValue} />
          </Card>

          <SectionTitle>Fotos (panel, asientos, etc.)</SectionTitle>
          <Card>
            <PhotoGrid fotos={record.pre.fotos} onChange={(fotos) => persist({ ...record, pre: { ...record.pre, fotos } })} />
          </Card>

          <SectionTitle>Observaciones encontradas (PRE)</SectionTitle>
          <Card>
            <TextInput
              style={styles.textarea}
              multiline
              placeholder="Detalles que no estén dentro de los ítems anteriores..."
              placeholderTextColor="#b0a6a3"
              value={record.pre.observaciones}
              onChangeText={(v) => persist({ ...record, pre: { ...record.pre, observaciones: v } })}
            />
          </Card>

          <SectionTitle>Firma del cliente — autoriza inicio y estado de la unidad</SectionTitle>
          <Card>
            <SignaturePad
              ref={sigRef}
              existingDataUrl={record.pre.firma?.dataUrl}
              onCapture={onSignatureCaptured}
              onEmpty={onSignatureEmpty}
              onClear={() => persist({ ...record, pre: { ...record.pre, firma: null } })}
            />
            <View style={styles.btnRow}>
              <Button title="Limpiar firma" variant="ghost" onPress={() => sigRef.current?.clear()} />
            </View>
          </Card>

          <View style={styles.btnRow}>
            <Button title="Guardar borrador" variant="secondary" block onPress={handleSaveDraft} />
          </View>
          <View style={styles.btnRow}>
            <Button title="Finalizar PRE y continuar" block onPress={handleFinish} />
          </View>
          <Text style={styles.helptext}>
            El borrador se guarda automáticamente en este celular aunque no tengas conexión a internet. Al
            finalizar, el servicio queda "Pendiente de POST" hasta que instales/repares el equipo y completes la
            segunda parte.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
  content: { padding: 14, paddingBottom: 40 },
  row2: { flexDirection: 'row', gap: 10 },
  textarea: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 11,
    fontSize: 15,
    minHeight: 70,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
    color: colors.text,
  },
  btnRow: { marginTop: 10 },
  helptext: { fontSize: 12, color: colors.muted, marginTop: 6, marginHorizontal: 4, lineHeight: 17 },
});
