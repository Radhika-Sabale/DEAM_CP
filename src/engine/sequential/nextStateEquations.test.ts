/**
 * @file nextStateEquations.test.ts
 * Unit and property tests for next-state equation derivation, K-map optimality checks against
 * brute-force oracle with don't-cares, and hand-checked textbook canonical comparisons.
 */
/* eslint-disable no-console */

import { describe, expect, it } from 'vitest';
import type { FlipFlopType } from '../../types/sequential';
import { parse } from '../boolean/parser';
import { minimizeSOP } from '../common/bruteForceMinimizer';
import { counterMachine } from './counterMachines';
import { detectorMachine } from './detectorMachines';
import { buildExcitationTable } from './excitation';
import { rowIndex } from './encoding';
import { deriveEquations, evaluateEquations, totalCost } from './nextStateEquations';

describe('nextStateEquations.ts', () => {
  const flipFlops: FlipFlopType[] = ['SR', 'JK', 'D', 'T'];

  it('HAND-CHECKED: Mod-8 Up Counter with T flip-flops yields T0=1, T1=Q0, T2=Q1 & Q0', () => {
    const res = counterMachine({ kind: 'counter', flipFlop: 'T', style: 'sync', direction: 'up', modulus: 8 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const exc = buildExcitationTable(res.machine.table, 'T');
    const eqRes = deriveEquations(exc.functionColumns);
    expect(eqRes.ok).toBe(true);
    if (!eqRes.ok) return;

    const { equations } = eqRes;
    const eqT2 = equations.find((e) => e.name === 'T2');
    const eqT1 = equations.find((e) => e.name === 'T1');
    const eqT0 = equations.find((e) => e.name === 'T0');

    expect(eqT0?.text).toBe('1');
    expect(eqT1?.text).toBe('Q0');
    expect(eqT2?.text).toBe('Q1 & Q0');

    expect(totalCost(equations)).toEqual({ terms: 3, literals: 3 });
  });

  it('HAND-CHECKED: Mod-8 Down Counter with T flip-flops yields T0=1, T1=!Q0, T2=!Q1 & !Q0', () => {
    const res = counterMachine({ kind: 'counter', flipFlop: 'T', style: 'sync', direction: 'down', modulus: 8 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const exc = buildExcitationTable(res.machine.table, 'T');
    const eqRes = deriveEquations(exc.functionColumns);
    expect(eqRes.ok).toBe(true);
    if (!eqRes.ok) return;

    const { equations } = eqRes;
    const eqT2 = equations.find((e) => e.name === 'T2');
    const eqT1 = equations.find((e) => e.name === 'T1');
    const eqT0 = equations.find((e) => e.name === 'T0');

    expect(eqT0?.text).toBe('1');
    expect(eqT1?.text).toBe('!Q0');
    expect(eqT2?.text).toBe('!Q1 & !Q0');
  });

  it('HAND-CHECKED: Mod-10 Up Counter with JK flip-flops matches textbook simplified equations', () => {
    const res = counterMachine({ kind: 'counter', flipFlop: 'JK', style: 'sync', direction: 'up', modulus: 10 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const exc = buildExcitationTable(res.machine.table, 'JK');
    const eqRes = deriveEquations(exc.functionColumns);
    expect(eqRes.ok).toBe(true);
    if (!eqRes.ok) return;

    const { equations } = eqRes;
    const getEq = (name: string) => equations.find((e) => e.name === name);

    // J0 = 1, K0 = 1
    expect(getEq('J0')?.text).toBe('1');
    expect(getEq('K0')?.text).toBe('1');

    // J1 = !Q3 & Q0, K1 = Q0
    expect(getEq('J1')?.text).toBe('!Q3 & Q0');
    expect(getEq('K1')?.text).toBe('Q0');

    // J2 = Q1 & Q0, K2 = Q1 & Q0
    expect(getEq('J2')?.text).toBe('Q1 & Q0');
    expect(getEq('K2')?.text).toBe('Q1 & Q0');

    // J3 = Q2 & Q1 & Q0, K3 = Q0
    expect(getEq('J3')?.text).toBe('Q2 & Q1 & Q0');
    expect(getEq('K3')?.text).toBe('Q0');
  });

  it('Comprehensive matrix test: care-row self-verification, parser idempotence, and brute-force optimality', () => {
    const machineSpecs = [
      // Up counters
      { kind: 'counter' as const, flipFlop: 'JK' as const, style: 'sync' as const, direction: 'up' as const, modulus: 5 },
      { kind: 'counter' as const, flipFlop: 'D' as const, style: 'sync' as const, direction: 'up' as const, modulus: 6 },
      { kind: 'counter' as const, flipFlop: 'T' as const, style: 'sync' as const, direction: 'up' as const, modulus: 8 },
      { kind: 'counter' as const, flipFlop: 'SR' as const, style: 'sync' as const, direction: 'up' as const, modulus: 10 },
      { kind: 'counter' as const, flipFlop: 'D' as const, style: 'sync' as const, direction: 'up' as const, modulus: 16 },
      // Down counters
      { kind: 'counter' as const, flipFlop: 'T' as const, style: 'sync' as const, direction: 'down' as const, modulus: 8 },
      { kind: 'counter' as const, flipFlop: 'JK' as const, style: 'sync' as const, direction: 'down' as const, modulus: 5 },
      // Up-Down counter
      { kind: 'counter' as const, flipFlop: 'D' as const, style: 'sync' as const, direction: 'up-down' as const, modulus: 6 },
      // Custom sequences with unused states
      { kind: 'counter' as const, flipFlop: 'JK' as const, style: 'sync' as const, direction: 'custom' as const, modulus: 5, sequence: [0, 2, 4, 6, 1] },
      { kind: 'counter' as const, flipFlop: 'T' as const, style: 'sync' as const, direction: 'custom' as const, modulus: 6, sequence: [1, 3, 7, 5, 4, 2] },
      // Sequence detectors
      { kind: 'detector' as const, flipFlop: 'D' as const, pattern: '1011', machine: 'mealy' as const, overlapping: true },
      { kind: 'detector' as const, flipFlop: 'JK' as const, pattern: '1011', machine: 'moore' as const, overlapping: true },
      { kind: 'detector' as const, flipFlop: 'T' as const, pattern: '110', machine: 'mealy' as const, overlapping: false },
      { kind: 'detector' as const, flipFlop: 'SR' as const, pattern: '110', machine: 'moore' as const, overlapping: false },
    ];

    let totalEquationsChecked = 0;
    let totalOracleChecks = 0;

    for (const spec of machineSpecs) {
      const machineRes = spec.kind === 'counter' ? counterMachine(spec) : detectorMachine(spec);
      expect(machineRes.ok).toBe(true);
      if (!machineRes.ok) continue;

      const baseTable = machineRes.machine.table;

      for (const ff of flipFlops) {
        const exc = buildExcitationTable(baseTable, ff);
        const eqRes = deriveEquations(exc.functionColumns);

        expect(eqRes.ok).toBe(true);
        if (!eqRes.ok) continue;

        for (const eq of eqRes.equations) {
          totalEquationsChecked++;

          // 1. Parser round-trip
          const reparse = parse(eq.text);
          expect(reparse.ok).toBe(true);

          // 2. Evaluator matches column on all care rows
          const eqHasIn = eq.variables.some((v) => v === 'IN' || v === 'DN');
          for (const row of exc.rows) {
            const ev = evaluateEquations(eqRes.equations, row.code, row.inputValue ?? 0, baseTable.hasInput);
            const rIdx = rowIndex(row.code, row.inputValue ?? 0, eqHasIn);
            const expectedVal = eq.column[rIdx];
            if (row.valid && (expectedVal === 0 || expectedVal === 1)) {
              expect(ev[eq.name]).toBe(expectedVal);
            }
          }

          // 3. Brute-force optimality for functions of <= 4 variables
          if (eq.variables.length <= 4) {
            totalOracleChecks++;
            const minterms: number[] = [];
            const dontCares: number[] = [];
            for (let i = 0; i < eq.column.length; i++) {
              if (eq.column[i] === 1) minterms.push(i);
              else if (eq.column[i] === 'X') dontCares.push(i);
            }
            const oracle = minimizeSOP(eq.variables.length, minterms, dontCares);
            expect(eq.cost.terms).toBe(oracle.minTermCount);
            expect(eq.cost.literals).toBe(oracle.minLiteralCount);
          }
        }
      }
    }

    expect(totalEquationsChecked).toBeGreaterThan(200);
    expect(totalOracleChecks).toBeGreaterThan(150);
    console.log(`[Equations Optimality] Verified ${totalEquationsChecked} derived equations (${totalOracleChecks} brute-force oracle optimality checks).`);
  });
});
