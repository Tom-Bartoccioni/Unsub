import type { FastifyInstance } from 'fastify';
import { scanInboxesForUser, type ScanDeps } from '../lib/email-scan.js';
import { toDTO } from './subscriptions.js';

export type ScanRouteDeps = ScanDeps;

export function makeScanRoutes(deps: ScanRouteDeps) {
  return async function (fastify: FastifyInstance): Promise<void> {
    fastify.post('/scan/run', async (req, reply) => {
      const auth = await fastify.requireAuth(req);
      try {
        const { accounts, persisted } = await scanInboxesForUser(auth.row.id, deps);
        const totalFetched = accounts.reduce((acc, r) => acc + r.fetchedCount, 0);
        const totalParsed = accounts.reduce((acc, r) => acc + r.parsed.length, 0);
        return {
          totalFetched,
          totalParsed,
          subscriptions: persisted.map(toDTO),
        };
      } catch (err) {
        req.log.error({ err }, 'scan failed');
        const message = err instanceof Error ? err.message : 'scan failed';
        return reply.code(502).send({ error: 'scan_failed', message });
      }
    });
  };
}
