/**
 * @file tables.test.ts
 * Comprehensive verification of flip-flop tables:
 * - Hand-checked literal characteristic tables, compact tables, and excitation tables.
 * - Product property proof: Cartesian product of excitation don't-care sets equals valid combinations.
 * - Characteristic equation AST evaluation against nextState using Stage 4A evaluator.
 * - Alternate equation forms verified equivalent via Stage 4B areEquivalent checker.
 */

import { describe, expect, it } from 'vitest';
import type { LogicValue } from '../../types/ast';
import type { FlipFlopType } from '../../types/sequential';
import { areEquivalent } from '../boolean/equivalence';
import { evaluate } from '../boolean/evaluator';
import { inputNames, isInvalidInput, nextState } from './models';
import {
  characteristicEquation,
  characteristicTable,
  compactTable,
  excitationInputs,
  excitationTable,
} from './tables';

describe('1. Hand-Checked Literal Characteristic and Compact Tables', () => {
  it('generates exact 8-row SR characteristic table with locked bit-order (S, R, Q)', () => {
    const table = characteristicTable('SR');
    expect(table).toHaveLength(8);

    // Row 0: 0 0 0 -> 0 Hold
    expect(table[0]).toEqual({ index: 0, inputs: [0, 0], q: 0, qNext: 0, operation: 'Hold', invalid: false });
    // Row 1: 0 0 1 -> 1 Hold
    expect(table[1]).toEqual({ index: 1, inputs: [0, 0], q: 1, qNext: 1, operation: 'Hold', invalid: false });
    // Row 2: 0 1 0 -> 0 Reset
    expect(table[2]).toEqual({ index: 2, inputs: [0, 1], q: 0, qNext: 0, operation: 'Reset', invalid: false });
    // Row 3: 0 1 1 -> 0 Reset
    expect(table[3]).toEqual({ index: 3, inputs: [0, 1], q: 1, qNext: 0, operation: 'Reset', invalid: false });
    // Row 4: 1 0 0 -> 1 Set
    expect(table[4]).toEqual({ index: 4, inputs: [1, 0], q: 0, qNext: 1, operation: 'Set', invalid: false });
    // Row 5: 1 0 1 -> 1 Set
    expect(table[5]).toEqual({ index: 5, inputs: [1, 0], q: 1, qNext: 1, operation: 'Set', invalid: false });
    // Row 6: 1 1 0 -> X Invalid
    expect(table[6]).toEqual({ index: 6, inputs: [1, 1], q: 0, qNext: 'X', operation: 'Invalid', invalid: true });
    // Row 7: 1 1 1 -> X Invalid
    expect(table[7]).toEqual({ index: 7, inputs: [1, 1], q: 1, qNext: 'X', operation: 'Invalid', invalid: true });
  });

  it('generates exact 8-row JK characteristic table with locked bit-order (J, K, Q)', () => {
    const table = characteristicTable('JK');
    expect(table).toHaveLength(8);

    expect(table[0]).toEqual({ index: 0, inputs: [0, 0], q: 0, qNext: 0, operation: 'Hold', invalid: false });
    expect(table[1]).toEqual({ index: 1, inputs: [0, 0], q: 1, qNext: 1, operation: 'Hold', invalid: false });
    expect(table[2]).toEqual({ index: 2, inputs: [0, 1], q: 0, qNext: 0, operation: 'Reset', invalid: false });
    expect(table[3]).toEqual({ index: 3, inputs: [0, 1], q: 1, qNext: 0, operation: 'Reset', invalid: false });
    expect(table[4]).toEqual({ index: 4, inputs: [1, 0], q: 0, qNext: 1, operation: 'Set', invalid: false });
    expect(table[5]).toEqual({ index: 5, inputs: [1, 0], q: 1, qNext: 1, operation: 'Set', invalid: false });
    expect(table[6]).toEqual({ index: 6, inputs: [1, 1], q: 0, qNext: 1, operation: 'Toggle', invalid: false });
    expect(table[7]).toEqual({ index: 7, inputs: [1, 1], q: 1, qNext: 0, operation: 'Toggle', invalid: false });
  });

  it('generates exact 4-row D and T characteristic tables', () => {
    const dTable = characteristicTable('D');
    expect(dTable).toHaveLength(4);
    expect(dTable[0]).toEqual({ index: 0, inputs: [0], q: 0, qNext: 0, operation: 'Load 0', invalid: false });
    expect(dTable[1]).toEqual({ index: 1, inputs: [0], q: 1, qNext: 0, operation: 'Load 0', invalid: false });
    expect(dTable[2]).toEqual({ index: 2, inputs: [1], q: 0, qNext: 1, operation: 'Load 1', invalid: false });
    expect(dTable[3]).toEqual({ index: 3, inputs: [1], q: 1, qNext: 1, operation: 'Load 1', invalid: false });

    const tTable = characteristicTable('T');
    expect(tTable).toHaveLength(4);
    expect(tTable[0]).toEqual({ index: 0, inputs: [0], q: 0, qNext: 0, operation: 'Hold', invalid: false });
    expect(tTable[1]).toEqual({ index: 1, inputs: [0], q: 1, qNext: 1, operation: 'Hold', invalid: false });
    expect(tTable[2]).toEqual({ index: 2, inputs: [1], q: 0, qNext: 1, operation: 'Toggle', invalid: false });
    expect(tTable[3]).toEqual({ index: 3, inputs: [1], q: 1, qNext: 0, operation: 'Toggle', invalid: false });
  });

  it('generates exact compact operation tables for all types', () => {
    expect(compactTable('SR')).toEqual([
      { inputs: [0, 0], qNextDescription: 'Q', operation: 'Hold' },
      { inputs: [0, 1], qNextDescription: '0', operation: 'Reset' },
      { inputs: [1, 0], qNextDescription: '1', operation: 'Set' },
      { inputs: [1, 1], qNextDescription: 'Invalid', operation: 'Invalid' },
    ]);

    expect(compactTable('JK')).toEqual([
      { inputs: [0, 0], qNextDescription: 'Q', operation: 'Hold' },
      { inputs: [0, 1], qNextDescription: '0', operation: 'Reset' },
      { inputs: [1, 0], qNextDescription: '1', operation: 'Set' },
      { inputs: [1, 1], qNextDescription: "Q'", operation: 'Toggle' },
    ]);

    expect(compactTable('D')).toEqual([
      { inputs: [0], qNextDescription: '0', operation: 'Load 0' },
      { inputs: [1], qNextDescription: '1', operation: 'Load 1' },
    ]);

    expect(compactTable('T')).toEqual([
      { inputs: [0], qNextDescription: 'Q', operation: 'Hold' },
      { inputs: [1], qNextDescription: "Q'", operation: 'Toggle' },
    ]);
  });
});

