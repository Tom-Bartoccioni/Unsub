export type ColorSet = {
  bg: string;
  bgElevated: string;
  card: string;
  cardElevated: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  accentBlue: string;
  accentBlueLight: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  success: string;
  overlay: string;
  donutTrack: string;
};

export const darkColors: ColorSet = {
  bg: '#0a0a0a',
  bgElevated: '#141416',
  card: '#1c1c1e',
  cardElevated: '#2a2a2c',
  border: '#2a2a2c',
  borderStrong: '#3a3a3c',
  textPrimary: '#ffffff',
  textSecondary: '#a1a1aa',
  textTertiary: '#71717a',
  textMuted: '#52525b',
  accentBlue: '#3b82f6',
  accentBlueLight: '#60a5fa',
  danger: '#ef4444',
  dangerSoft: '#7f1d1d',
  warning: '#f59e0b',
  success: '#10b981',
  overlay: 'rgba(0,0,0,0.7)',
  donutTrack: '#2a2a2c',
};

export const lightColors: ColorSet = {
  bg: '#f5f5f7',
  bgElevated: '#ffffff',
  card: '#ffffff',
  cardElevated: '#f2f2f5',
  border: '#e5e5e7',
  borderStrong: '#d1d1d6',
  textPrimary: '#0a0a0a',
  textSecondary: '#3a3a3c',
  textTertiary: '#8e8e93',
  textMuted: '#aeaeb2',
  accentBlue: '#3b82f6',
  accentBlueLight: '#60a5fa',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  warning: '#d97706',
  success: '#059669',
  overlay: 'rgba(0,0,0,0.4)',
  donutTrack: '#e5e5e7',
};

export type ThemeName = 'light' | 'dark';
export const colorsByTheme: Record<ThemeName, ColorSet> = {
  light: lightColors,
  dark: darkColors,
};

// Category palette is intentionally the same across themes — it's the brand
// signal for each subscription category, not a UI surface.
// Category palette mirrors the Unsub logo's 5 arcs (blue / purple / green /
// yellow / red) so the dashboard donut visually carries the brand. Other
// stays neutral grey for the 6th bucket.
export const LOGO_COLORS = ['#3b82f6', '#a855f7', '#10b981', '#facc15', '#ef4444'] as const;

export const categoryColors: Record<string, string> = {
  Productivity: '#3b82f6',
  Cloud: '#a855f7',
  Wellness: '#10b981',
  News: '#facc15',
  Entertainment: '#ef4444',
  Other: '#6b7280',
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
} as const;
