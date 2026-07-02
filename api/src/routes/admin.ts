import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { SubscriptionStore } from '../db/subscriptions.js';
import type { UserStore } from '../db/users.js';
import type { paymentEvents, pushTokens, subscriptions } from '../db/schema.js';
import { notifyRenewals } from '../lib/notify-renewals.js';

export type AdminRouteDeps = {
  store: SubscriptionStore;
  users: UserStore;
  db: NodePgDatabase<{
    subscriptions: typeof subscriptions;
    pushTokens: typeof pushTokens;
    paymentEvents: typeof paymentEvents;
  }>;
  // Shared secret required in Authorization: Bearer <token>. When
  // undefined the endpoints are disabled so deploys without the env var
  // set can't be triggered anonymously.
  rolloverToken: string | undefined;
};

export function makeAdminRoutes(deps: AdminRouteDeps) {
  return async function (fastify: FastifyInstance): Promise<void> {
    // Daily catch-up for due renewals. Designed to be triggered by an
    // external scheduler (GitHub Actions cron). Idempotent: running twice
    // in the same day touches no rows on the second call.
    const authorize = (req: FastifyRequest) => {
      if (!deps.rolloverToken) return { ok: false as const, code: 503, error: 'rollover_disabled' };
      const header = req.headers['authorization'];
      if (header !== `Bearer ${deps.rolloverToken}`) {
        return { ok: false as const, code: 401, error: 'unauthorized' };
      }
      return { ok: true as const };
    };

    fastify.post('/admin/rollover', async (req, reply) => {
      const auth = authorize(req);
      if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });
      const result = await deps.store.rolloverDueRenewals();
      req.log.info(result, 'rollover.completed');
      return result;
    });

    // Hourly job: find users whose local hour is currently noon and
    // push them a digest of subscriptions renewing tomorrow. The cron
    // runs every hour; per-user filtering picks each user up exactly
    // once per day, during their own noon.
    fastify.post('/admin/notify-renewals', async (req, reply) => {
      const auth = authorize(req);
      if (!auth.ok) return reply.code(auth.code).send({ error: auth.error });
      const result = await notifyRenewals({ db: deps.db, users: deps.users });
      req.log.info(result, 'notify_renewals.completed');
      return result;
    });
  };
}
