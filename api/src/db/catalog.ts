import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { catalogServices, type CatalogServiceInsert, type CatalogServiceRow } from './schema.js';

// A cancellation record matched from justdeleteme, keyed by domain.
export type CancellationUpdate = {
  domain: string;
  cancelUrl: string | null;
  cancelDifficulty: string | null;
  cancelNotes: string | null;
};

export type CatalogStore = {
  // Every catalog row, for the public GET /catalog response.
  listAll: () => Promise<CatalogServiceRow[]>;
  // Max(updatedAt) across the table — used as the catalog version/ETag so the
  // app can skip re-downloading when nothing changed.
  latestUpdatedAt: () => Promise<Date | null>;
  // Upsert a batch of catalog records (used by the seeder). Conflicts on id
  // refresh the mutable fields but PRESERVE the cancel* columns (those are
  // owned by the sync job, not the seed).
  upsertMany: (rows: CatalogServiceInsert[]) => Promise<number>;
  // Apply cancellation updates matched by domain (used by the justdeleteme
  // sync job). Returns how many rows were touched.
  applyCancellations: (updates: CancellationUpdate[]) => Promise<number>;
};

export function createDrizzleCatalogStore(
  db: NodePgDatabase<{ catalogServices: typeof catalogServices }>,
): CatalogStore {
  return {
    async listAll() {
      return db.select().from(catalogServices);
    },

    async latestUpdatedAt() {
      // pg returns max() of a raw SQL timestamp expression as a STRING, not a
      // Date (unlike selecting the column directly). Coerce so the Date|null
      // contract actually holds — callers do latest.toISOString().
      const [row] = await db
        .select({ max: sql<string | null>`max(${catalogServices.updatedAt})` })
        .from(catalogServices);
      const max = row?.max ?? null;
      return max ? new Date(max) : null;
    },

    async upsertMany(rows) {
      if (rows.length === 0) return 0;
      let touched = 0;
      // Chunk to keep parameter counts well under Postgres' 65535 limit.
      const CHUNK = 100;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const batch = rows.slice(i, i + CHUNK);
        const out = await db
          .insert(catalogServices)
          .values(batch)
          .onConflictDoUpdate({
            target: catalogServices.id,
            set: {
              name: sql`excluded.name`,
              aliases: sql`excluded.aliases`,
              domain: sql`excluded.domain`,
              category: sql`excluded.category`,
              brandColor: sql`excluded.brand_color`,
              plans: sql`excluded.plans`,
              pricesUpdatedAt: sql`excluded.prices_updated_at`,
              updatedAt: sql`now()`,
              // Deliberately NOT touching cancel_url / cancel_difficulty /
              // cancel_notes / cancel_synced_at — the sync job owns those.
            },
          })
          .returning({ id: catalogServices.id });
        touched += out.length;
      }
      return touched;
    },

    async applyCancellations(updates) {
      let touched = 0;
      for (const u of updates) {
        const out = await db
          .update(catalogServices)
          .set({
            cancelUrl: u.cancelUrl,
            cancelDifficulty: u.cancelDifficulty,
            cancelNotes: u.cancelNotes,
            cancelSyncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(catalogServices.domain, u.domain))
          .returning({ id: catalogServices.id });
        touched += out.length;
      }
      return touched;
    },
  };
}
