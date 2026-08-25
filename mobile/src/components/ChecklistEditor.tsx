import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CHECKLIST_ITEMS, type Checklist, type ChecklistValue } from '@wara/shared';
import { colors } from '../theme';

export function ChecklistEditor({
  checklist,
  onChange,
}: {
  checklist: Checklist;
  onChange: (key: string, value: ChecklistValue) => void;
}) {
  let lastGroup: string | undefined;

  return (
    <View>
      {CHECKLIST_ITEMS.map((item) => {
        const showGroup = item.group && item.group !== lastGroup;
        if (item.group) lastGroup = item.group;
        const value = checklist[item.key];

        return (
          <View key={item.key} style={styles.item}>
            {showGroup ? <Text style={styles.groupTitle}>{item.group}</Text> : null}
            <Text style={styles.label}>{item.label}</Text>
            {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
            <View style={styles.toggleRow}>
              <Pressable
                onPress={() => onChange(item.key, value === 'SI' ? null : 'SI')}
                style={[styles.toggleBtn, value === 'SI' && styles.toggleSiActive]}
              >
                <Text style={[styles.toggleText, value === 'SI' && styles.toggleSiText]}>SÍ</Text>
              </Pressable>
              <Pressable
                onPress={() => onChange(item.key, value === 'NO' ? null : 'NO')}
                style={[styles.toggleBtn, value === 'NO' && styles.toggleNoActive]}
              >
                <Text style={[styles.toggleText, value === 'NO' && styles.toggleNoText]}>NO</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 11 },
  groupTitle: { fontSize: 12, fontWeight: '700', color: colors.primaryDark, marginBottom: 6 },
  label: { fontSize: 14, marginBottom: 8, lineHeight: 19, color: colors.text },
  note: { fontSize: 11.5, color: colors.muted, marginTop: -4, marginBottom: 8 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  toggleText: { fontWeight: '700', fontSize: 13.5, color: colors.muted },
  toggleSiActive: { backgroundColor: colors.okBg, borderColor: colors.ok },
  toggleSiText: { color: colors.ok },
  toggleNoActive: { backgroundColor: colors.badBg, borderColor: colors.bad },
  toggleNoText: { color: colors.bad },
});
