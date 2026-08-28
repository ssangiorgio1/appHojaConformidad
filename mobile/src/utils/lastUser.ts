import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'wara:lastUid';

// Tracks which Firebase uid last completed a successful login on this
// device — used to tell "same técnico signing back in" (keep local data)
// apart from "a different técnico on a shared device" (safe to clear).
export async function getLastUid(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export function setLastUid(uid: string): void {
  AsyncStorage.setItem(KEY, uid).catch(() => {});
}
