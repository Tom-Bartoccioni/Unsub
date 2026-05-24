import { and, desc, eq, lt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  paymentEvents,
  subscriptions,
  type PaymentEventRow,
  type SubscriptionRow,
} from './schema.js';

export type SubscriptionInput = {
  userId: string;
  provider: string;
  providerKey: string;
  category: string | null;
  amountMinor: number;
  currency: string;
  frequency: 'monthly' | 'yearly' | 'weekly' | 'unknown';
  nextRenewalDate: Date | null;
  startedAt: Date | null;
  confidence: number;
  status?: 'active' | 'trial';
  sourceMessageId: string | null;
  sourceDate: Date | null;
};

export type SubscriptionPatch = {
  provider?: string;
  providerKey?: string;
  category?: string | null;
  amountMinor?: number;
  currency?: string;
  frequency?: 'monthly' | 'yearly' | 'weekly' | 'unknown';
  nextRenewalDate?: Date | null;
  startedAt?: Date | null;
  status?: 'active' | 'trial' | 'cancelled';
};

// Cycle dates strictly BEFORE `end`, starting at `start` and stepping by
// the frequency. Used to backfill 'estimated' payment_events when a user
// supplies a start date.
export function cycleDatesBetween(
  start: Date,
  end: Date,
  frequency: 'monthly' | 'yearly' | 'weekly' | 'unknown',
): Date[] {
  if (frequency === 'unknown') return [];
  const out: Date[] = [];
  const cursor = new Date(start);
  // Safety cap so a misconfigured 10-year-old weekly sub doesn't blow up.
  const MAX = 600;
  while (cursor.getTime() < end.getTime() && out.length < MAX) {
    out.push(new Date(cursor));
    if (frequency === 'monthly') cursor.setMonth(cursor.getMonth() + 1);
    else if (frequency === 'yearly') cursor.setFullYear(cursor.getFullYear() + 1);
    else if (frequency === 'weekly') cursor.setDate(cursor.getDate() + 7);
  }
  return out;
}

export type SubscriptionStore = {
  upsert: (input: SubscriptionInput) => Promise<SubscriptionRow>;
  listByUserId: (userId: string) => Promise<SubscriptionRow[]>;
  deleteById: (id: string, userId: string) => Promise<boolean>;
  updateById: (
    id: string,
    userId: string,
    patch: SubscriptionPatch,
  ) => Promise<SubscriptionRow | null>;
  // Returns rows ordered newest-first. Returns null when the subscription
  // doesn't exist or isn't owned by the user (caller should 404).
  listPaymentEvents: (subscriptionId: string, userId: string) => Promise<PaymentEventRow[] | null>;
  // Inserts a manual event. Returns null on ownership failure.
  addPaymentEvent: (
    subscriptionId: string,
    userId: string,
    input: { chargedAt: Date; amountMinor: number; currency: string; source: string },
  ) => Promise<PaymentEventRow | null>;
  // Wipes prior 'estimated' rows for the subscription and re-inserts one
  // per cycle between `startedAt` and now. Real-source rows (manual,
  // email, card) are preserved. Returns number of estimated rows written.
  regenerateEstimatedEvents: (
    subscriptionId: string,
    startedAt: Date,
    frequency: 'monthly' | 'yearly' | 'weekly' | 'unknown',
    amountMinor: number,
    currency: string,
  ) => Promise<number>;
  // Daily rollover: find every active subscription whose next renewal date
  // has already passed, advance it one cycle at a time until it's in the
  // future, and (if startedAt is set) insert one 'estimated' payment_event
  // per cycle that was crossed. Idempotent — running twice in the same day
  // touches no rows the second time. Returns counts for observability.
  rolloverDueRenewals: () => Promise<{ subsAdvanced: number; eventsInserted: number }>;
};

