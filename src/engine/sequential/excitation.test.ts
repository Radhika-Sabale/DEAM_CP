/**
 * @file excitation.test.ts
 * Comprehensive mathematical verification of multi-flip-flop excitation table derivation,
 * complete concrete completion verification via nextState(), product property verification,
 * hand-checked literal columns (mod-8 T, mod-5 D, mod-10 JK), and JSON serialization.
 */
/* eslint-disable no-console */

import { describe, expect, it } from 'vitest';
import type { LogicValue } from '../../types/ast';
import type { FlipFlopType } from '../../types/sequential';
import { nextState } from '../flipflop/models';
import { counterMachine } from './counterMachines';
import { detectorMachine } from './detectorMachines';
import { buildExcitationTable, functionColumns } from './excitation';

/**
 * Expands an array of LogicValues (containing 0, 1, or 'X') into all concrete 0/1 vectors.
 */
function expandConcreteCompletions(values: readonly LogicValue[]): (0 | 1)[][] {
  let results: (0 | 1)[][] = [[]];
  for (const v of values) {
    if (v === 'X') {
      const next: (0 | 1)[][] = [];
      for (const r of results) {
        next.push([...r, 0], [...r, 1]);
      }
      results = next;
    } else {
      results = results.map((r) => [...r, v as 0 | 1]);
    }
  }
  return results;
}

