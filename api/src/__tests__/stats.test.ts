import { describe, expect, it } from 'vitest';
import { computeStats, monthlyMinor, monthsBetween } from '../lib/stats.js';
import type { SubscriptionRow } from '../db/schema.js';

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
