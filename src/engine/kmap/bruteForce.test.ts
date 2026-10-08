/**
 * @file bruteForce.test.ts
 * Oracle comparison test suite for the deterministic K-map solver.
 *
 * Verifies the Quine-McCluskey / Petrick solver against the independent,
 * exhaustive oracle (src/engine/common/bruteForceMinimizer).
 *
 * Checks:
 * - ALL 256 three-variable functions (no don't-cares): cost equality, set of all minimal covers, verifyCover.
 * - ALL 81 two-variable functions with every don't-care placement (3^4).
 * - ALL 6,561 three-variable functions with every don't-care placement (3^8).
 * - 4-variable sweep without don't-cares (default seeded sample >= 2,000; full 65,536 with RUN_FULL_KMAP_SWEEP=true).
 * - Seeded random 4-variable functions WITH don't-cares (>= 1,000).
 * - Seeded random 5-variable functions with and without don't-cares (>= 300).
 * - Exhaustive and sampled POS checks against minimizePOS.
 * - Disagreement counter reported in test log (must be 0).
 */

/* eslint-disable no-console */

import { afterAll, describe, expect, it } from 'vitest';
import {
  type Cube as OracleCube,
  minimizePOS,
  minimizeSOP,
  verifyCover,
} from '../common/bruteForceMinimizer';
import type { Cube } from './layout';
import { solvePOS, solveSOP } from './solver';

function createPrng(seed = 123456789): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function normalizeCube(c: Cube | OracleCube): string {
  return `${c.careMask}:${c.valueMask}`;
}

function normalizeCover(cover: readonly (Cube | OracleCube)[]): string {
  return [...cover].map(normalizeCube).sort().join(';');
}

function normalizeSolutions(solutions: readonly (readonly (Cube | OracleCube)[])[]): string[] {
  return Array.from(new Set(solutions.map(normalizeCover))).sort();
}

let totalFunctionsChecked = 0;
let totalDisagreements = 0;

afterAll(() => {
  console.log('====================================================');
  console.log(`ORACLE VERIFICATION SUMMARY:`);
  console.log(`Total functions checked against oracle: ${totalFunctionsChecked}`);
  console.log(`Total disagreements: ${totalDisagreements}`);
  console.log('====================================================');
});

describe('1. 3-Variable Exhaustive (All 256 Functions, No Don\'t-Cares)', () => {
  it('achieves exact cost equality, identical all-minimal-covers sets, and passes verifyCover', () => {
    for (let mask = 0; mask < 256; mask++) {
      const minterms: number[] = [];
      for (let bit = 0; bit < 8; bit++) {
        if (((mask >>> bit) & 1) === 1) {
          minterms.push(bit);
        }
      }

      totalFunctionsChecked++;

      const oracle = minimizeSOP(3, minterms);
      const res = solveSOP(3, minterms);

      if (!res.ok) {
        totalDisagreements++;
        expect(res.ok).toBe(true);
        continue;
      }

      const sol = res.solution;

      // 1. Cost equality
      if (
        sol.primarySolution.termCount !== oracle.minTermCount ||
        sol.primarySolution.literalCount !== oracle.minLiteralCount
      ) {
        totalDisagreements++;
      }
      expect(sol.primarySolution.termCount).toBe(oracle.minTermCount);
      expect(sol.primarySolution.literalCount).toBe(oracle.minLiteralCount);

      // 2. All minimal covers equality (compared as normalized sets of cube-sets)
      const solverCoverCubes = sol.allMinimalCovers.map((cov) =>
        cov.primeImplicants.map((pi) => pi.cube)
      );
      const normSolver = normalizeSolutions(solverCoverCubes);
      const normOracle = normalizeSolutions(oracle.solutions);

      if (JSON.stringify(normSolver) !== JSON.stringify(normOracle)) {
        totalDisagreements++;
      }
      expect(normSolver).toEqual(normOracle);

      // 3. verifyCover passes for every solver answer
      for (const cov of solverCoverCubes) {
        const v = verifyCover(3, minterms, [], cov);
        expect(v.coversAllMinterms).toBe(true);
        expect(v.coversNoZeros).toBe(true);
      }
    }
  });
});

