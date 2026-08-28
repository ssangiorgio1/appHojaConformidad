import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { Foto, PhotoSlotDef } from '@wara/shared';
import { colors, radius } from '../theme';
import { resizeImageToDataUrl, uuid } from '../utils/misc';
import { useToast } from './Toast';

export function slotsFilled(slots: PhotoSlotDef[], fotos: Foto[]): boolean {
  return slots.filter((s) => s.required).every((s) => fotos.some((f) => f.slotKey === s.key));
}

export function missingSlotLabels(slots: PhotoSlotDef[], fotos: Foto[]): string[] {
  return slots.filter((s) => s.required && !fotos.some((f) => f.slotKey === s.key)).map((s) => s.label);
}

export function SlotPhotoCapture({
  slots,
  fotos,
  onChange,
}: {
  slots: PhotoSlotDef[];
  fotos: Foto[];
  onChange: (fotos: Foto[]) => void;
}) {
  const [processingSlot, setProcessingSlot] = useState<string | null>(null);
  const { showToast } = useToast();

  async function ensureCameraPermission(): Promise<boolean> {
    const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
    if (status === 'granted') return true;

    showToast({
      type: 'error',
      message: canAskAgain
        ? 'WARA Conformidad necesita acceso a la cámara para continuar.'
        : 'Habilitá el acceso a la cámara para esta app desde Ajustes del celular.',
    });
    return false;
  }

  function replaceSlot(slotKey: string, foto: Foto) {
    onChange([...fotos.filter((f) => f.slotKey !== slotKey), foto]);
  }

  function removeSlot(slotKey: string) {
    onChange(fotos.filter((f) => f.slotKey !== slotKey));
  }

  async function captureFor(slot: PhotoSlotDef) {
    if (!(await ensureCameraPermission())) return;

    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images' as const], quality: 1 });
    if (result.canceled || !result.assets?.[0]) return;

    setProcessingSlot(slot.key);
    try {
      const dataUrl = await resizeImageToDataUrl(result.assets[0].uri);
      replaceSlot(slot.key, { id: uuid(), slotKey: slot.key, dataUrl });
    } catch {
      showToast({ type: 'error', message: 'No se pudo procesar el archivo.' });
    } finally {
      setProcessingSlot(null);
    }
  }

  return (
    <View>
      {slots.map((slot) => {
        const foto = fotos.find((f) => f.slotKey === slot.key);
        const processing = processingSlot === slot.key;

        return (
          <View key={slot.key} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.label}>{slot.label}</Text>
              <Text style={[styles.tag, slot.required ? styles.tagRequired : styles.tagOptional]}>
                {slot.required ? 'Obligatoria' : 'Opcional'}
              </Text>
            </View>

            {foto ? (
              <View style={styles.filled}>
                <Image source={{ uri: foto.dataUrl }} style={styles.thumb} />
                <View style={styles.filledActions}>
                  <Pressable onPress={() => captureFor(slot)}>
                    <Text style={styles.actionLink}>Reemplazar</Text>
                  </Pressable>
                  <Pressable onPress={() => removeSlot(slot.key)}>
                    <Text style={[styles.actionLink, styles.actionLinkDanger]}>Quitar</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.emptySlot} onPress={() => captureFor(slot)} disabled={processing}>
                {processing ? (
                  <ActivityIndicator color={colors.muted} />
                ) : (
                  <Text style={styles.emptySlotText}>＋ Tomar foto</Text>
                )}
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 11 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 14, color: colors.text, flex: 1, marginRight: 8 },
  tag: { fontSize: 10.5, fontWeight: '700', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 20 },
  tagRequired: { backgroundColor: colors.badBg, color: colors.bad },
  tagOptional: { backgroundColor: '#efe6e3', color: colors.muted },
  emptySlot: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius - 4,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fbf8f7',
  },
  emptySlotText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  filled: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#eee' },
  filledActions: { gap: 6 },
  actionLink: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  actionLinkDanger: { color: colors.bad },
});
