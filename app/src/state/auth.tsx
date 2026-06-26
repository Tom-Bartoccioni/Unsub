import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { nativeGoogleSignIn } from '@/lib/googleSignin';
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
      //   - Native: signInWithPopup can't open a popup. The native Google
      //     account picker returns an id token, which we exchange for a
      //     Firebase credential via signInWithCredential. A dismissed picker
      //     yields null — treat it as a silent no-op, not an error.
      signInWithGoogle: async () => {
        if (Platform.OS === 'web') {
          await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
          return;
        }
        const idToken = await nativeGoogleSignIn();
        if (!idToken) return;
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(getFirebaseAuth(), credential);
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
