/**
 * @file seededRandom.test.ts
 * Unit tests for seeded PRNG utilities.
 */

import { describe, expect, it } from 'vitest';
import { createPrng, prngChoice, prngInt, prngShuffle } from './seededRandom';

describe('seededRandom', () => {
  it('generates deterministic sequences for identical seeds', () => {
    const rng1 = createPrng(42);
    const rng2 = createPrng(42);

    const seq1 = Array.from({ length: 20 }, () => rng1());
    const seq2 = Array.from({ length: 20 }, () => rng2());

    expect(seq1).toEqual(seq2);
    expect(seq1.every((n) => n >= 0 && n < 1)).toBe(true);
  });

  it('generates different sequences for different seeds', () => {
    const rng1 = createPrng(100);
    const rng2 = createPrng(200);

    const v1 = Array.from({ length: 5 }, () => rng1());
    const v2 = Array.from({ length: 5 }, () => rng2());

    expect(v1).not.toEqual(v2);
  });

  it('generates integers uniformly within inclusive bounds', () => {
    const rng = createPrng(123);
    const min = 3;
    const max = 7;
    const seen = new Set<number>();

    for (let i = 0; i < 500; i++) {
      const val = prngInt(rng, min, max);
      expect(val).toBeGreaterThanOrEqual(min);
      expect(val).toBeLessThanOrEqual(max);
      seen.add(val);
    }

    expect(seen.size).toBe(5); // all numbers 3, 4, 5, 6, 7 seen
  });

  it('picks random choices and handles empty array', () => {
    const rng = createPrng(555);
    expect(prngChoice(rng, [])).toBeUndefined();

    const items = ['A', 'B', 'C', 'D'];
    const choice = prngChoice(rng, items);
    expect(choice).toBeDefined();
    expect(items.includes(choice as string)).toBe(true);
  });

  it('shuffles arrays deterministically without mutating original', () => {
    const rng = createPrng(999);
    const original = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = prngShuffle(rng, original);

    expect(shuffled).toHaveLength(original.length);
    expect(shuffled).not.toBe(original);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(original);
  });
});
