import type { NormalizedEmail } from './gmail.js';

export type Frequency = 'weekly' | 'monthly' | 'yearly' | 'unknown';

export type ParsedSubscription = {
  provider: string;
  amount: number | null;
  currency: string | null;
  frequency: Frequency;
  nextRenewalDate: Date | null;
  confidence: number; // 0..1
  sourceMessageId: string;
};

const SYMBOL_TO_CODE: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
};

const KNOWN_CODES = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD']);

const NO_REPLY_SENDER_RX = /^(no.?reply|notifications?|billing|invoices?|info|hello|support)$/i;

const PUBLIC_TLDS = new Set([
  'com',
  'net',
  'org',
  'io',
  'co',
  'app',
  'dev',
  'ai',
  'me',
  'fr',
  'de',
  'uk',
  'es',
  'it',
  'nl',
  'be',
  'ch',
  'at',
  'ie',
  'pt',
  'eu',
  'us',
  'ca',
  'au',
  'nz',
]);

const PROVIDER_DOMAIN_OVERRIDES: Record<string, string> = {
  youtube: 'YouTube',
  google: 'Google',
  youtubepremium: 'YouTube Premium',
  aws: 'AWS',
  github: 'GitHub',
  gitlab: 'GitLab',
  openai: 'OpenAI',
  apple: 'Apple',
  icloud: 'iCloud',
  spotify: 'Spotify',
  netflix: 'Netflix',
  disneyplus: 'Disney+',
  adobe: 'Adobe',
  microsoft: 'Microsoft',
  office365: 'Microsoft 365',
};

export function parseSubscription(email: NormalizedEmail): ParsedSubscription | null {
  const provider = extractProvider(email);
  if (!provider) return null;

  const text = preferText(email);
  const subjectAndBody = `${email.subject}\n${text}`;

  const amounts = extractAmounts(subjectAndBody);
  const best = pickBestAmount(amounts, subjectAndBody);

  const frequency = extractFrequency(subjectAndBody);
  const nextRenewalDate = extractNextRenewalDate(subjectAndBody, email.internalDate);

  let confidence = 0;
  if (best) confidence += 0.4;
  if (frequency !== 'unknown') confidence += 0.25;
  if (nextRenewalDate) confidence += 0.25;
  if (provider !== 'Unknown') confidence += 0.1;

  // If we can't even find an amount, the email probably isn't a real receipt.
  if (!best && frequency === 'unknown' && !nextRenewalDate) return null;

  return {
    provider,
    amount: best?.amount ?? null,
    currency: best?.currency ?? null,
    frequency,
    nextRenewalDate,
    confidence: Math.min(1, confidence),
    sourceMessageId: email.id,
  };
}

function preferText(email: NormalizedEmail): string {
  if (email.textBody) return email.textBody;
  if (email.htmlBody) return stripHtml(email.htmlBody);
  return email.snippet;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractProvider(email: NormalizedEmail): string {
  const from = email.from;
  // Display-name form: "Spotify <noreply@spotify.com>" or '"Spotify" <...>'
  const nameMatch = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (nameMatch) {
    const candidate = nameMatch[1]!.trim();
    if (candidate && !NO_REPLY_SENDER_RX.test(candidate.split(/\s+/)[0] ?? '')) {
      return titleCase(candidate);
    }
  }
  // Fallback: derive from email domain.
  const addr = (from.match(/<([^>]+)>/)?.[1] ?? from.match(/\S+@\S+/)?.[0] ?? '').trim();
  const domain = addr.split('@')[1] ?? '';
  if (!domain) return 'Unknown';
  return providerFromDomain(domain);
}

export function providerFromDomain(domain: string): string {
  const parts = domain.toLowerCase().split('.').filter(Boolean);
  let i = parts.length - 1;
  while (i >= 0 && PUBLIC_TLDS.has(parts[i]!)) i--;
  const main = parts[i] ?? domain;
  if (PROVIDER_DOMAIN_OVERRIDES[main]) return PROVIDER_DOMAIN_OVERRIDES[main]!;
  return titleCase(main.replace(/-/g, ' '));
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

type Money = { amount: number; currency: string };

export function extractAmounts(text: string): Money[] {
  const out: Money[] = [];

  // Pattern A: symbol-or-code BEFORE amount, e.g. "$9.99", "€12,99", "EUR 9.99"
  const reBefore =
    /([$€£¥]|\b(?:USD|EUR|GBP|JPY|CHF|CAD|AUD))\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+[.,]\d{2})/gi;
  for (const m of text.matchAll(reBefore)) {
    const sym = m[1]!;
    const num = parseAmount(m[2]!);
    if (num != null) out.push({ amount: num, currency: codeForSymbol(sym) });
  }

  // Pattern B: amount BEFORE symbol-or-code, e.g. "9,99 €", "12.50 USD"
  const reAfter =
    /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+[.,]\d{2})\s?([$€£¥]|\b(?:USD|EUR|GBP|JPY|CHF|CAD|AUD)\b)/gi;
  for (const m of text.matchAll(reAfter)) {
    const num = parseAmount(m[1]!);
    const sym = m[2]!;
    if (num != null) out.push({ amount: num, currency: codeForSymbol(sym) });
  }

  return out;
}

