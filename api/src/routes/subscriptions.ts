import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SubscriptionStore } from '../db/subscriptions.js';
import type { SubscriptionRow } from '../db/schema.js';

const CreateBody = z.object({
  provider: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(40).nullable().optional(),
  amount: z.number().positive().max(1_000_000),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((s) => s.toUpperCase()),
  frequency: z.enum(['monthly', 'yearly', 'weekly', 'unknown']),
  nextRenewalDate: z.string().datetime().nullable().optional(),
});

const PatchBody = z
  .object({
    provider: z.string().trim().min(1).max(120).optional(),
    category: z.string().trim().min(1).max(40).nullable().optional(),
    amount: z.number().positive().max(1_000_000).optional(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((s) => s.toUpperCase())
      .optional(),
    frequency: z.enum(['monthly', 'yearly', 'weekly', 'unknown']).optional(),
    nextRenewalDate: z.string().datetime().nullable().optional(),
    status: z.enum(['active', 'trial', 'cancelled']).optional(),
  })
  .strict();

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
  category: string | null;
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
    category: row.category,
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
        category: body.category ?? null,
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

    fastify.patch('/subscriptions/:id', async (req, reply) => {
      const auth = await fastify.requireAuth(req);
      const idParsed = IdParam.safeParse(req.params);
      if (!idParsed.success) return reply.code(400).send({ error: 'invalid_id' });
      const bodyParsed = PatchBody.safeParse(req.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: bodyParsed.error.issues });
      }
      const body = bodyParsed.data;
      const patch: Parameters<typeof deps.store.updateById>[2] = {};
      if (body.provider !== undefined) {
        patch.provider = body.provider;
        patch.providerKey = body.provider.split(/\s+/)[0]?.toLowerCase() ?? '';
      }
      if (body.category !== undefined) patch.category = body.category;
      if (body.amount !== undefined) patch.amountMinor = Math.round(body.amount * 100);
      if (body.currency !== undefined) patch.currency = body.currency;
      if (body.frequency !== undefined) patch.frequency = body.frequency;
      if (body.nextRenewalDate !== undefined) {
        patch.nextRenewalDate = body.nextRenewalDate ? new Date(body.nextRenewalDate) : null;
      }
      if (body.status !== undefined) patch.status = body.status;
      const row = await deps.store.updateById(idParsed.data.id, auth.row.id, patch);
      if (!row) return reply.code(404).send({ error: 'not_found' });
      return { subscription: toDTO(row) };
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
