// Build the catalog seed JSON that `db/seed-catalog.ts` loads into the
// `catalog_services` table.
//
// SOURCE OF TRUTH: the app's bundled vendor catalog under
// `app/src/data/catalog/`. We import the already-aggregated `CATALOG` array so
// the seed inherits the EXACT dedup (first-occurrence-per-id wins, in the app's
// lot import order) and category normalization (Music/Gaming -> Entertainment,
// Security -> Cloud) that `index.ts` applies. Reusing that array — rather than
// re-implementing the merge here — guarantees the served catalog matches what
// the app bundles as its offline fallback.
//
// The app catalog's `index.ts` references `__DEV__` (a React Native global) in
// a dev-only console.warn guard. Under Node/tsx that global is undefined and
// referencing it throws a ReferenceError, so we define it as `false` BEFORE the
// import below runs (the import is hoisted, hence the explicit assignment on the
// preceding line rather than a top-level `import` statement).
//
// Run with: `npm run build:catalog-seed` (or `npx tsx scripts/build-catalog-seed.ts`).

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Silence the RN-only dev warning guard in the app catalog's index.ts.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

// Cross-workspace import of the aggregated catalog (dedup + normalize applied).
// tsx resolves the `.js` specifier to the sibling `.ts` source at runtime.
const { CATALOG } = await import('../../app/src/data/catalog/index.js');

// One row per DB column in `catalog_services` (see db/schema.ts), including the
// CURATED cancellation fields (billing / cancelUrl / cancelNotes) — the app
// catalog is their source of truth and the seed carries them into the DB.
type CatalogSeedRecord = {
  id: string;
  name: string;
  aliases: string[];
  domain: string;
  category: string;
  brandColor: string | null;
  plans: unknown[];
  pricesUpdatedAt: string;
  billing: string | null;
  cancelUrl: string | null;
  cancelNotes: string | null;
};

const records: CatalogSeedRecord[] = CATALOG.map((svc) => ({
  id: svc.id,
  name: svc.name,
  // DB column defaults to []; make the absence explicit in the JSON too.
  aliases: svc.aliases ?? [],
  domain: svc.domain,
  category: svc.category,
  // Nullable columns — normalize `undefined` to `null` for valid JSON.
  brandColor: svc.brandColor ?? null,
  plans: svc.plans,
  pricesUpdatedAt: svc.pricesUpdatedAt,
  billing: svc.billing ?? null,
  cancelUrl: svc.cancelUrl ?? null,
  cancelNotes: svc.cancelNotes ?? null,
}));

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '../src/db/catalog-seed.json');

writeFileSync(outPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');

// eslint-disable-next-line no-console
console.log(`[build-catalog-seed] wrote ${records.length} services to ${outPath}`);
