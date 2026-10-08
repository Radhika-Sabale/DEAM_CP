/**
 * @file bruteForceMinimizer.test.ts
 * Unit tests, textbook cases, parity/corner checks, and exhaustive sweeps
 * for the brute-force minimizer oracle.
 */

import { describe, expect, it } from 'vitest';
import { getBit } from './bitUtils';
import {
  type Cube,
  cubeToLiterals,
  cubeToString,
  minimizePOS,
  minimizeSOP,
  toPosString,
  toSopString,
  verifyCover,
} from './bruteForceMinimizer';

function evaluateSop(cubes: readonly Cube[], minterm: number): boolean {
  if (cubes.length === 0) return false;
  return cubes.some((c) => ((minterm & c.careMask) >>> 0) === c.valueMask);
}

function evaluatePos(cubes: readonly Cube[], minterm: number, varCount: number): boolean {
  if (cubes.length === 0) return true;
  return cubes.every((c) => {
    if (c.careMask === 0) return false;
    for (let i = 0; i < varCount; i++) {
      const bitPos = varCount - 1 - i;
      if (getBit(c.careMask, bitPos) === 1) {
        const mBit = getBit(minterm, bitPos);
        const dualVal = getBit(c.valueMask, bitPos);
        if (mBit !== dualVal) return true;
      }
    }
    return false;
  });
}

