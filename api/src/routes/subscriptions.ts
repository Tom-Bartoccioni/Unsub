import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SubscriptionStore } from '../db/subscriptions.js';
import type { SubscriptionRow } from '../db/schema.js';

const CreateBody = z.object({
  provider: z.string().trim().min(1).max(120),
  amount: z.number().positive().max(1_000_000),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((s) => s.toUpperCase()),
  frequency: z.enum(['monthly', 'yearly', 'weekly', 'unknown']),
  nextRenewalDate: z.string().datetime().nullable().optional(),
});

const IdParam = z.object({ id: z.string().uuid() });

function firstProviderToken(provider: string): string {
  return provider.split(/\s+/)[0]?.toLowerCase() ?? '';
}

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

    fastify.post('/subscriptions', async (req, reply) => {
      const auth = await fastify.requireAuth(req);
      const parsed = CreateBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      const body = parsed.data;
      const row = await deps.store.upsert({
        userId: auth.row.id,
        provider: body.provider,
        providerKey: firstProviderToken(body.provider),
        amountMinor: Math.round(body.amount * 100),
        currency: body.currency,
        frequency: body.frequency,
        nextRenewalDate: body.nextRenewalDate ? new Date(body.nextRenewalDate) : null,
        confidence: 1, // user-entered
        sourceMessageId: null,
        sourceDate: null,
      });
      return reply.code(201).send({ subscription: toDTO(row) });
    });

    fastify.delete('/subscriptions/:id', async (req, reply) => {
      const auth = await fastify.requireAuth(req);
      const parsed = IdParam.safeParse(req.params);
      if (!parsed.success) return reply.code(400).send({ error: 'invalid_id' });
      const ok = await deps.store.deleteById(parsed.data.id, auth.row.id);
      if (!ok) return reply.code(404).send({ error: 'not_found' });
      return reply.code(204).send();
    });
  };
}
