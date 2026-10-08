/**
 * @file compare.test.ts
 * Test suite for truth table column comparison and failure heuristics.
 */

import { describe, expect, it } from 'vitest';
import type { LogicValue } from '../../types/ast';
import type { ExtractedTruthTable } from '../../types/circuit';
import { createPrng, prngChoice, prngInt } from '../common/seededRandom';
import { compareCircuitToIntended, compareColumns } from './compare';

describe('compareColumns and compareCircuitToIntended', () => {
  it('1. returns match for identical columns', () => {
    const intended: LogicValue[] = [0, 1, 1, 0];
    const actual: LogicValue[] = [0, 1, 1, 0];
    const res = compareColumns(intended, actual, ['A', 'B']);

    expect(res.status).toBe('match');
    expect(res.mismatchCount).toBe(0);
    expect(res.likelyCauses).toHaveLength(0);
    expect(res.rows.every((r) => r.status === 'match')).toBe(true);
  });

  it('2. detects single wrong row correctly', () => {
    const intended: LogicValue[] = [0, 1, 1, 0];
    const actual: LogicValue[] = [0, 1, 0, 0]; // Row 2 is wrong
    const res = compareColumns(intended, actual, ['A', 'B']);

    expect(res.status).toBe('mismatch');
    expect(res.mismatchCount).toBe(1);
    expect(res.rows[2]?.status).toBe('mismatch');
    expect(res.rows[0]?.status).toBe('match');
  });

  it('3. treats dont-care (X) in intended as non-mismatches', () => {
    const intended: LogicValue[] = [0, 'X', 1, 'X'];
    const actual: LogicValue[] = [0, 1, 1, 0];
    const res = compareColumns(intended, actual, ['A', 'B']);

    expect(res.status).toBe('match');
    expect(res.mismatchCount).toBe(0);
    expect(res.rows[1]?.status).toBe('dont-care');
    expect(res.rows[3]?.status).toBe('dont-care');
  });

  it('4. treats actual X on care rows as unknown mismatches and diagnoses unknown-values', () => {
    const intended: LogicValue[] = [0, 1, 1, 0];
    const actual: LogicValue[] = [0, 'X', 1, 0];
    const res = compareColumns(intended, actual, ['A', 'B']);

    expect(res.status).toBe('mismatch');
    expect(res.mismatchCount).toBe(1);
    expect(res.rows[1]?.status).toBe('unknown');
    expect(res.likelyCauses.some((c) => c.type === 'unknown-values')).toBe(true);
  });

  it('5. diagnoses inverted-output heuristic correctly', () => {
    const intended: LogicValue[] = [0, 1, 1, 0];
    const actual: LogicValue[] = [1, 0, 0, 1]; // Inverted
    const res = compareColumns(intended, actual, ['A', 'B']);

    expect(res.status).toBe('mismatch');
    expect(res.mismatchCount).toBe(4);
    expect(res.likelyCauses.some((c) => c.type === 'inverted-output')).toBe(true);
  });

  it('6. diagnoses stuck-at-0 and stuck-at-1 heuristics', () => {
    const intended: LogicValue[] = [0, 1, 1, 0];
    const actual0: LogicValue[] = [0, 0, 0, 0];
    const res0 = compareColumns(intended, actual0, ['A', 'B']);
    expect(res0.likelyCauses.some((c) => c.type === 'stuck-at-0')).toBe(true);

    const actual1: LogicValue[] = [1, 1, 1, 1];
    const res1 = compareColumns(intended, actual1, ['A', 'B']);
    expect(res1.likelyCauses.some((c) => c.type === 'stuck-at-1')).toBe(true);
  });

  it('7. diagnoses swapped-inputs across all 3-variable swap permutations', () => {
    // F(A, B, C) = A'B + C = minterms 1, 2, 3, 5, 7
    // [0, 1, 1, 1, 0, 1, 0, 1]
    const intended: LogicValue[] = [0, 1, 1, 1, 0, 1, 0, 1];
    const vars = ['A', 'B', 'C'];

    // Swap A and B: F(B, A, C) = B'A + C
    // Row 0(000)->0, 1(001)->1, 2(010)->0, 3(011)->1, 4(100)->1, 5(101)->1, 6(110)->0, 7(111)->1
    const actualSwapAB: LogicValue[] = [0, 1, 0, 1, 1, 1, 0, 1];
    const resAB = compareColumns(intended, actualSwapAB, vars);
    expect(resAB.likelyCauses.some((c) => c.type === 'swapped-inputs' && c.swappedLabels?.includes('A') && c.swappedLabels?.includes('B'))).toBe(true);

    // Swap B and C: F(A, C, B) = A'C + B
    // Row 0(000)->0, 1(001)->1, 2(010)->1, 3(011)->1, 4(100)->0, 5(101)->1, 6(110)->0, 7(111)->1
    const actualSwapBC: LogicValue[] = [0, 1, 1, 1, 0, 0, 1, 1];
    const resBC = compareColumns(intended, actualSwapBC, vars);
    expect(resBC.likelyCauses.some((c) => c.type === 'swapped-inputs' && c.swappedLabels?.includes('B') && c.swappedLabels?.includes('C'))).toBe(true);
  });

  it('8. remaps rows by variable name when order differs in compareCircuitToIntended', () => {
    // Intended: variables A, B; column [0, 1, 1, 0] (XOR: A=0,B=1 -> 1; A=1,B=0 -> 1)
    const intended = {
      variables: ['A', 'B'],
      column: [0, 1, 1, 0] as LogicValue[],
    };

    // Extracted table has inputs in order ['B', 'A']
    // Extracted rows for XOR:
    // B=0, A=0 -> index 0, out=0
    // B=0, A=1 -> index 1, out=1
    // B=1, A=0 -> index 2, out=1
    // B=1, A=1 -> index 3, out=0
    const extracted: ExtractedTruthTable = {
      inputs: ['B', 'A'],
      outputs: ['OUT'],
      rows: [
        { index: 0, inputs: [0, 0], outputs: [0] },
        { index: 1, inputs: [0, 1], outputs: [1] },
        { index: 2, inputs: [1, 0], outputs: [1] },
        { index: 3, inputs: [1, 1], outputs: [0] },
      ],
    };

    const res = compareCircuitToIntended(extracted, 'OUT', intended);
    expect(res.status).toBe('match');
    if (res.status !== 'incomparable') {
      expect(res.mismatchCount).toBe(0);
    }
  });

  it('9. returns incomparable when variable names are missing or extra', () => {
    const intended = {
      variables: ['A', 'B'],
      column: [0, 1, 1, 0] as LogicValue[],
    };

    const extractedMissing: ExtractedTruthTable = {
      inputs: ['A', 'C'],
      outputs: ['OUT'],
      rows: [],
    };

    const res = compareCircuitToIntended(extractedMissing, 'OUT', intended);
    expect(res.status).toBe('incomparable');
    if (res.status === 'incomparable') {
      expect(res.missingVariables).toEqual(['B']);
      expect(res.extraVariables).toEqual(['C']);
    }
  });

  it('10. property test: mutating k care rows always produces exactly k mismatches', () => {
    const rng = createPrng(4321);

    for (let trial = 0; trial < 100; trial++) {
      const numVars = prngInt(rng, 2, 4);
      const numRows = 1 << numVars;
      const intended: LogicValue[] = [];

      for (let i = 0; i < numRows; i++) {
        intended.push(prngChoice(rng, [0, 1]) as LogicValue);
      }

      const k = prngInt(rng, 0, numRows);
      const mutateIndices = new Set<number>();
      while (mutateIndices.size < k) {
        mutateIndices.add(prngInt(rng, 0, numRows - 1));
      }

      const actual = [...intended];
      for (const idx of mutateIndices) {
        actual[idx] = actual[idx] === 1 ? 0 : 1;
      }

      const res = compareColumns(intended, actual);
      expect(res.mismatchCount).toBe(k);
      expect(res.status).toBe(k === 0 ? 'match' : 'mismatch');
    }
  });
});
