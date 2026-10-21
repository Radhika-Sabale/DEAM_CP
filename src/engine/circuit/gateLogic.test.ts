/**
 * @file gateLogic.test.ts
 * Exhaustive property and unit tests for three-valued Kleene gate logic.
 *
 * Verifies evaluateGate against an independent completion-enumeration reference
 * over all 3^n input vectors for arities 1 to 4 and arity 6 for XOR.
 */

import { describe, expect, it } from 'vitest';
import type { LogicValue } from '../../types/ast';
import type { GateType } from '../../types/circuit';
import { evaluateGate, invert } from './gateLogic';

/**
 * Independent binary evaluation reference function.
 */
function evaluateBinaryRef(type: GateType, inputs: readonly (0 | 1)[]): 0 | 1 {
  switch (type) {
    case 'NOT':
      return inputs[0] === 1 ? 0 : 1;
    case 'BUFFER':
      return inputs[0] ?? 0;
    case 'AND':
      return inputs.every((x) => x === 1) ? 1 : 0;
    case 'OR':
      return inputs.some((x) => x === 1) ? 1 : 0;
    case 'NAND':
      return inputs.every((x) => x === 1) ? 0 : 1;
    case 'NOR':
      return inputs.some((x) => x === 1) ? 0 : 1;
    case 'XOR':
      return inputs.filter((x) => x === 1).length % 2 === 1 ? 1 : 0;
    case 'XNOR':
      return inputs.filter((x) => x === 1).length % 2 === 0 ? 1 : 0;
  }
}

/**
 * Generates all 3^n ternary input vectors of length n.
 */
function generateTernaryVectors(length: number): LogicValue[][] {
  const result: LogicValue[][] = [];
  const total = 3 ** length;
  const values: LogicValue[] = [0, 1, 'X'];

  for (let i = 0; i < total; i++) {
    let cur = i;
    const vec: LogicValue[] = [];
    for (let pos = 0; pos < length; pos++) {
      vec.push(values[cur % 3] as LogicValue);
      cur = Math.floor(cur / 3);
    }
    result.push(vec);
  }
  return result;
}

/**
 * Independent reference evaluator using complete X-expansion enumeration.
 */
function evaluateKleeneReference(type: GateType, inputs: readonly LogicValue[]): LogicValue {
  const xIndices: number[] = [];
  inputs.forEach((v, idx) => {
    if (v === 'X') xIndices.push(idx);
  });

  if (xIndices.length === 0) {
    return evaluateBinaryRef(type, inputs as (0 | 1)[]);
  }

  const completionCount = 1 << xIndices.length;
  let seenZero = false;
  let seenOne = false;

  for (let mask = 0; mask < completionCount; mask++) {
    const candidate = [...inputs] as (0 | 1)[];
    xIndices.forEach((pos, bitIdx) => {
      candidate[pos] = ((mask >> bitIdx) & 1) as 0 | 1;
    });

    const res = evaluateBinaryRef(type, candidate);
    if (res === 0) seenZero = true;
    if (res === 1) seenOne = true;

    if (seenZero && seenOne) return 'X';
  }

  if (seenZero && !seenOne) return 0;
  if (seenOne && !seenZero) return 1;
  return 'X';
}

describe('gateLogic', () => {
  describe('invert', () => {
    it('inverts binary values and preserves X', () => {
      expect(invert(0)).toBe(1);
      expect(invert(1)).toBe(0);
      expect(invert('X')).toBe('X');
    });
  });

  describe('Exhaustive 3-valued equivalence against completion oracle', () => {
    const standardGates: GateType[] = ['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR'];

    it('exhaustively matches NOT for all ternary inputs (arity 1)', () => {
      const vectors = generateTernaryVectors(1);
      for (const vec of vectors) {
        const expected = evaluateKleeneReference('NOT', vec);
        const actual = evaluateGate('NOT', vec);
        expect(actual).toBe(expected);
      }
    });

    for (let arity = 2; arity <= 4; arity++) {
      it(`exhaustively matches all gates for arity ${arity} (3^${arity} = ${3 ** arity} vectors)`, () => {
        const vectors = generateTernaryVectors(arity);
        for (const gate of standardGates) {
          for (const vec of vectors) {
            const expected = evaluateKleeneReference(gate, vec);
            const actual = evaluateGate(gate, vec);
            expect(actual).toBe(expected);
          }
        }
      });
    }

    it('exhaustively matches XOR and XNOR for arity 6 against parity rules', () => {
      const vectors = generateTernaryVectors(6);
      for (const vec of vectors) {
        const expectedXor = evaluateKleeneReference('XOR', vec);
        const actualXor = evaluateGate('XOR', vec);
        expect(actualXor).toBe(expectedXor);

        const expectedXnor = evaluateKleeneReference('XNOR', vec);
        const actualXnor = evaluateGate('XNOR', vec);
        expect(actualXnor).toBe(expectedXnor);
      }
    });
  });

  describe('Arity bounds and invalid inputs', () => {
    it('returns X for NOT with arity !== 1', () => {
      expect(evaluateGate('NOT', [])).toBe('X');
      expect(evaluateGate('NOT', [0, 1])).toBe('X');
    });

    it('passes a single input through BUFFER and preserves unknown', () => {
      expect(evaluateGate('BUFFER', [0])).toBe(0);
      expect(evaluateGate('BUFFER', [1])).toBe(1);
      expect(evaluateGate('BUFFER', ['X'])).toBe('X');
      expect(evaluateGate('BUFFER', [])).toBe('X');
      expect(evaluateGate('BUFFER', [0, 1])).toBe('X');
    });

    it('returns X for multi-input gates with arity < 2 or > 8', () => {
      expect(evaluateGate('AND', [])).toBe('X');
      expect(evaluateGate('AND', [1])).toBe('X');
      expect(evaluateGate('OR', [0])).toBe('X');
      expect(evaluateGate('AND', [1, 1, 1, 1, 1, 1, 1, 1, 1])).toBe('X'); // 9 inputs
    });
  });
});
