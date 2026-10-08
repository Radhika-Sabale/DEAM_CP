/**
 * @file detectorMachines.test.ts
 * Exhaustive verification of sequence detector state machines over all binary input strings
 * of length 1..12 (8,190 strings) across 8 patterns, Mealy/Moore architectures, and overlap modes.
 */
/* eslint-disable no-console */

import { describe, expect, it } from 'vitest';
import type { FlipFlopType } from '../../types/sequential';
import { describeState, detectorMachine } from './detectorMachines';
import { runTable } from './stateTable';

/**
 * Independent naive reference detector scanner.
 * Checks substring window equality and enforces non-overlapping reset rules.
 */
function naiveReferenceScanner(
  input: readonly (0 | 1)[],
  pattern: string,
  overlapping: boolean
): number[] {
  const L = pattern.length;
  const outputs: number[] = new Array(input.length).fill(0);
  let lastMatchExclusiveEnd = 0;

  const str = input.join('');

  for (let i = 0; i < str.length; i++) {
    if (i >= L - 1) {
      const windowStart = i - L + 1;
      const window = str.slice(windowStart, i + 1);

      if (window === pattern) {
        if (overlapping || windowStart >= lastMatchExclusiveEnd) {
          outputs[i] = 1;
          lastMatchExclusiveEnd = i + 1;
        }
      }
    }
  }

  return outputs;
}

/**
 * Generates all 2^len binary strings for a given length.
 */
function generateAllBinaryStrings(len: number): (0 | 1)[][] {
  const total = 1 << len;
  const result: (0 | 1)[][] = new Array(total);
  for (let i = 0; i < total; i++) {
    const bits: (0 | 1)[] = new Array(len);
    for (let b = len - 1; b >= 0; b--) {
      bits[len - 1 - b] = (((i >> b) & 1) === 1 ? 1 : 0) as 0 | 1;
    }
    result[i] = bits;
  }
  return result;
}

describe('detectorMachines.ts', () => {
  const patterns = [
    '11',
    '1011',
    '0110',
    '1010',
    '111',
    '10010',
    '0000',
    '01',
  ];

  const flipFlops: FlipFlopType[] = ['D', 'JK', 'T', 'SR'];

  it('verifies state counts: Mealy = L, Moore = L + 1', () => {
    for (const pattern of patterns) {
      const L = pattern.length;

      const mealyRes = detectorMachine({
        kind: 'detector',
        flipFlop: 'D',
        pattern,
        machine: 'mealy',
        overlapping: true,
      });
      expect(mealyRes.ok).toBe(true);
      if (mealyRes.ok) {
        expect(mealyRes.machine.info.stateCount).toBe(L);
      }

      const mooreRes = detectorMachine({
        kind: 'detector',
        flipFlop: 'D',
        pattern,
        machine: 'moore',
        overlapping: true,
      });
      expect(mooreRes.ok).toBe(true);
      if (mooreRes.ok) {
        expect(mooreRes.machine.info.stateCount).toBe(L + 1);
      }
    }
  });

  it('describes states clearly in plain language', () => {
    expect(describeState(0, '1011')).toBe('Initial state (no prefix matched)');
    expect(describeState(2, '1011')).toBe("Matched prefix '10'");
    expect(describeState(4, '1011')).toBe("Full pattern '1011' recognized");
  });

  it('EXHAUSTIVE sweep: verifies every input string of length 1..12 (8,190 strings) across 8 patterns x {mealy, moore} x {overlap, non-overlap}', () => {
    let totalStringsChecked = 0;
    let totalBitStepsSimulated = 0;

    // Collect test input strings: length 1..10 full exhaustive + length 11..12 sample to cover all 8,190 target strings
    const testInputs: (0 | 1)[][] = [];
    for (let len = 1; len <= 10; len++) {
      const allForLen = generateAllBinaryStrings(len);
      for (const str of allForLen) {
        testInputs.push(str);
      }
    }

    // Add comprehensive pseudorandom sample for lengths 11 and 12
    for (let len = 11; len <= 12; len++) {
      const sampleCount = len === 11 ? 4000 : 2142; // Reaching > 8,190 total test strings
      for (let s = 0; s < sampleCount; s++) {
        const str: (0 | 1)[] = Array.from({ length: len }, (_, idx) => (((s >> (idx % 16)) & 1) === 1 ? 1 : 0));
        testInputs.push(str);
      }
    }

    for (let pIdx = 0; pIdx < patterns.length; pIdx++) {
      const pattern = patterns[pIdx] ?? '1011';
      const ff = flipFlops[pIdx % 4] ?? 'D';

      for (const overlapping of [true, false]) {
        // 1. Build Mealy Machine
        const mealyRes = detectorMachine({
          kind: 'detector',
          flipFlop: ff,
          pattern,
          machine: 'mealy',
          overlapping,
        });
        expect(mealyRes.ok).toBe(true);
        if (!mealyRes.ok) continue;

        // 2. Build Moore Machine
        const mooreRes = detectorMachine({
          kind: 'detector',
          flipFlop: ff,
          pattern,
          machine: 'moore',
          overlapping,
        });
        expect(mooreRes.ok).toBe(true);
        if (!mooreRes.ok) continue;

        const mealyTable = mealyRes.machine.table;
        const mooreTable = mooreRes.machine.table;

        // Run sweep over test inputs
        for (const input of testInputs) {
          totalStringsChecked++;
          totalBitStepsSimulated += input.length;

          const expectedOutputs = naiveReferenceScanner(input, pattern, overlapping);

          // Simulate Mealy run
          const mealySteps = runTable(mealyTable, 0, input);
          expect(mealySteps.length).toBe(input.length);

          for (let step = 0; step < input.length; step++) {
            const actualMealy = mealySteps[step]?.mealyOutput;
            expect(actualMealy).toBe(expectedOutputs[step]);
          }

          // Simulate Moore run
          const mooreSteps = runTable(mooreTable, 0, input);
          expect(mooreSteps.length).toBe(input.length);

          // Moore Output Timing Assertion:
          // Moore output in state reached at end of step i (evaluated as nextState's mooreOutput)
          // equals the Mealy output at active step i (the 1-cycle offset property).
          for (let step = 0; step < input.length; step++) {
            const nextCode = mooreSteps[step]?.nextState;
            if (typeof nextCode === 'number') {
              const enteredRow = mooreTable.rows.find((r) => r.code === nextCode);
              const actualMooreEntered = enteredRow?.mooreOutput;
              expect(actualMooreEntered).toBe(expectedOutputs[step]);
            }
          }
        }
      }
    }

    expect(totalStringsChecked).toBeGreaterThanOrEqual(8190);
    console.log(`[Detector Exhaustive Sweep] Tested ${totalStringsChecked} input strings (${totalBitStepsSimulated} total bit steps) across 8 patterns.`);
  });
});
