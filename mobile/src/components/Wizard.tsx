import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './ui';
import { colors } from '../theme';

export interface WizardStepDef {
  key: string;
  title: string;
}

export function WizardProgress({
  steps,
  currentIndex,
  furthestIndex,
  onSelect,
}: {
  steps: WizardStepDef[];
  currentIndex: number;
  furthestIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>
        Paso {currentIndex + 1} de {steps.length} · {steps[currentIndex].title}
      </Text>
      <View style={styles.dots}>
        {steps.map((step, index) => {
          const reachable = index <= furthestIndex;
          const active = index === currentIndex;
          return (
            <Pressable
              key={step.key}
              disabled={!reachable}
              onPress={() => onSelect(index)}
              style={[styles.dot, active && styles.dotActive, !active && reachable && styles.dotReachable]}
            />
          );
        })}
      </View>
    </View>
  );
}

export function WizardNav({
  onBack,
  onNext,
  nextLabel,
  showBack,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  showBack: boolean;
}) {
  return (
    <View style={styles.navRow}>
      {showBack && <Button title="Atrás" variant="secondary" onPress={onBack} />}
      <View style={{ flex: 1 }}>
        <Button title={nextLabel} block onPress={onNext} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 6 },
  title: { fontSize: 12.5, fontWeight: '700', color: colors.primaryDark, marginBottom: 8 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.border },
  dotReachable: { backgroundColor: '#d8b9c0' },
  dotActive: { backgroundColor: colors.primary },
  navRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
});
