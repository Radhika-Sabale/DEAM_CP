/**
 * @file kmap.test.ts
 * Hand-checked and structural tests for the deterministic K-map engine (Stage 7A).
 *
 * Verifies:
 * - K-map geometry, cell/minterm bijection, textbook 4-variable table matching.
 * - Adjacency including horizontal, vertical, and corner wrap-arounds.
 * - 5-variable dual-layer inter-layer adjacency.
 * - Visual rectangle decomposition (plain, wrap left-right, wrap top-bottom, 4 corners, 5-var dual-layer).
 * - Quine-McCluskey trace and prime implicant / essential prime implicant extraction on 5+ textbook functions.
 * - Reduction steps (row dominance, column dominance) and Petrick expansion steps on cyclic cores.
 * - Equivalence of POS and SOP solutions.
 */

import { describe, expect, it } from 'vitest';
import { areEquivalent } from '../boolean/equivalence';
import { evaluateBinary } from '../boolean/evaluator';
import {
  cellAt,
  cornerMinterms,
  cubeCells,
  decomposeCubeToRectangles,
  isAdjacent,
  neighbours,
  positionOf,
} from './layout';
import type { Cube } from './layout';
import { runQuineMcCluskey } from './quineMcCluskey';
import {
  buildPiChart,
  extractPrimeImplicants,
  reducePiChart,
} from './primeImplicants';
import { solvePetrick } from './petrick';
import { solvePOS, solveSOP, solveSOPVerified } from './solver';

describe('1. K-Map Layout & Geometry', () => {
  it('establishes a bidirectional bijection for 2, 3, 4, and 5 variables', () => {
    for (const varCount of [2, 3, 4, 5]) {
      const total = 1 << varCount;
      const seenMinterms = new Set<number>();

      for (let m = 0; m < total; m++) {
        const pos = positionOf(m, varCount);
        const mapped = cellAt(pos.row, pos.col, pos.layer, varCount);
        expect(mapped).toBe(m);
        seenMinterms.add(mapped);
      }

      expect(seenMinterms.size).toBe(total);
    }
  });

  it('matches the hardcoded standard textbook 4-variable Karnaugh map table', () => {
    // Rows = AB (00, 01, 11, 10), Cols = CD (00, 01, 11, 10)
    const textbookGrid = [
      [0, 1, 3, 2], // AB = 00
      [4, 5, 7, 6], // AB = 01
      [12, 13, 15, 14], // AB = 11
      [8, 9, 11, 10], // AB = 10
    ];

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        expect(cellAt(r, c, 0, 4)).toBe(textbookGrid[r]?.[c]);
      }
    }
  });

  it('correctly determines adjacency including toroidal wrap-around boundaries', () => {
    // Horizontal wrap in row 0: cell (0, 0) = m0, cell (0, 3) = m2
    expect(isAdjacent(0, 2, 4)).toBe(true);

    // Vertical wrap in col 0: cell (0, 0) = m0, cell (3, 0) = m8
    expect(isAdjacent(0, 8, 4)).toBe(true);

    // Corner wrap: cell (0, 3) = m2 and cell (3, 3) = m10
    expect(isAdjacent(2, 10, 4)).toBe(true);

    // Diagonal is NOT adjacent: m0 (0000) and m5 (0101) differ by 2 bits
    expect(isAdjacent(0, 5, 4)).toBe(false);

    // Opposite corner is NOT adjacent: m0 (0000) and m15 (1111) differ by 4 bits
    expect(isAdjacent(0, 15, 4)).toBe(false);
  });

  it('supports 5-variable dual-layer inter-layer adjacency', () => {
    // In 5 variables, variable A (bit 4, weight 16) differentiates layer 0 and layer 1.
    // Cell at layer 0 (m5: 00101) is adjacent to the identical cell at layer 1 (m21: 10101).
    expect(isAdjacent(5, 21, 5)).toBe(true);
    const nbrs5 = neighbours(5, 5);
    expect(nbrs5).toContain(21);
    expect(nbrs5.length).toBe(5);
  });

  it('returns standard corner minterms for 2, 3, 4, and 5 variables', () => {
    expect(cornerMinterms(2)).toEqual([0, 1, 2, 3]);
    expect(cornerMinterms(3)).toEqual([0, 2, 4, 6]);
    expect(cornerMinterms(4)).toEqual([0, 2, 8, 10]);
    expect(cornerMinterms(5)).toEqual([0, 2, 8, 10, 16, 18, 24, 26]);
  });
});

