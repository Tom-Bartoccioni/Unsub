// The vendor catalog. Extends the old `PopularService` shape (single default
// amount) into a richer record that also carries logo domain, category, one or
// more pricing plans, and cancellation info for the "ghost a sub" flow.
//
// Distribution: this bundled catalog is the OFFLINE FALLBACK. At runtime the
// app refreshes it from the API (served from Render), so a price correction
// ships without republishing the app. The `cancel*` fields are additionally
// kept fresh by a backend cron that syncs justdeleteme's sites.json.
//
// Prices are "last known / approximate" — no authoritative pricing API exists
// (see the Phase 1 research). Each service stamps `pricesUpdatedAt` so the UI
// can show the tariff as indicative and flag stale data.

export type Frequency = 'monthly' | 'yearly' | 'weekly';

// One purchasable plan. Currency is the service's NATIVE currency (EUR when
// the service sells in Europe, USD otherwise) — the app converts to the user's
// display currency at render time via money.convert(), so we don't store the
// same plan in multiple currencies.
export type CatalogPlan = {
  // Human label as the vendor names it: "Standard", "Premium", "Individual",
  // "Family", "Duo"… Empty/"Standard" when the service has a single plan.
  name: string;
  amount: number;
  currency: string;
  frequency: Frequency;
  // Exactly one plan per service should be `default: true` — the one the
  // wizard pre-selects. If none is marked, the first plan is used.
  default?: boolean;
};

export type CancelDifficulty = 'easy' | 'medium' | 'hard' | 'impossible';

export type CatalogService = {
  // Stable kebab-case identifier. Never reuse or renumber — the app may persist
  // it against a tracked subscription.
  id: string;
  // Canonical display name ("Netflix", "Apple TV+", "Amazon Prime Video").
  name: string;
  // Extra search/matching tokens (lowercase): former names, abbreviations,
  // localized names. Powers wizard search and, later, email-scan matching.
  aliases?: string[];
  // Brand domain for the logo CDN (logo.dev). No plan/marketing subpaths —
  // just the apex or the product's canonical host ("disneyplus.com").
  domain: string;
  // Dashboard donut category. Must be one of the app's known categories
  // (see theme.categoryColors / lib/categories): Entertainment, Music,
  // Productivity, Cloud, Security, News, Wellness, Gaming, Other, etc.
  category: string;
  // Optional brand color override for the colored-initial fallback avatar.
  brandColor?: string;
  // One or more pricing plans. Order: cheapest → priciest, or the vendor's own
  // order. At least one entry.
  plans: CatalogPlan[];
  // Year-month the prices were last verified, e.g. "2026-07". Drives the
  // "approximate / last checked" hint in the UI.
  pricesUpdatedAt: string;
  // --- Cancellation (for the ghost-a-sub flow; synced from justdeleteme) ---
  // Direct URL to the account-cancellation / deletion page when known.
  cancelUrl?: string;
  cancelDifficulty?: CancelDifficulty;
  // Short human note ("Must cancel from the website, not the app", etc).
  cancelNotes?: string;
};

// The default plan the wizard should pre-fill for a service.
export function defaultPlan(svc: CatalogService): CatalogPlan {
  return svc.plans.find((p) => p.default) ?? svc.plans[0]!;
}
