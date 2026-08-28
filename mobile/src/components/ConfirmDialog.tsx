import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from './ui';
import { colors } from '../theme';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  // Hides the cancel button — for acknowledge-only messages (e.g. hard-block
  // validation errors) where there's no real choice to make.
  singleButton?: boolean;
};

type PendingConfirm = ConfirmOptions & { resolve: (value: boolean) => void };

type ConfirmContextValue = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  function close(result: boolean) {
    pending?.resolve(result);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal visible={!!pending} transparent animationType="fade" onRequestClose={() => close(false)}>
        <Pressable style={styles.backdrop} onPress={() => close(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.dialogWrap}>
            <Card>
              <Text style={styles.title}>{pending?.title}</Text>
              {pending?.message ? <Text style={styles.message}>{pending.message}</Text> : null}
              <View style={styles.actions}>
                {!pending?.singleButton && (
                  <Button title={pending?.cancelLabel ?? 'Cancelar'} variant="ghost" onPress={() => close(false)} />
                )}
                <Button
                  title={pending?.confirmLabel ?? (pending?.singleButton ? 'Entendido' : 'Confirmar')}
                  variant={pending?.destructive ? 'danger' : 'primary'}
                  onPress={() => close(true)}
                />
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialogWrap: { width: '100%', maxWidth: 420 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  message: { fontSize: 14, color: colors.muted, lineHeight: 19, marginBottom: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
