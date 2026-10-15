import { describe, it, expect } from 'vitest';
import {
  FLAGS_BIT_POSITIONS,
  flagsToWord,
  wordToFlags,
  type ModeledFlags,
} from './flagsWord';

describe('8086 Flags Word Encoding and Decoding', () => {
  it('asserts exact bit positions against hard-coded architectural table', () => {
    expect(FLAGS_BIT_POSITIONS.CF).toBe(0);
    expect(FLAGS_BIT_POSITIONS.ALWAYS_ONE).toBe(1);
    expect(FLAGS_BIT_POSITIONS.ZF).toBe(6);
    expect(FLAGS_BIT_POSITIONS.SF).toBe(7);
    expect(FLAGS_BIT_POSITIONS.TF).toBe(8);
    expect(FLAGS_BIT_POSITIONS.IF).toBe(9);
    expect(FLAGS_BIT_POSITIONS.OF).toBe(11);
  });

  it('unconditionally sets bit 1 in any encoded flags word', () => {
    const allZero: ModeledFlags = { C: 0, Z: 0, S: 0, O: 0, I: 0, T: 0 };
    const word = flagsToWord(allZero);
    expect(word & 0x0002).toBe(0x0002);
    expect(word).toBe(2);
  });

  it('round-trips all 64 combinations of modeled flags (2^6)', () => {
    const values: (0 | 1)[] = [0, 1];
    let count = 0;

    for (const C of values) {
      for (const Z of values) {
        for (const S of values) {
          for (const O of values) {
            for (const I of values) {
              for (const T of values) {
                const initial: ModeledFlags = { C, Z, S, O, I, T };
                const word = flagsToWord(initial);
                const restored = wordToFlags(word);

                expect(restored).toEqual(initial);
                expect(word & (1 << 1)).toBe(1 << 1); // bit 1 always set
                count++;
              }
            }
          }
        }
      }
    }

    expect(count).toBe(64);
  });

  it('encodes OF "undefined" as 0 in word and decodes as 0', () => {
    const flagsWithUndef: ModeledFlags = { C: 1, Z: 0, S: 1, O: 'undefined', I: 1, T: 0 };
    const word = flagsToWord(flagsWithUndef);
    const restored = wordToFlags(word);

    expect(restored.O).toBe(0);
    expect(restored.C).toBe(1);
    expect(restored.S).toBe(1);
    expect(restored.I).toBe(1);
    expect(restored.Z).toBe(0);
    expect(restored.T).toBe(0);
  });

  it('ignores unmodeled bits on deserialization (PF, AF, DF, reserved bits)', () => {
    // 0xFFFF: all 16 bits set
    const allBitsSet = wordToFlags(0xffff);
    expect(allBitsSet).toEqual({
      C: 1,
      Z: 1,
      S: 1,
      O: 1,
      I: 1,
      T: 1,
    });

    // Only unmodeled bits set (e.g. PF bit 2, AF bit 4, DF bit 10, bits 12-15)
    const unmodeledOnly = (1 << 2) | (1 << 4) | (1 << 10) | (0xf << 12);
    const decoded = wordToFlags(unmodeledOnly);
    expect(decoded).toEqual({
      C: 0,
      Z: 0,
      S: 0,
      O: 0,
      I: 0,
      T: 0,
    });
  });
});
