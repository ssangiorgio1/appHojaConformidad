import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

let cached: string | null | undefined;

export async function getLogoDataUri(): Promise<string | undefined> {
  if (cached !== undefined) return cached ?? undefined;
  try {
    const asset = Asset.fromModule(require('../../assets/logo-wara.png'));
    await asset.downloadAsync();
    if (!asset.localUri) {
      cached = null;
      return undefined;
    }
    const base64 = await new File(asset.localUri).base64();
    cached = `data:image/png;base64,${base64}`;
  } catch {
    cached = null;
  }
  return cached ?? undefined;
}
