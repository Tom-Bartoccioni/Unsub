import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { catalogServices, type CatalogServiceInsert, type CatalogServiceRow } from './schema.js';

export type CatalogStore = {
  // Every catalog row, for the public GET /catalog response.
  listAll: () => Promise<CatalogServiceRow[]>;
  // Max(updatedAt) across the table — used as the catalog version/ETag so the
  // app can skip re-downloading when nothing changed.
  latestUpdatedAt: () => Promise<Date | null>;
  // Upsert a batch of catalog records (used by the seeder). On conflict it
  // refreshes every field including the curated cancellation columns
  // (billing / cancel_url / cancel_notes) — the seed is their source of truth.
  upsertMany: (rows: CatalogServiceInsert[]) => Promise<number>;
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
              // Curated cancellation fields come from the seed — refresh them.
              billing: sql`excluded.billing`,
              cancelUrl: sql`excluded.cancel_url`,
              cancelNotes: sql`excluded.cancel_notes`,
              updatedAt: sql`now()`,
            },
          })
          .returning({ id: catalogServices.id });
        touched += out.length;
      }
      return touched;
    },
  };
}
