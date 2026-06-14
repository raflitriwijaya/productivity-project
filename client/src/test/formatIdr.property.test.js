// client/src/test/formatIdr.property.test.js
//
// Property-based + exhaustive-edge-case suite for the IDR money helpers. This is
// the single most important client test file: it prevents the x100 bug (where a
// "." thousands separator was mis-read as a decimal point) from ever returning,
// and pins the EXACT behavior of the parse/format boundary so a 50-year codebase
// can refactor these functions with confidence.
//
// -- CALIBRATION NOTES (verified against the real implementation, not assumed) --
//
//  1. `formatIdr` uses Intl.NumberFormat('id-ID', { currency: 'IDR' }). The ICU
//     output separates "Rp" from the digits with a NON-BREAKING SPACE (U+00A0),
//     NOT a regular ASCII space. Asserting a plain " " would fail. We build the
//     expected strings with the `NBSP` constant (from a code point, so the source
//     stays pure ASCII); that is also the regression guard that catches an
//     accidental ICU/locale change.
//
//  2. `parseIdrInput` is HARDENED -- clearly invalid money is rejected as NaN
//     instead of being silently "corrected" by stripping unknown characters:
//        '5e10'           -> NaN         (scientific notation is never IDR entry)
//        '0x1A'           -> NaN         (hex notation)
//        '--50000'        -> NaN         (double negative is always a typo)
//     Legitimate forms still parse, including dot thousands separators:
//        '50.000.000.000' -> 50000000000 (dots are separators -- a valid 50 billion)
//     These are pinned in the "PARSE REJECTION" block. The 'Rp'/'IDR' currency
//     prefix, a single leading minus and one comma decimal all remain valid.
import { describe, it, expect } from 'vitest';
import { formatIdr, parseIdrInput, formatIdrInput } from '../lib/formatIdr';

// Non-breaking space (U+00A0) -- the real separator Intl emits between "Rp" and
// digits. Constructed from a code point so the source file stays pure ASCII.
const NBSP = String.fromCharCode(0x00a0);
const RP = `Rp${NBSP}`;

describe('formatIdrInput <-> parseIdrInput ROUNDTRIP (Property-Based)', () => {
  // 10,000 random values -- verifies format->parse returns the original value.
  it('ROUNDTRIP: formatIdrInput then parseIdrInput returns original value (10K iterations)', () => {
    for (let i = 0; i < 10000; i++) {
      const value = Math.floor(Math.random() * 1000000000);
      const formatted = formatIdrInput(String(value));
      const parsed = parseIdrInput(formatted);
      expect(parsed).toBe(value);
    }
  });

  // 10,000 random values -- verifies parsing twice gives the same result.
  it('IDEMPOTENT: parseIdrInput called twice returns same value (10K iterations)', () => {
    for (let i = 0; i < 10000; i++) {
      const value = Math.floor(Math.random() * 1000000000);
      const once = parseIdrInput(String(value));
      const twice = parseIdrInput(String(once));
      expect(twice).toBe(once);
    }
  });

  // The x100 bug, pinned: a value carrying id-ID "." grouping must NEVER be read
  // as a decimal. 1.500.000 is one-point-five million, not 1.5.
  it('x100 GUARD: grouped display values never collapse to a fraction (10K iterations)', () => {
    for (let i = 0; i < 10000; i++) {
      const value = Math.floor(Math.random() * 1000000000);
      const grouped = formatIdrInput(String(value)); // e.g. "1.500.000"
      expect(parseIdrInput(grouped)).toBe(value);
      // And the stored->display->stored loop is stable too.
      expect(formatIdrInput(grouped)).toBe(grouped);
    }
  });

  // Verify formatIdr never throws -- critical for display stability.
  it('SAFE: formatIdr never throws on any input', () => {
    const inputs = [0, -1, 999999999999, '50000', 'abc', null, undefined, NaN, Infinity, '', '50.000', '50,000', '50.000.000'];
    for (const input of inputs) {
      expect(() => formatIdr(input)).not.toThrow();
    }
  });

  // parseIdrInput must never throw either (the input is raw user keystrokes).
  it('SAFE: parseIdrInput never throws on any input', () => {
    const inputs = [0, -1, 999999999999, '50000', 'abc', null, undefined, NaN, Infinity, '', '.', ',', 'Rp', '½', {}, []];
    for (const input of inputs) {
      expect(() => parseIdrInput(input)).not.toThrow();
    }
  });
});

