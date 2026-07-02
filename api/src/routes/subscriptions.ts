import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SubscriptionStore } from '../db/subscriptions.js';
import type { SubscriptionRow } from '../db/schema.js';
import { computeStats } from '../lib/stats.js';

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
  startedAt: z.string().datetime().nullable().optional(),
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
    startedAt: z.string().datetime().nullable().optional(),
    status: z.enum(['active', 'trial', 'cancelled']).optional(),
  })
  .strict();

const IdParam = z.object({ id: z.string().uuid() });

// Reactivating a ghosted sub: the modal re-asks price/cycle/renewal (they may
// have changed since it was cancelled). startedAt is the resume date.
const ReactivateBody = z.object({
  amount: z.number().positive().max(1_000_000),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((s) => s.toUpperCase()),
  frequency: z.enum(['monthly', 'yearly', 'weekly', 'unknown']),
  nextRenewalDate: z.string().datetime().nullable().optional(),
  startedAt: z.string().datetime().nullable().optional(),
});

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
  startedAt: string | null;
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
    startedAt: row.startedAt?.toISOString() ?? null,
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

    // Aggregated statistics for the stats/achievements screen. Amounts are
    // grouped by the subscription's own currency (the app converts to the
    // user's display currency); counters drive badge unlocks.
    fastify.get('/me/stats', async (req) => {
      const auth = await fastify.requireAuth(req);
      const [rows, transactions, periods] = await Promise.all([
        deps.store.listByUserId(auth.row.id),
        deps.store.countPaymentEvents(auth.row.id),
        deps.store.listPeriodsByUserId(auth.row.id),
      ]);
      return computeStats(rows, new Date(), transactions, periods);
    });

    fastify.post('/subscriptions', async (req, reply) => {
      const auth = await fastify.requireAuth(req);
      const parsed = CreateBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
      }
      const body = parsed.data;
      const startedAt = body.startedAt ? new Date(body.startedAt) : null;
      const providerKey = firstProviderToken(body.provider);

      // If the user re-adds a subscription they'd previously ghosted, reactivate
      // that existing row (opening a fresh period, preserving its history)
      // instead of creating a second, still-cancelled duplicate.
      const cancelled = await deps.store.findCancelledByProviderKey(auth.row.id, providerKey);
      if (cancelled) {
        const reactivated = await deps.store.reactivate(cancelled.id, auth.row.id, {
          amountMinor: Math.round(body.amount * 100),
          currency: body.currency,
          frequency: body.frequency,
          nextRenewalDate: body.nextRenewalDate ? new Date(body.nextRenewalDate) : null,
          startedAt,
        });
        if (reactivated) {
          // Re-adding via the wizard is "treat as a fresh subscription from the
          // start date you gave": if startedAt is provided, (re)generate the
          // estimated events for that window so the timeline reflects it. When
          // startedAt is null (a plain resume), leave events as-is.
          if (startedAt) {
            await deps.store.regenerateEstimatedEvents(
              reactivated.id,
              startedAt,
              reactivated.frequency as 'monthly' | 'yearly' | 'weekly' | 'unknown',
              reactivated.amountMinor,
              reactivated.currency,
            );
          }
          return reply.code(201).send({ subscription: toDTO(reactivated) });
        }
      }

      const row = await deps.store.upsert({
        userId: auth.row.id,
        provider: body.provider,
        providerKey,
        category: body.category ?? null,
        amountMinor: Math.round(body.amount * 100),
        currency: body.currency,
        frequency: body.frequency,
        nextRenewalDate: body.nextRenewalDate ? new Date(body.nextRenewalDate) : null,
        startedAt,
        confidence: 1, // user-entered
        sourceMessageId: null,
        sourceDate: null,
      });
      if (startedAt) {
        await deps.store.regenerateEstimatedEvents(
          row.id,
          startedAt,
          row.frequency as 'monthly' | 'yearly' | 'weekly' | 'unknown',
          row.amountMinor,
          row.currency,
        );
      }
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
      if (body.startedAt !== undefined) {
        patch.startedAt = body.startedAt ? new Date(body.startedAt) : null;
      }
      if (body.status !== undefined) patch.status = body.status;
      const row = await deps.store.updateById(idParsed.data.id, auth.row.id, patch);
      if (!row) return reply.code(404).send({ error: 'not_found' });
      // Regenerate estimated events whenever the inputs that drive them change.
      const driversChanged =
        body.startedAt !== undefined ||
        body.amount !== undefined ||
        body.currency !== undefined ||
        body.frequency !== undefined;
      if (driversChanged && row.startedAt) {
        await deps.store.regenerateEstimatedEvents(
          row.id,
          row.startedAt,
          row.frequency as 'monthly' | 'yearly' | 'weekly' | 'unknown',
          row.amountMinor,
          row.currency,
        );
      }
      return { subscription: toDTO(row) };
    });

    // Reactivate a ghosted subscription: opens a fresh life-cycle period with
    // the (possibly new) price/cycle, leaving the closed period's savings
    // frozen. The old PATCH status:'active' path still works for a plain
    // un-ghost, but this endpoint is what the reactivation modal calls.
    fastify.post('/subscriptions/:id/reactivate', async (req, reply) => {
      const auth = await fastify.requireAuth(req);
      const idParsed = IdParam.safeParse(req.params);
      if (!idParsed.success) return reply.code(400).send({ error: 'invalid_id' });
      const bodyParsed = ReactivateBody.safeParse(req.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({ error: 'invalid_body', issues: bodyParsed.error.issues });
      }
      const body = bodyParsed.data;
      const startedAt = body.startedAt ? new Date(body.startedAt) : null;
      const row = await deps.store.reactivate(idParsed.data.id, auth.row.id, {
        amountMinor: Math.round(body.amount * 100),
        currency: body.currency,
        frequency: body.frequency,
        nextRenewalDate: body.nextRenewalDate ? new Date(body.nextRenewalDate) : null,
        startedAt,
      });
      if (!row) return reply.code(404).send({ error: 'not_found' });
      // If the user set a start date (they can pick a past date on the resume
      // sheet), (re)generate the estimated events from it so the timeline shows
      // that history. If startedAt is null — a plain "resume today" — leave the
      // events alone so we neither invent a past nor erase the old period.
      if (startedAt) {
        await deps.store.regenerateEstimatedEvents(
          row.id,
          startedAt,
          row.frequency as 'monthly' | 'yearly' | 'weekly' | 'unknown',
          row.amountMinor,
          row.currency,
        );
      }
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

    fastify.get('/subscriptions/:id/payments', async (req, reply) => {
      const auth = await fastify.requireAuth(req);
      const parsed = IdParam.safeParse(req.params);
      if (!parsed.success) return reply.code(400).send({ error: 'invalid_id' });
      const [events, periods] = await Promise.all([
        deps.store.listPaymentEvents(parsed.data.id, auth.row.id),
        deps.store.listPeriodsBySubscription(parsed.data.id, auth.row.id),
      ]);
      if (events === null) return reply.code(404).send({ error: 'not_found' });
      return {
        payments: events.map((e) => ({
          id: e.id,
          chargedAt: e.chargedAt.toISOString(),
          amount: e.amountMinor / 100,
          currency: e.currency,
          source: e.source,
        })),
        // Life-cycle periods so the timeline can mark the gap when a sub was
        // ghosted then reactivated (a closed period followed by a later one).
        periods: (periods ?? []).map((p) => ({
          startedAt: p.startedAt.toISOString(),
          endedAt: p.endedAt ? p.endedAt.toISOString() : null,
        })),
      };
    });
  };
}
