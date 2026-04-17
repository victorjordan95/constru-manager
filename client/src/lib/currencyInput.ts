/**
 * Currency input utilities for pt-BR mask (e.g. "1.234,56")
 *
 * maskCurrency("123456") → "1.234,56"
 * parseCurrencyInput("1.234,56") → 123456  (cents)
 */

export function maskCurrency(rawInput: string): string {
  const digits = rawInput.replace(/\D/g, '');
  if (!digits) return '';
  const cents = parseInt(digits, 10);
  if (cents === 0) return '';
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseCurrencyInput(masked: string): number {
  if (!masked) return 0;
  const normalized = masked.replace(/\./g, '').replace(',', '.');
  const value = parseFloat(normalized);
  return isNaN(value) ? 0 : Math.round(value * 100);
}

/** Converts a cents integer to display string for pre-filling an edit form */
export function centsToMasked(cents: number): string {
  if (!cents) return '';
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Masks a plain decimal string (e.g. "20.5" → "20,50") for percentage fields */
export function maskDecimal(rawInput: string): string {
  // Allow only digits and a single comma or dot
  const cleaned = rawInput.replace(/[^0-9.,]/g, '').replace(',', '.');
  const parts = cleaned.split('.');
  const intPart = parts[0] ?? '';
  const decPart = parts[1] ?? '';
  if (!intPart && !decPart) return '';
  return decPart !== undefined && parts.length > 1
    ? `${intPart},${decPart.slice(0, 2)}`
    : intPart;
}

export function parseDecimalInput(masked: string): number {
  if (!masked) return 0;
  const normalized = masked.replace(',', '.');
  const value = parseFloat(normalized);
  return isNaN(value) ? 0 : value;
}