describe('parseIdrInput -- COMPLETE EDGE CASES (actual verified behavior)', () => {
  const cases = [
    // Basic
    { input: '0', expected: 0, desc: 'zero' },
    { input: '50000', expected: 50000, desc: 'simple integer' },
    { input: '1000000', expected: 1000000, desc: 'million' },

    // Indonesian thousands separator (dot)
    { input: '50.000', expected: 50000, desc: 'IDR thousands format' },
    { input: '1.500.000', expected: 1500000, desc: 'IDR millions format' },
    { input: '5.000.000', expected: 5000000, desc: 'IDR 5 million' },
    { input: '100.000.000', expected: 100000000, desc: 'IDR 100 million' },

    // Comma as decimal
    { input: '50,000', expected: 50, desc: 'comma = decimal (fifty)' },
    { input: '50,5', expected: 50.5, desc: 'comma decimal with fraction' },
    { input: '1.500,50', expected: 1500.5, desc: 'IDR thousands + comma decimal' },

    // Currency symbol
    { input: 'Rp 50.000', expected: 50000, desc: 'with Rp prefix' },
    { input: 'rp 50.000', expected: 50000, desc: 'lowercase rp' },
    { input: 'IDR 50.000', expected: 50000, desc: 'IDR prefix (ISO 4217 code allowed like Rp)' },

    // Negative
    { input: '-50000', expected: -50000, desc: 'negative integer' },
    { input: '-50.000', expected: -50000, desc: 'negative IDR format' },
    { input: '-Rp 50.000', expected: -50000, desc: 'negative with Rp' },

    // Whitespace
    { input: '  50000  ', expected: 50000, desc: 'leading/trailing spaces' },
    { input: '\n50000', expected: 50000, desc: 'leading newline' },
    { input: '50000\n', expected: 50000, desc: 'trailing newline' },
    { input: '\t50000\t', expected: 50000, desc: 'tabs' },

    // Invalid -- should return NaN (cleaned string is empty or just ".")
    { input: '', expected: NaN, desc: 'empty string' },
    { input: null, expected: NaN, desc: 'null' },
    { input: undefined, expected: NaN, desc: 'undefined' },
    { input: 'abc', expected: NaN, desc: 'letters' },
    { input: '½', expected: NaN, desc: 'unicode fraction' },
    { input: '١٢٣', expected: NaN, desc: 'arabic-indic numerals (not ASCII 0-9)' },
    { input: 'NaN', expected: NaN, desc: 'NaN string' },
    { input: 'Infinity', expected: NaN, desc: 'Infinity string' },
    { input: '[]', expected: NaN, desc: 'array string' },
    { input: '{}', expected: NaN, desc: 'object string' },
    { input: 'true', expected: NaN, desc: 'boolean string' },
    { input: '.', expected: NaN, desc: 'just a dot' },
    { input: ',', expected: NaN, desc: 'just a comma' },
  ];

  cases.forEach(({ input, expected, desc }) => {
    it(`${desc}: parseIdrInput(${JSON.stringify(input)}) -> ${expected}`, () => {
      const result = parseIdrInput(input);
      if (Number.isNaN(expected)) {
        expect(Number.isNaN(result)).toBe(true);
      } else {
        expect(result).toBe(expected);
      }
    });
  });
});

describe('parseIdrInput -- PARSE REJECTION (hardened: invalid money -> NaN)', () => {
  // `parseIdrInput` now REJECTS clearly invalid input rather than silently
  // stripping unknown characters and parsing the remainder. The first three were
  // previously "lenient" (510, 1, -50000); the dot-grouped 50 billion must still
  // parse, because that is a real IDR amount, not a typo.
  const cases = [
    { input: '5e10', expected: NaN, why: 'scientific notation is rejected' },
    { input: '0x1A', expected: NaN, why: 'hex notation is rejected' },
    { input: '--50000', expected: NaN, why: 'double negative is rejected' },
    { input: '50.000.000.000', expected: 50000000000, why: 'dots are separators -> valid 50 billion' },
  ];

  cases.forEach(({ input, expected, why }) => {
    it(`parseIdrInput(${JSON.stringify(input)}) -> ${expected} (${why})`, () => {
      const result = parseIdrInput(input);
      if (Number.isNaN(expected)) {
        expect(Number.isNaN(result)).toBe(true);
      } else {
        expect(result).toBe(expected);
      }
    });
  });
});

describe('formatIdr -- DISPLAY FUNCTION (Correctness, NBSP-aware)', () => {
  const cases = [
    { input: 50000, expected: `${RP}50.000` },
    { input: 0, expected: `${RP}0` },
    { input: 1, expected: `${RP}1` },
    { input: 1500000, expected: `${RP}1.500.000` },
    { input: -50000, expected: `-${RP}50.000` },
    { input: undefined, expected: `${RP}0` },
    { input: null, expected: `${RP}0` },
    { input: '50000', expected: `${RP}50.000` },
    { input: 'abc', expected: `${RP}0` },
    { input: 59.137, expected: `${RP}59` },   // rounds down (maximumFractionDigits: 0)
    { input: 59.99, expected: `${RP}60` },     // rounds up
    { input: 1000000000, expected: `${RP}1.000.000.000` },
    { input: -1, expected: `-${RP}1` },
  ];

  cases.forEach(({ input, expected }) => {
    it(`formatIdr(${JSON.stringify(input)}) -> ${JSON.stringify(expected)}`, () => {
      expect(formatIdr(input)).toBe(expected);
    });
  });

  it('separator between symbol and digits is a non-breaking space (U+00A0)', () => {
    // Pin the exact char so a locale/ICU regression is loud, not silent.
    expect(formatIdr(50000).charCodeAt(2)).toBe(0x00a0);
  });
});

describe('formatIdrInput -- DISPLAY HELPER', () => {
  it('formats raw numbers for display in input fields', () => {
    expect(formatIdrInput('50000')).toBe('50.000');
    expect(formatIdrInput('0')).toBe('0');
    expect(formatIdrInput('1500000')).toBe('1.500.000');
  });

  it('handles edge cases', () => {
    expect(formatIdrInput('')).toBe('');
    expect(formatIdrInput(null)).toBe('');
    expect(formatIdrInput(undefined)).toBe('');
    expect(formatIdrInput('-')).toBe('-'); // keep a lone minus so typing isn't interrupted
    expect(formatIdrInput('abc')).toBe('');
  });
});
