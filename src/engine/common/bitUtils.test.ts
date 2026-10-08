/**
 * @file bitUtils.test.ts
 * Unit tests and property sweeps for bitUtils.
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_GENERAL_WIDTH,
  MAX_MINTERM_VARIABLES,
  arithmeticShiftRight,
  arrayToBits,
  assignmentToMinterm,
  bitsToArray,
  differsByOneBit,
  fitsInWidth,
  fromBinaryString,
  getBit,
  hammingDistance,
  logicalShiftLeft,
  logicalShiftRight,
  lowBitMask,
  maxValueForWidth,
  minimumWidth,
  mintermToAssignment,
  popCount,
  rotate,
  rotateLeft,
  rotateRight,
  setBit,
  toBinaryString,
} from './bitUtils';

describe('bitUtils', () => {
  describe('Constants', () => {
    it('defines expected maximum bounds', () => {
      expect(MAX_GENERAL_WIDTH).toBe(32);
      expect(MAX_MINTERM_VARIABLES).toBe(6);
    });
  });

  describe('Width and Range Helpers', () => {
    it('computes maxValueForWidth correctly for boundary widths 1, 8, 31, 32', () => {
      expect(maxValueForWidth(1)).toBe(1);
      expect(maxValueForWidth(8)).toBe(255);
      expect(maxValueForWidth(31)).toBe(0x7fffffff);
      expect(maxValueForWidth(32)).toBe(0xffffffff);
    });

    it('throws on invalid width for maxValueForWidth', () => {
      expect(() => maxValueForWidth(0)).toThrow(RangeError);
      expect(() => maxValueForWidth(-1)).toThrow(RangeError);
      expect(() => maxValueForWidth(33)).toThrow(RangeError);
      expect(() => maxValueForWidth(1.5)).toThrow(TypeError);
    });

    it('checks fitsInWidth correctly', () => {
      expect(fitsInWidth(0, 1)).toBe(true);
      expect(fitsInWidth(1, 1)).toBe(true);
      expect(fitsInWidth(2, 1)).toBe(false);
      expect(fitsInWidth(255, 8)).toBe(true);
      expect(fitsInWidth(256, 8)).toBe(false);
      expect(fitsInWidth(0xffffffff, 32)).toBe(true);
      expect(fitsInWidth(0x100000000, 32)).toBe(false);
      expect(fitsInWidth(-1, 8)).toBe(false);
    });

    it('computes minimumWidth correctly', () => {
      expect(minimumWidth(0)).toBe(1);
      expect(minimumWidth(1)).toBe(1);
      expect(minimumWidth(2)).toBe(2);
      expect(minimumWidth(3)).toBe(2);
      expect(minimumWidth(4)).toBe(3);
      expect(minimumWidth(255)).toBe(8);
      expect(minimumWidth(256)).toBe(9);
      expect(minimumWidth(0x7fffffff)).toBe(31);
      expect(minimumWidth(0x80000000)).toBe(32);
      expect(minimumWidth(0xffffffff)).toBe(32);
    });

    it('throws on invalid input for minimumWidth', () => {
      expect(() => minimumWidth(-1)).toThrow(RangeError);
      expect(() => minimumWidth(0.5)).toThrow(TypeError);
      expect(() => minimumWidth(0x100000000)).toThrow(RangeError);
    });
  });

  describe('Bit Access and Modification', () => {
    it('gets bit correctly across 32 bits', () => {
      const val = 0b100101;
      expect(getBit(val, 0)).toBe(1);
      expect(getBit(val, 1)).toBe(0);
      expect(getBit(val, 2)).toBe(1);
      expect(getBit(val, 5)).toBe(1);
      expect(getBit(0x80000000, 31)).toBe(1);
      expect(getBit(0x7fffffff, 31)).toBe(0);
    });

    it('throws on invalid bitIndex for getBit', () => {
      expect(() => getBit(10, -1)).toThrow(RangeError);
      expect(() => getBit(10, 32)).toThrow(RangeError);
    });

    it('sets and clears bits correctly', () => {
      let val = 0;
      val = setBit(val, 0, 1);
      expect(val).toBe(1);
      val = setBit(val, 3, 1);
      expect(val).toBe(9);
      val = setBit(val, 31, 1);
      expect(val).toBe(0x80000009);
      val = setBit(val, 0, 0);
      expect(val).toBe(0x80000008);
      val = setBit(val, 31, 0);
      expect(val).toBe(8);
    });

    it('throws on invalid input for setBit', () => {
      expect(() => setBit(0, 32, 1)).toThrow(RangeError);
      expect(() => setBit(0, -1, 1)).toThrow(RangeError);
      // @ts-expect-error invalid bitValue testing
      expect(() => setBit(0, 2, 2)).toThrow(RangeError);
    });
  });

  describe('Population Count (popCount)', () => {
    it('evaluates popCount on edge values', () => {
      expect(popCount(0)).toBe(0);
      expect(popCount(1)).toBe(1);
      expect(popCount(0x55555555)).toBe(16);
      expect(popCount(0xaaaaaaaa)).toBe(16);
      expect(popCount(0x7fffffff)).toBe(31);
      expect(popCount(0x80000000)).toBe(1);
      expect(popCount(0xffffffff)).toBe(32);
    });

    it('throws on negative input for popCount', () => {
      expect(() => popCount(-1)).toThrow(RangeError);
    });
  });

  describe('Bit Array Conversions (MSB-first)', () => {
    it('converts value to bit array with MSB at index 0', () => {
      expect(bitsToArray(5, 3)).toEqual([1, 0, 1]);
      expect(bitsToArray(5, 5)).toEqual([0, 0, 1, 0, 1]);
      expect(bitsToArray(0, 1)).toEqual([0]);
      expect(bitsToArray(1, 1)).toEqual([1]);
    });

    it('throws on overflow for bitsToArray', () => {
      expect(() => bitsToArray(8, 3)).toThrow(RangeError);
      expect(() => bitsToArray(-1, 3)).toThrow(RangeError);
    });

    it('converts bit array to unsigned integer', () => {
      expect(arrayToBits([1, 0, 1])).toBe(5);
      expect(arrayToBits([0, 0, 1, 0, 1])).toBe(5);
      expect(arrayToBits([1, 1, 1, 1])).toBe(15);
      const allOnes32: (0 | 1)[] = new Array(32).fill(1);
      expect(arrayToBits(allOnes32)).toBe(0xffffffff);
    });

    it('throws on invalid bit arrays in arrayToBits', () => {
      expect(() => arrayToBits([])).toThrow(RangeError);
      // @ts-expect-error invalid bit value
      expect(() => arrayToBits([1, 2, 0])).toThrow(RangeError);
    });
  });

  describe('Binary String Conversions', () => {
    it('converts number to padded binary string', () => {
      expect(toBinaryString(5, 3)).toBe('101');
      expect(toBinaryString(5, 6)).toBe('000101');
      expect(toBinaryString(0, 4)).toBe('0000');
      expect(toBinaryString(0xffffffff, 32)).toBe('1'.repeat(32));
    });

    it('parses binary string into unsigned number', () => {
      expect(fromBinaryString('101')).toBe(5);
      expect(fromBinaryString('000101')).toBe(5);
      expect(fromBinaryString('1'.repeat(32))).toBe(0xffffffff);
    });

    it('throws on invalid string input for fromBinaryString', () => {
      expect(() => fromBinaryString('')).toThrow(TypeError);
      expect(() => fromBinaryString('10201')).toThrow(TypeError);
      expect(() => fromBinaryString('abc')).toThrow(TypeError);
      expect(() => fromBinaryString('1'.repeat(33))).toThrow(RangeError);
    });
  });

  describe('Minterm Mapping & Bit Ordering Convention', () => {
    it('maps minterm to variable assignment with variable 0 as MSB', () => {
      const assignment = mintermToAssignment(5, 3);
      expect(assignment).toEqual([1, 0, 1]);
      expect(assignmentToMinterm(assignment)).toBe(5);

      expect(mintermToAssignment(0, 3)).toEqual([0, 0, 0]);
      expect(mintermToAssignment(7, 3)).toEqual([1, 1, 1]);
    });

    it('enforces maximum minterm variables limit of 6', () => {
      expect(() => mintermToAssignment(0, 7)).toThrow(RangeError);
      expect(() => mintermToAssignment(64, 6)).toThrow(RangeError);
      expect(() => mintermToAssignment(63, 6)).not.toThrow();
    });

    it('computes Hamming distance and differsByOneBit correctly', () => {
      expect(hammingDistance(5, 7)).toBe(1);
      expect(differsByOneBit(5, 7)).toBe(true);

      expect(hammingDistance(5, 2)).toBe(3);
      expect(differsByOneBit(5, 2)).toBe(false);

      expect(hammingDistance(4, 4)).toBe(0);
      expect(differsByOneBit(4, 4)).toBe(false);
    });
  });

  describe('Shifts and Rotations', () => {
    it('calculates lowBitMask correctly', () => {
      expect(lowBitMask(1)).toBe(1);
      expect(lowBitMask(4)).toBe(15);
      expect(lowBitMask(8)).toBe(255);
      expect(lowBitMask(32)).toBe(0xffffffff);
    });

    it('performs width-bounded logicalShiftLeft', () => {
      expect(logicalShiftLeft(0b1011, 1, 4)).toBe(0b0110);
      expect(logicalShiftLeft(0b1011, 4, 4)).toBe(0);
      expect(logicalShiftLeft(0b1011, 5, 4)).toBe(0);
    });

    it('performs width-bounded logicalShiftRight', () => {
      expect(logicalShiftRight(0b1011, 1, 4)).toBe(0b0101);
      expect(logicalShiftRight(0b1011, 4, 4)).toBe(0);
      expect(logicalShiftRight(0b1011, 5, 4)).toBe(0);
    });

    it('performs width-bounded arithmeticShiftRight', () => {
      expect(arithmeticShiftRight(0b0100, 1, 4)).toBe(0b0010);
      expect(arithmeticShiftRight(0b1000, 1, 4)).toBe(0b1100);
      expect(arithmeticShiftRight(0b1000, 4, 4)).toBe(0b1111);
      expect(arithmeticShiftRight(0x40, 2, 8)).toBe(0x10);
      expect(arithmeticShiftRight(0x80, 2, 8)).toBe(0xe0);
    });

    it('performs width-bounded rotateLeft and rotateRight', () => {
      expect(rotateLeft(0b1001, 1, 4)).toBe(0b0011);
      expect(rotateLeft(0b1001, 4, 4)).toBe(0b1001);
      expect(rotateLeft(0b1001, 5, 4)).toBe(0b0011);

      expect(rotateRight(0b1001, 1, 4)).toBe(0b1100);
      expect(rotateRight(0b1001, 4, 4)).toBe(0b1001);
      expect(rotateRight(0b1001, 5, 4)).toBe(0b1100);

      expect(rotate(0b1001, 1, 4, 'left')).toBe(0b0011);
      expect(rotate(0b1001, 1, 4, 'right')).toBe(0b1100);
    });

    it('throws when value exceeds width for shift/rotate', () => {
      expect(() => logicalShiftLeft(16, 1, 4)).toThrow(RangeError);
      expect(() => logicalShiftRight(16, 1, 4)).toThrow(RangeError);
      expect(() => arithmeticShiftRight(16, 1, 4)).toThrow(RangeError);
      expect(() => rotateLeft(16, 1, 4)).toThrow(RangeError);
    });
  });

  describe('Property Loop Over All Values for Widths 1 to 8', () => {
    it('verifies round trips, fitsInWidth, popCount, and minimumWidth for all values up to 8 bits', () => {
      for (let width = 1; width <= 8; width++) {
        const total = 1 << width;
        for (let val = 0; val < total; val++) {
          expect(fitsInWidth(val, width)).toBe(true);
          expect(fitsInWidth(val + total, width)).toBe(false);

          const arr = bitsToArray(val, width);
          expect(arr.length).toBe(width);
          expect(arrayToBits(arr)).toBe(val);

          const str = toBinaryString(val, width);
          expect(str.length).toBe(width);
          expect(fromBinaryString(str)).toBe(val);

          let manualPop = 0;
          for (let i = 0; i < width; i++) {
            if (((val >>> i) & 1) === 1) manualPop++;
          }
          expect(popCount(val)).toBe(manualPop);
          expect(minimumWidth(val)).toBeLessThanOrEqual(width);

          expect(rotateLeft(val, width, width)).toBe(val);
          expect(rotateRight(val, width, width)).toBe(val);
        }
      }
    });
  });
});
