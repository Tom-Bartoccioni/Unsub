import { categoryColors } from '@/theme';

type ProviderInfo = { category: string; brandColor: string; domain?: string };

// Curated map: keyed by lowercased first token of provider name.
// `domain` is the canonical brand domain used to fetch a logo from
// Clearbit / Logo.dev. If absent we fall back to `<token>.com`, which
// resolves for almost every consumer brand we care about.
const PROVIDER_OVERRIDES: Record<string, ProviderInfo> = {
  netflix: { category: 'Entertainment', brandColor: '#E50914', domain: 'netflix.com' },
  spotify: { category: 'Entertainment', brandColor: '#1DB954', domain: 'spotify.com' },
  'disney+': { category: 'Entertainment', brandColor: '#0073E6', domain: 'disneyplus.com' },
  disney: { category: 'Entertainment', brandColor: '#0073E6', domain: 'disneyplus.com' },
  hulu: { category: 'Entertainment', brandColor: '#1CE783', domain: 'hulu.com' },
  hbo: { category: 'Entertainment', brandColor: '#9D34DA', domain: 'max.com' },
  max: { category: 'Entertainment', brandColor: '#9D34DA', domain: 'max.com' },
  amazon: { category: 'Entertainment', brandColor: '#FF9900', domain: 'primevideo.com' },
  prime: { category: 'Entertainment', brandColor: '#FF9900', domain: 'primevideo.com' },
  youtube: { category: 'Entertainment', brandColor: '#FF0000', domain: 'youtube.com' },
  twitch: { category: 'Entertainment', brandColor: '#9146FF', domain: 'twitch.tv' },
  paramount: { category: 'Entertainment', brandColor: '#0064FF', domain: 'paramountplus.com' },
  apple: { category: 'Cloud', brandColor: '#A2AAAD', domain: 'apple.com' },
  'icloud+': { category: 'Cloud', brandColor: '#3B9CFF', domain: 'icloud.com' },
  icloud: { category: 'Cloud', brandColor: '#3B9CFF', domain: 'icloud.com' },
  google: { category: 'Cloud', brandColor: '#4285F4', domain: 'google.com' },
  notion: { category: 'Productivity', brandColor: '#FFFFFF', domain: 'notion.so' },
  linear: { category: 'Productivity', brandColor: '#5E6AD2', domain: 'linear.app' },
  github: { category: 'Productivity', brandColor: '#FFFFFF', domain: 'github.com' },
  gitlab: { category: 'Productivity', brandColor: '#FC6D26', domain: 'gitlab.com' },
  adobe: { category: 'Productivity', brandColor: '#FF0000', domain: 'adobe.com' },
  chatgpt: { category: 'Productivity', brandColor: '#10A37F', domain: 'openai.com' },
  openai: { category: 'Productivity', brandColor: '#10A37F', domain: 'openai.com' },
  claude: { category: 'Productivity', brandColor: '#D97706', domain: 'anthropic.com' },
  vercel: { category: 'Productivity', brandColor: '#FFFFFF', domain: 'vercel.com' },
  atlassian: { category: 'Productivity', brandColor: '#0052CC', domain: 'atlassian.com' },
  loom: { category: 'Productivity', brandColor: '#625DF5', domain: 'loom.com' },
  slack: { category: 'Productivity', brandColor: '#4A154B', domain: 'slack.com' },
  figma: { category: 'Productivity', brandColor: '#F24E1E', domain: 'figma.com' },
  microsoft: { category: 'Productivity', brandColor: '#00A4EF', domain: 'microsoft.com' },
  dropbox: { category: 'Cloud', brandColor: '#0061FF', domain: 'dropbox.com' },
  '1password': { category: 'Security', brandColor: '#0572EC', domain: '1password.com' },
  bitwarden: { category: 'Security', brandColor: '#175DDC', domain: 'bitwarden.com' },
  nordvpn: { category: 'Security', brandColor: '#4687FF', domain: 'nordvpn.com' },
  protonmail: { category: 'Security', brandColor: '#6D4AFF', domain: 'proton.me' },
  proton: { category: 'Security', brandColor: '#6D4AFF', domain: 'proton.me' },
  audible: { category: 'News', brandColor: '#F8991C', domain: 'audible.com' },
  gym: { category: 'Wellness', brandColor: '#FF4F00' },
  fitness: { category: 'Wellness', brandColor: '#FF4F00' },
  peloton: { category: 'Wellness', brandColor: '#000000', domain: 'onepeloton.com' },
  headspace: { category: 'Wellness', brandColor: '#F47D31', domain: 'headspace.com' },
  calm: { category: 'Wellness', brandColor: '#2D7DD2', domain: 'calm.com' },
  patreon: { category: 'News', brandColor: '#FF424D', domain: 'patreon.com' },
  economist: { category: 'News', brandColor: '#E3120B', domain: 'economist.com' },
  nyt: { category: 'News', brandColor: '#FFFFFF', domain: 'nytimes.com' },
  substack: { category: 'News', brandColor: '#FF6719', domain: 'substack.com' },
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

// Best-effort brand domain for the logo CDN. Returns `null` if the
// provider name is too short / empty to guess from.
export function domainFor(provider: string): string | null {
  const info = categoryFor(provider);
  if (info.domain) return info.domain;
  const firstToken = provider.trim().toLowerCase().split(/\s+/)[0];
  if (!firstToken) return null;
  // Strip trailing punctuation ("disney+" → "disney") so the heuristic
  // domain stays valid.
  const cleaned = firstToken.replace(/[^a-z0-9-]/g, '');
  if (cleaned.length < 2) return null;
  return `${cleaned}.com`;
}

export function categoryColor(category: string): string {
  return categoryColors[category] ?? categoryColors.Other!;
}

export function brandInitial(provider: string): string {
  const trimmed = provider.trim();
  if (!trimmed) return '?';
  return trimmed[0]!.toUpperCase();
}
