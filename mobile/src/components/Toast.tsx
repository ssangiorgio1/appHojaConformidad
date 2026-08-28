import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../theme';

type ToastType = 'success' | 'error' | 'info';

type ToastOptions = {
  type?: ToastType;
  message: string;
  durationMs?: number;
};

type ToastContextValue = {
  showToast: (opts: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    ({ type = 'info', message, durationMs = 2600 }: ToastOptions) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast({ type, message });
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null));
      }, durationMs);
    },
    [opacity],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View pointerEvents="none" style={[styles.wrap, toneStyle[toast.type], { opacity }]}>
          <Text style={styles.text}>{toast.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    // High enough to clear the floating Atrás/Siguiente footer on the
    // pre/post wizards (and the home screen's FAB) on any device.
    bottom: 100,
    borderRadius: radius,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  text: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});

const toneStyle: Record<ToastType, object> = {
  success: { backgroundColor: colors.ok },
  error: { backgroundColor: colors.bad },
  info: { backgroundColor: colors.primaryDark },
};
