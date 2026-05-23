// Hardcoded approximate FX rates. Real currency conversion is a follow-up.
// Rate definition: 1 unit of `<key>` = `<value>` EUR (so to convert any
// currency to EUR multiply by the rate; to convert EUR to any other
// currency, divide).
const FX_TO_EUR: Record<string, number> = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.16,
  CHF: 1.04,
  CAD: 0.66,
  AUD: 0.6,
  JPY: 0.0062,
};

export function convert(amount: number, from: string, to: string): number {
  if (from === to) return amount;
  const fromRate = FX_TO_EUR[from] ?? 1;
  const toRate = FX_TO_EUR[to] ?? 1;
  return (amount * fromRate) / toRate;
}

export function monthlyAmount(amount: number, frequency: string): number | null {
  if (frequency === 'monthly') return amount;
  if (frequency === 'yearly') return amount / 12;
  if (frequency === 'weekly') return (amount * 52) / 12;
  return null;
}

export function formatPrice(amount: number, currency: string): string {
  try {
    const out = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    // Intl emits locale-specific whitespace around the symbol (e.g. French
    // uses a non-breaking space before €). Trim leading/trailing whitespace
    // so centered text aligns on the actual glyphs, not the padded box.
    return out.replace(/^\s+|\s+$/g, '');
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function frequencyLabel(frequency: string): string {
  if (frequency === 'monthly') return 'Month';
  if (frequency === 'yearly') return 'Year';
  if (frequency === 'weekly') return 'Week';
  return 'One-off';
}

export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'] as const;
