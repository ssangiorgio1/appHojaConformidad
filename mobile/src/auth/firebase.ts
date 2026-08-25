import { initializeApp, getApps, getApp } from 'firebase/app';
// `firebase/auth`'s exports map has no "react-native" condition for this SDK
// version, so it always resolves to the web build. Importing straight from
// `@firebase/auth` picks up its dedicated react-native build instead, which
// is where `getReactNativePersistence` actually lives.
import { initializeAuth, getAuth, getReactNativePersistence, type Auth } from '@firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Fast Refresh re-runs this module without resetting the native Auth instance.
  auth = getAuth(app);
}

export { app, auth };
