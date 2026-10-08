/**
 * @file gateLogic.ts
 * Pure three-valued Kleene logic gate evaluation functions.
 *
 * Implements standard IEEE 1164 / Kleene multi-valued logic semantics:
 * - AND: Dominant 0 (any 0 produces 0), otherwise any X produces X, otherwise 1.
 * - OR: Dominant 1 (any 1 produces 1), otherwise any X produces X, otherwise 0.
 * - NOT: Inverts 0 <-> 1; preserves X. Requires exactly 1 input.
 * - NAND: Inverted AND output.
 * - NOR: Inverted OR output.
 * - XOR: Multi-input odd parity. Any X produces X.
 * - XNOR: Multi-input even parity (inverted XOR). Any X produces X.
 */

import type { LogicValue } from '../../types/ast';
import type { GateType } from '../../types/circuit';

/**
 * Three-valued logic inverter.
 *
 * @param val Logic value (0, 1, or 'X')
 * @returns Inverted logic value
 */
export function invert(val: LogicValue): LogicValue {
  if (val === 0) return 1;
  if (val === 1) return 0;
  return 'X';
}

/**
 * Evaluates a combinational logic gate with 3-valued logic semantics.
 *
 * Arity rules:
 * - NOT: requires exactly 1 input.
 * - AND, OR, NAND, NOR, XOR, XNOR: requires 2 to 8 inputs.
 * - Any arity violation returns 'X' (static validation flags arity errors).
 *
 * @param type Gate function type (AND, OR, NOT, NAND, NOR, XOR, XNOR)
 * @param inputs Array of input logic values
 * @returns Evaluated logic value output
 */
export function evaluateGate(
  type: GateType,
  inputs: readonly LogicValue[]
): LogicValue {
  const count = inputs.length;

  // Validate arity bounds
  if (type === 'NOT') {
    if (count !== 1) return 'X';
    const first = inputs[0];
    return first !== undefined ? invert(first) : 'X';
  }

  if (count < 2 || count > 8) {
    return 'X';
  }

  switch (type) {
    case 'AND': {
      let hasX = false;
      for (let i = 0; i < count; i++) {
        const v = inputs[i];
        if (v === 0) return 0;
        if (v === 'X') hasX = true;
      }
      return hasX ? 'X' : 1;
    }

    case 'OR': {
      let hasX = false;
      for (let i = 0; i < count; i++) {
        const v = inputs[i];
        if (v === 1) return 1;
        if (v === 'X') hasX = true;
      }
      return hasX ? 'X' : 0;
    }

    case 'NAND': {
      let hasX = false;
      for (let i = 0; i < count; i++) {
        const v = inputs[i];
        if (v === 0) return 1;
        if (v === 'X') hasX = true;
      }
      return hasX ? 'X' : 0;
    }

    case 'NOR': {
      let hasX = false;
      for (let i = 0; i < count; i++) {
        const v = inputs[i];
        if (v === 1) return 0;
        if (v === 'X') hasX = true;
      }
      return hasX ? 'X' : 1;
    }

    case 'XOR': {
      let ones = 0;
      for (let i = 0; i < count; i++) {
        const v = inputs[i];
        if (v === 'X') return 'X';
        if (v === 1) ones++;
      }
      return ones % 2 === 1 ? 1 : 0;
    }

    case 'XNOR': {
      let ones = 0;
      for (let i = 0; i < count; i++) {
        const v = inputs[i];
        if (v === 'X') return 'X';
        if (v === 1) ones++;
      }
      return ones % 2 === 0 ? 1 : 0;
    }
  }
}
