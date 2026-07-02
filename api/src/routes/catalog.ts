import type { FastifyInstance } from 'fastify';
import type { CatalogStore } from '../db/catalog.js';
import type { CatalogServiceRow } from '../db/schema.js';

export type CatalogRouteDeps = {
  store: CatalogStore;
};

// Shape returned to the app. Mirrors the app's CatalogService plus the
// curated cancellation fields. Nulls are omitted on the wire where the app
// treats absence and null the same.
type CatalogServiceDto = {
  id: string;
  name: string;
  aliases: string[];
  domain: string;
  category: string;
  brandColor?: string;
  plans: CatalogServiceRow['plans'];
  pricesUpdatedAt: string;
  billing?: string;
  cancelUrl?: string;
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
    ...(row.billing ? { billing: row.billing } : {}),
    ...(row.cancelUrl ? { cancelUrl: row.cancelUrl } : {}),
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
      // no-cache = clients MAY store but MUST revalidate via the ETag before
      // reuse. Critical: a plain max-age let the RN Android HTTP client (OkHttp)
      // serve a stale empty response for an hour after a cold start that hit the
      // API before the catalog seed finished. Revalidation returns a cheap 304
      // when unchanged, fresh data when it moved.
      reply.header('cache-control', 'no-cache');

      return {
        version,
        count: rows.length,
        services: rows.map(toDto),
      };
    });
  };
}
