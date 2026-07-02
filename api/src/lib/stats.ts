import type { SubscriptionPeriodRow, SubscriptionRow } from '../db/schema.js';

export type Frequency = 'monthly' | 'yearly' | 'weekly' | 'unknown';

// Normalise any billing frequency to a monthly amount (in the subscription's
// own minor units). Returns null for 'unknown' so callers can skip it.
export function monthlyMinor(amountMinor: number, frequency: string): number | null {
  switch (frequency) {
    case 'monthly':
      return amountMinor;
    case 'yearly':
      return amountMinor / 12;
    case 'weekly':
      return (amountMinor * 52) / 12;
    default:
      return null;
  }
}

// Whole months between two dates (>= 0). Used for "saved since cancellation"
// and "spent since start". Counts elapsed full months, min 0.
export function monthsBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (30.44 * 24 * 60 * 60 * 1000));
}

// Per-currency totals plus badge counters. The server stays currency-agnostic:
// it returns amounts grouped by the subscription's own currency (in major
// units), and the app converts to the user's display currency. This keeps the
// FX rates in one place (the app) instead of duplicating them server-side.
export type StatsResult = {
  // currency code -> amount in major units (e.g. { EUR: 25.98, USD: 9.99 }).
  monthlySpend: Record<string, number>;
  annualSpend: Record<string, number>;
  // Saved by cancelling: monthly amount × months since cancellation, per ccy.
  saved: Record<string, number>;
  // Rough lifetime spend estimate: monthly × months since start, per ccy.
  lifetimeSpent: Record<string, number>;
  counters: {
    tracked: number; // all subscriptions ever added
    active: number; // status active or trial
    cancelled: number; // status cancelled
    categories: number; // distinct categories among non-cancelled subs
    transactions: number; // total recorded payment events
    firstTrackedAt: string | null; // ISO of earliest createdAt
  };
};

function add(map: Record<string, number>, ccy: string, amount: number): void {
  map[ccy] = (map[ccy] ?? 0) + amount;
}

export function computeStats(
  rows: SubscriptionRow[],
  now: Date,
  transactionCount = 0,
  periods: SubscriptionPeriodRow[] = [],
): StatsResult {
  const monthlySpend: Record<string, number> = {};
  const annualSpend: Record<string, number> = {};
  const saved: Record<string, number> = {};
  const lifetimeSpent: Record<string, number> = {};
  const categories = new Set<string>();
  let active = 0;
  let cancelled = 0;
  let firstTrackedAt: Date | null = null;

  for (const row of rows) {
    if (!firstTrackedAt || row.createdAt < firstTrackedAt) firstTrackedAt = row.createdAt;

    const monthly = monthlyMinor(row.amountMinor, row.frequency);
    const isActive = row.status === 'active' || row.status === 'trial';

    if (isActive) {
      active++;
      if (row.category) categories.add(row.category);
      if (monthly != null) {
        add(monthlySpend, row.currency, monthly / 100);
        add(annualSpend, row.currency, (monthly * 12) / 100);
      }
    }

    if (row.status === 'cancelled') cancelled++;

    // Lifetime spend estimate: monthly × months since the user started paying.
    if (monthly != null && row.startedAt) {
      const months = monthsBetween(row.startedAt, now);
      add(lifetimeSpent, row.currency, (monthly * months) / 100);
    }
  }

  // Saved by cancelling, summed over CLOSED periods (endedAt set): each closed
  // stretch keeps accruing monthly × months-since-it-ended, at the price it had
  // when it was cancelled. This survives ghost→reactivate→ghost cycles, where a
  // single cancelledAt on the row would only remember the latest cancellation.
  //
  // Back-compat: if no periods exist yet (pre-migration data reaching this code
  // path), fall back to the old cancelledAt-based estimate so the number never
  // silently drops to zero.
  if (periods.length > 0) {
    for (const p of periods) {
      if (!p.endedAt) continue; // open period — not "saved"
      const monthly = monthlyMinor(p.amountMinor, p.frequency);
      if (monthly == null) continue;
      const months = monthsBetween(p.endedAt, now);
      add(saved, p.currency, (monthly * months) / 100);
    }
  } else {
    for (const row of rows) {
      if (row.status !== 'cancelled') continue;
      const monthly = monthlyMinor(row.amountMinor, row.frequency);
      if (monthly == null) continue;
      const since = row.cancelledAt ?? row.updatedAt;
      const months = monthsBetween(since, now);
      add(saved, row.currency, (monthly * months) / 100);
    }
  }

  return {
    monthlySpend,
    annualSpend,
    saved,
    lifetimeSpent,
    counters: {
      tracked: rows.length,
      active,
      cancelled,
      categories: categories.size,
      transactions: transactionCount,
      firstTrackedAt: firstTrackedAt ? firstTrackedAt.toISOString() : null,
    },
  };
}
