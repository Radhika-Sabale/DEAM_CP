/**
 * @file circuitBuild.test.ts
 * Tests for Stage 10B combinational circuit building, schematic generation,
 * multi-output sharing, gate styles, and truth-table self-checking.
 */

import { describe, expect, it } from 'vitest';
import type { CounterSpec, DetectorSpec } from '../../types/sequential';
import { validateCircuit } from '../circuit/validate';
import { buildCombinationalCircuit } from './circuitBuild';
import { designSequential } from './counterDesigner';

describe('buildCombinationalCircuit', () => {
  it('builds valid combinational circuit for MOD-8 up counter with T flip-flops', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      modulus: 8,
      direction: 'up',
      flipFlop: 'T',
    };
    const designRes = designSequential(spec);
    expect(designRes.ok).toBe(true);
    if (!designRes.ok) return;

    const buildRes = buildCombinationalCircuit(designRes.design, { style: 'direct' });
    expect(buildRes.ok).toBe(true);
    if (!buildRes.ok) return;

    expect(buildRes.selfCheck.passed).toBe(true);
    expect(buildRes.selfCheck.errors).toEqual([]);
    expect(buildRes.selfCheck.checkedOutputs).toEqual(['T2', 'T1', 'T0']);

    expect(buildRes.flipFlopBlocks.length).toBe(3);
    expect(buildRes.flipFlopBlocks[0]).toEqual({
      bitIndex: 2,
      type: 'T',
      inputNames: ['T2'],
      stateName: 'Q2',
    });

    const validation = validateCircuit(buildRes.graph, { allowFeedback: false });
    expect(validation.hasBlockingErrors).toBe(false);
  });

  it('verifies multi-output subexpression sharing reduces or maintains gate count', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      modulus: 10,
      direction: 'up',
      flipFlop: 'JK',
    };
    const designRes = designSequential(spec);
    expect(designRes.ok).toBe(true);
    if (!designRes.ok) return;

    const sharedRes = buildCombinationalCircuit(designRes.design, {
      shareSubexpressions: true,
    });
    const unsharedRes = buildCombinationalCircuit(designRes.design, {
      shareSubexpressions: false,
    });

    expect(sharedRes.ok).toBe(true);
    expect(unsharedRes.ok).toBe(true);
    if (sharedRes.ok && unsharedRes.ok) {
      expect(sharedRes.gateCount).toBeLessThanOrEqual(unsharedRes.gateCount);
      expect(sharedRes.selfCheck.passed).toBe(true);
      expect(unsharedRes.selfCheck.passed).toBe(true);
    }
  });

  it('supports direct, sop-and-or, and nand-only styles with passing selfCheck', () => {
    const spec: DetectorSpec = {
      kind: 'detector',
      pattern: '1011',
      machine: 'mealy',
      overlapping: true,
      flipFlop: 'D',
    };
    const designRes = designSequential(spec);
    expect(designRes.ok).toBe(true);
    if (!designRes.ok) return;

    const styles = ['direct', 'sop-and-or', 'nand-only'] as const;
    for (const style of styles) {
      const buildRes = buildCombinationalCircuit(designRes.design, { style });
      expect(buildRes.ok).toBe(true);
      if (buildRes.ok) {
        expect(buildRes.styleApplied).toBe(style);
        expect(buildRes.selfCheck.passed).toBe(true);
        expect(buildRes.selfCheck.errors).toEqual([]);

        const val = validateCircuit(buildRes.graph, { allowFeedback: false });
        expect(val.hasBlockingErrors).toBe(false);
      }
    }
  });

  it('passes selfCheck across multiple sequential machine configurations', () => {
    const specs: (CounterSpec | DetectorSpec)[] = [
      { kind: 'counter', modulus: 5, direction: 'up', flipFlop: 'SR' },
      { kind: 'counter', modulus: 6, direction: 'up-down', flipFlop: 'D' },
      { kind: 'detector', pattern: '110', machine: 'moore', overlapping: false, flipFlop: 'JK' },
      { kind: 'counter', direction: 'custom', sequence: [0, 2, 5, 7], flipFlop: 'T' },
    ];

    for (const spec of specs) {
      const designRes = designSequential(spec);
      expect(designRes.ok).toBe(true);
      if (designRes.ok) {
        const buildRes = buildCombinationalCircuit(designRes.design);
        expect(buildRes.ok).toBe(true);
        if (buildRes.ok) {
          expect(buildRes.selfCheck.passed).toBe(true);
        }
      }
    }
  });
});
