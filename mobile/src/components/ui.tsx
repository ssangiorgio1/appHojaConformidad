import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, cardShadow } from '../theme';

export function TopbarBackButton({ onPress, color = '#fff' }: { onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.topbarBack}>
      <Ionicons name="arrow-back" size={22} color={color} />
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Field({
  label,
  ...inputProps
}: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.muted} {...inputProps} />
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  block,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  block?: boolean;
  disabled?: boolean;
}) {
  if (variant === 'primary') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [block && styles.btnBlock, disabled && styles.btnDisabled, pressed && !disabled && styles.btnPressed]}
      >
        <LinearGradient
          colors={[colors.accent, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btn}
        >
          <Text style={[styles.btnText, variantTextStyles.primary]}>{title}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        variantStyles[variant],
        block && styles.btnBlock,
        disabled && styles.btnDisabled,
        pressed && !disabled && styles.btnPressed,
      ]}
    >
      <Text style={[styles.btnText, variantTextStyles[variant]]}>{title}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone }: { label: string; tone: 'pre' | 'post' | 'done' | 'warn' }) {
  return (
    <View style={[styles.badge, badgeTone[tone]]}>
      <Text style={[styles.badgeText, badgeTextTone[tone]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: 16,
    marginBottom: 14,
    ...cardShadow,
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 13,
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  field: { width: '100%', marginBottom: 12 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: colors.muted, marginBottom: 4 },
  input: {
    borderWidth: 0,
    borderRadius: radius - 4,
    padding: 12,
    fontSize: 15,
    backgroundColor: colors.bg,
    color: colors.text,
  },
  btn: {
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: radius - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBlock: { width: '100%' },
  btnPressed: { opacity: 0.8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 15, fontWeight: '600' },
  topbarBack: { width: 30 },
  badge: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 20, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
});

const variantStyles: Record<ButtonVariant, object> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.bg },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  danger: { backgroundColor: colors.badBg },
  ghost: { backgroundColor: 'transparent' },
};

const variantTextStyles: Record<ButtonVariant, object> = {
  primary: { color: '#fff' },
  secondary: { color: colors.primaryDark },
  outline: { color: colors.primary },
  danger: { color: colors.bad },
  ghost: { color: colors.muted },
};

const badgeTone: Record<'pre' | 'post' | 'done' | 'warn', object> = {
  pre: { backgroundColor: '#fdf1de' },
  post: { backgroundColor: '#e2ecfb' },
  done: { backgroundColor: colors.okBg },
  warn: { backgroundColor: colors.badBg },
};

const badgeTextTone: Record<'pre' | 'post' | 'done' | 'warn', object> = {
  pre: { color: '#9a6400' },
  post: { color: '#1f4e8c' },
  done: { color: colors.ok },
  warn: { color: colors.bad },
};
