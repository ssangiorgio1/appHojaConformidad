import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import type { Foto } from '@wara/shared';
import { resizeImageToDataUrl, uuid } from './misc';

const MARKER_KEY = 'wara.pendingCapture.v1';

export type CaptureScreen = 'pre' | 'post';
type CaptureMarker = { recordId: string; screen: CaptureScreen; slotKey: string };

// Populated by recoverPendingCapture, consumed by the matching screen via takeRecoveredFoto.
let recoveredFoto: (CaptureMarker & { foto: Foto }) | null = null;

export async function markCaptureStarted(marker: CaptureMarker): Promise<void> {
  await AsyncStorage.setItem(MARKER_KEY, JSON.stringify(marker));
}

export async function markCaptureFinished(): Promise<void> {
  await AsyncStorage.removeItem(MARKER_KEY);
}

/**
 * Android sometimes kills the app's MainActivity to reclaim memory while the system
 * camera is in the foreground; without this, the photo the user just took is silently
 * lost and the app reopens on the record list. Call once on app startup: if a capture
 * was interrupted, recovers the photo and returns where to navigate so the matching
 * screen (via takeRecoveredFoto) can drop it into the right slot.
 * See https://docs.expo.dev/versions/latest/sdk/imagepicker/#imagepickergetpendingresultasync
 */
export async function recoverPendingCapture(): Promise<{ recordId: string; screen: CaptureScreen } | null> {
  const raw = await AsyncStorage.getItem(MARKER_KEY);
  if (!raw) return null;
  const marker = JSON.parse(raw) as CaptureMarker;
  await markCaptureFinished();

  const result = await ImagePicker.getPendingResultAsync();
  const asset = result && 'assets' in result && !result.canceled ? result.assets?.[0] : null;
  if (!asset?.uri) return null;

  const dataUrl = await resizeImageToDataUrl(asset.uri);
  recoveredFoto = { ...marker, foto: { id: uuid(), slotKey: marker.slotKey, dataUrl } };
  return { recordId: marker.recordId, screen: marker.screen };
}

export function takeRecoveredFoto(recordId: string, screen: CaptureScreen): Foto | null {
  if (recoveredFoto && recoveredFoto.recordId === recordId && recoveredFoto.screen === screen) {
    const foto = recoveredFoto.foto;
    recoveredFoto = null;
    return foto;
  }
  return null;
}
