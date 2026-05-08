import { categoryColors } from '@/theme';

type ProviderInfo = { category: string; brandColor: string };

// Curated map: keyed by lowercased first token of provider name.
const PROVIDER_OVERRIDES: Record<string, ProviderInfo> = {
  netflix: { category: 'Entertainment', brandColor: '#E50914' },
  spotify: { category: 'Entertainment', brandColor: '#1DB954' },
  'disney+': { category: 'Entertainment', brandColor: '#0073E6' },
  disney: { category: 'Entertainment', brandColor: '#0073E6' },
  hulu: { category: 'Entertainment', brandColor: '#1CE783' },
  hbo: { category: 'Entertainment', brandColor: '#9D34DA' },
  max: { category: 'Entertainment', brandColor: '#9D34DA' },
  amazon: { category: 'Entertainment', brandColor: '#FF9900' },
  prime: { category: 'Entertainment', brandColor: '#FF9900' },
  youtube: { category: 'Entertainment', brandColor: '#FF0000' },
  twitch: { category: 'Entertainment', brandColor: '#9146FF' },
  paramount: { category: 'Entertainment', brandColor: '#0064FF' },
  apple: { category: 'Cloud', brandColor: '#A2AAAD' },
  'icloud+': { category: 'Cloud', brandColor: '#3B9CFF' },
  icloud: { category: 'Cloud', brandColor: '#3B9CFF' },
  google: { category: 'Cloud', brandColor: '#4285F4' },
  notion: { category: 'Productivity', brandColor: '#FFFFFF' },
  linear: { category: 'Productivity', brandColor: '#5E6AD2' },
  github: { category: 'Productivity', brandColor: '#FFFFFF' },
  gitlab: { category: 'Productivity', brandColor: '#FC6D26' },
  adobe: { category: 'Productivity', brandColor: '#FF0000' },
  chatgpt: { category: 'Productivity', brandColor: '#10A37F' },
  openai: { category: 'Productivity', brandColor: '#10A37F' },
  claude: { category: 'Productivity', brandColor: '#D97706' },
  vercel: { category: 'Productivity', brandColor: '#FFFFFF' },
  atlassian: { category: 'Productivity', brandColor: '#0052CC' },
  loom: { category: 'Productivity', brandColor: '#625DF5' },
  slack: { category: 'Productivity', brandColor: '#4A154B' },
  figma: { category: 'Productivity', brandColor: '#F24E1E' },
  microsoft: { category: 'Productivity', brandColor: '#00A4EF' },
  gym: { category: 'Wellness', brandColor: '#FF4F00' },
  fitness: { category: 'Wellness', brandColor: '#FF4F00' },
  peloton: { category: 'Wellness', brandColor: '#000000' },
  headspace: { category: 'Wellness', brandColor: '#F47D31' },
  patreon: { category: 'News', brandColor: '#FF424D' },
  economist: { category: 'News', brandColor: '#E3120B' },
  nyt: { category: 'News', brandColor: '#FFFFFF' },
  substack: { category: 'News', brandColor: '#FF6719' },
};

const FALLBACK: ProviderInfo = { category: 'Other', brandColor: '#6b7280' };

export function categoryFor(provider: string): ProviderInfo {
  const tokens = provider.toLowerCase().split(/\s+/);
  for (const t of tokens) {
    const hit = PROVIDER_OVERRIDES[t];
    if (hit) return hit;
  }
  return FALLBACK;
}

export function categoryColor(category: string): string {
  return categoryColors[category] ?? categoryColors.Other!;
}

export function brandInitial(provider: string): string {
  const trimmed = provider.trim();
  if (!trimmed) return '?';
  return trimmed[0]!.toUpperCase();
}
