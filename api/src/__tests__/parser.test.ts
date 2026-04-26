import { describe, expect, it } from 'vitest';
import {
  dedupSubscriptions,
  extractAmounts,
  extractFrequency,
  extractNextRenewalDate,
  extractProvider,
  parseSubscription,
  providerFromDomain,
  type ParsedSubscription,
} from '../lib/parser.js';
import type { NormalizedEmail } from '../lib/gmail.js';

const baseEmail: NormalizedEmail = {
  id: 'm1',
  threadId: 't1',
  internalDate: new Date('2026-04-26T12:00:00Z'),
  from: '',
  to: 'me@example.com',
  subject: '',
  snippet: '',
  textBody: '',
  htmlBody: '',
};

describe('extractProvider / providerFromDomain', () => {
  it('uses the From display name when human-readable', () => {
    expect(extractProvider({ ...baseEmail, from: 'Spotify <noreply@spotify.com>' })).toBe(
      'Spotify',
    );
    expect(extractProvider({ ...baseEmail, from: '"Netflix" <info@account.netflix.com>' })).toBe(
      'Netflix',
    );
  });

  it('falls back to the email domain for generic display names', () => {
    expect(extractProvider({ ...baseEmail, from: 'noreply <billing@stripe.com>' })).toBe('Stripe');
    expect(extractProvider({ ...baseEmail, from: 'billing@github.com' })).toBe('GitHub');
  });

  it('strips public TLDs and applies overrides', () => {
    expect(providerFromDomain('mail.openai.com')).toBe('OpenAI');
    expect(providerFromDomain('account.netflix.fr')).toBe('Netflix');
    expect(providerFromDomain('foo.bar.uk')).toBe('Bar');
  });
});

describe('extractAmounts', () => {
  it('parses USD with $ symbol', () => {
    expect(extractAmounts('Total: $9.99')).toContainEqual({ amount: 9.99, currency: 'USD' });
  });

  it('parses EUR with comma decimal and trailing symbol', () => {
    expect(extractAmounts('Montant: 12,99 €')).toContainEqual({ amount: 12.99, currency: 'EUR' });
  });

  it('parses ISO codes (USD/EUR/GBP)', () => {
    expect(extractAmounts('Charged EUR 7.50')).toContainEqual({ amount: 7.5, currency: 'EUR' });
    expect(extractAmounts('Charged 19.99 GBP')).toContainEqual({ amount: 19.99, currency: 'GBP' });
  });

  it('handles thousands separators', () => {
    expect(extractAmounts('Total: $1,299.00')).toContainEqual({ amount: 1299, currency: 'USD' });
  });
});

describe('extractFrequency', () => {
  it('detects monthly / yearly / weekly cues', () => {
    expect(extractFrequency('billed monthly')).toBe('monthly');
    expect(extractFrequency('Annual subscription renewed')).toBe('yearly');
    expect(extractFrequency('weekly plan')).toBe('weekly');
    expect(extractFrequency('one-time payment')).toBe('unknown');
  });

  it('matches /month and /year shortcuts', () => {
    expect(extractFrequency('$9.99/month')).toBe('monthly');
    expect(extractFrequency('$99.99/year')).toBe('yearly');
  });
});

describe('extractNextRenewalDate', () => {
  it('parses ISO date after a cue', () => {
    const d = extractNextRenewalDate(
      'Next billing date: 2026-05-25',
      new Date('2026-04-26T00:00:00Z'),
    );
    expect(d?.toISOString().slice(0, 10)).toBe('2026-05-25');
  });

  it('parses month-name date', () => {
    const d = extractNextRenewalDate('Renews on May 25, 2026', new Date('2026-04-26T00:00:00Z'));
    expect(d?.toISOString().slice(0, 10)).toBe('2026-05-25');
  });

  it('returns null when no cue is present', () => {
    expect(extractNextRenewalDate('Thanks for your order', new Date())).toBeNull();
  });
});