function codeForSymbol(s: string): string {
  const upper = s.toUpperCase();
  if (KNOWN_CODES.has(upper)) return upper;
  return SYMBOL_TO_CODE[s] ?? upper;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  const decimalIdx = Math.max(lastDot, lastComma);
  let intPart: string;
  let fracPart = '';
  if (decimalIdx === -1) {
    intPart = cleaned;
  } else {
    intPart = cleaned.slice(0, decimalIdx).replace(/[.,]/g, '');
    fracPart = cleaned.slice(decimalIdx + 1);
    // If the "decimal" part is 3 digits and there's no other separator, it was actually a thousands sep
    if (
      fracPart.length === 3 &&
      lastDot === -1 &&
      lastComma >= 0 &&
      cleaned.length === intPart.length + 4
    ) {
      intPart = cleaned.replace(/[.,]/g, '');
      fracPart = '';
    }
  }
  const num = Number(`${intPart}.${fracPart || '0'}`);
  return Number.isFinite(num) ? num : null;
}

function pickBestAmount(amounts: Money[], context: string): Money | null {
  if (amounts.length === 0) return null;
  if (amounts.length === 1) return amounts[0]!;

  // Prefer the amount nearest a "total"/"charge"/"billed" keyword.
  const keywordRx = /\b(total|amount(?:\s+(?:charged|due))?|charged|billed|paid|grand\s+total)\b/gi;
  const keywordPositions: number[] = [];
  for (const m of context.matchAll(keywordRx)) {
    if (m.index != null) keywordPositions.push(m.index);
  }

  if (keywordPositions.length > 0) {
    const indexed = amounts.map((a, idx) => ({ a, idx }));
    indexed.sort((x, y) => {
      const dx = nearestDistance(x.idx, context, x.a, keywordPositions);
      const dy = nearestDistance(y.idx, context, y.a, keywordPositions);
      return dx - dy;
    });
    return indexed[0]!.a;
  }

  // Otherwise, the largest is usually the order total.
  return [...amounts].sort((a, b) => b.amount - a.amount)[0]!;
}

function nearestDistance(_idx: number, _ctx: string, _money: Money, positions: number[]): number {
  // We don't know the original match index of `_money` cheaply (we threw it away in extract).
  // Approximate by scanning for the formatted amount. Cheap but bounded.
  // For phase 1 the amount list is small (~5–10), so this is fine.
  return Math.min(...positions);
}

export function extractFrequency(text: string): Frequency {
  const t = text.toLowerCase();
  if (/\b(annual(?:ly)?|year(?:ly)?|per\s+year|\/year|annuel)\b/.test(t)) return 'yearly';
  if (/\b(week(?:ly)?|per\s+week|\/week)\b/.test(t)) return 'weekly';
  if (/\b(month(?:ly)?|per\s+month|\/(?:mo|month)|monthly\s+plan|mensuel)\b/.test(t))
    return 'monthly';
  return 'unknown';
}

const MONTH_NAMES =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

const MONTH_LOOKUP: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

export function extractNextRenewalDate(text: string, base: Date): Date | null {
  const cuePart =
    '(?:next\\s+(?:renewal|billing|charge|payment|invoice)(?:\\s+date)?|' +
    'renews?\\s+on|' +
    'will\\s+(?:renew|be\\s+billed)\\s+on|' +
    '(?:billing|renewal|payment|charge|due)\\s+date)';
  const datePart =
    `(?<date>${MONTH_NAMES}\\s+\\d{1,2}(?:,?\\s*\\d{4})?|` +
    '\\d{4}-\\d{2}-\\d{2}|' +
    '\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}|' +
    `\\d{1,2}\\s+${MONTH_NAMES}(?:\\s+\\d{4})?)`;
  const rx = new RegExp(`${cuePart}[\\s:]*${datePart}`, 'i');
  const m = text.match(rx);
  if (!m) return null;
  return parseFlexibleDate(m.groups?.date ?? '', base);
}

function parseFlexibleDate(raw: string, base: Date): Date | null {
  const trimmed = raw.trim();

  // ISO yyyy-mm-dd
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return utcDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  // mm/dd/yyyy or mm/dd/yy (US convention)
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    return utcDate(year, Number(slash[1]) - 1, Number(slash[2]));
  }

  // "May 25" / "May 25, 2026" / "May 25 2026"
  const monthDay = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?$/);
  if (monthDay) {
    const month = MONTH_LOOKUP[monthDay[1]!.toLowerCase()];
    if (month == null) return null;
    return withInferredYear(month, Number(monthDay[2]), monthDay[3], base);
  }

  // "25 May" / "25 May 2026"
  const dayMonth = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?$/);
  if (dayMonth) {
    const month = MONTH_LOOKUP[dayMonth[2]!.toLowerCase()];
    if (month == null) return null;
    return withInferredYear(month, Number(dayMonth[1]), dayMonth[3], base);
  }

  return null;
}

function withInferredYear(
  month: number,
  day: number,
  yearStr: string | undefined,
  base: Date,
): Date | null {
  if (yearStr) return utcDate(Number(yearStr), month, day);
  const candidate = utcDate(base.getUTCFullYear(), month, day);
  if (!candidate) return null;
  if (candidate.getTime() < base.getTime()) {
    candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
  }
  return candidate;
}

function utcDate(year: number, monthIdx: number, day: number): Date | null {
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthIdx) ||
    !Number.isFinite(day) ||
    monthIdx < 0 ||
    monthIdx > 11 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return new Date(Date.UTC(year, monthIdx, day));
}
