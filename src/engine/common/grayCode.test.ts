/**
 * @file grayCode.test.ts
 * Unit tests for Gray code transformations, sequence generators, cyclic adjacency,
 * and Karnaugh map coordinate mappings.
 */

import { describe, expect, it } from 'vitest';
import { toBinaryString } from './bitUtils';
import {
  binaryStringToGrayString,
  binaryToGray,
  cyclicAdjacency,
  generateGraySequence,
  grayDistance,
  grayStringToBinaryString,
  grayToBinary,
  kmapAxisLabels,
  kmapAxisOrder,
  kmapCellToMinterm,
  mintermToKMapCell,
} from './grayCode';

describe('grayCode', () => {
  describe('Known Sequences by Hand (Widths 1 to 4)', () => {
    it('matches known sequence for width 1', () => {
      expect(generateGraySequence(1)).toEqual([0, 1]);
    });

    it('matches known sequence for width 2', () => {
      expect(generateGraySequence(2)).toEqual([0, 1, 3, 2]);
    });

    it('matches known sequence for width 3', () => {
      expect(generateGraySequence(3)).toEqual([0, 1, 3, 2, 6, 7, 5, 4]);
    });

    it('matches known sequence for width 4', () => {
      expect(generateGraySequence(4)).toEqual([
        0, 1, 3, 2, 6, 7, 5, 4, 12, 13, 15, 14, 10, 11, 9, 8,
      ]);
    });
  });

  describe('Round-Trip Conversions (Up to Width 10)', () => {
    it('verifies binary <-> gray round trip for numbers and strings up to width 10', () => {
      for (let width = 1; width <= 10; width++) {
        const count = 1 << width;
        for (let val = 0; val < count; val++) {
          const gray = binaryToGray(val, width);
          expect(grayToBinary(gray, width)).toBe(val);

          const binStr = toBinaryString(val, width);
          const grayStr = binaryStringToGrayString(binStr);
          expect(grayStringToBinaryString(grayStr)).toBe(binStr);
        }
      }
    });

    it('throws when numeric value does not fit in width', () => {
      expect(() => binaryToGray(4, 2)).toThrow(RangeError);
      expect(() => grayToBinary(4, 2)).toThrow(RangeError);
    });
  });

  describe('Adjacency and Single-Bit Wrap Property', () => {
    it('confirms every adjacent pair differs by exactly one bit, including last-to-first wrap', () => {
      for (let width = 1; width <= 8; width++) {
        const seq = generateGraySequence(width);
        for (let i = 0; i < seq.length; i++) {
          const curr = seq[i] ?? 0;
          const next = seq[(i + 1) % seq.length] ?? 0;
          expect(grayDistance(curr, next)).toBe(1);
        }
      }
    });
  });

  describe('Cyclic Adjacency Helper', () => {
    it('computes adjacent coordinates with wrap-around for lengths 2, 4, 8', () => {
      expect(cyclicAdjacency(0, 2)).toEqual([1, 1]);
      expect(cyclicAdjacency(1, 2)).toEqual([0, 0]);

      expect(cyclicAdjacency(0, 4)).toEqual([3, 1]);
      expect(cyclicAdjacency(1, 4)).toEqual([0, 2]);
      expect(cyclicAdjacency(2, 4)).toEqual([1, 3]);
      expect(cyclicAdjacency(3, 4)).toEqual([2, 0]);

      expect(cyclicAdjacency(0, 8)).toEqual([7, 1]);
      expect(cyclicAdjacency(7, 8)).toEqual([6, 0]);
    });

    it('throws for invalid axis lengths or positions', () => {
      expect(() => cyclicAdjacency(0, 3)).toThrow(RangeError);
      expect(() => cyclicAdjacency(0, 5)).toThrow(RangeError);
      expect(() => cyclicAdjacency(-1, 4)).toThrow(RangeError);
      expect(() => cyclicAdjacency(4, 4)).toThrow(RangeError);
    });
  });

  describe('K-Map Axis Order & Labels', () => {
    it('produces correct axis orders for 1, 2, and 3 bits', () => {
      expect(kmapAxisOrder(1)).toEqual([0, 1]);
      expect(kmapAxisOrder(2)).toEqual([0, 1, 3, 2]);
      expect(kmapAxisOrder(3)).toEqual([0, 1, 3, 2, 6, 7, 5, 4]);
    });

    it('produces formatted string labels for K-map headers', () => {
      expect(kmapAxisLabels(1)).toEqual(['0', '1']);
      expect(kmapAxisLabels(2)).toEqual(['00', '01', '11', '10']);
      expect(kmapAxisLabels(3)).toEqual([
        '000', '001', '011', '010', '110', '111', '101', '100',
      ]);
    });

    it('throws for unsupported bit count in kmapAxisOrder', () => {
      expect(() => kmapAxisOrder(0)).toThrow(RangeError);
      expect(() => kmapAxisOrder(4)).toThrow(RangeError);
    });
  });

  describe('Standard 4-Variable Textbook K-Map Verification', () => {
    it('matches textbook table for 4 variables', () => {
      const textbookTable = [
        [0, 1, 3, 2],
        [4, 5, 7, 6],
        [12, 13, 15, 14],
        [8, 9, 11, 10],
      ];

      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const row = textbookTable[r];
          const expectedMinterm = row ? (row[c] ?? 0) : 0;
          expect(kmapCellToMinterm({ row: r, col: c }, 4)).toBe(expectedMinterm);
          expect(mintermToKMapCell(expectedMinterm, 4)).toEqual({ row: r, col: c });
        }
      }
    });
  });

  describe('K-Map Bijection Across Variable Counts (2 to 5)', () => {
    it('proves bijective mapping for 2 variables', () => {
      const seen = new Set<number>();
      for (let m = 0; m < 4; m++) {
        const pos = mintermToKMapCell(m, 2);
        const recovered = kmapCellToMinterm(pos, 2);
        expect(recovered).toBe(m);
        seen.add(recovered);
      }
      expect(seen.size).toBe(4);
    });

    it('proves bijective mapping for 3 variables', () => {
      const seen = new Set<number>();
      for (let m = 0; m < 8; m++) {
        const pos = mintermToKMapCell(m, 3);
        const recovered = kmapCellToMinterm(pos, 3);
        expect(recovered).toBe(m);
        seen.add(recovered);
      }
      expect(seen.size).toBe(8);
    });

    it('proves bijective mapping for 4 variables', () => {
      const seen = new Set<number>();
      for (let m = 0; m < 16; m++) {
        const pos = mintermToKMapCell(m, 4);
        const recovered = kmapCellToMinterm(pos, 4);
        expect(recovered).toBe(m);
        seen.add(recovered);
      }
      expect(seen.size).toBe(16);
    });

    it('proves bijective mapping for 5 variables across 2 layers', () => {
      const seen = new Set<number>();
      for (let m = 0; m < 32; m++) {
        const pos = mintermToKMapCell(m, 5);
        expect(pos.layer).toBe(m >= 16 ? 1 : 0);
        const recovered = kmapCellToMinterm(pos, 5);
        expect(recovered).toBe(m);
        seen.add(recovered);
      }
      expect(seen.size).toBe(32);
    });

    it('throws on out-of-range inputs for K-map conversions', () => {
      expect(() => mintermToKMapCell(-1, 3)).toThrow(RangeError);
      expect(() => mintermToKMapCell(8, 3)).toThrow(RangeError);
      expect(() => mintermToKMapCell(0, 6)).toThrow(RangeError);
      expect(() => kmapCellToMinterm({ row: 0, col: 0 }, 1)).toThrow(RangeError);
      expect(() => kmapCellToMinterm({ row: 4, col: 0 }, 4)).toThrow(RangeError);
      expect(() => kmapCellToMinterm({ layer: 2, row: 0, col: 0 }, 5)).toThrow(RangeError);
    });
  });
});
