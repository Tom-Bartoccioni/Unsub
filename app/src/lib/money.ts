// Hardcoded approximate FX rates for the donut total. The list itself shows
// each subscription in its native currency. Real FX rates are a follow-up.
const FX_TO_EUR: Record<string, number> = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.16,
  CHF: 1.04,
  CAD: 0.66,
  AUD: 0.6,
  JPY: 0.0062,
};

export const DISPLAY_CURRENCY = 'EUR';
export const DISPLAY_CURRENCY_SYMBOL = '€';

export function toDisplayCurrency(amount: number, currency: string): number {
  return amount * (FX_TO_EUR[currency] ?? 1);
}

export function monthlyAmount(amount: number, frequency: string): number | null {
  if (frequency === 'monthly') return amount;
  if (frequency === 'yearly') return amount / 12;
  if (frequency === 'weekly') return (amount * 52) / 12;
  return null;
}

export function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatDisplayTotal(amount: number): string {
  return formatPrice(amount, DISPLAY_CURRENCY);
}

export function frequencyLabel(frequency: string): string {
  if (frequency === 'monthly') return 'Month';
  if (frequency === 'yearly') return 'Year';
  if (frequency === 'weekly') return 'Week';
  return 'One-off';
}
