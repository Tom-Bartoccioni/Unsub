import type { FastifyInstance } from 'fastify';
import type { SubscriptionStore } from '../db/subscriptions.js';
import type { SubscriptionRow } from '../db/schema.js';

export type SubscriptionsRouteDeps = {
  store: SubscriptionStore;
};

export type SubscriptionDTO = {
  id: string;
  provider: string;
  amount: number;
  currency: string;
  frequency: string;
  nextRenewalDate: string | null;
  confidence: number;
  status: string;
  sourceDate: string | null;
  updatedAt: string;
};

export function toDTO(row: SubscriptionRow): SubscriptionDTO {
  return {
    id: row.id,
    provider: row.provider,
    amount: row.amountMinor / 100,
    currency: row.currency,
    frequency: row.frequency,
    nextRenewalDate: row.nextRenewalDate?.toISOString() ?? null,
    confidence: row.confidence,
    status: row.status,
    sourceDate: row.sourceDate?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function makeSubscriptionsRoutes(deps: SubscriptionsRouteDeps) {
  return async function (fastify: FastifyInstance): Promise<void> {
    fastify.get('/subscriptions', async (req) => {
      const auth = await fastify.requireAuth(req);
      const rows = await deps.store.listByUserId(auth.row.id);
      return { subscriptions: rows.map(toDTO) };
    });
  };
}
