import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import {
  diffChecklists,
  missingChecklistItems,
  missingRequiredEquipoLabels,
  missingEquipoChecks,
  EQUIP_GROUPS,
  EQUIP_CHECK_FIELDS,
  POST_PHOTO_SLOTS,
  SATISFACCION_LABELS,
  type ChecklistValue,
  type ConformidadRecord,
  type Equipo,
  type SatisfaccionFirma,
} from '@wara/shared';
import { RequireAuth } from '../../src/auth/RequireAuth';
import { useAuth } from '../../src/auth/AuthContext';
import { dbGet, dbPut } from '../../src/db/database';
import { syncRecord } from '../../src/sync/sync';
import { ChecklistEditor, type ChecklistEditorHandle } from '../../src/components/ChecklistEditor';
import { SlotPhotoCapture, missingSlotLabels } from '../../src/components/SlotPhotoCapture';
import { SignaturePad, type SignaturePadHandle } from '../../src/components/SignaturePad';
import { Button, Card, Field, SectionTitle } from '../../src/components/ui';
import { WizardProgress, WizardNav, type WizardStepDef } from '../../src/components/Wizard';
import { useToast } from '../../src/components/Toast';
import { useConfirm } from '../../src/components/ConfirmDialog';
import { colors } from '../../src/theme';
import { nowIso } from '../../src/utils/misc';
import { useScrollLock } from '../../src/utils/useScrollLock';
import { getSavedStep, saveStep, clearStep } from '../../src/utils/wizardStep';

const STEPS: WizardStepDef[] = [
  { key: 'checklist', title: 'Revisión general del vehículo' },
  { key: 'equipo', title: 'Datos del equipamiento' },
  { key: 'control', title: 'Control de instalación' },
  { key: 'fotos', title: 'Fotos' },
  { key: 'observaciones', title: 'Observaciones' },
  { key: 'firma', title: 'Firma del cliente' },
];
const LAST_STEP = STEPS.length - 1;

const SATISFACCION_OPTIONS: SatisfaccionFirma[] = ['satisfecho', 'insatisfecho', 'no_firma_insatisfecho'];
const SATISFACCION_TONE: Record<SatisfaccionFirma, 'ok' | 'warn' | 'bad'> = {
  satisfecho: 'ok',
  insatisfecho: 'warn',
  no_firma_insatisfecho: 'bad',
};

export default function PostScreen() {
  return (
    <RequireAuth>
      <PostForm />
    </RequireAuth>
  );
}