describe('2. Exhaustive Don\'t-Care Combinations (2-var 3^4 = 81 & 3-var 3^8 = 6,561)', () => {
  it('verifies all 81 combinations of 2-variable functions with don\'t-cares', () => {
    for (let code = 0; code < 81; code++) {
      let temp = code;
      const minterms: number[] = [];
      const dontCares: number[] = [];

      for (let cell = 0; cell < 4; cell++) {
        const val = temp % 3;
        temp = Math.floor(temp / 3);
        if (val === 1) minterms.push(cell);
        else if (val === 2) dontCares.push(cell);
      }

      totalFunctionsChecked++;

      const oracle = minimizeSOP(2, minterms, dontCares);
      const res = solveSOP(2, minterms, dontCares);

      if (!res.ok) {
        totalDisagreements++;
        expect(res.ok).toBe(true);
        continue;
      }

      const sol = res.solution;
      expect(sol.primarySolution.termCount).toBe(oracle.minTermCount);
      expect(sol.primarySolution.literalCount).toBe(oracle.minLiteralCount);

      for (const cov of sol.allMinimalCovers) {
        const cubes = cov.primeImplicants.map((p) => p.cube);
        const v = verifyCover(2, minterms, dontCares, cubes);
        expect(v.coversAllMinterms).toBe(true);
        expect(v.coversNoZeros).toBe(true);
      }
    }
  });

  it('verifies all 6,561 combinations of 3-variable functions with don\'t-cares (3^8 combinations)', () => {
    for (let code = 0; code < 6561; code++) {
      let temp = code;
      const minterms: number[] = [];
      const dontCares: number[] = [];

      for (let cell = 0; cell < 8; cell++) {
        const val = temp % 3;
        temp = Math.floor(temp / 3);
        if (val === 1) minterms.push(cell);
        else if (val === 2) dontCares.push(cell);
      }

      totalFunctionsChecked++;

      const oracle = minimizeSOP(3, minterms, dontCares);
      const res = solveSOP(3, minterms, dontCares);

      if (!res.ok) {
        totalDisagreements++;
        expect(res.ok).toBe(true);
        continue;
      }

      const sol = res.solution;
      if (
        sol.primarySolution.termCount !== oracle.minTermCount ||
        sol.primarySolution.literalCount !== oracle.minLiteralCount
      ) {
        totalDisagreements++;
      }
      expect(sol.primarySolution.termCount).toBe(oracle.minTermCount);
      expect(sol.primarySolution.literalCount).toBe(oracle.minLiteralCount);

      for (const cov of sol.allMinimalCovers) {
        const cubes = cov.primeImplicants.map((p) => p.cube);
        const v = verifyCover(3, minterms, dontCares, cubes);
        expect(v.coversAllMinterms).toBe(true);
        expect(v.coversNoZeros).toBe(true);
      }
    }
  });
});

describe('3. 4-Variable Sweep (Without Don\'t-Cares)', () => {
  const isFullSweep = process.env.RUN_FULL_KMAP_SWEEP === 'true';
  const sampleCount = isFullSweep ? 65536 : 2000;

  it(`verifies ${sampleCount} 4-variable functions (full sweep=${isFullSweep})`, () => {
    const prng = createPrng(987654321);
    const start = Date.now();

    for (let i = 0; i < sampleCount; i++) {
      const mask = isFullSweep ? i : Math.floor(prng() * 65536);
      const minterms: number[] = [];
      for (let bit = 0; bit < 16; bit++) {
        if (((mask >>> bit) & 1) === 1) {
          minterms.push(bit);
        }
      }

      totalFunctionsChecked++;

      const oracle = minimizeSOP(4, minterms);
      const res = solveSOP(4, minterms);

      if (!res.ok) {
        totalDisagreements++;
        expect(res.ok).toBe(true);
        continue;
      }

      const sol = res.solution;
      if (
        sol.primarySolution.termCount !== oracle.minTermCount ||
        sol.primarySolution.literalCount !== oracle.minLiteralCount
      ) {
        totalDisagreements++;
      }
      expect(sol.primarySolution.termCount).toBe(oracle.minTermCount);
      expect(sol.primarySolution.literalCount).toBe(oracle.minLiteralCount);

      for (const cov of sol.allMinimalCovers) {
        const cubes = cov.primeImplicants.map((p) => p.cube);
        const v = verifyCover(4, minterms, [], cubes);
        expect(v.coversAllMinterms).toBe(true);
        expect(v.coversNoZeros).toBe(true);
      }
    }

    const elapsed = Date.now() - start;
    console.log(`4-variable verification (${sampleCount} functions) completed in ${elapsed} ms.`);
  });
});

describe('4. Seeded Random 4-Variable Functions With Don\'t-Cares', () => {
  it('verifies at least 1,000 seeded random 4-variable functions with don\'t-cares', () => {
    const prng = createPrng(555555555);
    const count = 1000;

    for (let i = 0; i < count; i++) {
      const minterms: number[] = [];
      const dontCares: number[] = [];

      for (let cell = 0; cell < 16; cell++) {
        const r = prng();
        if (r < 0.35) {
          minterms.push(cell);
        } else if (r < 0.55) {
          dontCares.push(cell);
        }
      }

      totalFunctionsChecked++;

      const oracle = minimizeSOP(4, minterms, dontCares);
      const res = solveSOP(4, minterms, dontCares);

      if (!res.ok) {
        totalDisagreements++;
        expect(res.ok).toBe(true);
        continue;
      }

      const sol = res.solution;
      if (
        sol.primarySolution.termCount !== oracle.minTermCount ||
        sol.primarySolution.literalCount !== oracle.minLiteralCount
      ) {
        totalDisagreements++;
      }
      expect(sol.primarySolution.termCount).toBe(oracle.minTermCount);
      expect(sol.primarySolution.literalCount).toBe(oracle.minLiteralCount);

      for (const cov of sol.allMinimalCovers) {
        const cubes = cov.primeImplicants.map((p) => p.cube);
        const v = verifyCover(4, minterms, dontCares, cubes);
        expect(v.coversAllMinterms).toBe(true);
        expect(v.coversNoZeros).toBe(true);
      }
    }
  });
});

