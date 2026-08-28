import { forwardRef, useImperativeHandle, useRef } from 'react';
import { findNodeHandle, Pressable, StyleSheet, Text, View, type ScrollView } from 'react-native';
import { CHECKLIST_ITEMS, type Checklist, type ChecklistValue } from '@wara/shared';
import { colors } from '../theme';

export interface ChecklistEditorHandle {
  scrollToItem: (key: string, scrollViewRef: React.RefObject<ScrollView | null>, offset?: number) => void;
}

export const ChecklistEditor = forwardRef<
  ChecklistEditorHandle,
  {
    checklist: Checklist;
    onChange: (key: string, value: ChecklistValue) => void;
    highlightKeys?: string[];
  }
>(function ChecklistEditor({ checklist, onChange, highlightKeys }, ref) {
  const itemRefs = useRef<Map<string, View>>(new Map());
  let lastGroup: string | undefined;

  useImperativeHandle(ref, () => ({
    scrollToItem(key, scrollViewRef, offset = 12) {
      const itemNode = itemRefs.current.get(key);
      const scrollNode = scrollViewRef.current;
      if (!itemNode || !scrollNode) return;
      const scrollHandle = findNodeHandle(scrollNode);
      if (!scrollHandle) return;
      itemNode.measureLayout(
        scrollHandle,
        (_x: number, y: number) => scrollNode.scrollTo({ y: Math.max(y - offset, 0), animated: true }),
        () => {},
      );
    },
  }));

  return (
    <View>
      {CHECKLIST_ITEMS.map((item) => {
        const showGroup = item.group && item.group !== lastGroup;
        if (item.group) lastGroup = item.group;
        const value = checklist[item.key];
        const highlighted = highlightKeys?.includes(item.key);

        return (
          <View
            key={item.key}
            ref={(node) => {
              if (node) itemRefs.current.set(item.key, node);
              else itemRefs.current.delete(item.key);
            }}
            style={[styles.item, highlighted && styles.itemHighlighted]}
          >
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
});

const styles = StyleSheet.create({
  item: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 11 },
  itemHighlighted: { backgroundColor: colors.badBg, borderRadius: 10, paddingHorizontal: 8, marginHorizontal: -8 },
  groupTitle: { fontSize: 12, fontWeight: '700', color: colors.primaryDark, marginBottom: 6 },
  label: { fontSize: 14, marginBottom: 8, lineHeight: 19, color: colors.text },
  note: { fontSize: 11.5, color: colors.muted, marginTop: -4, marginBottom: 8 },
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
});
