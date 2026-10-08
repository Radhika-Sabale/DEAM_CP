/**
 * @file encoding.test.ts
 * Unit and property tests for sequential state machine bit-encoding and naming conventions.
 */

import { describe, expect, it } from 'vitest';
import type { FlipFlopType } from '../../types/sequential';
import {
  bitsToCode,
  checkVariableLimit,
  codeToBits,
  flipFlopInputNames,
  formatCode,
  functionVariables,
  inputVariableNames,
  inverseRowIndex,
  minStateBits,
  OUTPUT_VARIABLE_NAME,
  rowIndex,
  stateVariableNames,
} from './encoding';

describe('encoding.ts', () => {
  describe('minStateBits', () => {
    it('returns at least 1 for 0, 1, or negative inputs', () => {
      expect(minStateBits(0)).toBe(1);
      expect(minStateBits(1)).toBe(1);
      expect(minStateBits(-5)).toBe(1);
    });

    it('returns correct bit widths for standard state counts', () => {
      expect(minStateBits(2)).toBe(1);
      expect(minStateBits(3)).toBe(2);
      expect(minStateBits(4)).toBe(2);
      expect(minStateBits(5)).toBe(3);
      expect(minStateBits(8)).toBe(3);
      expect(minStateBits(9)).toBe(4);
      expect(minStateBits(16)).toBe(4);
    });
  });

  describe('stateVariableNames & inputVariableNames', () => {
    it('produces MSB-first state names from Q{n-1} down to Q0', () => {
      expect(stateVariableNames(1)).toEqual(['Q0']);
      expect(stateVariableNames(2)).toEqual(['Q1', 'Q0']);
      expect(stateVariableNames(3)).toEqual(['Q2', 'Q1', 'Q0']);
      expect(stateVariableNames(4)).toEqual(['Q3', 'Q2', 'Q1', 'Q0']);
    });

    it('produces correct input names per category', () => {
      expect(inputVariableNames('none')).toEqual([]);
      expect(inputVariableNames('counter-up-down')).toEqual(['DN']);
      expect(inputVariableNames('detector')).toEqual(['IN']);
      expect(OUTPUT_VARIABLE_NAME).toBe('Z');
    });

    it('combines state and input variables with state bits as MSB and input as LSB', () => {
      expect(functionVariables(3, false)).toEqual(['Q2', 'Q1', 'Q0']);
      expect(functionVariables(2, true, 'counter-up-down')).toEqual(['Q1', 'Q0', 'DN']);
      expect(functionVariables(3, true, 'detector')).toEqual(['Q2', 'Q1', 'Q0', 'IN']);
    });
  });

  describe('code <-> bits conversion exhaustive sweep (n = 1..4)', () => {
    it('exhaustively converts all codes 0..2^n - 1 to bits and back', () => {
      for (let n = 1; n <= 4; n++) {
        const total = 1 << n;
        for (let code = 0; code < total; code++) {
          const bits = codeToBits(code, n);
          expect(bits.length).toBe(n);

          // Verify bits representation
          const reconstructed = bitsToCode(bits);
          expect(reconstructed).toBe(code);

          // Verify formatCode matches binary padding
          const formatted = formatCode(code, n);
          expect(formatted.length).toBe(n);
          expect(parseInt(formatted, 2)).toBe(code);
        }
      }
    });
  });

  describe('flipFlopInputNames for all architectures', () => {
    const types: FlipFlopType[] = ['SR', 'JK', 'D', 'T'];

    it('generates expected terminal identifiers across bit indices', () => {
      expect(flipFlopInputNames('SR', 0)).toEqual(['S0', 'R0']);
      expect(flipFlopInputNames('SR', 2)).toEqual(['S2', 'R2']);
      expect(flipFlopInputNames('JK', 1)).toEqual(['J1', 'K1']);
      expect(flipFlopInputNames('D', 3)).toEqual(['D3']);
      expect(flipFlopInputNames('T', 0)).toEqual(['T0']);

      types.forEach((t) => {
        for (let bit = 0; bit < 4; bit++) {
          const names = flipFlopInputNames(t, bit);
          expect(names.length).toBeGreaterThanOrEqual(1);
          names.forEach((name) => expect(name.endsWith(String(bit))).toBe(true));
        }
      });
    });
  });

  describe('rowIndex & inverseRowIndex round trip', () => {
    it('round trips cleanly without external inputs', () => {
      for (let code = 0; code < 16; code++) {
        const idx = rowIndex(code, 0, false);
        expect(idx).toBe(code);
        const inv = inverseRowIndex(idx, false);
        expect(inv).toEqual({ code, inputValue: 0 });
      }
    });

    it('round trips cleanly with external input', () => {
      for (let code = 0; code < 16; code++) {
        for (const input of [0, 1]) {
          const idx = rowIndex(code, input, true);
          expect(idx).toBe((code << 1) | input);
          const inv = inverseRowIndex(idx, true);
          expect(inv).toEqual({ code, inputValue: input });
        }
      }
    });
  });

  describe('checkVariableLimit', () => {
    it('permits up to 5 total variables', () => {
      expect(checkVariableLimit(4, true)).toEqual({ ok: true, totalVariables: 5 });
      expect(checkVariableLimit(5, false)).toEqual({ ok: true, totalVariables: 5 });
      expect(checkVariableLimit(3, true)).toEqual({ ok: true, totalVariables: 4 });
    });

    it('rejects greater than 5 total variables with clear diagnostic message', () => {
      const res = checkVariableLimit(5, true);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('too-many-variables');
        expect(res.message).toBe('The K-map solver handles at most 5 variables');
      }

      const res6 = checkVariableLimit(6, false);
      expect(res6.ok).toBe(false);
    });
  });
});
