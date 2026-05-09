import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
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

// Preferences are non-sensitive (theme name, currency code, a boolean).
// Keep storage simple: localStorage on web, in-memory on native (until we
// add AsyncStorage later — secure-store would be overkill for these).
const storage = {
  get(key: string): string | null {
    try {
      return (globalThis as { localStorage?: Storage }).localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      (globalThis as { localStorage?: Storage }).localStorage?.setItem(key, value);
    } catch {
      // ignore
    }
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
    const raw = storage.get(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<Preferences>;
        setPrefs((prev) => ({ ...prev, ...parsed }));
      } catch {
        // malformed value; ignore.
      }
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: Preferences) => {
    setPrefs(next);
    storage.set(STORAGE_KEY, JSON.stringify(next));
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