describe('2. Visual Rectangle Decomposition', () => {
  it('decomposes a plain 2x2 contiguous group into a single rectangle', () => {
    // In 4 variables: B=1, D=1 corresponds to minterms [5, 7, 13, 15]
    // careMask = 0101_2 = 5, valueMask = 0101_2 = 5
    const cube: Cube = { careMask: 5, valueMask: 5 };
    const rects = decomposeCubeToRectangles(cube, 4);

    expect(rects.length).toBe(1);
    const r0 = rects[0];
    expect(r0).toBeDefined();
    if (r0) {
      expect(r0.layer).toBe(0);
      expect(r0.width).toBe(2);
      expect(r0.height).toBe(2);
      expect(r0.wrap).toBe('none');
      expect(r0.minterms.slice().sort((a, b) => a - b)).toEqual([5, 7, 13, 15]);
    }
  });

  it('decomposes a horizontal wrap group (left-right edges) into 2 rectangle pieces', () => {
    // Row pair wrapping left-right: AB=00, D=0 (minterms [0, 2])
    // careMask: A=1, B=1, C=0, D=1 -> 1101_2 = 13. valueMask: 0000_2 = 0
    const cube: Cube = { careMask: 13, valueMask: 0 };
    const rects = decomposeCubeToRectangles(cube, 4);

    expect(rects.length).toBe(2);
    expect(rects.map((r) => r.wrap).sort()).toEqual(['left', 'right']);
    const allMinterms = rects.flatMap((r) => r.minterms).sort((a, b) => a - b);
    expect(allMinterms).toEqual([0, 2]);
  });

  it('decomposes a vertical wrap group (top-bottom edges) into 2 rectangle pieces', () => {
    // Column pair wrapping top-bottom: B=0, CD=00 (minterms [0, 8])
    // careMask: A=0, B=1, C=1, D=1 -> 0111_2 = 7. valueMask: 0
    const cube: Cube = { careMask: 7, valueMask: 0 };
    const rects = decomposeCubeToRectangles(cube, 4);

    expect(rects.length).toBe(2);
    expect(rects.map((r) => r.wrap).sort()).toEqual(['bottom', 'top']);
    const allMinterms = rects.flatMap((r) => r.minterms).sort((a, b) => a - b);
    expect(allMinterms).toEqual([0, 8]);
  });

  it('decomposes the four-corner group into 4 corner rectangle pieces', () => {
    // 4 corners: B=0, D=0 (minterms [0, 2, 8, 10])
    // careMask: A=0, B=1, C=0, D=1 -> 0101_2 = 5. valueMask: 0
    const cube: Cube = { careMask: 5, valueMask: 0 };
    const rects = decomposeCubeToRectangles(cube, 4);

    expect(rects.length).toBe(4);
    const wraps = rects.map((r) => r.wrap).sort();
    expect(wraps).toEqual(['bottom-left', 'bottom-right', 'top-left', 'top-right']);
    const allMinterms = rects.flatMap((r) => r.minterms).sort((a, b) => a - b);
    expect(allMinterms).toEqual([0, 2, 8, 10]);
  });

  it('decomposes an 8-cell group spanning dual layers in a 5-variable map', () => {
    // A is don't care (spans layer 0 and layer 1).
    // B=0, D=0 (careMask has bits 3 and 1 set: 01010_2 = 10).
    // In each layer, row 0..1 and col 0..1 forms a contiguous 2x2 rectangle.
    const cube: Cube = { careMask: 10, valueMask: 0 };
    const rects = decomposeCubeToRectangles(cube, 5);

    expect(rects.length).toBe(2); // 1 rect in layer 0, 1 rect in layer 1
    const layer0Rects = rects.filter((r) => r.layer === 0);
    const layer1Rects = rects.filter((r) => r.layer === 1);
    expect(layer0Rects.length).toBe(1);
    expect(layer1Rects.length).toBe(1);

    const cells = cubeCells(cube, 5);
    expect(cells.length).toBe(8);
  });

  it('decomposes an 8-cell corner-wrapping group spanning dual layers in a 5-variable map', () => {
    // A is don't care. C=0, E=0 (bits 2 and 0 set in care: 00101_2 = 5).
    // C=0 gives row indices 0 and 3 (top/bottom wrap).
    // E=0 gives col indices 0 and 3 (left/right wrap).
    // In each layer, 4 corner pieces are produced -> 8 pieces total.
    const cube: Cube = { careMask: 5, valueMask: 0 };
    const rects = decomposeCubeToRectangles(cube, 5);

    expect(rects.length).toBe(8);
    const layer0Rects = rects.filter((r) => r.layer === 0);
    const layer1Rects = rects.filter((r) => r.layer === 1);
    expect(layer0Rects.length).toBe(4);
    expect(layer1Rects.length).toBe(4);

    const cells = cubeCells(cube, 5);
    expect(cells.length).toBe(8);
    expect(cells).toEqual([0, 2, 8, 10, 16, 18, 24, 26]);
  });
});

