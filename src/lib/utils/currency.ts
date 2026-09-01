import { CURRENCY_SYMBOL } from '@/lib/constants';

/**
 * Formats a numeric amount for display, e.g. 1234.5 → "RM 1,234.50"
 */
export function formatCurrency(amount: number, symbol: string = CURRENCY_SYMBOL): string {
  return `${symbol} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Converts a raw text input (digits only) into a formatted decimal currency string.
 * Used for controlled currency inputs: e.g. "12345" → "123.45"
 */
export function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Parses a formatted currency string back to a number.
 * e.g. "1,234.56" → 1234.56
 */
export function parseCurrencyString(value: string): number {
  return parseFloat(value.replace(/,/g, '')) || 0;
}
