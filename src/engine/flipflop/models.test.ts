/**
 * @file models.test.ts
 * Exhaustive property and unit tests for flip-flop models:
 * configuration validation, 3-valued nextState evaluation, input mappings,
 * invalid input detection, operation names, and outputsFromQ.
 */

import { describe, expect, it } from 'vitest';
import type { LogicValue } from '../../types/ast';
import type { FlipFlopType, TriggerMode } from '../../types/sequential';
import {
  defaultConfig,
  inputNames,
  isInvalidInput,
  nextState,
  operationName,
  outputsFromQ,
  validateConfig,
} from './models';

describe('Flip-Flop Configuration Validation', () => {
  it('validates default configurations for all four flip-flop types', () => {
    const types: FlipFlopType[] = ['SR', 'JK', 'D', 'T'];
    for (const t of types) {
      const cfg = defaultConfig(t);
      const res = validateConfig(cfg);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(cfg.type).toBe(t);
      expect(cfg.trigger).toBe('rising');
      expect(cfg.asyncActiveLow).toBe(true);
      expect(cfg.propagationDelay).toBeGreaterThanOrEqual(0);
    }
  });

  it('rejects invalid configurations gracefully without throwing', () => {
    expect(validateConfig(null).valid).toBe(false);
    expect(validateConfig(undefined).valid).toBe(false);
    expect(validateConfig('bad').valid).toBe(false);

    const badType = validateConfig({
      ...defaultConfig('D'),
      type: 'INVALID' as unknown as FlipFlopType,
    });
    expect(badType.valid).toBe(false);
    expect(badType.errors[0]).toContain('Invalid flip-flop type');

    const badTrigger = validateConfig({
      ...defaultConfig('D'),
      trigger: 'middle-edge' as unknown as TriggerMode,
    });
    expect(badTrigger.valid).toBe(false);

    const badDelay = validateConfig({
      ...defaultConfig('D'),
      propagationDelay: -1,
    });
    expect(badDelay.valid).toBe(false);

    const nonIntDelay = validateConfig({
      ...defaultConfig('D'),
      propagationDelay: 1.5,
    });
    expect(nonIntDelay.valid).toBe(false);
  });
});

describe('Input Pin Mappings and Operation Names', () => {
  it('returns correct input names for all types', () => {
    expect(inputNames('SR')).toEqual(['S', 'R']);
    expect(inputNames('JK')).toEqual(['J', 'K']);
    expect(inputNames('D')).toEqual(['D']);
    expect(inputNames('T')).toEqual(['T']);
  });

  it('correctly classifies invalid SR input state', () => {
    expect(isInvalidInput('SR', [1, 1])).toBe(true);
    expect(isInvalidInput('SR', [0, 0])).toBe(false);
    expect(isInvalidInput('SR', [1, 0])).toBe(false);
    expect(isInvalidInput('SR', [0, 1])).toBe(false);
    expect(isInvalidInput('JK', [1, 1])).toBe(false);
    expect(isInvalidInput('D', [1])).toBe(false);
    expect(isInvalidInput('T', [1])).toBe(false);
  });

  it('returns exact operation names for all types and concrete inputs', () => {
    expect(operationName('SR', [0, 0])).toBe('Hold');
    expect(operationName('SR', [0, 1])).toBe('Reset');
    expect(operationName('SR', [1, 0])).toBe('Set');
    expect(operationName('SR', [1, 1])).toBe('Invalid');
    expect(operationName('SR', [1, 'X'])).toBe('Unknown');

    expect(operationName('JK', [0, 0])).toBe('Hold');
    expect(operationName('JK', [0, 1])).toBe('Reset');
    expect(operationName('JK', [1, 0])).toBe('Set');
    expect(operationName('JK', [1, 1])).toBe('Toggle');

    expect(operationName('D', [0])).toBe('Load 0');
    expect(operationName('D', [1])).toBe('Load 1');
    expect(operationName('D', ['X'])).toBe('Unknown');

    expect(operationName('T', [0])).toBe('Hold');
    expect(operationName('T', [1])).toBe('Toggle');
    expect(operationName('T', ['X'])).toBe('Unknown');
  });

  it('returns complementary outputs from Q with outputsFromQ', () => {
    expect(outputsFromQ(0)).toEqual({ q: 0, qBar: 1 });
    expect(outputsFromQ(1)).toEqual({ q: 1, qBar: 0 });
    expect(outputsFromQ('X')).toEqual({ q: 'X', qBar: 'X' });
  });

  it('returns X for wrong arity inputs in nextState', () => {
    expect(nextState('SR', [1], 0)).toBe('X');
    expect(nextState('D', [1, 0], 0)).toBe('X');
    expect(nextState('JK', [], 1)).toBe('X');
  });
});

