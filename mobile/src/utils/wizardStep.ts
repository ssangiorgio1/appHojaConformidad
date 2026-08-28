import AsyncStorage from '@react-native-async-storage/async-storage';

type Phase = 'pre' | 'post';

function storageKey(recordId: string, phase: Phase) {
  return `wara:wizardStep:${phase}:${recordId}`;
}

// Lets the pre/post wizards resume where the técnico left off instead of
// always restarting at step 1 — pure UX state, never sent to the API.
export async function getSavedStep(recordId: string, phase: Phase): Promise<number | null> {
  const raw = await AsyncStorage.getItem(storageKey(recordId, phase));
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function saveStep(recordId: string, phase: Phase, index: number): void {
  AsyncStorage.setItem(storageKey(recordId, phase), String(index)).catch(() => {});
}

export function clearStep(recordId: string, phase: Phase): void {
  AsyncStorage.removeItem(storageKey(recordId, phase)).catch(() => {});
}
