import { Platform } from 'react-native';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  // Firebase v11 split the RN persistence export into a deep import
  // path. The type isn't exported either, so we type the import loosely.
  // @ts-expect-error — getReactNativePersistence is exported but not typed.
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  if (!firebaseConfig.apiKey) {
    throw new Error(
      'Firebase config missing. Set EXPO_PUBLIC_FIREBASE_* in app/.env (see app/.env.example).',
    );
  }
  app = getApps()[0] ?? initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  // On native, the default getAuth() relies on IndexedDB/localStorage which
  // don't exist — that surfaces as auth/network-request-failed once the
  // partially-initialized auth hits the network. Use initializeAuth with
  // AsyncStorage-backed persistence on native; getAuth on web.
  if (Platform.OS === 'web') {
    auth = getAuth(getFirebaseApp());
  } else {
    auth = initializeAuth(getFirebaseApp(), {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
  return auth;
}