function PostForm() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { getIdToken } = useAuth();
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
      setRecord(r);
      const saved = await getSavedStep(id, 'post');
      if (saved !== null && saved >= 0 && saved <= LAST_STEP) {
        setStepIndex(saved);
        setFurthestIndex(saved);
      }
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

  function setEquipoCheck(key: string, value: ChecklistValue) {
    persist({ ...record!, equipo: { ...record!.equipo, [key]: value } });
  }

  function setSatisfaccion(satisfaccion: SatisfaccionFirma) {
    persist({ ...record!, post: { ...record!.post, firma: { ...record!.post.firma, satisfaccion } } }, true);
  }

  function onSignatureCaptured(dataUrl: string) {
    const action = pendingAction.current;
    pendingAction.current = null;
    const locked = action === 'lock' ? true : record!.post.firma?.locked;
    const next: ConformidadRecord = {
      ...record!,
      post: { ...record!.post, firma: { dataUrl, firmedAt: nowIso(), locked, satisfaccion: record!.post.firma?.satisfaccion } },
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
      showToast({ type: 'error', message: 'Falta la firma del cliente para dar conformidad final.' });
    } else if (action === 'draft') {
      persist({ ...record! }, true);
      showToast({ type: 'success', message: 'Borrador guardado.' });
    } else if (action === 'lock') {
      showToast({ type: 'error', message: 'Todavía no hay firma para bloquear.' });
    }
  }

  function toggleFirmaLocked() {
    if (record!.post.firma?.locked) {
      persist({ ...record!, post: { ...record!.post, firma: { ...record!.post.firma, locked: false } } }, true);
      return;
    }
    pendingAction.current = 'lock';
    sigRef.current?.capture();
  }

  async function finalize(base: ConformidadRecord) {
    const next: ConformidadRecord = { ...base, status: 'completo' };
    await dbPut({ ...next, updatedAt: nowIso() });
    clearStep(next.id, 'post');
    router.replace(`/ver/${next.id}`);
    // Fire-and-forget: a failure just leaves it PENDING_SYNC for the retry
    // pass in index.tsx — must never block navigation to the summary screen.
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
    saveStep(record!.id, 'post', index);
  }

  function advanceTo(index: number) {
    setStepIndex(index);
    setFurthestIndex((f) => Math.max(f, index));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    saveStep(record!.id, 'post', index);
  }

  async function handleNext() {
    if (stepIndex === 0) {
      const missing = missingChecklistItems(record!.post.checklist);
      if (missing.length) {
        setHighlightKeys(missing.map((it) => it.key));
        checklistRef.current?.scrollToItem(missing[0].key, scrollRef);
        await blockingMessage('Checklist incompleto', missing.map((it) => it.label));
        return;
      }
      setHighlightKeys([]);

      const diffs = diffChecklists(record!.pre.checklist, record!.post.checklist);
      if (diffs.length) {
        const proceed = await confirm({
          title: 'Cambió respecto del PRE',
          message: diffs.map((d) => `• ${d.label}\n  PRE: ${d.preValue} → POST: ${d.postValue}`).join('\n\n'),
          confirmLabel: 'Continuar igual',
          cancelLabel: 'Revisar',
        });
        if (!proceed) return;
      }
    }

    if (stepIndex === 1) {
      const missingEquipo = missingRequiredEquipoLabels(record!.equipo);
      if (missingEquipo.length) {
        await blockingMessage('Faltan datos obligatorios', missingEquipo);
        return;
      }
    }

    if (stepIndex === 2) {
      const missingChecks = missingEquipoChecks(record!.equipo);
      if (missingChecks.length) {
        setHighlightKeys(missingChecks.map((f) => f.key));
        await blockingMessage('Control de instalación incompleto', missingChecks.map((f) => f.label));
        return;
      }
      setHighlightKeys([]);
    }

    if (stepIndex === 3) {
      const missingPhotos = missingSlotLabels(POST_PHOTO_SLOTS, record!.post.fotos);
      if (missingPhotos.length) {
        await blockingMessage('Faltan fotos obligatorias', missingPhotos);
        return;
      }
    }

    advanceTo(stepIndex + 1);
  }

  async function handleFinish() {
    const missingPhotos = missingSlotLabels(POST_PHOTO_SLOTS, record!.post.fotos);
    if (missingPhotos.length) {
      await blockingMessage('Faltan fotos obligatorias', missingPhotos);
      return;
    }

    const missingEquipo = missingRequiredEquipoLabels(record!.equipo);
    if (missingEquipo.length) {
      await blockingMessage('Faltan datos obligatorios', missingEquipo);
      goToStep(1);
      return;
    }

    const missingChecks = missingEquipoChecks(record!.equipo);
    if (missingChecks.length) {
      setHighlightKeys(missingChecks.map((f) => f.key));
      await blockingMessage('Control de instalación incompleto', missingChecks.map((f) => f.label));
      goToStep(2);
      return;
    }

    const missing = missingChecklistItems(record!.post.checklist);
    if (missing.length) {
      setHighlightKeys(missing.map((it) => it.key));
      await blockingMessage('Checklist incompleto', missing.map((it) => it.label));
      goToStep(0);
      return;
    }

    const diffs = diffChecklists(record!.pre.checklist, record!.post.checklist);
    if (diffs.length) {
      const proceed = await confirm({
        title: 'Cambió respecto del PRE',
        message: diffs.map((d) => `• ${d.label}\n  PRE: ${d.preValue} → POST: ${d.postValue}`).join('\n\n'),
        confirmLabel: 'Continuar igual',
        cancelLabel: 'Revisar',
      });
      if (!proceed) return;
    }

    const satisfaccion = record!.post.firma?.satisfaccion;
    if (!satisfaccion) {
      await blockingMessage('Falta indicar el resultado de la firma', [
        'Elegí si el cliente firma conforme, firma disconforme, o no firma por estar disconforme.',
      ]);
      goToStep(LAST_STEP);
      return;
    }

    if (satisfaccion === 'no_firma_insatisfecho') {
      // No signature is expected for this outcome — skip capture() entirely
      // so the empty-pad path (onSignatureEmpty) never gets a chance to
      // block finishing for a client who's refusing to sign.
      finalize({ ...record!, post: { ...record!.post, firma: { satisfaccion, firmedAt: nowIso() } } });
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
          <Text style={styles.topbarTitle}>Post-instalación</Text>
          <Text style={styles.topbarSub}>
            {record.cliente || 'Servicio'} · {record.matricula || ''}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} scrollEnabled={scrollEnabled}>
          <WizardProgress steps={STEPS} currentIndex={stepIndex} furthestIndex={furthestIndex} onSelect={goToStep} />

          {stepIndex === 0 && (
            <Card>
              <ChecklistEditor
                ref={checklistRef}
                checklist={record.post.checklist}
                onChange={setChecklistValue}
                highlightKeys={highlightKeys}
              />
            </Card>
          )}

          {stepIndex === 1 && (
            <Card>
              <Text style={styles.legend}>* Campo obligatorio</Text>
              {EQUIP_GROUPS.map((group) => (
                <View key={group.title}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  {group.fields.map((f) =>
                    'checkbox' in f && f.checkbox ? (
                      <Pressable
                        key={f.key}
                        style={styles.equipCheckRow}
                        onPress={() => setEquipoText(f.key, record.equipo[f.key as keyof Equipo] ? '' : 'Sí')}
                      >
                        <View style={[styles.checkbox, record.equipo[f.key as keyof Equipo] && styles.checkboxOn]}>
                          {record.equipo[f.key as keyof Equipo] ? <Text style={styles.checkboxMark}>✓</Text> : null}
                        </View>
                        <Text style={styles.equipCheckLabel}>{f.label}</Text>
                      </Pressable>
                    ) : (
                      <Field
                        key={f.key}
                        label={'required' in f && f.required ? `${f.label} *` : f.label}
                        value={(record.equipo[f.key as keyof Equipo] as string) ?? ''}
                        onChangeText={(v) => setEquipoText(f.key, v)}
                      />
                    ),
                  )}
                </View>
              ))}
            </Card>
          )}

          {stepIndex === 2 && (
            <Card>
              <Text style={styles.legend}>Obligatorio: respondé SÍ o NO en cada punto.</Text>
              {EQUIP_CHECK_FIELDS.map((f) => {
                const value = record.equipo[f.key as keyof Equipo] as ChecklistValue | undefined;
                const highlighted = highlightKeys.includes(f.key);
                return (
                  <View key={f.key} style={[styles.checkRow, highlighted && styles.itemHighlighted]}>
                    <Text style={styles.checkLabel}>{f.label}</Text>
                    <View style={styles.toggleRow}>
                      <Pressable
                        onPress={() => setEquipoCheck(f.key, value === 'SI' ? null : 'SI')}
                        style={[styles.toggleBtn, value === 'SI' && styles.toggleSiActive]}
                      >
                        <Text style={[styles.toggleText, value === 'SI' && styles.toggleSiText]}>SÍ</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setEquipoCheck(f.key, value === 'NO' ? null : 'NO')}
                        style={[styles.toggleBtn, value === 'NO' && styles.toggleNoActive]}
                      >
                        <Text style={[styles.toggleText, value === 'NO' && styles.toggleNoText]}>NO</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </Card>
          )}

          {stepIndex === 3 && (
            <Card>
              <SlotPhotoCapture
                slots={POST_PHOTO_SLOTS}
                fotos={record.post.fotos}
                onChange={(fotos) => persist({ ...record, post: { ...record.post, fotos } })}
              />
            </Card>
          )}

          {stepIndex === 4 && (
            <Card>
              <SectionTitle>Observaciones encontradas (POST)</SectionTitle>
              <TextInput
                style={styles.textarea}
                multiline
                placeholder="Detalles que no estén dentro de los ítems anteriores..."
                placeholderTextColor="#b0a6a3"
                value={record.post.observaciones}
                onChangeText={(v) => persist({ ...record, post: { ...record.post, observaciones: v } })}
              />
            </Card>
          )}

          {stepIndex === 5 && (
            <Card>
              <SectionTitle>Firma del cliente — conformidad final</SectionTitle>
              <Text style={styles.legend}>* Elegí un resultado</Text>
              <View style={styles.satisfaccionRow}>
                {SATISFACCION_OPTIONS.map((opt) => {
                  const active = record.post.firma?.satisfaccion === opt;
                  const tone = SATISFACCION_TONE[opt];
                  return (
                    <Pressable
                      key={opt}
                      style={[styles.satisfaccionBtn, active && satisfaccionActiveStyle[tone]]}
                      onPress={() => setSatisfaccion(opt)}
                    >
                      <Text style={[styles.satisfaccionText, active && satisfaccionActiveTextStyle[tone]]}>
                        {SATISFACCION_LABELS[opt]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {record.post.firma?.satisfaccion === 'no_firma_insatisfecho' ? (
                <Text style={styles.helptext}>
                  El cliente no va a firmar — se registra la disconformidad sin firma.
                </Text>
              ) : (
                <>
                  <View {...lockHandlers}>
                    <SignaturePad
                      ref={sigRef}
                      existingDataUrl={record.post.firma?.dataUrl}
                      onCapture={onSignatureCaptured}
                      onEmpty={onSignatureEmpty}
                      onClear={() =>
                        persist({
                          ...record,
                          post: { ...record.post, firma: { satisfaccion: record.post.firma?.satisfaccion } },
                        })
                      }
                      disabled={record.post.firma?.locked}
                    />
                  </View>
                  <View style={styles.signatureActions}>
                    {!record.post.firma?.locked && (
                      <Button title="Limpiar firma" variant="ghost" onPress={() => sigRef.current?.clear()} />
                    )}
                    <Button
                      title={record.post.firma?.locked ? 'Desbloquear firma' : 'Bloquear firma'}
                      variant="ghost"
                      onPress={toggleFirmaLocked}
                    />
                  </View>
                </>
              )}
              <View style={styles.btnRow}>
                <Button title="Guardar borrador" variant="secondary" block onPress={handleSaveDraft} />
              </View>
            </Card>
          )}
        </ScrollView>

        <View style={styles.navFooter}>
          <WizardNav
            showBack={stepIndex > 0}
            onBack={() => goToStep(stepIndex - 1)}
            onNext={stepIndex === LAST_STEP ? handleFinish : handleNext}
            nextLabel={stepIndex === LAST_STEP ? 'Finalizar servicio' : 'Siguiente'}
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
  legend: { fontSize: 11.5, color: colors.muted, marginBottom: 8 },
  groupTitle: { fontSize: 12, fontWeight: '700', color: colors.primaryDark, marginTop: 12, marginBottom: 2 },
  checkRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemHighlighted: { backgroundColor: colors.badBg, borderRadius: 10, paddingHorizontal: 8, marginHorizontal: -8 },
  checkLabel: { fontSize: 14, color: colors.text, marginBottom: 8, lineHeight: 19 },
  equipCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  equipCheckLabel: { fontSize: 14, color: colors.text, flex: 1 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 9,
    borderWidth: 0,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  toggleText: { fontWeight: '700', fontSize: 13.5, color: colors.muted },
  toggleSiActive: { backgroundColor: colors.okBg, borderColor: colors.ok },
  toggleSiText: { color: colors.ok },
  toggleNoActive: { backgroundColor: colors.badBg, borderColor: colors.bad },
  toggleNoText: { color: colors.bad },
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
  satisfaccionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  satisfaccionBtn: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  satisfaccionText: { fontWeight: '700', fontSize: 12.5, color: colors.muted, textAlign: 'center' },
});

const satisfaccionActiveStyle: Record<'ok' | 'warn' | 'bad', object> = {
  ok: { backgroundColor: colors.okBg },
  warn: { backgroundColor: colors.warnBg },
  bad: { backgroundColor: colors.badBg },
};

const satisfaccionActiveTextStyle: Record<'ok' | 'warn' | 'bad', object> = {
  ok: { color: colors.ok },
  warn: { color: colors.warn },
  bad: { color: colors.bad },
};
