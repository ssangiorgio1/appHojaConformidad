import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { missingChecklistItems, PRE_PHOTO_SLOTS, type ChecklistValue, type ConformidadRecord } from '@wara/shared';
import { RequireAuth } from '../../src/auth/RequireAuth';
import { useAuth } from '../../src/auth/AuthContext';
import { dbGet, dbPut } from '../../src/db/database';
import { syncRecord } from '../../src/sync/sync';
import { ChecklistEditor, type ChecklistEditorHandle } from '../../src/components/ChecklistEditor';
import { SlotPhotoCapture, missingSlotLabels } from '../../src/components/SlotPhotoCapture';
import { SignaturePad, type SignaturePadHandle } from '../../src/components/SignaturePad';
import { TicketOdooPicker } from '../../src/components/TicketOdooPicker';
import { Button, Card, Field, SectionTitle } from '../../src/components/ui';
import { WizardProgress, WizardNav, type WizardStepDef } from '../../src/components/Wizard';
import { useToast } from '../../src/components/Toast';
import { useConfirm } from '../../src/components/ConfirmDialog';
import { colors } from '../../src/theme';
import { nowIso } from '../../src/utils/misc';
import { useScrollLock } from '../../src/utils/useScrollLock';
import { getSavedStep, saveStep, clearStep } from '../../src/utils/wizardStep';

const STEPS: WizardStepDef[] = [
  { key: 'datos', title: 'Datos del servicio' },
  { key: 'checklist', title: 'Revisión general del vehículo' },
  { key: 'fotos', title: 'Fotos' },
  { key: 'observaciones', title: 'Observaciones' },
  { key: 'firma', title: 'Firma del cliente' },
];
const LAST_STEP = STEPS.length - 1;

const STEP0_REQUIRED: Array<{ key: keyof ConformidadRecord; label: string }> = [
  { key: 'cliente', label: 'Cliente' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'hora', label: 'Hora' },
  { key: 'matricula', label: 'Matrícula' },
  { key: 'instalador', label: 'Instalador' },
  { key: 'responsableEmpresa', label: 'Responsable de empresa' },
];

export default function PreScreen() {
  return (
    <RequireAuth>
      <PreForm />
    </RequireAuth>
  );
}

