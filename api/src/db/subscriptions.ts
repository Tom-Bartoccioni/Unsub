import { and, count, desc, eq, isNull, lt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  paymentEvents,
  subscriptionPeriods,
  subscriptions,
  type PaymentEventRow,
  type SubscriptionPeriodRow,
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

// Reactivating a ghosted subscription: the modal re-asks price/cycle/renewal
// (they may have changed), and we open a fresh period from `startedAt` (the
// resume date, defaulting to now) while leaving the closed period untouched.
export type ReactivateInput = {
  amountMinor: number;
  currency: string;
  frequency: 'monthly' | 'yearly' | 'weekly' | 'unknown';
  nextRenewalDate: Date | null;
  startedAt: Date | null;
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
  // Additive variant: inserts one 'estimated' event per cycle from `from` to
  // now WITHOUT deleting anything. Used on reactivation so the resumed period's
  // charges are added while the previous period's history stays intact. Skips
  // any cycle date that already has an event (avoids duplicates on overlap).
  addEstimatedEventsFrom: (
    subscriptionId: string,
    from: Date,
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
  // Total number of recorded payment events across all of the user's
  // subscriptions (observed + estimated). Drives the "Total transactions" stat.
  countPaymentEvents: (userId: string) => Promise<number>;
  // All life-cycle periods for a user's subscriptions, used by the savings
  // stat (sum over CLOSED periods). Joined + ownership-scoped.
  listPeriodsByUserId: (userId: string) => Promise<SubscriptionPeriodRow[]>;
  // Periods for a single subscription, oldest-first, ownership-scoped. Drives
  // the detail timeline's "cancelled from X to Y" pause markers. Returns null
  // if the sub doesn't exist / isn't the user's.
  listPeriodsBySubscription: (
    subscriptionId: string,
    userId: string,
  ) => Promise<SubscriptionPeriodRow[] | null>;
  // Reactivate a ghosted subscription: flip status back to active, apply the
  // (possibly new) price/cycle from the modal, and open a fresh period. The
  // previously-closed period is left intact so its savings stay frozen.
  // Returns null on ownership failure.
  reactivate: (
    id: string,
    userId: string,
    input: ReactivateInput,
  ) => Promise<SubscriptionRow | null>;
  // Most-recently-cancelled subscription for a provider key, if any. Lets the
  // create flow reactivate an existing ghosted sub (preserving its history)
  // instead of leaving a stale cancelled duplicate behind.
  findCancelledByProviderKey: (
    userId: string,
    providerKey: string,
  ) => Promise<SubscriptionRow | null>;
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
      // Open an initial period the first time we see this subscription (a real
      // insert, or an existing row that predates the periods table). Idempotent
      // via the existence guard so a conflicting upsert doesn't add a second
      // open period.
      const [hasPeriod] = await db
        .select({ id: subscriptionPeriods.id })
        .from(subscriptionPeriods)
        .where(eq(subscriptionPeriods.subscriptionId, row.id))
        .limit(1);
      if (!hasPeriod) {
        await db.insert(subscriptionPeriods).values({
          subscriptionId: row.id,
          startedAt: row.startedAt ?? row.createdAt,
          endedAt: row.status === 'cancelled' ? (row.cancelledAt ?? new Date()) : null,
          amountMinor: row.amountMinor,
          currency: row.currency,
          frequency: row.frequency,
        });
      }
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
      // Stamp cancelledAt when transitioning into 'cancelled'; clear it on any
      // other status so reactivation resets the saved-money clock.
      const now = new Date();
      const statusFields =
        patch.status === undefined
          ? {}
          : patch.status === 'cancelled'
            ? { cancelledAt: now }
            : { cancelledAt: null };
      const [row] = await db
        .update(subscriptions)
        .set({ ...patch, ...statusFields, updatedAt: now })
        .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
        .returning();
      if (!row) return null;
      // Ghosting closes the currently-open period (if any) so the savings stat
      // starts accruing from `now`. Reactivation is NOT handled here — it goes
      // through reactivate(), which opens a fresh period. Other status changes
      // (active<->trial) leave periods alone.
      if (patch.status === 'cancelled') {
        await db
          .update(subscriptionPeriods)
          .set({ endedAt: now })
          .where(
            and(
              eq(subscriptionPeriods.subscriptionId, row.id),
              isNull(subscriptionPeriods.endedAt),
            ),
          );
      }
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
    async countPaymentEvents(userId) {
      const [row] = await db
        .select({ n: count() })
        .from(paymentEvents)
        .innerJoin(subscriptions, eq(paymentEvents.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.userId, userId));
      return row?.n ?? 0;
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
    async addEstimatedEventsFrom(subscriptionId, from, frequency, amountMinor, currency) {
      const dates = cycleDatesBetween(from, new Date(), frequency);
      if (dates.length === 0) return 0;
      // Fetch existing event timestamps so we don't double-insert a cycle that
      // already exists (e.g. an overlap with the previous period).
      const existing = await db
        .select({ chargedAt: paymentEvents.chargedAt })
        .from(paymentEvents)
        .where(eq(paymentEvents.subscriptionId, subscriptionId));
      const seen = new Set(existing.map((e) => e.chargedAt.getTime()));
      const rows = dates
        .filter((d) => !seen.has(d.getTime()))
        .map((d) => ({ subscriptionId, chargedAt: d, amountMinor, currency, source: 'estimated' }));
      if (rows.length === 0) return 0;
      await db.insert(paymentEvents).values(rows);
      return rows.length;
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
        // Insert an estimated payment_event for each rolled-over cycle.
        // The rollover itself is evidence the charge happened — we're
        // advancing the date because the prior next-renewal-date is in
        // the past, which means that cycle ran. No startedAt guard needed
        // for the cycles we observe rolling; only retroactive history
        // before the user started tracking needs startedAt.
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
      return { subsAdvanced, eventsInserted };
    },
    async listPeriodsBySubscription(subscriptionId, userId) {
      const [sub] = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, userId)));
      if (!sub) return null;
      return db
        .select()
        .from(subscriptionPeriods)
        .where(eq(subscriptionPeriods.subscriptionId, subscriptionId))
        .orderBy(subscriptionPeriods.startedAt);
    },
    async findCancelledByProviderKey(userId, providerKey) {
      const [row] = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.providerKey, providerKey),
            eq(subscriptions.status, 'cancelled'),
          ),
        )
        .orderBy(desc(subscriptions.updatedAt))
        .limit(1);
      return row ?? null;
    },
    async listPeriodsByUserId(userId) {
      const rows = await db
        .select({ period: subscriptionPeriods })
        .from(subscriptionPeriods)
        .innerJoin(subscriptions, eq(subscriptionPeriods.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.userId, userId));
      return rows.map((r) => r.period);
    },
    async reactivate(id, userId, input) {
      const now = new Date();
      // Ownership-scoped flip back to active + apply the resumed price/cycle.
      const [row] = await db
        .update(subscriptions)
        .set({
          status: 'active',
          cancelledAt: null,
          amountMinor: input.amountMinor,
          currency: input.currency,
          frequency: input.frequency,
          nextRenewalDate: input.nextRenewalDate,
          startedAt: input.startedAt,
          updatedAt: now,
        })
        .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
        .returning();
      if (!row) return null;
      // Defensive: close any period that's still open (shouldn't happen for a
      // cancelled sub, but guarantees the single-open-period invariant).
      await db
        .update(subscriptionPeriods)
        .set({ endedAt: now })
        .where(
          and(
            eq(subscriptionPeriods.subscriptionId, row.id),
            isNull(subscriptionPeriods.endedAt),
          ),
        );
      // If the sub was ghosted and reactivated on the SAME day, don't fragment
      // into a new period — just reopen the one that closed today (and refresh
      // its price/cycle). This avoids zero-length "paused" gaps from quick
      // ghost→reactivate toggles. Otherwise open a fresh period from the resume
      // date, leaving the earlier (genuinely paused) period closed.
      const resume = input.startedAt ?? now;
      const [latestClosed] = await db
        .select()
        .from(subscriptionPeriods)
        .where(eq(subscriptionPeriods.subscriptionId, row.id))
        .orderBy(desc(subscriptionPeriods.endedAt))
        .limit(1);
      const sameDay =
        latestClosed?.endedAt != null && startOfUtcDayMs(latestClosed.endedAt) === startOfUtcDayMs(resume);
      if (sameDay && latestClosed) {
        await db
          .update(subscriptionPeriods)
          .set({
            endedAt: null,
            amountMinor: input.amountMinor,
            currency: input.currency,
            frequency: input.frequency,
          })
          .where(eq(subscriptionPeriods.id, latestClosed.id));
      } else {
        await db.insert(subscriptionPeriods).values({
          subscriptionId: row.id,
          startedAt: resume,
          endedAt: null,
          amountMinor: input.amountMinor,
          currency: input.currency,
          frequency: input.frequency,
        });
      }
      return row;
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

// UTC-midnight epoch of a date, for comparing period boundaries at day
// granularity (endedAt has a precise time, startedAt is stored at UTC midnight).
function startOfUtcDayMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
