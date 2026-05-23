import type { FastifyInstance } from 'fastify';
import type { SubscriptionStore } from '../db/subscriptions.js';

export type AdminRouteDeps = {
  store: SubscriptionStore;
  // Shared secret required in Authorization: Bearer <token>. When
  // undefined the endpoint is disabled so deploys without the env var
  // set can't be triggered anonymously.
  rolloverToken: string | undefined;
};

export function makeAdminRoutes(deps: AdminRouteDeps) {
  return async function (fastify: FastifyInstance): Promise<void> {
    // Daily catch-up for due renewals. Designed to be triggered by an
    // external scheduler (GitHub Actions cron). Idempotent: running twice
    // in the same day touches no rows on the second call.
    fastify.post('/admin/rollover', async (req, reply) => {
      if (!deps.rolloverToken) {
        return reply.code(503).send({ error: 'rollover_disabled' });
      }
      const header = req.headers['authorization'];
      const expected = `Bearer ${deps.rolloverToken}`;
      if (header !== expected) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      const result = await deps.store.rolloverDueRenewals();
      req.log.info(result, 'rollover.completed');
      return result;
    });
  };
}
