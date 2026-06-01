// client/src/lib/formatIdr.js
// Indonesian Rupiah formatting helpers. The API sends/stores money as numeric
// strings (§6.0); format only at the display boundary, parse only at form submit.

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const GROUP = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/**
 * Format a number or numeric string as IDR currency, no decimals.
 * e.g. 1500000 → "Rp 1.500.000". Nullish / non-numeric input → "Rp 0".
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatIdr(value) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return IDR.format(Number.isFinite(n) ? n : 0);
}

/**
 * Parse a user-typed IDR string back to a number. Strips "Rp", spaces and
 * thousands separators ("."), treats "," as the decimal point, and preserves a
 * leading minus (used for balance/market adjustments). Unparseable → NaN.
 * @param {string|number|null|undefined} input
 * @returns {number}
 */
export function parseIdrInput(input) {
  if (typeof input === 'number') return input;
  if (input == null) return NaN;
  const negative = /^\s*-/.test(String(input));
  const cleaned = String(input)
    .replace(/rp/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.]/g, '');
  if (cleaned === '' || cleaned === '.') return NaN;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return NaN;
  return negative ? -n : n;
}

/**
 * Reformat a raw input value into grouped digits for display inside a text field,
 * with no currency symbol — e.g. "1500000" → "1.500.000". Keeps a lone leading
 * minus or empty string as-is so typing isn't interrupted.
 * @param {string|number|null|undefined} input
 * @returns {string}
 */
export function formatIdrInput(input) {
  if (input == null || input === '') return '';
  const str = String(input);
  if (str === '-') return '-';
  const n = parseIdrInput(str);
  if (Number.isNaN(n)) return '';
  return GROUP.format(n);
}

export default formatIdr;
