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
 *
 * Hardened: rather than silently stripping unknown characters, clearly invalid
 * money is REJECTED as NaN — scientific notation ('5e10'), hex ('0x1A'), double
 * negatives ('--50000'), and any stray non-numeric character. Legitimate forms
 * stay valid: dot thousands separators ('50.000.000.000' = 50 billion), a single
 * leading minus ('-50000'), one comma decimal, and the 'Rp'/'IDR' currency prefix.
 * @param {string|number|null|undefined} input
 * @returns {number}
 */
export function parseIdrInput(input) {
  if (typeof input === 'number') return input;
  if (input == null) return NaN;
  const negative = /^\s*-/.test(String(input));

  // Strip the currency symbol and whitespace, then validate the remainder BEFORE
  // collapsing separators — at this point a "." is still a (thousands) separator.
  const cleaned = String(input)
    .replace(/rp/gi, '')
    .replace(/\s/g, '');

  // Reject scientific notation — never used for IDR entry ('5e10', '1e100').
  if (/[eE]/.test(cleaned)) return NaN;
  // Reject hex notation ('0x1A').
  if (/0x/i.test(cleaned)) return NaN;
  // Reject double negatives — always a typo ('--50000').
  if (/--/.test(cleaned)) return NaN;
  // Reject any character that is not a digit, separator or single minus. 'IDR' is
  // the ISO 4217 code for Rupiah, allowed as a prefix alongside the 'Rp' symbol.
  if (/[^0-9.,\-\s]/.test(cleaned.replace(/idr/gi, ''))) return NaN;

  const digits = cleaned
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.]/g, '');
  if (digits === '' || digits === '.') return NaN;
  const n = Number(digits);
  if (!Number.isFinite(n)) return NaN;
  return negative ? -n : n;
}

/**
 * Normalize a stored numeric value (the API returns money as a NUMERIC string such
 * as "59137.00") into a plain, un-grouped string for use as a raw <input> value —
 * e.g. "59137.00" → "59137", "1500.5" → "1500.5". Nullish / empty / non-numeric → "".
 *
 * Money inputs submit through `parseIdrInput` (V9 §15.1), which reads "." as a
 * thousands separator. This returns a plain un-grouped value purely to keep the raw
 * <input> simple; the parser handles any grouping the user later types.
 * @param {string|number|null|undefined} value
 * @returns {string}
 */
export function toAmountInput(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : '';
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