describe('3. Quine-McCluskey & Prime Implicants: Textbook Functions', () => {
  it('Textbook 1: f(A,B,C,D) = Σm(0, 2, 5, 7, 8, 10, 13, 15) -> B*D + B\'*D\'', () => {
    const minterms = [0, 2, 5, 7, 8, 10, 13, 15];
    const qm = runQuineMcCluskey(4, minterms);
    const pis = extractPrimeImplicants(qm, 4, minterms);

    expect(pis.length).toBe(2);
    const piStrings = pis.map((p) => p.termString).sort();
    expect(piStrings).toEqual(["B'D'", 'BD']);

    const chart = buildPiChart(pis, minterms);
    const reduction = reducePiChart(chart);

    expect(reduction.essentialPrimeImplicants.length).toBe(2);
    expect(reduction.cyclicCore).toBeNull();

    const sol = solveSOP(4, minterms);
    expect(sol.ok).toBe(true);
    if (sol.ok) {
      expect(sol.solution.primarySolution.expressionString).toBe("B'D' + BD");
      expect(sol.solution.primarySolution.termCount).toBe(2);
      expect(sol.solution.primarySolution.literalCount).toBe(4);
    }
  });

  it('Textbook 2: f(A,B,C,D) = Σm(1, 3, 7, 11, 15) + Σd(0, 2, 5)', () => {
    const minterms = [1, 3, 7, 11, 15];
    const dontCares = [0, 2, 5];
    const qm = runQuineMcCluskey(4, minterms, dontCares);
    const pis = extractPrimeImplicants(qm, 4, minterms);

    // Prime implicants should cover required minterms using don't-cares
    expect(pis.some((p) => p.termString === 'CD')).toBe(true);
    expect(pis.some((p) => p.termString === "A'B'")).toBe(true);

    const sol = solveSOP(4, minterms, dontCares);
    expect(sol.ok).toBe(true);
    if (sol.ok) {
      expect(sol.solution.primarySolution.termCount).toBe(2);
      expect(sol.solution.primarySolution.literalCount).toBe(4);
      // Both CD and A'B' cover all required minterms
      expect(sol.solution.primarySolution.expressionString).toBe("A'B' + CD");
    }
  });

  it('Textbook 3: Cyclic core requiring Petrick f(A,B,C) = Σm(0, 1, 2, 5, 6, 7)', () => {
    const minterms = [0, 1, 2, 5, 6, 7];
    const qm = runQuineMcCluskey(3, minterms);
    const pis = extractPrimeImplicants(qm, 3, minterms);

    // 6 prime implicants forming a classic cyclic chart
    expect(pis.length).toBe(6);
    const chart = buildPiChart(pis, minterms);
    const reduction = reducePiChart(chart);

    // No essential prime implicants exist!
    expect(reduction.essentialPrimeImplicants.length).toBe(0);
    expect(reduction.cyclicCore).not.toBeNull();
    if (reduction.cyclicCore) {
      expect(reduction.cyclicCore.primeImplicants.length).toBe(6);
      expect(reduction.cyclicCore.minterms.length).toBe(6);

      const petrick = solvePetrick(reduction.cyclicCore.primeImplicants, reduction.cyclicCore.minterms);
      expect(petrick.ok).toBe(true);
      if (petrick.ok) {
        expect(petrick.minimalCovers.length).toBe(2);
        expect(petrick.minTermCount).toBe(3);
        expect(petrick.minLiteralCount).toBe(6);
      }
    }

    const sol = solveSOP(3, minterms);
    expect(sol.ok).toBe(true);
    if (sol.ok) {
      expect(sol.solution.allMinimalCovers.length).toBe(2);
      expect(sol.solution.primarySolution.termCount).toBe(3);
      expect(sol.solution.primarySolution.literalCount).toBe(6);
    }
  });

  it('Textbook 4: Row/Column Dominance f(A,B,C,D) = Σm(4, 5, 6, 8, 9, 10, 13)', () => {
    const minterms = [4, 5, 6, 8, 9, 10, 13];
    const sol = solveSOP(4, minterms);
    expect(sol.ok).toBe(true);
    if (sol.ok) {
      expect(sol.solution.reductionSteps.length).toBeGreaterThan(0);
      expect(sol.solution.allMinimalCovers.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('Textbook 5: 4-variable Parity function Σm(1, 2, 4, 7, 8, 11, 13, 14)', () => {
    const minterms = [1, 2, 4, 7, 8, 11, 13, 14];
    const qm = runQuineMcCluskey(4, minterms);
    expect(qm.primeImplicants.length).toBe(8);

    const sol = solveSOP(4, minterms);
    expect(sol.ok).toBe(true);
    if (sol.ok) {
      // Nothing combines; all 8 are essential prime implicants
      expect(sol.solution.essentialPrimeImplicants.length).toBe(8);
      expect(sol.solution.primarySolution.termCount).toBe(8);
      expect(sol.solution.primarySolution.literalCount).toBe(32);
      expect(sol.solution.cyclicCore).toBeNull();
    }
  });
});

describe('4. POS vs SOP Equivalence & Edge Cases', () => {
  it('handles empty minterm list (constant 0)', () => {
    const sop = solveSOP(3, []);
    expect(sop.ok).toBe(true);
    if (sop.ok) {
      expect(sop.solution.expressionString).toBe('0');
      expect(sop.solution.primarySolution.termCount).toBe(0);
    }

    const pos = solvePOS(3, []);
    expect(pos.ok).toBe(true);
    if (pos.ok) {
      expect(pos.solution.expressionString).toBe('0');
    }
  });

  it('handles tautology / all minterms (constant 1)', () => {
    const allMinterms = Array.from({ length: 16 }, (_, i) => i);
    const sop = solveSOP(4, allMinterms);
    expect(sop.ok).toBe(true);
    if (sop.ok) {
      expect(sop.solution.expressionString).toBe('1');
      expect(sop.solution.primarySolution.termCount).toBe(1);
      expect(sop.solution.primarySolution.literalCount).toBe(0);
    }

    const pos = solvePOS(4, allMinterms);
    expect(pos.ok).toBe(true);
    if (pos.ok) {
      expect(pos.solution.expressionString).toBe('1');
    }
  });

  it('verifies that POS and SOP solutions are logically equivalent on test functions', () => {
    const testCases: { vars: number; minterms: number[]; dc?: number[] }[] = [
      { vars: 3, minterms: [0, 1, 4, 5] },
      { vars: 3, minterms: [0, 2, 5, 7] },
      { vars: 4, minterms: [0, 2, 5, 7, 8, 10, 13, 15] },
      { vars: 4, minterms: [1, 3, 7, 11, 15], dc: [0, 2, 5] },
      { vars: 4, minterms: [2, 3, 7, 9, 11, 13] },
    ];

    for (const tc of testCases) {
      const sopRes = solveSOP(tc.vars, tc.minterms, tc.dc ?? []);
      const posRes = solvePOS(tc.vars, tc.minterms, tc.dc ?? []);

      expect(sopRes.ok).toBe(true);
      expect(posRes.ok).toBe(true);

      if (sopRes.ok && posRes.ok) {
        const sopAst = sopRes.solution.expression;
        const posAst = posRes.solution.expression;

        // Exhaustive check over all 2^vars assignments
        const total = 1 << tc.vars;
        const dcSet = new Set(tc.dc ?? []);
        const mSet = new Set(tc.minterms);

        for (let m = 0; m < total; m++) {
          if (dcSet.has(m)) continue;
          const assignment: Record<string, 0 | 1> = {};
          for (let i = 0; i < tc.vars; i++) {
            const bitPos = tc.vars - 1 - i;
            const vName = sopRes.solution.variableNames[i] ?? String.fromCharCode(65 + i);
            assignment[vName] = ((m >>> bitPos) & 1) === 1 ? 1 : 0;
          }

          const sopVal = evaluateBinary(sopAst, assignment);
          const posVal = evaluateBinary(posAst, assignment);
          const expected = mSet.has(m) ? 1 : 0;

          expect(sopVal).toBe(expected);
          expect(posVal).toBe(expected);
        }

        // If no don't-cares, ASTs must be equivalent under areEquivalent
        if (!tc.dc || tc.dc.length === 0) {
          expect(areEquivalent(sopAst, posAst)).toBe(true);
        }
      }
    }
  });

  it('runs solveSOPVerified without error', () => {
    const verified = solveSOPVerified(4, [0, 2, 8, 10]);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.solution.expressionString).toBe("B'D'");
    }
  });
});
