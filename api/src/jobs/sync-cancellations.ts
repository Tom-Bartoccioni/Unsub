// Sync cancellation links/difficulty from JustDeleteMe into catalog_services.
// Idempotent — safe to run on a schedule (e.g. weekly cron on Render). Only
// touches the cancel* columns; prices/metadata are owned by the seed.
//
//   pnpm --filter @unsub/api sync-cancellations
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { loadEnv } from '../env.js';
import { closeDb, getDb } from '../db/client.js';
import { catalogServices } from '../db/schema.js';
import { createDrizzleCatalogStore } from '../db/catalog.js';
import { fetchJdmData, indexByDomain, matchCancellations } from '../lib/justdeleteme.js';

// Core sync against an injected db, so both the standalone runner and the
// /admin/sync-cancellations endpoint (which reuses the app's pooled db) share
// one implementation.
export async function syncCancellationsWith(
  db: NodePgDatabase<{ catalogServices: typeof catalogServices }>,
): Promise<{ matched: number; touched: number }> {
  const store = createDrizzleCatalogStore(db);
  const [jdmRaw, domainRows] = await Promise.all([
    fetchJdmData(),
    db.select({ domain: catalogServices.domain }).from(catalogServices),
  ]);
  const jdm = indexByDomain(jdmRaw);
  const updates = matchCancellations(
    domainRows.map((r) => r.domain),
    jdm,
  );
  const touched = await store.applyCancellations(updates);
  return { matched: updates.length, touched };
}

// Standalone runner: opens its own connection from the env.
export async function syncCancellations(): Promise<{ matched: number; touched: number }> {
  const env = loadEnv();
  const db = getDb(env.DATABASE_URL);
  return syncCancellationsWith(db);
}

const invokedDirectly = process.argv[1]?.endsWith('sync-cancellations.ts');
if (invokedDirectly) {
  syncCancellations()
    .then(async ({ matched, touched }) => {
      console.log(JSON.stringify({ ok: true, matched, touched }));
      await closeDb();
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
