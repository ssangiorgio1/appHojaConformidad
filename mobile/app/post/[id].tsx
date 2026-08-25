import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CHECKLIST_ITEMS,
  EQUIP_GROUPS,
  EQUIP_CHECK_FIELDS,
  type ChecklistValue,
  type ConformidadRecord,
  type Equipo,
} from '@wara/shared';
import { RequireAuth } from '../../src/auth/RequireAuth';
import { dbGet, dbPut } from '../../src/db/database';
import { ChecklistEditor } from '../../src/components/ChecklistEditor';
import { PhotoGrid } from '../../src/components/PhotoGrid';
import { SignaturePad, type SignaturePadHandle } from '../../src/components/SignaturePad';
import { Button, Card, Field, SectionTitle } from '../../src/components/ui';
import { colors } from '../../src/theme';
import { nowIso } from '../../src/utils/misc';

export default function PostScreen() {
  return (
    <RequireAuth>
      <PostForm />
    </RequireAuth>
  );
}

function PostForm() {
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

  function setChecklistValue(key: string, value: ChecklistValue) {
    persist({ ...record!, post: { ...record!.post, checklist: { ...record!.post.checklist, [key]: value } } });
  }

  function setEquipoText(key: string, value: string) {
    persist({ ...record!, equipo: { ...record!.equipo, [key]: value } });
  }

  function toggleEquipoCheck(key: string) {
    persist({ ...record!, equipo: { ...record!.equipo, [key]: !record!.equipo[key as keyof Equipo] } });
  }

  function onSignatureCaptured(dataUrl: string) {
    const action = pendingAction.current;
    pendingAction.current = null;
    const next: ConformidadRecord = {
      ...record!,
      post: { ...record!.post, firma: { dataUrl, firmedAt: nowIso() } },
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
      Alert.alert('Falta la firma', 'Falta la firma del cliente para dar conformidad final.');
    } else if (action === 'draft') {
      persist({ ...record! }, true);
      Alert.alert('Guardado', 'Borrador guardado.');
    }
  }

  async function finalize(base: ConformidadRecord) {
    const next: ConformidadRecord = { ...base, status: 'completo' };
    await dbPut({ ...next, updatedAt: nowIso() });
    router.replace(`/ver/${next.id}`);
  }

  function handleSaveDraft() {
    pendingAction.current = 'draft';
    sigRef.current?.capture();
  }

  function handleFinish() {
    const unanswered = CHECKLIST_ITEMS.filter((it) => !record!.post.checklist[it.key]);
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
          <Text style={styles.topbarTitle}>Post-instalación</Text>
          <Text style={styles.topbarSub}>
            {record.cliente || 'Servicio'} · {record.matricula || ''}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <SectionTitle>Revisión general del vehículo (POST)</SectionTitle>
          <Card>
            <ChecklistEditor checklist={record.post.checklist} onChange={setChecklistValue} />
          </Card>

          <SectionTitle>Datos del equipamiento instalado</SectionTitle>
          <Card>
            {EQUIP_GROUPS.map((group) => (
              <View key={group.title}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                {group.fields.map((f) => (
                  <Field
                    key={f.key}
                    label={f.label}
                    value={(record.equipo[f.key as keyof Equipo] as string) ?? ''}
                    onChangeText={(v) => setEquipoText(f.key, v)}
                  />
                ))}
              </View>
            ))}
          </Card>

          <SectionTitle>Control de instalación</SectionTitle>
          <Card>
            {EQUIP_CHECK_FIELDS.map((f) => (
              <Pressable key={f.key} style={styles.checkRow} onPress={() => toggleEquipoCheck(f.key)}>
                <View style={[styles.checkbox, record.equipo[f.key as keyof Equipo] && styles.checkboxOn]}>
                  {record.equipo[f.key as keyof Equipo] ? <Text style={styles.checkboxMark}>✓</Text> : null}
                </View>
                <Text style={styles.checkLabel}>{f.label}</Text>
              </Pressable>
            ))}
          </Card>

          <SectionTitle>Fotos (post instalación)</SectionTitle>
          <Card>
            <PhotoGrid fotos={record.post.fotos} onChange={(fotos) => persist({ ...record, post: { ...record.post, fotos } })} />
          </Card>

          <SectionTitle>Observaciones encontradas (POST)</SectionTitle>
          <Card>
            <TextInput
              style={styles.textarea}
              multiline
              placeholder="Detalles que no estén dentro de los ítems anteriores..."
              placeholderTextColor="#b0a6a3"
              value={record.post.observaciones}
              onChangeText={(v) => persist({ ...record, post: { ...record.post, observaciones: v } })}
            />
          </Card>

          <SectionTitle>Firma del cliente — conformidad final</SectionTitle>
          <Card>
            <SignaturePad
              ref={sigRef}
              existingDataUrl={record.post.firma?.dataUrl}
              onCapture={onSignatureCaptured}
              onEmpty={onSignatureEmpty}
              onClear={() => persist({ ...record, post: { ...record.post, firma: null } })}
            />
            <View style={styles.btnRow}>
              <Button title="Limpiar firma" variant="ghost" onPress={() => sigRef.current?.clear()} />
            </View>
          </Card>

          <View style={styles.btnRow}>
            <Button title="Guardar borrador" variant="secondary" block onPress={handleSaveDraft} />
          </View>
          <View style={styles.btnRow}>
            <Button title="Finalizar servicio" block onPress={handleFinish} />
          </View>
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
  groupTitle: { fontSize: 12, fontWeight: '700', color: colors.primaryDark, marginTop: 12, marginBottom: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  checkLabel: { fontSize: 14, color: colors.text, flex: 1 },
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
});
