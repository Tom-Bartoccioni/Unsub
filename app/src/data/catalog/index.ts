// Aggregated vendor catalog. Merges every per-category lot into one
// deduplicated, category-normalized list plus lookup/search helpers used by
// the add-subscription wizard.
//
// This bundled catalog is the OFFLINE FALLBACK. At runtime the app refreshes
// it from the API (see lib/catalog.ts); the cancel* fields are additionally
// kept fresh by a backend cron syncing justdeleteme.

import type { CatalogPlan, CatalogService } from './types';
import { defaultPlan } from './types';
import { VIDEO_STREAMING } from './video';
import { MUSIC_AUDIO } from './music';
import { PRODUCTIVITY } from './productivity';
import { CLOUD_SECURITY } from './cloud-security';
import { NEWS_READING } from './news';
import { WELLNESS } from './wellness';
import { GAMING } from './gaming';
import { MISC } from './misc';

export type { CatalogService, CatalogPlan, CancelDifficulty } from './types';
export { defaultPlan } from './types';

// The donut only renders these six categories (see theme.categoryColors).
// The research lots used finer buckets (Music, Gaming, Security) that the
// dashboard doesn't know — collapse them so every service lands in a colored
// slice instead of the grey "Other" catch-all:
//   Music, Gaming -> Entertainment   (both are leisure spend)
//   Security      -> Cloud           (VPN/password managers sit with storage)
const CATEGORY_ALIASES: Record<string, string> = {
  Music: 'Entertainment',
  Gaming: 'Entertainment',
  Security: 'Cloud',
};

function normalizeCategory(category: string): string {
  return CATEGORY_ALIASES[category] ?? category;
}

// Import order sets dedup precedence: when the same `id` appears in two lots,
// the FIRST occurrence wins. Ordered so the most category-appropriate lot owns
// each shared id (e.g. audible/kobo-plus belong to reading, not music; patreon
// to misc). Twitch is deduped by id too — the video lot's 'twitch' wins over
// gaming's 'twitch-turbo' via the explicit alias merge below.
const LOTS: CatalogService[][] = [
  VIDEO_STREAMING,
  PRODUCTIVITY,
  CLOUD_SECURITY,
  NEWS_READING, // owns audible, kobo-plus
  MISC, // owns patreon
  WELLNESS,
  GAMING,
  MUSIC_AUDIO,
];

function buildCatalog(): CatalogService[] {
  const byId = new Map<string, CatalogService>();
  const dropped: string[] = [];
  for (const lot of LOTS) {
    for (const svc of lot) {
      if (byId.has(svc.id)) {
        dropped.push(svc.id);
        continue;
      }
      byId.set(svc.id, { ...svc, category: normalizeCategory(svc.category) });
    }
  }
  if (__DEV__ && dropped.length) {
    // Surface accidental id collisions during development; harmless in prod.
    // eslint-disable-next-line no-console
    console.warn(`[catalog] dropped ${dropped.length} duplicate ids:`, dropped.join(', '));
  }
  return Array.from(byId.values());
}

export const CATALOG: CatalogService[] = buildCatalog();

// Fast id lookup.
const BY_ID = new Map(CATALOG.map((s) => [s.id, s]));

export function catalogById(id: string): CatalogService | undefined {
  return BY_ID.get(id);
}

// Normalize a string for search/match: lowercase, strip accents and
// non-alphanumerics so "Disney+", "disney plus" and "DISNEY" all collide.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // strip combining accents (é -> e)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Precomputed haystack per service: normalized name + aliases + id.
type Indexed = { svc: CatalogService; hay: string; nName: string };
const INDEX: Indexed[] = CATALOG.map((svc) => ({
  svc,
  nName: norm(svc.name),
  hay: [svc.name, svc.id, ...(svc.aliases ?? [])].map(norm).join(' '),
}));

// Wizard search. Ranks exact/prefix name matches above substring/alias hits so
// typing "net" surfaces Netflix at the top. Returns up to `limit` services.
export function searchCatalog(query: string, limit = 30): CatalogService[] {
  const q = norm(query);
  if (!q) return CATALOG.slice(0, limit);
  const scored: { svc: CatalogService; score: number }[] = [];
  for (const { svc, hay, nName } of INDEX) {
    let score = 0;
    if (nName === q) score = 100;
    else if (nName.startsWith(q)) score = 80;
    else if (hay.includes(` ${q}`) || hay.startsWith(q)) score = 60; // word-boundary
    else if (hay.includes(q)) score = 40;
    if (score > 0) scored.push({ svc, score });
  }
  scored.sort((a, b) => b.score - a.score || a.svc.name.localeCompare(b.svc.name));
  return scored.slice(0, limit).map((s) => s.svc);
}

// Best single match for a raw provider name (used to enrich a custom entry or,
// later, an email-scanned merchant). Returns undefined when nothing scores.
export function matchCatalog(name: string): CatalogService | undefined {
  return searchCatalog(name, 1)[0];
}

export { normalizeCategory };

// Re-export the default-plan helper's result shape for callers that only need
// the pre-fill values for the wizard.
export function catalogDefaults(svc: CatalogService): CatalogPlan {
  return defaultPlan(svc);
}