describe('excitation.ts', () => {
  const flipFlops: FlipFlopType[] = ['SR', 'JK', 'D', 'T'];

  describe('Comprehensive mathematical verification via Stage 9A nextState()', () => {
    it('verifies that EVERY concrete completion of X reproduces exact next state bits across machines and flip-flop types', () => {
      let totalCompletionsChecked = 0;
      let totalTransitionsChecked = 0;

      // Test matrix of machines:
      // 1. Mod-8 Up Counter
      // 2. Mod-10 Up-Down Counter
      // 3. Custom Sequence Counter [0, 3, 5, 2, 6]
      // 4. Sequence Detector '1011' Mealy
      // 5. Sequence Detector '110' Moore

      const machines = [
        counterMachine({ kind: 'counter', flipFlop: 'JK', style: 'sync', direction: 'up', modulus: 8 }),
        counterMachine({ kind: 'counter', flipFlop: 'SR', style: 'sync', direction: 'up-down', modulus: 6 }),
        counterMachine({ kind: 'counter', flipFlop: 'T', style: 'sync', direction: 'custom', modulus: 5, sequence: [0, 3, 5, 2, 6] }),
        detectorMachine({ kind: 'detector', flipFlop: 'D', pattern: '1011', machine: 'mealy', overlapping: true }),
        detectorMachine({ kind: 'detector', flipFlop: 'JK', pattern: '110', machine: 'moore', overlapping: false }),
      ];

      for (const mRes of machines) {
        expect(mRes.ok).toBe(true);
        if (!mRes.ok) continue;

        const baseTable = mRes.machine.table;

        for (const ff of flipFlops) {
          const excTable = buildExcitationTable(baseTable, ff);

          for (const row of excTable.rows) {
            if (row.valid && typeof row.nextCode === 'number') {
              for (const trans of row.transitions) {
                totalTransitionsChecked++;

                const q = trans.q;
                const qNext = trans.qNext;

                // Extract pin values for this flip-flop
                const pinValues: LogicValue[] = Object.values(trans.inputs);
                const completions = expandConcreteCompletions(pinValues);

                for (const comp of completions) {
                  totalCompletionsChecked++;

                  // Never generate forbidden SR condition (S=1, R=1)
                  if (ff === 'SR' && comp.length >= 2) {
                    const isForbidden = comp[0] === 1 && comp[1] === 1;
                    expect(isForbidden).toBe(false);
                  }

                  // Evaluate next state through authoritative Stage 9A model
                  const simulatedNextQ = nextState(ff, comp, q);
                  expect(simulatedNextQ).toBe(qNext);
                }
              }
            } else {
              // Unused rows must have all 'X' for flip-flop inputs
              for (const pinVal of Object.values(row.flipFlopInputs)) {
                expect(pinVal).toBe('X');
              }
            }
          }
        }
      }

      expect(totalCompletionsChecked).toBeGreaterThan(500);
      console.log(`[Excitation Completion Sweep] Verified ${totalCompletionsChecked} concrete input completions across ${totalTransitionsChecked} state bit transitions.`);
    });
  });

  describe('HAND-CHECKED literal column verifications', () => {
    it('1. Mod-8 Up Counter with T flip-flops: T0 = 1 on all rows, T1 = Q0, T2 = Q1.Q0', () => {
      const res = counterMachine({
        kind: 'counter',
        flipFlop: 'T',
        style: 'sync',
        direction: 'up',
        modulus: 8,
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const excTable = buildExcitationTable(res.machine.table, 'T');
      const cols = excTable.functionColumns;

      expect(cols.map((c) => c.name)).toEqual(['T2', 'T1', 'T0']);

      const colT2 = cols.find((c) => c.name === 'T2')?.column;
      const colT1 = cols.find((c) => c.name === 'T1')?.column;
      const colT0 = cols.find((c) => c.name === 'T0')?.column;

      expect(colT0).toBeDefined();
      expect(colT1).toBeDefined();
      expect(colT2).toBeDefined();

      // T0 = 1 on all 8 rows
      expect(colT0).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);

      // T1 toggles when Q0 = 1 (rows 1, 3, 5, 7)
      expect(colT1).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);

      // T2 toggles when Q1.Q0 = 1 (rows 3 and 7)
      expect(colT2).toEqual([0, 0, 0, 1, 0, 0, 0, 1]);
    });

    it('2. Mod-5 Up Counter with D flip-flops: D columns equal the next-state bits', () => {
      const res = counterMachine({
        kind: 'counter',
        flipFlop: 'D',
        style: 'sync',
        direction: 'up',
        modulus: 5,
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const excTable = buildExcitationTable(res.machine.table, 'D');
      const cols = excTable.functionColumns;

      expect(cols.map((c) => c.name)).toEqual(['D2', 'D1', 'D0']);

      // Next states for 0..4: 1 (001), 2 (010), 3 (011), 4 (100), 0 (000); 5..7: X
      const colD2 = cols.find((c) => c.name === 'D2')?.column;
      const colD1 = cols.find((c) => c.name === 'D1')?.column;
      const colD0 = cols.find((c) => c.name === 'D0')?.column;

      expect(colD2).toEqual([0, 0, 0, 1, 0, 'X', 'X', 'X']);
      expect(colD1).toEqual([0, 1, 1, 0, 0, 'X', 'X', 'X']);
      expect(colD0).toEqual([1, 0, 1, 0, 0, 'X', 'X', 'X']);
    });

    it('3. Mod-10 Up Counter with JK flip-flops: spot-checks key transition rows including 9 -> 0', () => {
      const res = counterMachine({
        kind: 'counter',
        flipFlop: 'JK',
        style: 'sync',
        direction: 'up',
        modulus: 10,
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const excTable = buildExcitationTable(res.machine.table, 'JK');

      // State 9 (1001) -> State 0 (0000)
      // Bit 3 (MSB, Q3): 1 -> 0 => J3 = 'X', K3 = 1
      // Bit 2 (Q2):      0 -> 0 => J2 = 0,   K2 = 'X'
      // Bit 1 (Q1):      0 -> 0 => J1 = 0,   K1 = 'X'
      // Bit 0 (LSB, Q0): 1 -> 0 => J0 = 'X', K0 = 1
      const row9 = excTable.rows.find((r) => r.code === 9);
      expect(row9).toBeDefined();
      if (row9) {
        expect(row9.flipFlopInputs['J3']).toBe('X');
        expect(row9.flipFlopInputs['K3']).toBe(1);
        expect(row9.flipFlopInputs['J2']).toBe(0);
        expect(row9.flipFlopInputs['K2']).toBe('X');
        expect(row9.flipFlopInputs['J1']).toBe(0);
        expect(row9.flipFlopInputs['K1']).toBe('X');
        expect(row9.flipFlopInputs['J0']).toBe('X');
        expect(row9.flipFlopInputs['K0']).toBe(1);
      }

      // State 7 (0111) -> State 8 (1000)
      // Bit 3: 0 -> 1 => J3 = 1,   K3 = 'X'
      // Bit 2: 1 -> 0 => J2 = 'X', K2 = 1
      // Bit 1: 1 -> 0 => J1 = 'X', K1 = 1
      // Bit 0: 1 -> 0 => J0 = 'X', K0 = 1
      const row7 = excTable.rows.find((r) => r.code === 7);
      expect(row7).toBeDefined();
      if (row7) {
        expect(row7.flipFlopInputs['J3']).toBe(1);
        expect(row7.flipFlopInputs['K3']).toBe('X');
        expect(row7.flipFlopInputs['J2']).toBe('X');
        expect(row7.flipFlopInputs['K2']).toBe(1);
        expect(row7.flipFlopInputs['J1']).toBe('X');
        expect(row7.flipFlopInputs['K1']).toBe(1);
        expect(row7.flipFlopInputs['J0']).toBe('X');
        expect(row7.flipFlopInputs['K0']).toBe(1);
      }
    });

    it('4. Detector machine output Z column length and ordering', () => {
      // Mealy detector: 4 states -> 8 rows in table, Z column length 8
      const mealy = detectorMachine({
        kind: 'detector',
        flipFlop: 'D',
        pattern: '1011',
        machine: 'mealy',
        overlapping: true,
      });
      expect(mealy.ok).toBe(true);
      if (mealy.ok) {
        const exc = buildExcitationTable(mealy.machine.table, 'D');
        const cols = functionColumns(exc, mealy.machine.table);
        expect(cols.map((c) => c.name)).toEqual(['D1', 'D0', 'Z']);
        expect(cols[2]?.column.length).toBe(8);
      }

      // Moore detector: 4 states (2 bits) -> state count 4 (codes 0..3), Z column length 4
      const moore = detectorMachine({
        kind: 'detector',
        flipFlop: 'T',
        pattern: '101',
        machine: 'moore',
        overlapping: false,
      });
      expect(moore.ok).toBe(true);
      if (moore.ok) {
        const exc = buildExcitationTable(moore.machine.table, 'T');
        const cols = functionColumns(exc, moore.machine.table);
        expect(cols.map((c) => c.name)).toEqual(['T1', 'T0', 'Z']);
        expect(cols[2]?.column.length).toBe(4);
        expect(cols[2]?.variables).toEqual(['Q1', 'Q0']);
        // State 3 (match state) has Moore output 1
        expect(cols[2]?.column).toEqual([0, 0, 0, 1]);
      }
    });
  });

  describe('JSON round-trip serializability', () => {
    it('serializes and deserializes excitation table with full fidelity', () => {
      const res = counterMachine({
        kind: 'counter',
        flipFlop: 'JK',
        style: 'sync',
        direction: 'up',
        modulus: 4,
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        const excTable = buildExcitationTable(res.machine.table, 'JK');
        const serialized = JSON.stringify(excTable);
        const deserialized = JSON.parse(serialized);
        expect(deserialized).toEqual(excTable);
      }
    });
  });
});
