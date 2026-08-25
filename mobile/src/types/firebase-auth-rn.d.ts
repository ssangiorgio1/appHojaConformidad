// `@firebase/auth`'s package.json "exports" map has a top-level "types" entry
// that takes precedence over the platform-specific ("react-native") branch for
// TYPE resolution, even though the "react-native" condition is correctly used
// for the actual runtime JS by Metro. That means `getReactNativePersistence`
// (which only exists in the react-native build's types) is invisible to tsc.
// This augmentation re-declares it so type-checking matches what actually runs.
import type { Persistence, ReactNativeAsyncStorage } from '@firebase/auth';

declare module '@firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
