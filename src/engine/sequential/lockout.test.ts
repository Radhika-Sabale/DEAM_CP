/**
 * @file lockout.test.ts
 * Comprehensive test suite for Stage 10B lockout analysis.
 * Verifies hand-crafted trapped cycles, SR indeterminate states, self-correcting paths,
 * and validates the pruning algorithm against an independent depth-enumerating brute-force oracle over 300 equation sets.
 */

import { describe, expect, it } from 'vitest';
import type { BoolNode } from '../../types/ast';
import type { CounterSpec, FlipFlopType } from '../../types/sequential';
import { parse } from '../boolean/parser';
import { solveSOP } from '../kmap/solver';
import { designSequential } from './counterDesigner';
import { analyzeLockout, computeEquationNextState } from './lockout';
import type { DerivedEquation } from './nextStateEquations';
import { createCanonicalStateTable } from './stateTable';

function makeEquation(
  name: string,
  exprStr: string,
  variables: string[] = ['Q2', 'Q1', 'Q0']
): DerivedEquation {
  const parsed = parse(exprStr);
  const expr: BoolNode = parsed.ok && parsed.ast ? parsed.ast : { type: 'constant', value: 0 };
  return {
    name,
    variables,
    column: [],
    expression: expr,
    text: exprStr,
    cost: { terms: 1, literals: 1 },
    minimalCoverCount: 1,
    usedDontCares: [],
    constant: null,
  };
}

