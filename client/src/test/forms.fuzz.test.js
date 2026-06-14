// client/src/test/forms.fuzz.test.js
//
// Input fuzzing for the money-parsing boundary. Every money <input> in the app
// (PortfolioModal, CreateTransactionModal, Budget, Receivables/Payables, Accounts)
// funnels its raw string through `parseIdrInput` at submit time. This file throws
// a battery of hostile / malformed strings at it and asserts two invariants:
//   1. it NEVER throws (a throw here would crash a form submit), and
//   2. it returns NaN for clearly-invalid input and the correct number otherwise.
//
// Behavior verified against the real implementation; see the companion
// formatIdr.property.test.js header for the rejection notes (e.g. '5e10' -> NaN).
import { describe, it, expect } from 'vitest';
import { parseIdrInput } from '../lib/formatIdr';

describe('Money Input Fuzzing -- parseIdrInput Resilience', () => {
  // These values should NEVER cause a throw.
  const FUZZ_VALUES = [
    '', '0', '-1', '9999999999999999',
    '50.000', '50,000', '50.000.000', '50.000,00',
    '5e10', 'NaN', 'Infinity', '-Infinity',
    'abc', '½', '١٢٣', 'null', 'undefined',
    '  50000  ', '\n50000', '50000\n', '\t50000\t',
    String(Number.MAX_SAFE_INTEGER),
    String(Number.MIN_SAFE_INTEGER),
    '0x1A', '[]', '{}', 'true', 'false',
    '.', ',', '-', '--50000',
    '50.000.000.000', '50,000,000,000',
    'Rp', 'Rp ', 'Rp 0', 'Rp abc',
    '1e100', '1e-100',
    Array(1000).fill('0').join(''), // very long input
  ];

  it('parseIdrInput NEVER throws on any fuzz input', () => {
    for (const input of FUZZ_VALUES) {
      expect(() => parseIdrInput(input)).not.toThrow();
    }
  });

  it('parseIdrInput NEVER throws on non-string types either', () => {
    // Forms always pass strings, but defense-in-depth: hooks/tests may pass raw types.
    const NON_STRINGS = [null, undefined, NaN, Infinity, -Infinity, 0, -1, 1e21, {}, [], true, false];
    for (const input of NON_STRINGS) {
      expect(() => parseIdrInput(input)).not.toThrow();
    }
  });

  it('parseIdrInput returns NaN for clearly invalid inputs', () => {
    const INVALID = ['abc', '½', 'true', 'false', '[]', '{}', 'NaN', 'Infinity', 'null', 'undefined', '.', ','];
    for (const input of INVALID) {
      expect(Number.isNaN(parseIdrInput(input))).toBe(true);
    }
  });

  it('parseIdrInput returns correct value for valid inputs', () => {
    const validCases = [
      { input: '0', expected: 0 },
      { input: '50000', expected: 50000 },
      { input: '1000000', expected: 1000000 },
      { input: '50.000', expected: 50000 },
      { input: '-50000', expected: -50000 },
      { input: 'Rp 50.000', expected: 50000 },
    ];
    for (const { input, expected } of validCases) {
      expect(parseIdrInput(input)).toBe(expected);
    }
  });

  // A parsed money value must never silently become a non-finite number that a
  // later `.toFixed()` / arithmetic would corrupt: the contract is "finite number
  // or NaN", never Infinity.
  it('parseIdrInput never returns Infinity for string input', () => {
    for (const input of FUZZ_VALUES) {
      const result = parseIdrInput(input);
      expect(result === Infinity || result === -Infinity).toBe(false);
    }
  });
});
