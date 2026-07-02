import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import { en } from './locales/en';
import { fr } from './locales/fr';
import { es } from './locales/es';
import { it } from './locales/it';

// Supported UI languages. `label` is the language's own endonym, shown in the
// settings picker (conventional and needs no translation).
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];
export const DEFAULT_LANGUAGE: LanguageCode = 'en';

const SUPPORTED = new Set<LanguageCode>(LANGUAGES.map((l) => l.code));

function isSupported(code: string): code is LanguageCode {
  return SUPPORTED.has(code as LanguageCode);
}

// The device's preferred language if it's one we support, else English. Used to
// pick a sensible default on first launch (before the user chooses in Settings).
export function deviceLanguage(): LanguageCode {
  try {
    for (const locale of getLocales()) {
      const code = locale.languageCode?.toLowerCase();
      if (code && isSupported(code)) return code;
    }
  } catch {
    // getLocales can throw in rare environments; fall back to English.
  }
  return DEFAULT_LANGUAGE;
}

export const i18n = new I18n(
  { en, fr, es, it },
  {
    defaultLocale: DEFAULT_LANGUAGE,
    enableFallback: true, // fall back to English for any missing key
  },
);

// Set the active locale. Call this whenever the language pref changes.
export function setLanguage(code: LanguageCode): void {
  i18n.locale = code;
}

// A BCP-47 locale tag for Intl date/number formatting, derived from the active
// app language — so dates/numbers follow the chosen language, not the device.
export function localeTag(code: LanguageCode = i18n.locale as LanguageCode): string {
  switch (code) {
    case 'fr':
      return 'fr-FR';
    case 'es':
      return 'es-ES';
    case 'it':
      return 'it-IT';
    default:
      return 'en-US';
  }
}

// Translate. Thin wrapper over i18n.t so callers import from one place.
export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}