describe('2. Classic Excitation Tables and Product Property Proof', () => {
  it('matches textbook excitation tables for all four flip-flop architectures', () => {
    // SR excitation: 0->0 (S=0,R=X), 0->1 (S=1,R=0), 1->0 (S=0,R=1), 1->1 (S=X,R=0)
    expect(excitationTable('SR')).toEqual([
      { q: 0, qNext: 0, inputs: { S: 0, R: 'X' } },
      { q: 0, qNext: 1, inputs: { S: 1, R: 0 } },
      { q: 1, qNext: 0, inputs: { S: 0, R: 1 } },
      { q: 1, qNext: 1, inputs: { S: 'X', R: 0 } },
    ]);

    // JK excitation: 0->0 (J=0,K=X), 0->1 (J=1,K=X), 1->0 (J=X,K=1), 1->1 (J=X,K=0)
    expect(excitationTable('JK')).toEqual([
      { q: 0, qNext: 0, inputs: { J: 0, K: 'X' } },
      { q: 0, qNext: 1, inputs: { J: 1, K: 'X' } },
      { q: 1, qNext: 0, inputs: { J: 'X', K: 1 } },
      { q: 1, qNext: 1, inputs: { J: 'X', K: 0 } },
    ]);

    // D excitation: D = Q+
    expect(excitationTable('D')).toEqual([
      { q: 0, qNext: 0, inputs: { D: 0 } },
      { q: 0, qNext: 1, inputs: { D: 1 } },
      { q: 1, qNext: 0, inputs: { D: 0 } },
      { q: 1, qNext: 1, inputs: { D: 1 } },
    ]);

    // T excitation: T = Q xor Q+
    expect(excitationTable('T')).toEqual([
      { q: 0, qNext: 0, inputs: { T: 0 } },
      { q: 0, qNext: 1, inputs: { T: 1 } },
      { q: 1, qNext: 0, inputs: { T: 1 } },
      { q: 1, qNext: 1, inputs: { T: 0 } },
    ]);
  });

  it('PRODUCT PROPERTY: Cartesian product of excitation sets equals valid input combinations', () => {
    const types: FlipFlopType[] = ['SR', 'JK', 'D', 'T'];
    const transitions: [0 | 1, 0 | 1][] = [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ];

    for (const type of types) {
      const names = inputNames(type);
      const inCount = names.length;
      const numCombos = 1 << inCount;

      for (const [q, qNext] of transitions) {
        // Collect all valid inputs yielding q -> qNext
        const directValidInputs: string[] = [];
        for (let idx = 0; idx < numCombos; idx++) {
          const vec: (0 | 1)[] = [];
          for (let bit = inCount - 1; bit >= 0; bit--) {
            vec.push(((idx >> bit) & 1) as 0 | 1);
          }
          if (!isInvalidInput(type, vec) && nextState(type, vec, q) === qNext) {
            directValidInputs.push(vec.join(''));
          }
        }

        // Compute Cartesian product from excitationInputs result
        const exc = excitationInputs(type, q, qNext);
        const perPinChoices: (0 | 1)[][] = names.map((name) => {
          const val = exc[name];
          return val === 'X' ? [0, 1] : [val as 0 | 1];
        });

        let cartesian: string[] = [''];
        for (const choices of perPinChoices) {
          const next: string[] = [];
          for (const prefix of cartesian) {
            for (const c of choices) {
              next.push(prefix + String(c));
            }
          }
          cartesian = next;
        }

        // Assert direct set equals cartesian product set
        expect(
          cartesian.sort(),
          `Product property failed for ${type} transition ${q}->${qNext}`
        ).toEqual(directValidInputs.sort());
      }
    }
  });
});