describe('parseSubscription (end-to-end)', () => {
  it('extracts provider, amount, frequency, and renewal from a Spotify-style email', () => {
    const out = parseSubscription({
      ...baseEmail,
      from: 'Spotify <no-reply@spotify.com>',
      subject: 'Your Spotify Premium receipt',
      textBody: [
        'Thanks for subscribing to Spotify Premium.',
        'Amount charged: €9.99',
        'Plan: monthly',
        'Next renewal: May 26, 2026',
      ].join('\n'),
    });
    expect(out).not.toBeNull();
    expect(out!.provider).toBe('Spotify');
    expect(out!.amount).toBe(9.99);
    expect(out!.currency).toBe('EUR');
    expect(out!.frequency).toBe('monthly');
    expect(out!.nextRenewalDate?.toISOString().slice(0, 10)).toBe('2026-05-26');
    expect(out!.confidence).toBeGreaterThanOrEqual(0.9);
    expect(out!.sourceDate).toEqual(baseEmail.internalDate);
  });

  it('returns null when the email has nothing actionable', () => {
    const out = parseSubscription({
      ...baseEmail,
      from: 'Friend <friend@example.com>',
      subject: 'Lunch tomorrow?',
      textBody: 'Pick a place and let me know.',
    });
    expect(out).toBeNull();
  });

  it('drops emails with no amount (workspace notifications, etc.)', () => {
    const out = parseSubscription({
      ...baseEmail,
      from: 'Atlassian <noreply@atlassian.com>',
      subject: 'Your monthly digest',
      textBody: 'Here is what happened in your workspace this month.',
    });
    expect(out).toBeNull();
  });

  it('rejects one-off Booking.com payments even when amount + provider parse', () => {
    const out = parseSubscription({
      ...baseEmail,
      from: 'Booking.com <noreply@booking.com>',
      subject: 'Booking Confirmation: Hotel Lutetia, Paris',
      textBody: 'Total: €83.39\nCheck-in: May 1, 2026',
    });
    expect(out).toBeNull();
  });

  it('rejects e-commerce order confirmations', () => {
    const out = parseSubscription({
      ...baseEmail,
      from: 'Amazon <auto-confirm@amazon.com>',
      subject: 'Your order #123-456 has shipped',
      textBody: 'Total: $42.00',
    });
    expect(out).toBeNull();
  });

  it('drops emails with an amount but no recurring cue (could be a one-off)', () => {
    const out = parseSubscription({
      ...baseEmail,
      from: 'Acme <billing@acme.io>',
      subject: 'Your invoice',
      textBody: 'Charged: $42.00',
    });
    expect(out).toBeNull();
  });

  it('keeps a candidate when a renewal date is present even without a frequency cue', () => {
    const out = parseSubscription({
      ...baseEmail,
      from: 'Acme <billing@acme.io>',
      subject: 'Your invoice',
      textBody: 'Charged: $42.00\nNext billing date: 2026-05-26',
    });
    expect(out).not.toBeNull();
    expect(out!.amount).toBe(42);
    expect(out!.frequency).toBe('unknown');
    expect(out!.nextRenewalDate?.toISOString().slice(0, 10)).toBe('2026-05-26');
  });
});

describe('dedupSubscriptions', () => {
  const make = (
    overrides: Partial<ParsedSubscription> & Pick<ParsedSubscription, 'sourceDate'>,
  ): ParsedSubscription => ({
    provider: 'Atlassian Loom',
    amount: 24,
    currency: 'USD',
    frequency: 'monthly',
    nextRenewalDate: null,
    confidence: 0.65,
    sourceMessageId: `m-${overrides.sourceDate.getTime()}`,
    ...overrides,
  });

  it('collapses three identical receipts into one (newest wins)', () => {
    const items = [
      make({ sourceDate: new Date('2026-02-15') }),
      make({ sourceDate: new Date('2026-04-15') }),
      make({ sourceDate: new Date('2026-03-15') }),
    ];
    const out = dedupSubscriptions(items);
    expect(out).toHaveLength(1);
    expect(out[0]!.sourceDate.toISOString().slice(0, 10)).toBe('2026-04-15');
  });

  it('keeps separate entries for different (provider, amount) tuples', () => {
    const items = [
      make({ sourceDate: new Date('2026-04-15') }),
      make({
        provider: 'Spotify',
        amount: 9.99,
        currency: 'EUR',
        sourceDate: new Date('2026-04-10'),
      }),
    ];
    expect(dedupSubscriptions(items)).toHaveLength(2);
  });

  it('collapses sibling product labels (Atlassian vs Atlassian Loom) when amount+freq match', () => {
    const items = [
      make({ provider: 'Atlassian Loom', sourceDate: new Date('2026-04-15') }),
      make({ provider: 'Atlassian', sourceDate: new Date('2026-04-10') }),
    ];
    const out = dedupSubscriptions(items);
    expect(out).toHaveLength(1);
    // Newest wins: 'Atlassian Loom' on 2026-04-15.
    expect(out[0]!.provider).toBe('Atlassian Loom');
  });
});
