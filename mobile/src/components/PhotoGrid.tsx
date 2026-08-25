import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { Foto } from '@wara/shared';
import { colors, radius } from '../theme';
import { resizeImageToDataUrl, uuid } from '../utils/misc';

export function PhotoGrid({ fotos, onChange }: { fotos: Foto[]; onChange: (fotos: Foto[]) => void }) {
  const [processing, setProcessing] = useState(false);

  async function addFrom(pick: () => Promise<ImagePicker.ImagePickerResult>) {
    const result = await pick();
    if (result.canceled || !result.assets?.[0]) return;

    setProcessing(true);
    try {
      const dataUrl = await resizeImageToDataUrl(result.assets[0].uri);
      onChange([...fotos, { id: uuid(), dataUrl }]);
    } catch {
      Alert.alert('Error', 'No se pudo procesar la foto.');
    } finally {
      setProcessing(false);
    }
  }

  function handleAdd() {
    Alert.alert('Agregar foto', undefined, [
      { text: 'Tomar foto', onPress: () => addFrom(() => ImagePicker.launchCameraAsync({ quality: 1 })) },
      {
        text: 'Elegir de galería',
        onPress: () => addFrom(() => ImagePicker.launchImageLibraryAsync({ quality: 1 })),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function remove(id: string) {
    onChange(fotos.filter((f) => f.id !== id));
  }

  return (
    <View style={styles.grid}>
      {fotos.map((f) => (
        <View key={f.id} style={styles.thumb}>
          <Image source={{ uri: f.dataUrl ?? f.url }} style={styles.img} />
          <Pressable style={styles.del} onPress={() => remove(f.id)}>
            <Text style={styles.delText}>×</Text>
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.add} onPress={handleAdd} disabled={processing}>
        {processing ? (
          <ActivityIndicator color={colors.muted} />
        ) : (
          <>
            <Text style={styles.addIcon}>＋</Text>
            <Text style={styles.addText}>Agregar foto</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  thumb: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  img: { width: '100%', height: '100%' },
  del: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 11,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delText: { color: '#fff', fontSize: 14, lineHeight: 16 },
  add: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fbf8f7',
    gap: 4,
  },
  addIcon: { fontSize: 20, color: colors.muted },
  addText: { fontSize: 11, color: colors.muted, textAlign: 'center' },
});
