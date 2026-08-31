import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button } from './ui';
import { colors, radius } from '../theme';

// record.fecha/hora are plain "YYYY-MM-DD" / "HH:mm" strings — parsed into a
// Date only for the native picker UI, never stored as one.
function parseDate(fecha: string, hora: string): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, min] = hora.split(':').map(Number);
  const date = new Date();
  if (y && m && d) date.setFullYear(y, m - 1, d);
  if (!Number.isNaN(h) && !Number.isNaN(min)) date.setHours(h, min, 0, 0);
  return date;
}

function formatFecha(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatHora(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Display-only: record.fecha stays "YYYY-MM-DD" everywhere else (storage, sorting, sync).
function formatFechaDisplay(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return y && m && d ? `${d}/${m}/${y}` : fecha;
}

// Shared chrome for both fields: our own Modal owns open/close so only ever
// one picker is on screen and it always has an explicit way to dismiss —
// the bare native picker has neither on iOS (it's just an inline view) and
// two of them mounted at once is what caused the previous overlap.
function PickerModal({
  visible,
  title,
  value,
  mode,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  value: Date;
  mode: 'date' | 'time';
  onCancel: () => void;
  onConfirm: (date: Date) => void;
}) {
  const [draft, setDraft] = useState(value);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} onShow={() => setDraft(value)}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable hitSlop={10} onPress={onCancel}>
              <Text style={styles.sheetClose}>✕</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={draft}
            mode={mode}
            display="spinner"
            is24Hour
            themeVariant="light"
            style={styles.picker}
            onChange={(_, date) => date && setDraft(date)}
          />
          <View style={styles.sheetFooter}>
            <View style={{ flex: 1 }}>
              <Button title="Cancelar" variant="outline" onPress={onCancel} block />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Listo" onPress={() => onConfirm(draft)} block />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (fecha: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={value ? styles.value : styles.placeholder}>{value ? formatFechaDisplay(value) : 'DD/MM/AAAA'}</Text>
      </Pressable>
      <PickerModal
        visible={open}
        title="Elegí la fecha"
        mode="date"
        value={parseDate(value || formatFecha(new Date()), '00:00')}
        onCancel={() => setOpen(false)}
        onConfirm={(date) => {
          onChange(formatFecha(date));
          setOpen(false);
        }}
      />
    </View>
  );
}

export function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hora: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={value ? styles.value : styles.placeholder}>{value || 'HH:mm'}</Text>
      </Pressable>
      <PickerModal
        visible={open}
        title="Elegí la hora"
        mode="time"
        value={parseDate(formatFecha(new Date()), value || '00:00')}
        onCancel={() => setOpen(false)}
        onConfirm={(date) => {
          onChange(formatHora(date));
          setOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { width: '100%', marginBottom: 12 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: colors.muted, marginBottom: 4 },
  input: {
    borderRadius: radius - 4,
    padding: 12,
    backgroundColor: colors.bg,
  },
  value: { fontSize: 15, color: colors.text },
  placeholder: { fontSize: 15, color: colors.muted },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  sheetClose: { fontSize: 16, color: colors.muted, padding: 4 },
  picker: { alignSelf: 'center', ...(Platform.OS === 'ios' ? { height: 180 } : {}) },
  sheetFooter: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
