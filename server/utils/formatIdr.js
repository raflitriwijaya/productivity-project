// server/utils/formatIdr.js
// Server-side Indonesian Rupiah formatting. Mirrors client/src/lib/formatIdr.js so
// any IDR strings the API composes (e.g. log lines, toast messages built server-side)
// match what the frontend renders. Values are stored as NUMERIC and travel over the
// wire as numeric strings (§6.0); format only at display boundaries.

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

/**
 * Format a number (or numeric string) as IDR, no decimals — e.g. 1500000 → "Rp 1.500.000".
 * Invalid / nullish input formats as "Rp 0".
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatIdr(value) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return IDR.format(Number.isFinite(n) ? n : 0);
}

/**
 * Parse a user-entered IDR string back to a number — strips "Rp", thousands
 * separators (".") and spaces; treats "," as the decimal separator.
 * Returns NaN for unparseable input.
 * @param {string|number|null|undefined} input
 * @returns {number}
 */
export function parseIdrInput(input) {
  if (typeof input === 'number') return input;
  if (input == null) return NaN;
  const cleaned = String(input)
    .replace(/rp/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .trim();
  if (cleaned === '') return NaN;
  return Number(cleaned);
}

export default formatIdr;
