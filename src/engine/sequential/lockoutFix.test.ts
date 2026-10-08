/**
 * @file lockoutFix.test.ts
 * Integration test suite for Stage 10B lockout fix proposals.
 * Evaluates both minimal-cost and all-to-initial repair strategies across the entire design matrix.
 */

/* eslint-disable no-console */
import { describe, expect, it } from 'vitest';
import type { CounterSpec, DetectorSpec, FlipFlopType, SequentialSpec } from '../../types/sequential';
import { designSequential } from './counterDesigner';
import { computeEquationNextState } from './lockout';
import { proposeLockoutFix } from './lockoutFix';

describe('Lockout Repair Engine Matrix', () => {
  const counterConfigs: CounterSpec[] = [
    { kind: 'counter', modulus: 5, direction: 'up' },
    { kind: 'counter', modulus: 6, direction: 'up' },
    { kind: 'counter', modulus: 8, direction: 'up' },
    { kind: 'counter', modulus: 10, direction: 'up' },
    { kind: 'counter', modulus: 16, direction: 'up' },
    { kind: 'counter', modulus: 8, direction: 'down' },
    { kind: 'counter', modulus: 5, direction: 'down' },
    { kind: 'counter', modulus: 6, direction: 'up-down' },
    // 6 Custom sequences with unused states
    { kind: 'counter', direction: 'custom', sequence: [0, 2, 4, 6] },
    { kind: 'counter', direction: 'custom', sequence: [1, 3, 5, 7] },
    { kind: 'counter', direction: 'custom', sequence: [0, 1, 4, 5, 2] },
    { kind: 'counter', direction: 'custom', sequence: [0, 3, 6] },
    { kind: 'counter', direction: 'custom', sequence: [7, 6, 1, 2] },
    { kind: 'counter', direction: 'custom', sequence: [0, 2, 5, 7, 1] },
  ];

  const detectorConfigs: DetectorSpec[] = [
    { kind: 'detector', pattern: '1011', machine: 'mealy', overlapping: true, flipFlop: 'D' },
    { kind: 'detector', pattern: '1011', machine: 'mealy', overlapping: false, flipFlop: 'D' },
    { kind: 'detector', pattern: '1011', machine: 'moore', overlapping: true, flipFlop: 'D' },
    { kind: 'detector', pattern: '1011', machine: 'moore', overlapping: false, flipFlop: 'D' },
    { kind: 'detector', pattern: '110', machine: 'mealy', overlapping: true, flipFlop: 'D' },
    { kind: 'detector', pattern: '110', machine: 'mealy', overlapping: false, flipFlop: 'D' },
    { kind: 'detector', pattern: '110', machine: 'moore', overlapping: true, flipFlop: 'D' },
    { kind: 'detector', pattern: '110', machine: 'moore', overlapping: false, flipFlop: 'D' },
  ];

  const flipFlopTypes: FlipFlopType[] = ['SR', 'JK', 'D', 'T'];

  it('proves minimal-cost and all-to-initial repairs produce 100% self-correcting designs', () => {
    let totalTested = 0;
    let neededFixCount = 0;

    const allSpecs: SequentialSpec[] = [];

    for (const c of counterConfigs) {
      for (const ff of flipFlopTypes) {
        allSpecs.push({ ...c, flipFlop: ff });
      }
    }

    for (const d of detectorConfigs) {
      for (const ff of flipFlopTypes) {
        allSpecs.push({ ...d, flipFlop: ff });
      }
    }

    for (const spec of allSpecs) {
      totalTested++;

      // Baseline design
      const baseRes = designSequential(spec);
      expect(baseRes.ok).toBe(true);
      if (!baseRes.ok) continue;

      const baseDesign = baseRes.design;

      // Strategy 1: Minimal Cost
      const minCostFix = proposeLockoutFix(spec, 'minimal-cost');
      expect(minCostFix.ok).toBe(true);
      if (!minCostFix.ok) continue;

      // Strategy 2: All to Initial
      const allInitFix = proposeLockoutFix(spec, 'all-to-initial');
      expect(allInitFix.ok).toBe(true);
      if (!allInitFix.ok) continue;

      if (Object.keys(minCostFix.redirects).length > 0) {
        neededFixCount++;
      }

      // Check self-correcting
      expect(minCostFix.resultingLockout.isSelfCorrecting).toBe(true);
      expect(minCostFix.resultingLockout.lockedStates).toEqual([]);
      expect(minCostFix.resultingLockout.indeterminateStates).toEqual([]);

      expect(allInitFix.resultingLockout.isSelfCorrecting).toBe(true);
      expect(allInitFix.resultingLockout.lockedStates).toEqual([]);
      expect(allInitFix.resultingLockout.indeterminateStates).toEqual([]);

      // Check cost inequality: minimal-cost terms <= all-to-initial terms (or terms equal and literals <=)
      const mcCost = minCostFix.design.totalCost;
      const aiCost = allInitFix.design.totalCost;

      const mcBetterOrEqual =
        mcCost.terms < aiCost.terms ||
        (mcCost.terms === aiCost.terms && mcCost.literals <= aiCost.literals);
      expect(mcBetterOrEqual).toBe(true);

      // Verify behaviour on all valid states is completely unchanged
      const inputs = baseDesign.table.hasInput ? ([0, 1] as const) : ([0] as const);
      for (const vCode of baseDesign.table.validCodes) {
        for (const inVal of inputs) {
          const origNext = computeEquationNextState(
            vCode,
            inVal,
            baseDesign.table.stateBits,
            baseDesign.spec.flipFlop,
            baseDesign.equations,
            baseDesign.table.hasInput
          );
          const fixedNext = computeEquationNextState(
            vCode,
            inVal,
            minCostFix.design.table.stateBits,
            minCostFix.design.spec.flipFlop,
            minCostFix.design.equations,
            minCostFix.design.table.hasInput
          );
          expect(fixedNext).toEqual(origNext);
        }
      }
    }

    console.log(
      `Lockout repair test completed: ${totalTested} designs tested across full matrix, ${neededFixCount} needed lockout fixes.`
    );
  });
});
