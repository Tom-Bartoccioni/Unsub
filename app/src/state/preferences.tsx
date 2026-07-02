import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorsByTheme, type ColorSet, type ThemeName } from '@/theme';
import {
  DEFAULT_LANGUAGE,
  deviceLanguage,
  setLanguage as applyLanguage,
  t as translate,
  type LanguageCode,
} from '@/lib/i18n';

export type Preferences = {
  theme: ThemeName;
  displayCurrency: string;
  notificationsEnabled: boolean;
  language: LanguageCode;
};

const DEFAULTS: Preferences = {
  // Dark by default. Users who picked a theme in settings keep their choice
  // (the persisted value overrides this default on load).
  theme: 'dark',
  displayCurrency: 'EUR',
  // Notifications opt-out by default: on unless the user turns them off (or the
  // OS permission is denied at first-login, which flips this back to false).
  notificationsEnabled: true,
  // Default to the device language if it's one we support, else English. A
  // persisted choice overrides this on load.
  language: DEFAULT_LANGUAGE,
};

const STORAGE_KEY = 'unsub.preferences.v1';

// Preferences are non-sensitive (theme name, currency code, a boolean).
// AsyncStorage works on both web and native, so a user's choices (incl.
// turning notifications off) survive app restarts instead of resetting to the
// defaults on every native launch.
const storage = {
  async get(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
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
  setLanguage: (next: LanguageCode) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    storage.get(STORAGE_KEY).then((raw) => {
      if (cancelled) return;
      // Start from the device language, then let any persisted choice win.
      let resolved: Preferences = { ...DEFAULTS, language: deviceLanguage() };
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<Preferences>;
          resolved = { ...resolved, ...parsed };
        } catch {
          // malformed value; ignore.
        }
      }
      applyLanguage(resolved.language);
      setPrefs(resolved);
      setReady(true);
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
      setLanguage: (next) => {
        applyLanguage(next);
        persist({ ...prefs, language: next });
      },
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

// Translation hook. Reading prefs.language creates the reactive dependency, so
// every component using useT() re-renders when the language changes. Returns a
// `t` bound to the active locale plus the current language code (handy for
// locale-aware date/number formatting via localeTag).
export function useT(): { t: typeof translate; language: LanguageCode } {
  const { prefs } = usePrefs();
  return { t: translate, language: prefs.language };
}