describe('5. Seeded Random 5-Variable Functions (With and Without Don\'t-Cares)', () => {
  it('verifies 300 random 5-variable functions', () => {
    const prng = createPrng(1122334455);
    const count = 300;

    for (let i = 0; i < count; i++) {
      const withDc = i % 2 === 1;
      const minterms: number[] = [];
      const dontCares: number[] = [];

      for (let cell = 0; cell < 32; cell++) {
        const r = prng();
        if (withDc) {
          if (r < 0.3) minterms.push(cell);
          else if (r < 0.45) dontCares.push(cell);
        } else {
          if (r < 0.35) minterms.push(cell);
        }
      }

      totalFunctionsChecked++;

      const oracle = minimizeSOP(5, minterms, dontCares);
      const res = solveSOP(5, minterms, dontCares);

      if (!res.ok) {
        totalDisagreements++;
        expect(res.ok).toBe(true);
        continue;
      }

      const sol = res.solution;
      if (
        sol.primarySolution.termCount !== oracle.minTermCount ||
        sol.primarySolution.literalCount !== oracle.minLiteralCount
      ) {
        totalDisagreements++;
      }
      expect(sol.primarySolution.termCount).toBe(oracle.minTermCount);
      expect(sol.primarySolution.literalCount).toBe(oracle.minLiteralCount);

      for (const cov of sol.allMinimalCovers) {
        const cubes = cov.primeImplicants.map((p) => p.cube);
        const v = verifyCover(5, minterms, dontCares, cubes);
        expect(v.coversAllMinterms).toBe(true);
        expect(v.coversNoZeros).toBe(true);
      }
    }
  });
});

describe('6. POS Verification Against minimizePOS', () => {
  it('verifies 3-variable exhaustive POS against minimizePOS', () => {
    for (let mask = 0; mask < 256; mask++) {
      const minterms: number[] = [];
      for (let bit = 0; bit < 8; bit++) {
        if (((mask >>> bit) & 1) === 1) {
          minterms.push(bit);
        }
      }

      totalFunctionsChecked++;

      const oracle = minimizePOS(3, minterms);
      const res = solvePOS(3, minterms);

      if (!res.ok) {
        totalDisagreements++;
        expect(res.ok).toBe(true);
        continue;
      }

      const sol = res.solution;
      expect(sol.primarySolution.termCount).toBe(oracle.minTermCount);
      expect(sol.primarySolution.literalCount).toBe(oracle.minLiteralCount);

      const zeroCells: number[] = [];
      for (let c = 0; c < 8; c++) {
        if (!minterms.includes(c)) zeroCells.push(c);
      }

      for (const cov of sol.allMinimalCovers) {
        const cubes = cov.primeImplicants.map((p) => p.cube);
        const v = verifyCover(3, zeroCells, [], cubes);
        expect(v.coversAllMinterms).toBe(true);
        expect(v.coversNoZeros).toBe(true);
      }
    }
  });

  it('verifies 500 sampled 4-variable POS functions with don\'t-cares', () => {
    const prng = createPrng(777888999);
    for (let i = 0; i < 500; i++) {
      const minterms: number[] = [];
      const dontCares: number[] = [];
      for (let cell = 0; cell < 16; cell++) {
        const r = prng();
        if (r < 0.35) minterms.push(cell);
        else if (r < 0.5) dontCares.push(cell);
      }

      totalFunctionsChecked++;

      const oracle = minimizePOS(4, minterms, dontCares);
      const res = solvePOS(4, minterms, dontCares);

      if (!res.ok) {
        totalDisagreements++;
        expect(res.ok).toBe(true);
        continue;
      }

      const sol = res.solution;
      expect(sol.primarySolution.termCount).toBe(oracle.minTermCount);
      expect(sol.primarySolution.literalCount).toBe(oracle.minLiteralCount);

      const zeroCells: number[] = [];
      for (let c = 0; c < 16; c++) {
        if (!minterms.includes(c) && !dontCares.includes(c)) zeroCells.push(c);
      }

      for (const cov of sol.allMinimalCovers) {
        const cubes = cov.primeImplicants.map((p) => p.cube);
        const v = verifyCover(4, zeroCells, dontCares, cubes);
        expect(v.coversAllMinterms).toBe(true);
        expect(v.coversNoZeros).toBe(true);
      }
    }
  });
});
