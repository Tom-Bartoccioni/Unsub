// Sync cancellation info from the JustDeleteMe open dataset into our catalog.
//
// JustDeleteMe (github.com/justdeleteme/justdelete.me) publishes sites.json: a
// structured, freely-usable directory mapping services to their account
// deletion / cancellation page, with a difficulty rating and notes. We match
// its entries to our catalog by DOMAIN and copy url/difficulty/notes into the
// catalog_services.cancel* columns, which the app surfaces in the "how to
// cancel" flow when a user ghosts a subscription.
//
// The prices/metadata in the catalog are owned by our seed; only the cancel*
// fields are owned by this sync.

import type { CancellationUpdate } from '../db/catalog.js';

// Raw shape of a sites.json entry. Fields beyond these exist but are unused.
export type JdmEntry = {
  name?: string;
  domains?: string[];
  url?: string;
  difficulty?: string; // 'easy' | 'medium' | 'hard' | 'impossible' | ''
  notes?: string;
  email?: string;
};

export type JdmData = { sites?: JdmEntry[] } | JdmEntry[];

// Raw GitHub URL for the canonical sites.json. Overridable for tests.
export const JDM_SITES_URL =
  'https://raw.githubusercontent.com/justdeleteme/justdelete.me/master/_data/sites.json';

// Normalize a domain to its registrable-ish form for matching: lowercase,
// strip protocol/path/www so "www.netflix.com/…" and "netflix.com" collide.
export function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/\/.*$/, '');
  d = d.replace(/^www\./, '');
  return d;
}

const ALLOWED_DIFFICULTY = new Set(['easy', 'medium', 'hard', 'impossible']);

function cleanDifficulty(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = raw.trim().toLowerCase();
  return ALLOWED_DIFFICULTY.has(d) ? d : null;
}

// Build a domain -> cancellation lookup from the raw dataset. Later entries for
// the same domain win (dataset is roughly de-duped already).
export function indexByDomain(data: JdmData): Map<string, CancellationUpdate> {
  const entries = Array.isArray(data) ? data : (data.sites ?? []);
  const byDomain = new Map<string, CancellationUpdate>();
  for (const e of entries) {
    const domains = e.domains ?? [];
    const url = e.url?.trim() || null;
    // Skip entries with neither a URL nor any actionable info.
    if (!url && !e.notes) continue;
    for (const rawDomain of domains) {
      const domain = normalizeDomain(rawDomain);
      if (!domain) continue;
      byDomain.set(domain, {
        domain,
        cancelUrl: url,
        cancelDifficulty: cleanDifficulty(e.difficulty),
        cancelNotes: e.notes?.trim() || null,
      });
    }
  }
  return byDomain;
}

// Given our catalog's domains, produce the cancellation updates that actually
// match a JustDeleteMe entry. Domains are normalized on both sides.
export function matchCancellations(
  catalogDomains: string[],
  jdm: Map<string, CancellationUpdate>,
): CancellationUpdate[] {
  const updates: CancellationUpdate[] = [];
  const seen = new Set<string>();
  for (const raw of catalogDomains) {
    const domain = normalizeDomain(raw);
    if (seen.has(domain)) continue;
    seen.add(domain);
    const hit = jdm.get(domain);
    if (hit) updates.push({ ...hit, domain: raw }); // keep the catalog's stored domain form
  }
  return updates;
}

// Fetch + parse sites.json. Uses global fetch (Node 18+).
export async function fetchJdmData(url = JDM_SITES_URL): Promise<JdmData> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`JustDeleteMe fetch failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as JdmData;
}
