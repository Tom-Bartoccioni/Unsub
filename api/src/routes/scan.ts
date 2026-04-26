import type { FastifyInstance } from 'fastify';
import { scanInboxesForUser, type ScanDeps } from '../lib/email-scan.js';

export type ScanRouteDeps = ScanDeps;

export function makeScanRoutes(deps: ScanRouteDeps) {
  return async function (fastify: FastifyInstance): Promise<void> {
    fastify.post('/scan/run', async (req, reply) => {
      const auth = await fastify.requireAuth(req);
      try {
        const results = await scanInboxesForUser(auth.row.id, deps);
        const accounts = results.map((r) => ({
          googleEmail: r.googleEmail,
          fetchedCount: r.fetchedCount,
          sampleSubjects: r.emails.slice(0, 3).map((e) => e.subject),
          parsed: r.parsed.map((p) => ({
            provider: p.provider,
            amount: p.amount,
            currency: p.currency,
            frequency: p.frequency,
            nextRenewalDate: p.nextRenewalDate?.toISOString() ?? null,
            confidence: p.confidence,
            sourceMessageId: p.sourceMessageId,
          })),
        }));
        const totalFetched = results.reduce((acc, r) => acc + r.fetchedCount, 0);
        const totalParsed = results.reduce((acc, r) => acc + r.parsed.length, 0);
        return { totalFetched, totalParsed, accounts };
      } catch (err) {
        req.log.error({ err }, 'scan failed');
        const message = err instanceof Error ? err.message : 'scan failed';
        return reply.code(502).send({ error: 'scan_failed', message });
      }
    });
  };
}