describe('3. Characteristic Equation Verification', () => {
  it('verifies SR characteristic equation against nextState on all valid rows', () => {
    const eq = characteristicEquation('SR');
    expect(eq.text).toBe("S + R'Q");
    expect(eq.constraint).toBe('S.R = 0');
    expect(eq.variables).toEqual(['S', 'R', 'Q']);

    for (const s of [0, 1] as const) {
      for (const r of [0, 1] as const) {
        if (s === 1 && r === 1) continue; // SR forbidden
        for (const q of [0, 1] as const) {
          const assignment: Record<string, LogicValue> = { S: s, R: r, Q: q };
          const evaluated = evaluate(eq.ast, assignment);
          const expected = nextState('SR', [s, r], q);
          expect(evaluated).toBe(expected);
        }
      }
    }
  });

  it('verifies JK characteristic equation against nextState on all 8 rows', () => {
    const eq = characteristicEquation('JK');
    expect(eq.text).toBe("JQ' + K'Q");
    expect(eq.variables).toEqual(['J', 'K', 'Q']);

    for (const j of [0, 1] as const) {
      for (const k of [0, 1] as const) {
        for (const q of [0, 1] as const) {
          const assignment: Record<string, LogicValue> = { J: j, K: k, Q: q };
          const evaluated = evaluate(eq.ast, assignment);
          const expected = nextState('JK', [j, k], q);
          expect(evaluated).toBe(expected);
        }
      }
    }
  });

  it('verifies D characteristic equation against nextState on all rows', () => {
    const eq = characteristicEquation('D');
    expect(eq.text).toBe('D');
    for (const d of [0, 1] as const) {
      for (const q of [0, 1] as const) {
        const assignment: Record<string, LogicValue> = { D: d, Q: q };
        const evaluated = evaluate(eq.ast, assignment);
        const expected = nextState('D', [d], q);
        expect(evaluated).toBe(expected);
      }
    }
  });

  it('verifies T characteristic equation and alternate XOR form equivalence', () => {
    const eq = characteristicEquation('T');
    expect(eq.text).toBe("TQ' + T'Q");
    expect(eq.alternateForms).toHaveLength(1);
    const alt = eq.alternateForms?.[0];
    expect(alt?.text).toBe('T ^ Q');

    // Both ASTs evaluate identically to nextState
    for (const t of [0, 1] as const) {
      for (const q of [0, 1] as const) {
        const assignment: Record<string, LogicValue> = { T: t, Q: q };
        const evalPrimary = evaluate(eq.ast, assignment);
        const evalAlt = evaluate(alt!.ast, assignment);
        const expected = nextState('T', [t], q);

        expect(evalPrimary).toBe(expected);
        expect(evalAlt).toBe(expected);
      }
    }

    // Equivalence verified via Stage 4B areEquivalent checker
    expect(areEquivalent(eq.ast, alt!.ast)).toBe(true);
  });
});
