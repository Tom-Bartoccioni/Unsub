import type { FastifyInstance } from 'fastify';
import type { CatalogStore } from '../db/catalog.js';
import type { CatalogServiceRow } from '../db/schema.js';

export type CatalogRouteDeps = {
  store: CatalogStore;
};

// Shape returned to the app. Mirrors the app's CatalogService plus the
// cancellation fields (populated by the justdeleteme sync). Nulls are omitted
// on the wire where the app treats absence and null the same.
type CatalogServiceDto = {
  id: string;
  name: string;
  aliases: string[];
  domain: string;
  category: string;
  brandColor?: string;
  plans: CatalogServiceRow['plans'];
  pricesUpdatedAt: string;
  cancelUrl?: string;
  cancelDifficulty?: string;
  cancelNotes?: string;
};

function toDto(row: CatalogServiceRow): CatalogServiceDto {
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases ?? [],
    domain: row.domain,
    category: row.category,
    ...(row.brandColor ? { brandColor: row.brandColor } : {}),
    plans: row.plans,
    pricesUpdatedAt: row.pricesUpdatedAt,
    ...(row.cancelUrl ? { cancelUrl: row.cancelUrl } : {}),
    ...(row.cancelDifficulty ? { cancelDifficulty: row.cancelDifficulty } : {}),
    ...(row.cancelNotes ? { cancelNotes: row.cancelNotes } : {}),
  };
}

export function makeCatalogRoutes(deps: CatalogRouteDeps) {
  return async function catalogRoutes(fastify: FastifyInstance): Promise<void> {
    // Public (no auth): the catalog isn't user data. The app pulls it at
    // startup and caches it; `version` is the max updatedAt so the client can
    // skip re-storing when nothing changed. Also set as a weak ETag so a
    // conditional GET can 304.
    fastify.get('/catalog', async (req, reply) => {
      const [rows, latest] = await Promise.all([deps.store.listAll(), deps.store.latestUpdatedAt()]);
      const version = latest ? latest.toISOString() : null;
      const etag = version ? `W/"${version}"` : undefined;

      if (etag && req.headers['if-none-match'] === etag) {
        return reply.code(304).send();
      }
      if (etag) reply.header('etag', etag);
      // Let clients/proxies cache briefly; the app also caches locally.
      reply.header('cache-control', 'public, max-age=3600');

      return {
        version,
        count: rows.length,
        services: rows.map(toDto),
      };
    });
  };
}
