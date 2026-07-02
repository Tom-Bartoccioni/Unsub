import { describe, expect, it } from 'vitest';
import { computeStats, monthlyMinor, monthsBetween } from '../lib/stats.js';
import type { SubscriptionPeriodRow, SubscriptionRow } from '../db/schema.js';

// Minimal SubscriptionPeriodRow factory for the period-based savings tests.
function period(overrides: Partial<SubscriptionPeriodRow>): SubscriptionPeriodRow {
  return {
    id: 'p',
    subscriptionId: 'id',
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    endedAt: null,
    amountMinor: 1000,
    currency: 'EUR',
    frequency: 'monthly',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as SubscriptionPeriodRow;
}

// Minimal SubscriptionRow factory — only the fields computeStats reads matter.
function sub(overrides: Partial<SubscriptionRow>): SubscriptionRow {
  return {
    id: 'id',
    userId: 'u',
    provider: 'Provider',
    providerKey: 'provider',
    category: null,
    amountMinor: 1000,
    currency: 'EUR',
    frequency: 'monthly',
    nextRenewalDate: null,
    startedAt: null,
    confidence: 1,
    status: 'active',
    cancelledAt: null,
    sourceMessageId: null,
    sourceDate: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as SubscriptionRow;
}

const NOW = new Date('2026-06-01T00:00:00.000Z');

describe('monthlyMinor', () => {
  it('passes monthly through', () => {
    expect(monthlyMinor(1000, 'monthly')).toBe(1000);
  });
  it('divides yearly by 12', () => {
    expect(monthlyMinor(1200, 'yearly')).toBe(100);
  });
  it('scales weekly to monthly', () => {
    expect(monthlyMinor(100, 'weekly')).toBeCloseTo((100 * 52) / 12);
  });
  it('returns null for unknown', () => {
    expect(monthlyMinor(1000, 'unknown')).toBeNull();
  });
});

describe('monthsBetween', () => {
  it('is 0 for future or equal dates', () => {
    expect(monthsBetween(NOW, NOW)).toBe(0);
    expect(monthsBetween(new Date('2026-07-01'), NOW)).toBe(0);
  });
  it('counts whole elapsed months', () => {
    expect(monthsBetween(new Date('2026-04-01T00:00:00.000Z'), NOW)).toBe(2);
  });
});

describe('computeStats', () => {
  it('sums active monthly + annual spend per currency', () => {
    const r = computeStats(
      [
        sub({ amountMinor: 999, currency: 'EUR', frequency: 'monthly', status: 'active' }),
        sub({ amountMinor: 1200, currency: 'USD', frequency: 'yearly', status: 'active' }),
      ],
      NOW,
    );
    expect(r.monthlySpend.EUR).toBeCloseTo(9.99);
    expect(r.monthlySpend.USD).toBeCloseTo(1.0); // 12/12
    expect(r.annualSpend.EUR).toBeCloseTo(9.99 * 12);
  });

  it('computes saved as monthly × months since cancellation', () => {
    // Spotify 15€ cancelled 2 months ago + Netflix 10€ cancelled 1 month ago.
    const r = computeStats(
      [
        sub({
          amountMinor: 1500,
          status: 'cancelled',
          cancelledAt: new Date('2026-04-01T00:00:00.000Z'),
        }),
        sub({
          amountMinor: 1000,
          status: 'cancelled',
          cancelledAt: new Date('2026-05-01T00:00:00.000Z'),
        }),
      ],
      NOW,
    );
    // 15 × 2 + 10 × 1 = 40
    expect(r.saved.EUR).toBeCloseTo(40);
    expect(r.counters.cancelled).toBe(2);
  });

  it('falls back to updatedAt when cancelledAt is null', () => {
    const r = computeStats(
      [
        sub({
          amountMinor: 1000,
          status: 'cancelled',
          cancelledAt: null,
          updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        }),
      ],
      NOW,
    );
    expect(r.saved.EUR).toBeCloseTo(20); // 10 × 2 months
  });

  it('computes saved from CLOSED periods when periods are provided', () => {
    // Same Spotify/Netflix example, now via periods: Spotify 15€ ended 2mo ago,
    // Netflix 10€ ended 1mo ago → 15×2 + 10×1 = 40.
    const rows = [sub({ status: 'cancelled' }), sub({ id: 'id2', status: 'cancelled' })];
    const periods = [
      period({ amountMinor: 1500, endedAt: new Date('2026-04-01T00:00:00.000Z') }),
      period({
        id: 'p2',
        subscriptionId: 'id2',
        amountMinor: 1000,
        endedAt: new Date('2026-05-01T00:00:00.000Z'),
      }),
    ];
    const r = computeStats(rows, NOW, 0, periods);
    expect(r.saved.EUR).toBeCloseTo(40);
  });

  it('ignores OPEN periods in saved (an active resubscription accrues nothing)', () => {
    // A sub that was ghosted (closed period, 2mo) then reactivated (open
    // period): only the closed stretch counts toward savings.
    const rows = [sub({ status: 'active' })];
    const periods = [
      period({ amountMinor: 1000, endedAt: new Date('2026-04-01T00:00:00.000Z') }), // closed 2mo
      period({ id: 'p2', amountMinor: 1200, endedAt: null }), // open, current
    ];
    const r = computeStats(rows, NOW, 0, periods);
    expect(r.saved.EUR).toBeCloseTo(20); // 10 × 2, the open period contributes 0
  });

  it('sums multiple closed periods across a ghost→reactivate→ghost cycle', () => {
    // One subscription, cancelled twice at different prices: 10€ ended 3mo ago
    // and 12€ ended 1mo ago → 10×3 + 12×1 = 42. A single cancelledAt could
    // never remember both.
    const rows = [sub({ status: 'cancelled' })];
    const periods = [
      period({ amountMinor: 1000, endedAt: new Date('2026-03-01T00:00:00.000Z') }),
      period({ id: 'p2', amountMinor: 1200, endedAt: new Date('2026-05-01T00:00:00.000Z') }),
    ];
    const r = computeStats(rows, NOW, 0, periods);
    expect(r.saved.EUR).toBeCloseTo(42);
  });

  it('does not count active subs in saved', () => {
    const r = computeStats([sub({ status: 'active' })], NOW);
    expect(r.saved.EUR ?? 0).toBe(0);
  });

  it('counts distinct categories among non-cancelled subs only', () => {
    const r = computeStats(
      [
        sub({ category: 'Entertainment', status: 'active' }),
        sub({ category: 'Cloud', status: 'active' }),
        sub({ category: 'Entertainment', status: 'active' }),
        sub({ category: 'News', status: 'cancelled' }),
      ],
      NOW,
    );
    expect(r.counters.categories).toBe(2);
    expect(r.counters.active).toBe(3);
    expect(r.counters.tracked).toBe(4);
  });

  it('tracks the earliest createdAt', () => {
    const r = computeStats(
      [
        sub({ createdAt: new Date('2026-03-01T00:00:00.000Z') }),
        sub({ createdAt: new Date('2026-01-15T00:00:00.000Z') }),
      ],
      NOW,
    );
    expect(r.counters.firstTrackedAt).toBe('2026-01-15T00:00:00.000Z');
  });

  it('returns empty maps and zero counters for no subs', () => {
    const r = computeStats([], NOW);
    expect(r.monthlySpend).toEqual({});
    expect(r.counters.tracked).toBe(0);
    expect(r.counters.transactions).toBe(0);
    expect(r.counters.firstTrackedAt).toBeNull();
  });

  it('passes through the transaction count', () => {
    const r = computeStats([sub({})], NOW, 42);
    expect(r.counters.transactions).toBe(42);
  });
});
