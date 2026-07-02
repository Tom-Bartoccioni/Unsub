// Seed the catalog_services table from the generated catalog-seed.json (built
// from the app's bundled catalog via scripts/build-catalog-seed.ts).
//
// Safe to run in any environment, including production: upsertMany refreshes
// prices/metadata AND the curated cancellation fields (billing/cancelUrl/
// cancelNotes) on conflict. Runs on deploy so the served catalog tracks the app.
//   pnpm --filter @unsub/api db:seed-catalog
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { closeDb, getDb } from './client.js';
import { createDrizzleCatalogStore } from './catalog.js';
import type { CatalogServiceInsert } from './schema.js';
import { loadEnv } from '../env.js';

async function loadSeed(): Promise<CatalogServiceInsert[]> {
  const path = fileURLToPath(new URL('./catalog-seed.json', import.meta.url));
  const raw = await readFile(path, 'utf8');
  const data = JSON.parse(raw) as CatalogServiceInsert[];
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('catalog-seed.json is empty or malformed — run build:catalog-seed first');
  }
  return data;
}

export async function seedCatalog(): Promise<{ count: number }> {
  const env = loadEnv();
  const db = getDb(env.DATABASE_URL);
  const store = createDrizzleCatalogStore(db);
  const rows = await loadSeed();
  const count = await store.upsertMany(rows);
  return { count };
}

// Only run as a script when invoked directly (not when imported by the deploy
// hook or tests).
const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  seedCatalog()
    .then(async ({ count }) => {
      console.log(`Catalog seed complete: ${count} services upserted.`);
      await closeDb();
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
