import * as ImageManipulator from 'expo-image-manipulator';

export function uuid(): string {
  return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function nowLocalDate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function nowLocalTime(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtDateTime(dateStr?: string, timeStr?: string): string {
  if (!dateStr) return '—';
  return dateStr + (timeStr ? ' ' + timeStr : '');
}

const MAX_DIM = 1100;

export async function resizeImageToDataUrl(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: MAX_DIM } }], {
    compress: 0.72,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  return `data:image/jpeg;base64,${result.base64}`;
}