describe('Exhaustive 2-Valued and 3-Valued nextState Verification', () => {
  // Hand-written oracle for concrete 0/1 inputs
  const binaryOracle: Record<
    FlipFlopType,
    (inputs: number[], q: number) => LogicValue
  > = {
    SR: ([s, r], q) => (s === 0 && r === 0 ? (q as 0 | 1) : s === 0 && r === 1 ? 0 : s === 1 && r === 0 ? 1 : 'X'),
    JK: ([j, k], q) => (j === 0 && k === 0 ? (q as 0 | 1) : j === 0 && k === 1 ? 0 : j === 1 && k === 0 ? 1 : q === 0 ? 1 : 0),
    D: ([d]) => (d as 0 | 1),
    T: ([t], q) => (t === 0 ? (q as 0 | 1) : q === 0 ? 1 : 0),
  };

  // Test-local completion enumerator
  function reference3ValuedNextState(
    type: FlipFlopType,
    inputs: LogicValue[],
    q: LogicValue
  ): LogicValue {
    const inputCompletions: (0 | 1)[][] = [[]];
    for (const v of inputs) {
      const cur = [...inputCompletions];
      inputCompletions.length = 0;
      for (const row of cur) {
        if (v === 'X') {
          inputCompletions.push([...row, 0], [...row, 1]);
        } else {
          inputCompletions.push([...row, v]);
        }
      }
    }

    const qComps: (0 | 1)[] = q === 'X' ? [0, 1] : [q];
    let expected: LogicValue | null = null;

    for (const inComp of inputCompletions) {
      for (const qComp of qComps) {
        const out = binaryOracle[type](inComp, qComp);
        if (out === 'X') return 'X';
        if (expected === null) {
          expected = out;
        } else if (expected !== out) {
          return 'X';
        }
      }
    }
    return expected ?? 'X';
  }

  const THREE_VALUED: LogicValue[] = [0, 1, 'X'];
  const TYPES: FlipFlopType[] = ['SR', 'JK', 'D', 'T'];

  it('matches binary oracle over all concrete 0/1 combinations', () => {
    for (const type of TYPES) {
      const arity = inputNames(type).length;
      const combos = arity === 1 ? [[0], [1]] : [[0, 0], [0, 1], [1, 0], [1, 1]];
      for (const inVec of combos) {
        for (const q of [0, 1] as const) {
          const expected = binaryOracle[type](inVec, q);
          const actual = nextState(type, inVec as LogicValue[], q);
          expect(actual).toBe(expected);
        }
      }
    }
  });

  it('matches reference completion enumerator over all 3-valued input vectors x q', () => {
    let totalChecked = 0;
    for (const type of TYPES) {
      const arity = inputNames(type).length;
      const vectors: LogicValue[][] =
        arity === 1
          ? THREE_VALUED.map((v) => [v])
          : THREE_VALUED.flatMap((v1) => THREE_VALUED.map((v2) => [v1, v2]));

      for (const vec of vectors) {
        for (const q of THREE_VALUED) {
          const expected = reference3ValuedNextState(type, vec, q);
          const actual = nextState(type, vec, q);
          expect(
            actual,
            `Mismatch for ${type} with inputs [${vec.join(',')}] and q=${q}`
          ).toBe(expected);
          totalChecked++;
        }
      }
    }
    // SR: 3^2 * 3 = 27
    // JK: 3^2 * 3 = 27
    // D: 3^1 * 3 = 9
    // T: 3^1 * 3 = 9
    // Total = 72 exhaustive combinations
    expect(totalChecked).toBe(72);
  });
});