function PreForm() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { usuario, getIdToken } = useAuth();
  const [record, setRecord] = useState<ConformidadRecord | null>(null);
  const [highlightKeys, setHighlightKeys] = useState<string[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [furthestIndex, setFurthestIndex] = useState(0);
  const sigRef = useRef<SignaturePadHandle>(null);
  const checklistRef = useRef<ChecklistEditorHandle>(null);
  const scrollRef = useRef<ScrollView>(null);
  const pendingAction = useRef<'draft' | 'finish' | 'lock' | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { scrollEnabled, lockHandlers } = useScrollLock();

  useEffect(() => {
    dbGet(id).then(async (r) => {
      if (!r) {
        router.replace('/');
        return;
      }
      // Instalador is always the logged-in técnico's account name and can't
      // be edited from the form — this backfills any draft that predates
      // that rule (e.g. one created before the técnico's account had a name).
      if (!r.instalador?.trim() && usuario?.nombre) {
        r = { ...r, instalador: usuario.nombre, updatedAt: nowIso() };
        await dbPut(r);
      }
      setRecord(r);
      const saved = await getSavedStep(id, 'pre');
      if (saved !== null && saved >= 0 && saved <= LAST_STEP) {
        setStepIndex(saved);
        setFurthestIndex(saved);
      }
    });
  }, [id, router, usuario?.nombre]);

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
    const locked = action === 'lock' ? true : record!.pre.firma?.locked;
    const next: ConformidadRecord = {
      ...record!,
      pre: { ...record!.pre, firma: { dataUrl, firmedAt: nowIso(), locked } },
    };
    if (action === 'finish') {
      finalize(next);
    } else {
      persist(next, true);
      if (action === 'draft') showToast({ type: 'success', message: 'Borrador guardado.' });
      if (action === 'lock') showToast({ type: 'success', message: 'Firma bloqueada.' });
    }
  }

  function onSignatureEmpty() {
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action === 'finish') {
      showToast({ type: 'error', message: 'Falta la firma del cliente para autorizar el inicio del servicio.' });
    } else if (action === 'draft') {
      persist({ ...record! }, true);
      showToast({ type: 'success', message: 'Borrador guardado.' });
    } else if (action === 'lock') {
      showToast({ type: 'error', message: 'Todavía no hay firma para bloquear.' });
    }
  }

  function toggleFirmaLocked() {
    if (record!.pre.firma?.locked) {
      persist({ ...record!, pre: { ...record!.pre, firma: { ...record!.pre.firma, locked: false } } }, true);
      return;
    }
    pendingAction.current = 'lock';
    sigRef.current?.capture();
  }

  async function finalize(base: ConformidadRecord) {
    const next: ConformidadRecord = { ...base, status: 'pendiente_post' };
    await dbPut({ ...next, updatedAt: nowIso() });
    clearStep(next.id, 'pre');
    router.replace('/');
    // Fire-and-forget: a failure just leaves it PENDING_SYNC for the retry
    // pass in index.tsx — must never block navigation back to the list.
    syncRecord(next, getIdToken);
  }

  function handleSaveDraft() {
    pendingAction.current = 'draft';
    sigRef.current?.capture();
  }

  async function blockingMessage(title: string, messages: string[]) {
    await confirm({ title, message: messages.map((m) => `• ${m}`).join('\n'), singleButton: true });
  }

  function goToStep(index: number) {
    setStepIndex(index);
    // Revisiting an earlier step re-locks the dots past it — otherwise
    // editing an earlier answer and jumping straight back via a dot would
    // skip the validation that answer is supposed to trigger.
    setFurthestIndex((f) => (index < f ? index : f));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    saveStep(record!.id, 'pre', index);
  }

  function advanceTo(index: number) {
    setStepIndex(index);
    setFurthestIndex((f) => Math.max(f, index));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    saveStep(record!.id, 'pre', index);
  }

  async function handleNext() {
    if (stepIndex === 0) {
      // El ticket de Odoo todavía no es obligatorio — la búsqueda/vínculo
      // con Odoo está en marcha, no bloquear el flujo por eso.
      const missingFields = STEP0_REQUIRED.filter(({ key }) => !String(record![key] ?? '').trim());
      if (missingFields.length) {
        await blockingMessage('Completá los datos del servicio', missingFields.map((f) => f.label));
        return;
      }
    }

    if (stepIndex === 1) {
      const missing = missingChecklistItems(record!.pre.checklist);
      if (missing.length) {
        setHighlightKeys(missing.map((it) => it.key));
        checklistRef.current?.scrollToItem(missing[0].key, scrollRef);
        await blockingMessage('Checklist incompleto', missing.map((it) => it.label));
        return;
      }
      setHighlightKeys([]);
    }

    if (stepIndex === 2) {
      const missingPhotos = missingSlotLabels(PRE_PHOTO_SLOTS, record!.pre.fotos);
      if (missingPhotos.length) {
        await blockingMessage('Faltan fotos obligatorias', missingPhotos);
        return;
      }
    }

    advanceTo(stepIndex + 1);
  }

  async function handleFinish() {
    const missingPhotos = missingSlotLabels(PRE_PHOTO_SLOTS, record!.pre.fotos);
    if (missingPhotos.length) {
      await blockingMessage('Faltan fotos obligatorias', missingPhotos);
      return;
    }

    const missing = missingChecklistItems(record!.pre.checklist);
    if (missing.length) {
      setHighlightKeys(missing.map((it) => it.key));
      await blockingMessage('Checklist incompleto', missing.map((it) => it.label));
      goToStep(1);
      return;
    }

    pendingAction.current = 'finish';
    sigRef.current?.capture();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} scrollEnabled={scrollEnabled}>
          <WizardProgress steps={STEPS} currentIndex={stepIndex} furthestIndex={furthestIndex} onSelect={goToStep} />

          {stepIndex === 0 && (
            <Card>
              <Field label="N° de hoja" value={record.numero} editable={false} />
              <Field label="Cliente *" value={record.cliente} onChangeText={(v) => set('cliente', v)} placeholder="Nombre del cliente" />
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Field label="Fecha *" value={record.fecha} onChangeText={(v) => set('fecha', v)} placeholder="YYYY-MM-DD" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Hora *" value={record.hora} onChangeText={(v) => set('hora', v)} placeholder="HH:mm" />
                </View>
              </View>
              <Field label="Matrícula *" value={record.matricula} onChangeText={(v) => set('matricula', v)} placeholder="Patente del vehículo" />
              <Field label="Instalador" value={record.instalador} editable={false} />
              <Field
                label="Responsable de empresa *"
                value={record.responsableEmpresa}
                onChangeText={(v) => set('responsableEmpresa', v)}
                placeholder="Responsable / contacto en la empresa cliente"
              />
              <TicketOdooPicker value={record.ticketOdoo} onChange={(ticketOdoo) => set('ticketOdoo', ticketOdoo)} />
            </Card>
          )}

          {stepIndex === 1 && (
            <Card>
              <ChecklistEditor
                ref={checklistRef}
                checklist={record.pre.checklist}
                onChange={setChecklistValue}
                highlightKeys={highlightKeys}
              />
            </Card>
          )}

          {stepIndex === 2 && (
            <Card>
              <SlotPhotoCapture
                slots={PRE_PHOTO_SLOTS}
                fotos={record.pre.fotos}
                onChange={(fotos) => persist({ ...record, pre: { ...record.pre, fotos } })}
              />
            </Card>
          )}

          {stepIndex === 3 && (
            <Card>
              <SectionTitle>Observaciones encontradas (PRE)</SectionTitle>
              <TextInput
                style={styles.textarea}
                multiline
                placeholder="Detalles que no estén dentro de los ítems anteriores..."
                placeholderTextColor="#b0a6a3"
                value={record.pre.observaciones}
                onChangeText={(v) => persist({ ...record, pre: { ...record.pre, observaciones: v } })}
              />
            </Card>
          )}

          {stepIndex === 4 && (
            <Card>
              <SectionTitle>Firma del cliente — autoriza inicio y estado de la unidad</SectionTitle>
              <View {...lockHandlers}>
                <SignaturePad
                  ref={sigRef}
                  existingDataUrl={record.pre.firma?.dataUrl}
                  onCapture={onSignatureCaptured}
                  onEmpty={onSignatureEmpty}
                  onClear={() => persist({ ...record, pre: { ...record.pre, firma: null } })}
                  disabled={record.pre.firma?.locked}
                />
              </View>
              <View style={styles.signatureActions}>
                {!record.pre.firma?.locked && (
                  <Button title="Limpiar firma" variant="ghost" onPress={() => sigRef.current?.clear()} />
                )}
                <Button
                  title={record.pre.firma?.locked ? 'Desbloquear firma' : 'Bloquear firma'}
                  variant="ghost"
                  onPress={toggleFirmaLocked}
                />
              </View>
              <View style={styles.btnRow}>
                <Button title="Guardar borrador" variant="secondary" block onPress={handleSaveDraft} />
              </View>
            </Card>
          )}

          <Text style={styles.helptext}>
            El borrador se guarda automáticamente en este celular aunque no tengas conexión a internet. Al
            finalizar, el servicio queda "Pendiente de POST" hasta que instales/repares el equipo y completes la
            segunda parte.
          </Text>
        </ScrollView>

        <View style={styles.navFooter}>
          <WizardNav
            showBack={stepIndex > 0}
            onBack={() => goToStep(stepIndex - 1)}
            onNext={stepIndex === LAST_STEP ? handleFinish : handleNext}
            nextLabel={stepIndex === LAST_STEP ? 'Finalizar PRE y continuar' : 'Siguiente'}
          />
        </View>
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
  content: { padding: 14, paddingBottom: 20 },
  navFooter: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row2: { flexDirection: 'row', gap: 10 },
  textarea: {
    borderWidth: 0,
    borderRadius: 10,
    padding: 11,
    fontSize: 15,
    minHeight: 70,
    textAlignVertical: 'top',
    backgroundColor: colors.bg,
    color: colors.text,
  },
  btnRow: { marginTop: 10 },
  signatureActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  helptext: { fontSize: 12, color: colors.muted, marginTop: 10, marginHorizontal: 4, lineHeight: 17 },
});
