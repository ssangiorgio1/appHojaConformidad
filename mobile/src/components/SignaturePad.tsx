import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas';
import { colors, radius } from '../theme';

export interface SignaturePadHandle {
  capture: () => void;
  clear: () => void;
}

export const SignaturePad = forwardRef<
  SignaturePadHandle,
  {
    existingDataUrl?: string | null;
    onCapture: (dataUrl: string) => void;
    onEmpty?: () => void;
    onClear?: () => void;
  }
>(function SignaturePad({ existingDataUrl, onCapture, onEmpty, onClear }, ref) {
  const inner = useRef<SignatureViewRef>(null);

  useImperativeHandle(ref, () => ({
    capture: () => inner.current?.readSignature(),
    clear: () => {
      inner.current?.clearSignature();
      onClear?.();
    },
  }));

  return (
    <View style={styles.wrap}>
      <SignatureScreen
        ref={inner}
        onOK={onCapture}
        onEmpty={() => onEmpty?.()}
        autoClear={false}
        dataURL={existingDataUrl ?? undefined}
        webStyle={webStyle}
        descriptionText=""
      />
      {!existingDataUrl && (
        <Text pointerEvents="none" style={styles.hint}>
          Firmá acá con el dedo
        </Text>
      )}
    </View>
  );
});

const webStyle = `
  .m-signature-pad--footer { display: none; margin: 0; }
  .m-signature-pad { box-shadow: none; border: none; margin: 0; height: 100%; }
  .m-signature-pad--body { border: none; }
  body,html { background-color: #fff; }
`;

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius - 4,
    backgroundColor: '#fff',
    height: 190,
    overflow: 'hidden',
  },
  hint: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#c9c0bd',
    fontSize: 13,
  },
});