describe('Lockout Analysis Unit Tests', () => {
  it('detects a 5 <-> 6 cycle and self-loop at 7 with hand-built D flip-flop equations', () => {
    // 3 state bits (Q2, Q1, Q0), valid states 0..4 (mod-5 counter), unused states 5, 6, 7.
    // We want transitions on unused states:
    // State 5 (101) -> State 6 (110)
    // State 6 (110) -> State 5 (101)
    // State 7 (111) -> State 7 (111)
    // Valid states: 0->1->2->3->4->0
    //
    // Truth table for D2, D1, D0:
    // 0 (000) -> 1 (001): D2=0, D1=0, D0=1
    // 1 (001) -> 2 (010): D2=0, D1=1, D0=0
    // 2 (010) -> 3 (011): D2=0, D1=1, D0=1
    // 3 (011) -> 4 (100): D2=1, D1=0, D0=0
    // 4 (100) -> 0 (000): D2=0, D1=0, D0=0
    // 5 (101) -> 6 (110): D2=1, D1=1, D0=0
    // 6 (110) -> 5 (101): D2=1, D1=0, D0=1
    // 7 (111) -> 7 (111): D2=1, D1=1, D0=1
    //
    // Minterms for D2 (1 on 3, 5, 6, 7):
    // 3 (011), 5 (101), 6 (110), 7 (111)
    // D2 = !Q2 & Q1 & Q0 | Q2 & Q0 | Q2 & Q1
    //
    // Minterms for D1 (1 on 1, 2, 5, 7):
    // 1 (001), 2 (010), 5 (101), 7 (111)
    // D1 = !Q2 & !Q1 & Q0 | !Q2 & Q1 & !Q0 | Q2 & Q0
    //
    // Minterms for D0 (1 on 0, 2, 6, 7):
    // 0 (000), 2 (010), 6 (110), 7 (111)
    // D0 = !Q2 & !Q1 & !Q0 | !Q2 & Q1 & !Q0 | Q2 & Q1

    const d2 = makeEquation('D2', '!Q2 & Q1 & Q0 | Q2 & Q0 | Q2 & Q1');
    const d1 = makeEquation('D1', '!Q2 & !Q1 & Q0 | !Q2 & Q1 & !Q0 | Q2 & Q0');
    const d0 = makeEquation('D0', '!Q2 & !Q1 & !Q0 | !Q2 & Q1 & !Q0 | Q2 & Q1');

    const transitions = new Map<number, { nextCode: number }>([
      [0, { nextCode: 1 }],
      [1, { nextCode: 2 }],
      [2, { nextCode: 3 }],
      [3, { nextCode: 4 }],
      [4, { nextCode: 0 }],
    ]);

    const table = createCanonicalStateTable(
      3,
      [0, 1, 2, 3, 4],
      0,
      false,
      'none',
      'counter',
      transitions
    );

    const report = analyzeLockout({
      table,
      equations: [d2, d1, d0],
      flipFlop: 'D',
    });

    expect(report.isSelfCorrecting).toBe(false);
    expect(report.lockedStates).toEqual([5, 6, 7]);
    expect(report.indeterminateStates).toEqual([]);
    expect(report.cycles.length).toBe(2);
    expect(report.cycles).toContainEqual([5, 6]);
    expect(report.cycles).toContainEqual([7]);

    const state5 = report.unusedStates.find((u) => u.code === 5);
    expect(state5?.status).toBe('locked');
    expect(state5?.examplePath).toEqual([5, 6, 5]);

    const state7 = report.unusedStates.find((u) => u.code === 7);
    expect(state7?.status).toBe('locked');
    expect(state7?.examplePath).toEqual([7, 7]);
  });

  it('detects a state returning to valid states in 2 steps', () => {
    // 3 state bits, valid 0..4, unused 5, 6, 7
    // Transitions:
    // State 5 -> 6
    // State 6 -> 0 (valid!) => 5 returns in 2 steps, 6 returns in 1 step
    // State 7 -> 0 (valid!) => 7 returns in 1 step

    // D2 on: 3 (011) only among valid; on unused: 5->6 (110 => D2=1)
    // D2 = !Q2 & Q1 & Q0 | Q2 & !Q1 & Q0
    // D1 on: 1, 2 among valid; on unused: 5->6 (110 => D1=1)
    // D1 = !Q2 & !Q1 & Q0 | !Q2 & Q1 & !Q0 | Q2 & !Q1 & Q0
    // D0 on: 0, 2 among valid; on unused: none
    // D0 = !Q2 & !Q1 & !Q0 | !Q2 & Q1 & !Q0

    const d2 = makeEquation('D2', '!Q2 & Q1 & Q0 | Q2 & !Q1 & Q0');
    const d1 = makeEquation('D1', '!Q2 & !Q1 & Q0 | !Q2 & Q1 & !Q0 | Q2 & !Q1 & Q0');
    const d0 = makeEquation('D0', '!Q2 & !Q1 & !Q0 | !Q2 & Q1 & !Q0');

    const transitions = new Map<number, { nextCode: number }>([
      [0, { nextCode: 1 }],
      [1, { nextCode: 2 }],
      [2, { nextCode: 3 }],
      [3, { nextCode: 4 }],
      [4, { nextCode: 0 }],
    ]);

    const table = createCanonicalStateTable(
      3,
      [0, 1, 2, 3, 4],
      0,
      false,
      'none',
      'counter',
      transitions
    );

    const report = analyzeLockout({
      table,
      equations: [d2, d1, d0],
      flipFlop: 'D',
    });

    expect(report.isSelfCorrecting).toBe(true);
    expect(report.lockedStates).toEqual([]);
    expect(report.indeterminateStates).toEqual([]);
    expect(report.maxStepsToValid).toBe(2);

    const state5 = report.unusedStates.find((u) => u.code === 5);
    expect(state5?.status).toBe('returns');
    expect(state5?.stepsToValid).toBe(2);
    expect(state5?.examplePath).toEqual([5, 6, 0]);

    const state6 = report.unusedStates.find((u) => u.code === 6);
    expect(state6?.status).toBe('returns');
    expect(state6?.stepsToValid).toBe(1);
    expect(state6?.examplePath).toEqual([6, 0]);
  });

  it('detects an SR indeterminate condition (S = R = 1) on an unused state', () => {
    // For SR flip-flop, if S0 = 1 and R0 = 1 on state 7 (111), nextState produces 'X'
    // S0 = Q2 & Q1 & Q0 (1 at state 7)
    // R0 = Q2 & Q1 & Q0 (1 at state 7)
    // S1=0, R1=0, S2=0, R2=0
    const s2 = makeEquation('S2', '0');
    const r2 = makeEquation('R2', '0');
    const s1 = makeEquation('S1', '0');
    const r1 = makeEquation('R1', '0');
    const s0 = makeEquation('S0', 'Q2 & Q1 & Q0');
    const r0 = makeEquation('R0', 'Q2 & Q1 & Q0');

    const transitions = new Map<number, { nextCode: number }>([
      [0, { nextCode: 1 }],
      [1, { nextCode: 2 }],
      [2, { nextCode: 3 }],
      [3, { nextCode: 4 }],
      [4, { nextCode: 0 }],
    ]);

    const table = createCanonicalStateTable(
      3,
      [0, 1, 2, 3, 4],
      0,
      false,
      'none',
      'counter',
      transitions
    );

    const report = analyzeLockout({
      table,
      equations: [s2, r2, s1, r1, s0, r0],
      flipFlop: 'SR',
    });

    expect(report.isSelfCorrecting).toBe(false);
    expect(report.indeterminateStates).toContain(7);

    const state7 = report.unusedStates.find((u) => u.code === 7);
    expect(state7?.status).toBe('indeterminate');
    expect(state7?.transitions[0]?.nextCode).toBe('X');
  });

  it('validates pruning algorithm against depth-(2^n + 1) brute-force search over 300 random equation sets', () => {
    // Seeded deterministic pseudo-random generator
    let seed = 123456789;
    function rand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    const n = 3;
    const numStates = 1 << n; // 8
    const maxDepth = numStates + 1; // 9
    const validCodes = [0, 1, 2, 3, 4]; // Unused: 5, 6, 7
    const validSet = new Set(validCodes);

    const transitions = new Map<number, { nextCode: number }>([
      [0, { nextCode: 1 }],
      [1, { nextCode: 2 }],
      [2, { nextCode: 3 }],
      [3, { nextCode: 4 }],
      [4, { nextCode: 0 }],
    ]);

    const table = createCanonicalStateTable(
      n,
      validCodes,
      0,
      true, // has external input IN
      'counter-up-down',
      'counter',
      transitions
    );

    const vars = ['Q2', 'Q1', 'Q0', 'IN'];

    function createEqFromMinterms(name: string, minterms: number[], vars: string[]): DerivedEquation {
      if (minterms.length === 0) {
        return {
          name,
          variables: vars,
          column: [],
          expression: { type: 'constant', value: 0 },
          text: '0',
          cost: { terms: 0, literals: 0 },
          minimalCoverCount: 1,
          usedDontCares: [],
          constant: 0,
        };
      }
      if (minterms.length === 16) {
        return {
          name,
          variables: vars,
          column: [],
          expression: { type: 'constant', value: 1 },
          text: '1',
          cost: { terms: 1, literals: 0 },
          minimalCoverCount: 1,
          usedDontCares: [],
          constant: 1,
        };
      }
      const solRes = solveSOP(4, minterms, [], vars);
      const expr: BoolNode = solRes.ok ? solRes.solution.expression : { type: 'constant', value: 0 };
      return {
        name,
        variables: vars,
        column: [],
        expression: expr,
        text: '',
        cost: { terms: 1, literals: 1 },
        minimalCoverCount: 1,
        usedDontCares: [],
        constant: null,
      };
    }

    function isLockoutBruteForce(
      startState: number,
      equations: readonly DerivedEquation[],
      validSet: Set<number>,
      maxDepth: number,
      n: number
    ): boolean {
      function dfs(curr: number, depth: number): boolean {
        if (validSet.has(curr)) return false;
        if (depth >= maxDepth) return true;

        for (const inVal of [0, 1] as const) {
          const nxt = computeEquationNextState(curr, inVal, n, 'D', equations, true);
          if (typeof nxt === 'number' && dfs(nxt, depth + 1)) {
            return true;
          }
        }
        return false;
      }

      return dfs(startState, 0);
    }

    for (let testIter = 0; testIter < 300; testIter++) {
      // Generate random next-state lookup table for D2, D1, D0
      // 16 minterms (8 states x 2 inputs)
      const mintermsD2: number[] = [];
      const mintermsD1: number[] = [];
      const mintermsD0: number[] = [];

      for (let m = 0; m < 16; m++) {
        if (rand() < 0.5) mintermsD2.push(m);
        if (rand() < 0.5) mintermsD1.push(m);
        if (rand() < 0.5) mintermsD0.push(m);
      }

      const eqD2 = createEqFromMinterms('D2', mintermsD2, vars);
      const eqD1 = createEqFromMinterms('D1', mintermsD1, vars);
      const eqD0 = createEqFromMinterms('D0', mintermsD0, vars);
      const equations = [eqD2, eqD1, eqD0];

      // Run analyzeLockout
      const report = analyzeLockout({
        table,
        equations,
        flipFlop: 'D',
      });

      for (const u of [5, 6, 7]) {
        const expectedLockout = isLockoutBruteForce(u, equations, validSet, maxDepth, n);
        const actualLocked = report.lockedStates.includes(u);
        expect(actualLocked).toBe(expectedLockout);
      }
    }
  });

  it('proves valid states never transition to unused states for any solver-derived design in the matrix', () => {
    const specs: CounterSpec[] = [
      { kind: 'counter', modulus: 5, flipFlop: 'D', direction: 'up' },
      { kind: 'counter', modulus: 6, flipFlop: 'T', direction: 'up' },
      { kind: 'counter', modulus: 10, flipFlop: 'JK', direction: 'up' },
      { kind: 'counter', modulus: 8, flipFlop: 'SR', direction: 'down' },
      { kind: 'counter', modulus: 6, flipFlop: 'D', direction: 'up-down' },
    ];

    const ffTypes: FlipFlopType[] = ['SR', 'JK', 'D', 'T'];

    for (const baseSpec of specs) {
      for (const ff of ffTypes) {
        const spec = { ...baseSpec, flipFlop: ff };
        const designRes = designSequential(spec);
        expect(designRes.ok).toBe(true);
        if (designRes.ok) {
          const { design } = designRes;
          const validSet = new Set(design.table.validCodes);
          const inputs = design.table.hasInput ? ([0, 1] as const) : ([0] as const);

          for (const validCode of design.table.validCodes) {
            for (const inVal of inputs) {
              const nxt = computeEquationNextState(
                validCode,
                inVal,
                design.table.stateBits,
                ff,
                design.equations,
                design.table.hasInput
              );

              expect(typeof nxt).toBe('number');
              if (typeof nxt === 'number') {
                expect(validSet.has(nxt)).toBe(true);
              }
            }
          }
        }
      }
    }
  });
});
