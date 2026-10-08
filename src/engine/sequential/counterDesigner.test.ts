/**
 * @file counterDesigner.test.ts
 * Unit and integration tests for the Stage 10B designSequential synthesis orchestrator.
 */

import { describe, expect, it } from 'vitest';
import type { CounterSpec, DetectorSpec } from '../../types/sequential';
import { designSequential } from './counterDesigner';

describe('designSequential orchestrator', () => {
  it('rejects invalid specifications with validation errors', () => {
    const invalidSpec: CounterSpec = {
      kind: 'counter',
      modulus: 1, // modulus must be >= 2
      flipFlop: 'D',
    };
    const res = designSequential(invalidSpec);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.length).toBeGreaterThan(0);
      expect(res.errors.some((e) => e.field === 'modulus')).toBe(true);
    }
  });

  it('rejects async style counters with use-async-designer code', () => {
    const asyncSpec: CounterSpec = {
      kind: 'counter',
      modulus: 8,
      direction: 'up',
      style: 'async',
      flipFlop: 'JK',
    };
    const res = designSequential(asyncSpec);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0]?.code).toBe('use-async-designer');
      expect(res.errors[0]?.field).toBe('style');
    }
  });

  it('synthesizes MOD-8 up counter with T flip-flops', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      modulus: 8,
      flipFlop: 'T',
      direction: 'up',
      style: 'sync',
    };
    const res = designSequential(spec);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const { design } = res;
      expect(design.table.stateBits).toBe(3);
      expect(design.table.unusedCodes).toEqual([]);
      expect(design.equations.length).toBe(3);
      expect(design.equations.map((e) => e.name)).toEqual(['T2', 'T1', 'T0']);
      expect(design.variableOrder).toEqual(['Q2', 'Q1', 'Q0']);

      const t0 = design.equations.find((e) => e.name === 'T0');
      const t1 = design.equations.find((e) => e.name === 'T1');
      const t2 = design.equations.find((e) => e.name === 'T2');

      expect(t0?.constant).toBe(1);
      expect(t1?.text).toBe('Q0');
      expect(t2?.text).toBe('Q1 & Q0');
    }
  });

  it('synthesizes MOD-10 BCD counter with JK flip-flops and handles unused states', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      modulus: 10,
      flipFlop: 'JK',
      direction: 'up',
    };
    const res = designSequential(spec);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const { design } = res;
      expect(design.table.stateBits).toBe(4);
      expect(design.table.validCodes.length).toBe(10);
      expect(design.table.unusedCodes).toEqual([10, 11, 12, 13, 14, 15]);
      expect(design.equations.length).toBe(8); // J3, K3, J2, K2, J1, K1, J0, K0

      const j0 = design.equations.find((e) => e.name === 'J0');
      const k0 = design.equations.find((e) => e.name === 'K0');
      expect(j0?.constant).toBe(1);
      expect(k0?.constant).toBe(1);
    }
  });

  it('correctly applies unusedRedirects to unused states', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      modulus: 5, // states 0..4 valid; 5..7 unused
      flipFlop: 'D',
      direction: 'up',
    };
    const redirects = { 5: 0, 6: 0, 7: 0 };
    const res = designSequential(spec, { unusedRedirects: redirects });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const { design } = res;
      expect(design.unusedRedirects).toEqual(redirects);

      // Verify row 5 transitions to 0
      const row5 = design.table.rows.find((r) => r.code === 5);
      expect(row5).toBeDefined();
      expect(row5?.valid).toBe(true);
      expect(row5?.nextCode).toBe(0);
      expect(row5?.mealyOutput).toBe('X');
      expect(row5?.mooreOutput).toBe('X');

      // Check excitation row for 5
      const exc5 = design.excitation.rows.find((r) => r.code === 5);
      expect(exc5).toBeDefined();
      expect(exc5?.valid).toBe(true);
      expect(exc5?.nextCode).toBe(0);
      // For D flip-flops, next state 0 (000) requires D2=0, D1=0, D0=0
      expect(exc5?.flipFlopInputs['D2']).toBe(0);
      expect(exc5?.flipFlopInputs['D1']).toBe(0);
      expect(exc5?.flipFlopInputs['D0']).toBe(0);
    }
  });

  it('synthesizes sequence detector machines (Mealy and Moore)', () => {
    const mealySpec: DetectorSpec = {
      kind: 'detector',
      pattern: '1011',
      machine: 'mealy',
      overlapping: true,
      flipFlop: 'D',
    };
    const mealyRes = designSequential(mealySpec);
    expect(mealyRes.ok).toBe(true);
    if (mealyRes.ok) {
      const { design } = mealyRes;
      expect(design.table.hasInput).toBe(true);
      expect(design.equations.some((e) => e.name === 'Z')).toBe(true);
      expect(design.variableOrder).toEqual(['Q1', 'Q0', 'IN']);
    }

    const mooreSpec: DetectorSpec = {
      kind: 'detector',
      pattern: '110',
      machine: 'moore',
      overlapping: false,
      flipFlop: 'JK',
    };
    const mooreRes = designSequential(mooreSpec);
    expect(mooreRes.ok).toBe(true);
    if (mooreRes.ok) {
      const { design } = mooreRes;
      expect(design.equations.some((e) => e.name === 'Z')).toBe(true);
      const zEq = design.equations.find((e) => e.name === 'Z');
      expect(zEq?.variables).toEqual(['Q1', 'Q0']); // Moore Z depends only on state bits (2 bits for 4 states)
    }
  });

  it('is completely deterministic and passes JSON round-trip serialization', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      modulus: 6,
      direction: 'up-down',
      flipFlop: 'JK',
    };

    const res1 = designSequential(spec);
    const res2 = designSequential(spec);

    expect(res1).toEqual(res2);

    const json = JSON.stringify(res1);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(res1);
  });
});
