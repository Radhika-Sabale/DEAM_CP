/**
 * @file flagExplain.ts
 * Structured pedagogical explanation and diagnostic fact extraction for ALU status flags.
 * Used by the ALU execution trace and the Stage 13B Feedback Engine.
 */

import { getBit } from '../common/bitUtils';
import type {
  FlagExplanation,
  FlagExplanationContext,
  FlagValue,
  OverflowFlagValue,
} from './types';

function explainCarryFlag(value: FlagValue, ctx: FlagExplanationContext): FlagExplanation {
  if (ctx.op === 'ADD') {
    return {
      flag: 'C',
      value,
      rule: 'add-carry-out',
      description:
        value === 1
          ? `Unsigned addition overflowed ${ctx.width} bits (carry out = 1)`
          : `Unsigned addition fit within ${ctx.width} bits (no carry out)`,
      facts: { carryOut: value },
    };
  }
  if (ctx.op === 'SUB' || ctx.op === 'CMP') {
    return {
      flag: 'C',
      value,
      rule: 'sub-borrow',
      description:
        value === 1
          ? `Unsigned operand A (${ctx.a}) < B (${ctx.b}), requiring a borrow (CF = 1)`
          : `Unsigned operand A (${ctx.a}) >= B (${ctx.b}), no borrow occurred (CF = 0)`,
      facts: {
        a: ctx.a,
        b: ctx.b,
        borrow: value,
        hardwareCarryOut: ctx.hardwareCarryOut ?? (value === 1 ? 0 : 1),
      },
    };
  }
  if (ctx.op === 'INC' || ctx.op === 'DEC') {
    return {
      flag: 'C',
      value,
      rule: 'inc-dec-carry-preserved',
      description: `${ctx.op} preserves existing carry (${value}) without modification`,
      facts: { previousC: value },
    };
  }
  if (ctx.op === 'AND' || ctx.op === 'OR' || ctx.op === 'XOR' || ctx.op === 'NOT') {
    return {
      flag: 'C',
      value,
      rule: 'logic-cleared-carry',
      description: 'Bitwise logic operation clears CF to 0 per 8086 specification',
      facts: { op: ctx.op, cleared: true },
    };
  }
  return {
    flag: 'C',
    value,
    rule: 'shift-carry-out',
    description: `Last bit shifted or rotated out into carry was ${value}`,
    facts: { shiftCount: ctx.shiftCount ?? 1, lastBitShiftedOut: value },
  };
}

function explainOverflowFlag(value: OverflowFlagValue, ctx: FlagExplanationContext): FlagExplanation {
  if (value === 'undefined') {
    return {
      flag: 'O',
      value: 'undefined',
      rule: 'shift-overflow-undefined',
      description: 'Overflow flag is undefined for shift/rotate counts greater than 1',
      facts: { shiftCount: ctx.shiftCount ?? 0, isUndefined: true },
    };
  }

  if (ctx.op === 'ADD') {
    const aSign = getBit(ctx.a, ctx.width - 1);
    const bSign = getBit(ctx.b, ctx.width - 1);
    const rSign = getBit(ctx.result, ctx.width - 1);
    return {
      flag: 'O',
      value,
      rule: 'add-signed-overflow',
      description:
        value === 1
          ? aSign === 1 && bSign === 1
            ? 'Two negative operands produced a non-negative sum (signed overflow)'
            : 'Two positive operands produced a negative sum (signed overflow)'
          : 'No signed overflow (operands had opposite signs or result sign matched)',
      facts: {
        aSign,
        bSign,
        resultSign: rSign,
        carryInMsb: ctx.carryInMsb ?? 0,
        carryOutMsb: ctx.carryOut ?? 0,
      },
    };
  }

  if (ctx.op === 'SUB' || ctx.op === 'CMP') {
    const aSign = getBit(ctx.a, ctx.width - 1);
    const bSign = getBit(ctx.b, ctx.width - 1);
    const rSign = getBit(ctx.result, ctx.width - 1);
    return {
      flag: 'O',
      value,
      rule: 'sub-signed-overflow',
      description:
        value === 1
          ? aSign === 0 && bSign === 1
            ? 'Positive operand minus negative operand produced negative result (signed overflow)'
            : 'Negative operand minus positive operand produced positive result (signed overflow)'
          : 'No signed overflow on subtraction',
      facts: { aSign, bSign, resultSign: rSign },
    };
  }

  if (ctx.op === 'INC' || ctx.op === 'DEC') {
    return {
      flag: 'O',
      value,
      rule: `${ctx.op.toLowerCase()}-signed-overflow`,
      description:
        value === 1
          ? `${ctx.op} reached the signed boundary causing sign inversion (signed overflow)`
          : `No signed overflow on ${ctx.op}`,
      facts: { operand: ctx.a, overflow: value === 1 },
    };
  }

  if (ctx.op === 'AND' || ctx.op === 'OR' || ctx.op === 'XOR' || ctx.op === 'NOT') {
    return {
      flag: 'O',
      value,
      rule: 'logic-cleared-overflow',
      description: 'Bitwise logic operation clears OF to 0 per 8086 specification',
      facts: { op: ctx.op, cleared: true },
    };
  }

  return {
    flag: 'O',
    value,
    rule: 'shift-signed-overflow',
    description:
      value === 1
        ? 'Shift by 1 altered the sign bit of the operand (signed overflow)'
        : 'Shift by 1 preserved the sign bit of the operand',
    facts: { shiftCount: 1, overflow: value === 1 },
  };
}

/**
 * Generates a structured explanation and fact set for an individual flag evaluation.
 */
export function explainFlag(
  flag: 'Z' | 'C' | 'S' | 'O',
  value: OverflowFlagValue,
  ctx: FlagExplanationContext
): FlagExplanation {
  if (flag === 'Z') {
    return {
      flag: 'Z',
      value,
      rule: 'zero-check',
      description:
        value === 1
          ? `Result has all ${ctx.width} bits clear (zero)`
          : `Result has at least one bit set (non-zero)`,
      facts: { result: ctx.result, isZero: value === 1, width: ctx.width },
    };
  }

  if (flag === 'S') {
    return {
      flag: 'S',
      value,
      rule: 'sign-bit-msb',
      description:
        value === 1
          ? `MSB (bit ${ctx.width - 1}) is 1, representing a negative 2's-complement value`
          : `MSB (bit ${ctx.width - 1}) is 0, representing a non-negative 2's-complement value`,
      facts: { msb: value, bitIndex: ctx.width - 1 },
    };
  }

  if (flag === 'C') {
    return explainCarryFlag(value as FlagValue, ctx);
  }

  return explainOverflowFlag(value, ctx);
}
