/**
 * @file stateTable.test.ts
 * Unit tests for CanonicalStateTable construction, lookup, reachability, completeness, and simulation.
 */

import { describe, expect, it } from 'vitest';
import {
  createCanonicalStateTable,
  initialState,
  isComplete,
  reachableFrom,
  runTable,
  tableRow,
  unusedStates,
  validStates,
} from './stateTable';

describe('stateTable.ts', () => {
  it('builds canonical table with correct row count including unused states', () => {
    // 3 state bits = 8 total codes. Valid: 0..4 (mod-5 counter). No input -> 8 rows.
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

    expect(table.rows.length).toBe(8);
    expect(validStates(table)).toEqual([0, 1, 2, 3, 4]);
    expect(unusedStates(table)).toEqual([5, 6, 7]);
    expect(initialState(table)).toBe(0);

    // Check valid row
    const row2 = tableRow(table, 2);
    expect(row2?.valid).toBe(true);
    expect(row2?.nextCode).toBe(3);

    // Check unused row
    const row5 = tableRow(table, 5);
    expect(row5?.valid).toBe(false);
    expect(row5?.nextCode).toBe('X');
    expect(row5?.mealyOutput).toBe('X');
    expect(row5?.mooreOutput).toBe('X');
  });

  it('computes reachable states correctly via BFS', () => {
    const transitions = new Map<number, { nextCode: number }>([
      [0, { nextCode: 1 }],
      [1, { nextCode: 2 }],
      [2, { nextCode: 0 }],
      // State 3 is disconnected / unreachable
      [3, { nextCode: 3 }],
    ]);

    const table = createCanonicalStateTable(
      2,
      [0, 1, 2, 3],
      0,
      false,
      'none',
      'counter',
      transitions
    );

    const reachable = reachableFrom(table, 0);
    expect(reachable).toEqual([0, 1, 2]);

    const issues = isComplete(table);
    expect(issues.some((i) => i.code === 'unreachable-state')).toBe(true);
  });

  it('simulates discrete execution with runTable verifying Mealy and Moore output timing', () => {
    // 2-bit state machine with external input (4 states -> 8 rows)
    const transitions = new Map<
      number,
      { nextCode: number; mealyOutput: 0 | 1; mooreOutput: 0 | 1 }
    >([
      // S0 (idx 0: IN=0 -> S0, out=0; idx 1: IN=1 -> S1, out=0)
      [0, { nextCode: 0, mealyOutput: 0, mooreOutput: 0 }],
      [1, { nextCode: 1, mealyOutput: 0, mooreOutput: 0 }],
      // S1 (idx 2: IN=0 -> S0, out=0; idx 3: IN=1 -> S1, out=1)
      [2, { nextCode: 0, mealyOutput: 0, mooreOutput: 1 }],
      [3, { nextCode: 1, mealyOutput: 1, mooreOutput: 1 }],
    ]);

    const table = createCanonicalStateTable(
      1,
      [0, 1],
      0,
      true,
      'detector',
      'mealy',
      transitions
    );

    // Trace with inputs: [1, 1, 0, 1]
    const inputs: (0 | 1)[] = [1, 1, 0, 1];
    const steps = runTable(table, 0, inputs);

    expect(steps.length).toBe(4);

    // Step 0: State S0, in 1 -> next S1, mealy 0, moore 0
    expect(steps[0]).toMatchObject({
      state: 0,
      input: 1,
      nextState: 1,
      mealyOutput: 0,
      mooreOutputOfPresentState: 0,
    });

    // Step 1: State S1, in 1 -> next S1, mealy 1, moore 1
    expect(steps[1]).toMatchObject({
      state: 1,
      input: 1,
      nextState: 1,
      mealyOutput: 1,
      mooreOutputOfPresentState: 1,
    });

    // Step 2: State S1, in 0 -> next S0, mealy 0, moore 1
    expect(steps[2]).toMatchObject({
      state: 1,
      input: 0,
      nextState: 0,
      mealyOutput: 0,
      mooreOutputOfPresentState: 1,
    });

    // Step 3: State S0, in 1 -> next S1, mealy 0, moore 0
    expect(steps[3]).toMatchObject({
      state: 0,
      input: 1,
      nextState: 1,
      mealyOutput: 0,
      mooreOutputOfPresentState: 0,
    });
  });
});
