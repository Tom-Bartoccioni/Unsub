import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colorsByTheme, type ColorSet, type ThemeName } from '@/theme';

export type Preferences = {
  theme: ThemeName;
  displayCurrency: string;
  notificationsEnabled: boolean;
};

const DEFAULTS: Preferences = {
  theme: 'light',
  displayCurrency: 'EUR',
  notificationsEnabled: false,
};

const STORAGE_KEY = 'unsub.preferences.v1';

// expo-secure-store doesn't work on web; fall back to localStorage there.
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        // ignore
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
};

type PreferencesContextValue = {
  prefs: Preferences;
  ready: boolean;
  setTheme: (next: ThemeName) => void;
  setDisplayCurrency: (next: string) => void;
  setNotificationsEnabled: (next: boolean) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    storage
      .get(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const parsed = JSON.parse(raw) as Partial<Preferences>;
          setPrefs((prev) => ({ ...prev, ...parsed }));
        } catch {
          // malformed value; ignore.
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: Preferences) => {
    setPrefs(next);
    void storage.set(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      prefs,
      ready,
      setTheme: (next) => persist({ ...prefs, theme: next }),
      setDisplayCurrency: (next) => persist({ ...prefs, displayCurrency: next.toUpperCase() }),
      setNotificationsEnabled: (next) => persist({ ...prefs, notificationsEnabled: next }),
    }),
    [prefs, ready, persist],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePrefs(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePrefs must be used inside <PreferencesProvider>');
  return ctx;
}

export function useTheme(): ColorSet {
  const { prefs } = usePrefs();
  return colorsByTheme[prefs.theme];
}