function seededPrng(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('bruteForceMinimizer', () => {
  describe('Input Validation & Error Paths', () => {
    it('throws when variableCount is out of range [1, 5]', () => {
      expect(() => minimizeSOP(0, [0])).toThrow(RangeError);
      expect(() => minimizeSOP(6, [0])).toThrow(RangeError);
      expect(() => minimizeSOP(2.5, [0])).toThrow(RangeError);
    });

    it('throws when minterms are out of bounds', () => {
      expect(() => minimizeSOP(3, [-1])).toThrow(RangeError);
      expect(() => minimizeSOP(3, [8])).toThrow(RangeError);
      expect(() => minimizeSOP(4, [16])).toThrow(RangeError);
    });

    it('throws when minterms and don`t-cares overlap', () => {
      expect(() => minimizeSOP(3, [1, 2], [2, 3])).toThrow(RangeError);
    });
  });

  describe('Edge Cases', () => {
    it('handles constant 0 (no minterms)', () => {
      const res = minimizeSOP(3, []);
      expect(res.minTermCount).toBe(0);
      expect(res.minLiteralCount).toBe(0);
      const sol = res.solutions[0] ?? [];
      expect(toSopString(sol, 3)).toBe('0');
      const ver = verifyCover(3, [], [], sol);
      expect(ver.coversAllMinterms).toBe(true);
      expect(ver.coversNoZeros).toBe(true);
    });

    it('handles constant 1 (all cells covered)', () => {
      const all3Var = [0, 1, 2, 3, 4, 5, 6, 7];
      const res = minimizeSOP(3, all3Var);
      expect(res.minTermCount).toBe(1);
      expect(res.minLiteralCount).toBe(0);
      const sol = res.solutions[0] ?? [];
      expect(toSopString(sol, 3)).toBe('1');
      const ver = verifyCover(3, all3Var, [], sol);
      expect(ver.coversAllMinterms).toBe(true);
      expect(ver.coversNoZeros).toBe(true);
    });

    it('handles only don`t-cares (zero minterms)', () => {
      const res = minimizeSOP(3, [], [0, 1, 2]);
      expect(res.minTermCount).toBe(0);
      expect(res.minLiteralCount).toBe(0);
      const sol = res.solutions[0] ?? [];
      expect(toSopString(sol, 3)).toBe('0');
    });

    it('handles single minterm without don`t-cares', () => {
      const res = minimizeSOP(3, [5]);
      expect(res.minTermCount).toBe(1);
      expect(res.minLiteralCount).toBe(3);
      const sol = res.solutions[0] ?? [];
      const firstCube = sol[0] ?? { careMask: 0, valueMask: 0 };
      expect(cubeToString(firstCube, 3)).toBe("AB'C");
    });
  });

  describe('Hand-Checked Textbook Cases', () => {
    it('minimizes 4-variable 4 corners: m(0, 2, 8, 10) into B`D`', () => {
      const res = minimizeSOP(4, [0, 2, 8, 10]);
      expect(res.minTermCount).toBe(1);
      expect(res.minLiteralCount).toBe(2);
      expect(res.solutions.length).toBe(1);
      const sol = res.solutions[0] ?? [];
      const firstCube = sol[0] ?? { careMask: 0, valueMask: 0 };
      expect(cubeToString(firstCube, 4)).toBe("B'D'");
    });

    it('minimizes 4-variable wrap-around corners + edges into single group', () => {
      const res = minimizeSOP(4, [0, 1, 3, 2]);
      expect(res.minTermCount).toBe(1);
      expect(res.minLiteralCount).toBe(2);
      const sol = res.solutions[0] ?? [];
      const firstCube = sol[0] ?? { careMask: 0, valueMask: 0 };
      expect(cubeToString(firstCube, 4)).toBe("A'B'");
    });

    it('handles essential-prime-less cyclic core with multiple tying minimal covers', () => {
      const res = minimizeSOP(3, [0, 1, 2, 5, 6, 7]);
      expect(res.minTermCount).toBe(3);
      expect(res.minLiteralCount).toBe(6);
      expect(res.solutions.length).toBe(2);
      for (const sol of res.solutions) {
        const ver = verifyCover(3, [0, 1, 2, 5, 6, 7], [], sol);
        expect(ver.coversAllMinterms).toBe(true);
        expect(ver.coversNoZeros).toBe(true);
      }
    });

    it('handles parity XOR/XNOR where nothing merges', () => {
      const res = minimizeSOP(3, [1, 2, 4, 7]);
      expect(res.minTermCount).toBe(4);
      expect(res.minLiteralCount).toBe(12);
      expect(res.solutions.length).toBe(1);
    });

    it('leverages don`t-cares to shrink the answer', () => {
      const res = minimizeSOP(4, [0, 1], [2, 3]);
      expect(res.minTermCount).toBe(1);
      expect(res.minLiteralCount).toBe(2);
      const sol = res.solutions[0] ?? [];
      const firstCube = sol[0] ?? { careMask: 0, valueMask: 0 };
      expect(cubeToString(firstCube, 4)).toBe("A'B'");
    });
  });

  describe('SOP and POS Equivalence', () => {
    it('produces logically equivalent SOP and POS expressions', () => {
      const minterms = [0, 2, 8, 10, 14, 15];
      const dontCares = [5, 7];
      const sopRes = minimizeSOP(4, minterms, dontCares);
      const posRes = minimizePOS(4, minterms, dontCares);

      const sopSol = sopRes.solutions[0] ?? [];
      const posSol = posRes.solutions[0] ?? [];

      expect(toPosString(posSol, 4)).toContain('(');

      for (let m = 0; m < 16; m++) {
        if (dontCares.includes(m)) continue;
        const expected = minterms.includes(m);
        const sopVal = evaluateSop(sopSol, m);
        const posVal = evaluatePos(posSol, m, 4);
        expect(sopVal).toBe(expected);
        expect(posVal).toBe(expected);
      }
    });
  });

  describe('All 256 3-Variable Functions Sweep', () => {
    it('verifies all 256 3-variable functions in well under a second', () => {
      const t0 = performance.now();
      for (let mask = 0; mask < 256; mask++) {
        const minterms: number[] = [];
        for (let b = 0; b < 8; b++) {
          if (((mask >>> b) & 1) === 1) minterms.push(b);
        }
        const res = minimizeSOP(3, minterms);
        expect(res.solutions.length).toBeGreaterThan(0);
        for (const sol of res.solutions) {
          expect(sol.length).toBe(res.minTermCount);
          const lits = sol.reduce((acc, c) => acc + cubeToLiterals(c, 3).length, 0);
          expect(lits).toBe(res.minLiteralCount);
          const ver = verifyCover(3, minterms, [], sol);
          expect(ver.coversAllMinterms).toBe(true);
          expect(ver.coversNoZeros).toBe(true);
        }
      }
      const elapsed = performance.now() - t0;
      // eslint-disable-next-line no-console
      console.log(`[Sweep Timing] All 256 3-variable functions completed in: ${elapsed.toFixed(2)} ms`);
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('Sample of 500 4-Variable Functions (Seeded PRNG)', () => {
    it('tests 500 randomized 4-variable functions with random don`t-cares', () => {
      const prng = seededPrng(42);
      const t0 = performance.now();

      for (let i = 0; i < 500; i++) {
        const minterms: number[] = [];
        const dontCares: number[] = [];
        for (let cell = 0; cell < 16; cell++) {
          const r = prng();
          if (r < 0.4) minterms.push(cell);
          else if (r < 0.55) dontCares.push(cell);
        }

        const res = minimizeSOP(4, minterms, dontCares);
        expect(res.solutions.length).toBeGreaterThan(0);
        for (const sol of res.solutions) {
          expect(sol.length).toBe(res.minTermCount);
          const lits = sol.reduce((acc, c) => acc + cubeToLiterals(c, 4).length, 0);
          expect(lits).toBe(res.minLiteralCount);
          const ver = verifyCover(4, minterms, dontCares, sol);
          expect(ver.coversAllMinterms).toBe(true);
          expect(ver.coversNoZeros).toBe(true);
        }
      }

      const elapsed = performance.now() - t0;
      // eslint-disable-next-line no-console
      console.log(`[Sweep Timing] 500 randomized 4-variable functions with don't-cares completed in: ${elapsed.toFixed(2)} ms`);
    });
  });

  describe('Full Sweep of All 65,536 4-Variable Functions', () => {
    const shouldSkip = process.env.SKIP_FULL_4VAR_SWEEP === 'true';

    it.skipIf(shouldSkip)('sweeps all 65,536 4-variable functions without don`t-cares', () => {
      const t0 = performance.now();
      let verifiedCount = 0;

      for (let mask = 0; mask < 65536; mask++) {
        const minterms: number[] = [];
        for (let b = 0; b < 16; b++) {
          if (((mask >>> b) & 1) === 1) minterms.push(b);
        }
        const res = minimizeSOP(4, minterms);
        if (mask % 5000 === 0) {
          const sol = res.solutions[0] ?? [];
          const ver = verifyCover(4, minterms, [], sol);
          expect(ver.coversAllMinterms).toBe(true);
          expect(ver.coversNoZeros).toBe(true);
        }
        verifiedCount++;
      }

      const elapsed = performance.now() - t0;
      // eslint-disable-next-line no-console
      console.log(`[Sweep Timing] Full sweep of all 65,536 4-variable functions completed in: ${elapsed.toFixed(2)} ms`);
      expect(verifiedCount).toBe(65536);
    });
  });
});
