/**
 * @file models.ts
 * Core operational models, configuration schemas, 3-valued next-state evaluators,
 * input pin mappings, and output helpers for SR, JK, D, and T flip-flops.
 */

import type { LogicValue } from '../../types/ast';
import type { FlipFlopType, TriggerMode } from '../../types/sequential';

/** Detailed configuration parameters for a flip-flop or latch component instance. */
export interface FlipFlopConfig {
  readonly type: FlipFlopType;
  readonly trigger: TriggerMode;
  readonly asyncControls: boolean;
  readonly asyncActiveLow: boolean;
  readonly propagationDelay: number;
  readonly setupTime: number;
  readonly holdTime: number;
}

/** Result of validating a FlipFlopConfig object. */
export interface ConfigValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const VALID_TYPES: readonly FlipFlopType[] = ['SR', 'JK', 'D', 'T'];
const VALID_TRIGGERS: readonly TriggerMode[] = ['rising', 'falling', 'level-high', 'level-low'];

/**
 * Validates a candidate flip-flop configuration, returning a clean result without throwing.
 */
export function validateConfig(config: unknown): ConfigValidationResult {
  const errors: string[] = [];
  if (typeof config !== 'object' || config === null) {
    return { valid: false, errors: ['Configuration must be a non-null object.'] };
  }
  const c = config as Partial<FlipFlopConfig>;
  if (!c.type || !VALID_TYPES.includes(c.type)) {
    errors.push(`Invalid flip-flop type: "${String(c.type)}". Expected one of: SR, JK, D, T.`);
  }
  if (!c.trigger || !VALID_TRIGGERS.includes(c.trigger)) {
    errors.push(`Invalid trigger mode: "${String(c.trigger)}". Expected one of: rising, falling, level-high, level-low.`);
  }
  if (typeof c.asyncControls !== 'boolean') errors.push('asyncControls must be a boolean.');
  if (typeof c.asyncActiveLow !== 'boolean') errors.push('asyncActiveLow must be a boolean.');
  if (typeof c.propagationDelay !== 'number' || !Number.isInteger(c.propagationDelay) || c.propagationDelay < 0) {
    errors.push('propagationDelay must be a non-negative integer.');
  }
  if (typeof c.setupTime !== 'number' || !Number.isInteger(c.setupTime) || c.setupTime < 0) {
    errors.push('setupTime must be a non-negative integer.');
  }
  if (typeof c.holdTime !== 'number' || !Number.isInteger(c.holdTime) || c.holdTime < 0) {
    errors.push('holdTime must be a non-negative integer.');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Creates a default, validated FlipFlopConfig for a given flip-flop architecture.
 */
export function defaultConfig(type: FlipFlopType): FlipFlopConfig {
  return {
    type,
    trigger: 'rising',
    asyncControls: false,
    asyncActiveLow: true,
    propagationDelay: 1,
    setupTime: 0,
    holdTime: 0,
  };
}

/**
 * Returns the ordered list of input signal names for a given flip-flop type.
 */
export function inputNames(type: FlipFlopType): readonly string[] {
  switch (type) {
    case 'SR': return ['S', 'R'];
    case 'JK': return ['J', 'K'];
    case 'D': return ['D'];
    case 'T': return ['T'];
  }
}

/**
 * Checks whether the input vector represents the forbidden/invalid state for a flip-flop.
 */
export function isInvalidInput(type: FlipFlopType, inputs: readonly LogicValue[]): boolean {
  return type === 'SR' && inputs.length >= 2 && inputs[0] === 1 && inputs[1] === 1;
}

/** Evaluates pure 2-valued next-state logic for concrete 0/1 inputs. */
function nextStateBinary(type: FlipFlopType, inputs: readonly (0 | 1)[], q: 0 | 1): LogicValue {
  switch (type) {
    case 'SR': {
      const [s, r] = inputs;
      if (s === 0 && r === 0) return q;
      if (s === 0 && r === 1) return 0;
      if (s === 1 && r === 0) return 1;
      return 'X';
    }
    case 'JK': {
      const [j, k] = inputs;
      if (j === 0 && k === 0) return q;
      if (j === 0 && k === 1) return 0;
      if (j === 1 && k === 0) return 1;
      return q === 0 ? 1 : 0;
    }
    case 'D': return inputs[0] ?? 'X';
    case 'T': return inputs[0] === 0 ? q : q === 0 ? 1 : 0;
  }
}

/** Generates all concrete binary 0/1 combinations for an array containing potential 'X' values. */
function enumerateCompletions(values: readonly LogicValue[]): (0 | 1)[][] {
  let results: (0 | 1)[][] = [[]];
  for (const v of values) {
    if (v === 'X') {
      const next: (0 | 1)[][] = [];
      for (const r of results) next.push([...r, 0], [...r, 1]);
      results = next;
    } else {
      results = results.map((r) => [...r, v]);
    }
  }
  return results;
}

/**
 * Evaluates the next state (Q+) of a flip-flop under three-valued logic (0, 1, 'X').
 */
export function nextState(type: FlipFlopType, inputs: readonly LogicValue[], q: LogicValue): LogicValue {
  if (inputs.length !== inputNames(type).length) return 'X';

  const hasX = q === 'X' || inputs.some((v) => v === 'X');
  if (!hasX) return nextStateBinary(type, inputs as (0 | 1)[], q as 0 | 1);

  const inputCompletions = enumerateCompletions(inputs);
  const qCompletions = q === 'X' ? ([0, 1] as const) : ([q] as const);
  let firstOutcome: LogicValue | null = null;

  for (const inComp of inputCompletions) {
    for (const qComp of qCompletions) {
      const outcome = nextStateBinary(type, inComp, qComp);
      if (outcome === 'X') return 'X';
      if (firstOutcome === null) firstOutcome = outcome;
      else if (firstOutcome !== outcome) return 'X';
    }
  }
  return firstOutcome ?? 'X';
}

/**
 * Returns the human-readable operational description for the given inputs.
 */
export function operationName(type: FlipFlopType, inputs: readonly LogicValue[]): string {
  if (inputs.length !== inputNames(type).length || inputs.some((v) => v === 'X')) {
    return type === 'SR' && inputs[0] === 1 && inputs[1] === 1 ? 'Invalid' : 'Unknown';
  }
  switch (type) {
    case 'SR': {
      const [s, r] = inputs;
      if (s === 0 && r === 0) return 'Hold';
      if (s === 0 && r === 1) return 'Reset';
      if (s === 1 && r === 0) return 'Set';
      return 'Invalid';
    }
    case 'JK': {
      const [j, k] = inputs;
      if (j === 0 && k === 0) return 'Hold';
      if (j === 0 && k === 1) return 'Reset';
      if (j === 1 && k === 0) return 'Set';
      return 'Toggle';
    }
    case 'D': return inputs[0] === 0 ? 'Load 0' : 'Load 1';
    case 'T': return inputs[0] === 0 ? 'Hold' : 'Toggle';
  }
}

/**
 * Generates both normal Q and complemented Qbar output levels from Q.
 */
export function outputsFromQ(q: LogicValue): { q: LogicValue; qBar: LogicValue } {
  if (q === 1) return { q: 1, qBar: 0 };
  if (q === 0) return { q: 0, qBar: 1 };
  return { q: 'X', qBar: 'X' };
}
