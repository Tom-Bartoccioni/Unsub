import { describe, expect, it } from 'vitest';
import {
  extractAmounts,
  extractFrequency,
  extractNextRenewalDate,
  extractProvider,
  parseSubscription,
  providerFromDomain,
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

  it('falls back to lower confidence when only the amount is present', () => {
    const out = parseSubscription({
      ...baseEmail,
      from: 'Acme <billing@acme.io>',
      subject: 'Your invoice',
      textBody: 'Charged: $42.00',
    });
    expect(out).not.toBeNull();
    expect(out!.amount).toBe(42);
    expect(out!.frequency).toBe('unknown');
    expect(out!.confidence).toBeLessThan(0.7);
  });
});
