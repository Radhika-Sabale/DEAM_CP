/**
 * @file flags.ts
 * Status flag computation for the ALU Engine.
 *
 * SUBTRACTION CARRY/BORROW CONVENTION:
 * The carry/borrow convention is the locked-in one: CF = 1 means BORROW on subtraction (8086 convention).
 * In the subtraction datapath (A - B = A + ~B + 1), hardware carry out C_hw = 1 indicates A >= B (no borrow).
 * Therefore, reported C = NOT C_hw (CF = 1 indicates A < B in unsigned comparison).
 */

import { getBit, lowBitMask } from '../common/bitUtils';
import type { FlagValue, OverflowFlagValue } from './types';

export { explainFlag } from './flagExplain';

/**
 * Computes Zero flag (Z): 1 if the masked result is 0, else 0.
 */
export function computeZeroFlag(result: number, width: number): FlagValue {
  const mask = lowBitMask(width);
  return (result & mask) === 0 ? 1 : 0;
}

/**
 * Computes Sign flag (S): value of the most significant bit (MSB) of the result.
 */
export function computeSignFlag(result: number, width: number): FlagValue {
  return getBit(result, width - 1);
}

/**
 * Computes Carry flag for addition: carry out of the MSB.
 */
export function computeAddCarryFlag(carryOutMsb: 0 | 1): FlagValue {
  return carryOutMsb;
}

/**
 * Computes Overflow flag for addition: carry into MSB XOR carry out of MSB.
 */
export function computeAddOverflowFlag(carryInMsb: 0 | 1, carryOutMsb: 0 | 1): FlagValue {
  return (carryInMsb ^ carryOutMsb) as FlagValue;
}

/**
 * Computes Carry/Borrow flag for subtraction (A - B = A + ~B + 1).
 * Reported CF = NOT C_hw (1 means borrow occurred: A < B unsigned).
 */
export function computeSubBorrowFlag(hardwareCarryOut: 0 | 1): FlagValue {
  return (hardwareCarryOut === 1 ? 0 : 1) as FlagValue;
}

/**
 * Computes Overflow flag for subtraction (A - B = A + ~B + 1).
 * Computed from the SAME datapath addition: carryInMsb XOR carryOutMsb.
 */
export function computeSubOverflowFlag(carryInMsb: 0 | 1, carryOutMsb: 0 | 1): FlagValue {
  return (carryInMsb ^ carryOutMsb) as FlagValue;
}

/**
 * Computes Carry flag for logical operations (AND, OR, XOR, NOT): always 0 per 8086 architecture.
 */
export function computeLogicCarryFlag(): FlagValue {
  return 0;
}

/**
 * Computes Overflow flag for logical operations (AND, OR, XOR, NOT): always 0 per 8086 architecture.
 */
export function computeLogicOverflowFlag(): FlagValue {
  return 0;
}

/**
 * Computes Overflow flag for increment (A + 1).
 * Overflow occurs when incrementing max positive signed value ((1 << (width - 1)) - 1).
 */
export function computeIncOverflowFlag(a: number, width: number): FlagValue {
  const maxPosSigned = (1 << (width - 1)) - 1;
  return a === maxPosSigned ? 1 : 0;
}

/**
 * Computes Overflow flag for decrement (A - 1).
 * Overflow occurs when decrementing min negative signed value (1 << (width - 1)).
 */
export function computeDecOverflowFlag(a: number, width: number): FlagValue {
  const minNegSigned = 1 << (width - 1);
  return a === minNegSigned ? 1 : 0;
}

/**
 * Computes Carry flag for shift operations: last bit shifted out of the operand.
 */
export function computeShiftCarryFlag(lastBitShiftedOut: 0 | 1): FlagValue {
  return lastBitShiftedOut;
}

/**
 * Computes Overflow flag for shift and rotate operations.
 * Defined only for shift count = 1. For shift count > 1, returns 'undefined' per 8086 rule.
 */
export function computeShiftOverflowFlag(
  op: 'SHL' | 'SHR' | 'SAR' | 'ROL' | 'ROR',
  count: number,
  origA: number,
  result: number,
  cFlag: FlagValue,
  width: number
): OverflowFlagValue {
  if (count > 1) {
    return 'undefined';
  }
  const msbRes = getBit(result, width - 1);
  switch (op) {
    case 'SHL':
      return (msbRes ^ cFlag) as FlagValue;
    case 'SHR':
      return getBit(origA, width - 1);
    case 'SAR':
      return 0;
    case 'ROL':
      return (msbRes ^ cFlag) as FlagValue;
    case 'ROR':
      return (msbRes ^ getBit(result, width - 2)) as FlagValue;
  }
}
