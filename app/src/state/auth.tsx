import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { sendTimezone } from '@/lib/push';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const auth = getFirebaseAuth();
      unsubscribe = onIdTokenChanged(auth, (next) => {
        setUser(next);
        setIsLoading(false);
        // Best-effort: report the device's timezone whenever a user
        // becomes authenticated, so the server picks the right hour
        // to send their renewal notification. Fires on app launch
        // (token persisted) and on sign-in. Silent failure.
        if (next) void sendTimezone();
      });
    } catch {
      setIsLoading(false);
    }
    return () => unsubscribe?.();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      },
      signUp: async (email, password) => {
        await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
      },
      // Google sign-in differs by platform:
      //   - Web: signInWithPopup opens an oauth popup, returns a credential.
      //   - Native: signInWithPopup isn't supported. Proper native flow needs
      //     OAuth client IDs registered in Google Cloud Console with the
      //     app's signing fingerprint, which isn't wired up yet. Throw a
      //     readable error so the UI can show 'use email/password instead'
      //     instead of the silent 'undefined is not a function'.
      signInWithGoogle: async () => {
        if (Platform.OS !== 'web') {
          throw Object.assign(new Error('Google sign-in is not yet available on the app.'), {
            code: 'auth/operation-not-supported-in-this-environment',
          });
        }
        await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
      },
      signOut: async () => {
        await firebaseSignOut(getFirebaseAuth());
      },
    }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