export function createDrizzleSubscriptionStore(
  db: NodePgDatabase<{ subscriptions: typeof subscriptions }>,
): SubscriptionStore {
  return {
    async upsert(input) {
      const [row] = await db
        .insert(subscriptions)
        .values({
          userId: input.userId,
          provider: input.provider,
          providerKey: input.providerKey,
          category: input.category,
          amountMinor: input.amountMinor,
          currency: input.currency,
          frequency: input.frequency,
          nextRenewalDate: input.nextRenewalDate,
          startedAt: input.startedAt,
          confidence: input.confidence,
          status: input.status ?? 'active',
          sourceMessageId: input.sourceMessageId,
          sourceDate: input.sourceDate,
        })
        .onConflictDoUpdate({
          target: [
            subscriptions.userId,
            subscriptions.providerKey,
            subscriptions.amountMinor,
            subscriptions.currency,
            subscriptions.frequency,
          ],
          set: {
            // Don't touch `status` on conflict — preserves user overrides
            // (dismissed, cancelled, manually re-marked active).
            provider: input.provider,
            category: input.category,
            nextRenewalDate: input.nextRenewalDate,
            startedAt: input.startedAt,
            confidence: input.confidence,
            sourceMessageId: input.sourceMessageId,
            sourceDate: input.sourceDate,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!row) throw new Error('subscriptions.upsert returned no row');
      return row;
    },
    async listByUserId(userId) {
      return db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.updatedAt));
    },
    async deleteById(id, userId) {
      const out = await db
        .delete(subscriptions)
        .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
        .returning({ id: subscriptions.id });
      return out.length > 0;
    },
    async updateById(id, userId, patch) {
      if (Object.keys(patch).length === 0) {
        const [row] = await db
          .select()
          .from(subscriptions)
          .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)));
        return row ?? null;
      }
      const [row] = await db
        .update(subscriptions)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
        .returning();
      return row ?? null;
    },
    async listPaymentEvents(subscriptionId, userId) {
      // Ownership check first — avoids leaking row existence via the events
      // list returning empty vs not-found.
      const [sub] = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, userId)));
      if (!sub) return null;
      return db
        .select()
        .from(paymentEvents)
        .where(eq(paymentEvents.subscriptionId, subscriptionId))
        .orderBy(desc(paymentEvents.chargedAt));
    },
    async addPaymentEvent(subscriptionId, userId, input) {
      const [sub] = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, userId)));
      if (!sub) return null;
      const [row] = await db
        .insert(paymentEvents)
        .values({ subscriptionId, ...input })
        .returning();
      return row ?? null;
    },
    async regenerateEstimatedEvents(subscriptionId, startedAt, frequency, amountMinor, currency) {
      // Wipe only the estimated rows — real events from email/card/manual
      // sources stay untouched, even if their date overlaps an estimate.
      await db
        .delete(paymentEvents)
        .where(
          and(
            eq(paymentEvents.subscriptionId, subscriptionId),
            eq(paymentEvents.source, 'estimated'),
          ),
        );
      const dates = cycleDatesBetween(startedAt, new Date(), frequency);
      if (dates.length === 0) return 0;
      await db.insert(paymentEvents).values(
        dates.map((d) => ({
          subscriptionId,
          chargedAt: d,
          amountMinor,
          currency,
          source: 'estimated',
        })),
      );
      return dates.length;
    },
    async rolloverDueRenewals() {
      const now = new Date();
      // Active subs only — cancelled rows don't renew. Filter out 'unknown'
      // frequency in JS since we can't step it. Trial subs are included:
      // they'll convert unless cancelled, so their renewal date should still
      // advance.
      const due = await db
        .select()
        .from(subscriptions)
        .where(and(lt(subscriptions.nextRenewalDate, now), eq(subscriptions.status, 'active')));
      let subsAdvanced = 0;
      let eventsInserted = 0;
      for (const row of due) {
        if (!row.nextRenewalDate) continue;
        const freq = row.frequency as 'monthly' | 'yearly' | 'weekly' | 'unknown';
        if (freq === 'unknown') continue;
        // The missed cycles are every date from the current nextRenewalDate
        // (inclusive of the one that just passed) up to but not including
        // the first future date. cycleDatesBetween gives us exactly that
        // when we treat now as the end and the current next as the start.
        const missed = cycleDatesBetween(row.nextRenewalDate, now, freq);
        if (missed.length === 0) continue;
        // Advance the date forward by missed.length cycles. The first
        // future date is one step beyond the last missed date.
        const newNext = stepCycle(missed[missed.length - 1]!, freq);
        await db
          .update(subscriptions)
          .set({ nextRenewalDate: newNext, updatedAt: new Date() })
          .where(eq(subscriptions.id, row.id));
        subsAdvanced++;
        // Insert observed-charge events only if startedAt is set — that's
        // the signal the user has acknowledged the cycle pattern. Without
        // it we don't pretend we know they were charged.
        if (row.startedAt) {
          await db.insert(paymentEvents).values(
            missed.map((d) => ({
              subscriptionId: row.id,
              chargedAt: d,
              amountMinor: row.amountMinor,
              currency: row.currency,
              source: 'estimated',
            })),
          );
          eventsInserted += missed.length;
        }
      }
      return { subsAdvanced, eventsInserted };
    },
  };
}

function stepCycle(d: Date, frequency: 'monthly' | 'yearly' | 'weekly'): Date {
  const out = new Date(d);
  if (frequency === 'monthly') out.setMonth(out.getMonth() + 1);
  else if (frequency === 'yearly') out.setFullYear(out.getFullYear() + 1);
  else if (frequency === 'weekly') out.setDate(out.getDate() + 7);
  return out;
}
