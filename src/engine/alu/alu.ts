/**
 * @file alu.ts
 * Core execution engine and comparison relations for the Arithmetic Logic Unit (ALU).
 *
 * SUBTRACTION CARRY/BORROW CONVENTION:
 * The carry/borrow convention is the locked-in one: CF = 1 means BORROW on subtraction (8086 convention).
 * All subtraction and comparison operations report borrowConvention: "cf-is-borrow".
 *
 * SUPPORTED WIDTHS:
 * Standard widths are 4-bit and 8-bit. The engine supports any integer width from 2 to 16 bits.
 */

import {
  arithmeticShiftRight,
  fitsInWidth,
  getBit,
  logicalShiftLeft,
  logicalShiftRight,
  lowBitMask,
  maxValueForWidth,
  rotateLeft,
  rotateRight,
  toBinaryString,
} from '../common/bitUtils';
import { buildCarryChain } from './carryChain';
import {
  computeAddCarryFlag,
  computeAddOverflowFlag,
  computeDecOverflowFlag,
  computeIncOverflowFlag,
  computeLogicCarryFlag,
  computeLogicOverflowFlag,
  computeShiftCarryFlag,
  computeShiftOverflowFlag,
  computeSignFlag,
  computeSubBorrowFlag,
  computeSubOverflowFlag,
  computeZeroFlag,
  explainFlag,
} from './flags';
import type {
  AluComparisonRelations,
  AluExecuteOptions,
  AluFlags,
  AluOp,
  AluResult,
  AluStepTrace,
  FlagExplanation,
  FlagExplanationContext,
} from './types';

const VALID_OPS = new Set<AluOp>([
  'ADD', 'SUB', 'CMP', 'AND', 'OR', 'XOR', 'NOT', 'INC', 'DEC',
  'SHL', 'SHR', 'SAR', 'ROL', 'ROR',
]);

function toSigned(unsignedVal: number, width: number): number {
  const signThreshold = 1 << (width - 1);
  return unsignedVal >= signThreshold ? unsignedVal - (1 << width) : unsignedVal;
}

function parseOperand(
  val: number | string,
  width: number,
  name: string
): { ok: true; value: number } | { ok: false; message: string } {
  let num: number;
  if (typeof val === 'string') {
    const clean = val.replace(/[\s_]/g, '');
    if (!/^[01]+$/.test(clean) || clean.length > width) {
      return { ok: false, message: `Operand ${name} "${val}" is not a valid ${width}-bit binary string.` };
    }
    num = parseInt(clean, 2);
  } else if (typeof val === 'number') {
    if (!Number.isInteger(val) || val < 0) {
      return { ok: false, message: `Operand ${name} must be a non-negative integer. Received: ${val}` };
    }
    num = val;
  } else {
    return { ok: false, message: `Operand ${name} must be a number or binary string.` };
  }

  if (!fitsInWidth(num, width)) {
    return { ok: false, message: `Operand ${name} value ${num} exceeds maximum for ${width}-bit width (${maxValueForWidth(width)}).` };
  }
  return { ok: true, value: num };
}

/**
 * Executes a pure ALU operation with comprehensive flag tracking and gate traces.
 */
export function execute(
  op: AluOp,
  a: number | string,
  b: number | string = 0,
  width: number = 4,
  options: AluExecuteOptions = {}
): AluResult {
  if (!Number.isInteger(width) || width < 2 || width > 16) {
    return { ok: false, error: { code: 'INVALID_WIDTH', message: `Width must be an integer between 2 and 16. Received: ${width}` } };
  }
  if (!VALID_OPS.has(op)) {
    return { ok: false, error: { code: 'UNKNOWN_OP', message: `Unknown ALU operation: "${op}"` } };
  }

  const aParsed = parseOperand(a, width, 'A');
  if (!aParsed.ok) return { ok: false, error: { code: 'OPERAND_OUT_OF_RANGE', message: aParsed.message } };
  const bParsed = parseOperand(b, width, 'B');
  if (!bParsed.ok) return { ok: false, error: { code: 'OPERAND_OUT_OF_RANGE', message: bParsed.message } };

  const uA = aParsed.value;
  const uB = bParsed.value;
  const mask = lowBitMask(width);
  const shiftCount = options.shiftCount ?? 1;

  if (['SHL', 'SHR', 'SAR', 'ROL', 'ROR'].includes(op)) {
    if (!Number.isInteger(shiftCount) || shiftCount < 1 || shiftCount > width) {
      return { ok: false, error: { code: 'INVALID_SHIFT_COUNT', message: `Shift count must be between 1 and ${width}. Received: ${shiftCount}` } };
    }
  }

  let rawResult = 0;
  let isDiscarded = false;
  let flags: AluFlags;
  let carryChainModel: ReturnType<typeof buildCarryChain> | undefined;
  const notes: string[] = [];
  let flagContext: FlagExplanationContext;

  if (op === 'ADD' || op === 'SUB' || op === 'CMP') {
    const isSub = op !== 'ADD';
    carryChainModel = buildCarryChain(uA, uB, width, isSub);
    const hwCout = carryChainModel.carryVector[width] ?? 0;
    const carryInMsb = carryChainModel.carryVector[width - 1] ?? 0;

    rawResult = isSub ? (uA - uB) & mask : (uA + uB) & mask;
    isDiscarded = op === 'CMP';

    const z = computeZeroFlag(rawResult, width);
    const s = computeSignFlag(rawResult, width);
    const c = isSub ? computeSubBorrowFlag(hwCout) : computeAddCarryFlag(hwCout);
    const o = isSub ? computeSubOverflowFlag(carryInMsb, hwCout) : computeAddOverflowFlag(carryInMsb, hwCout);
    flags = { Z: z, C: c, S: s, O: o };
    flagContext = { op, width, a: uA, b: uB, result: rawResult, carryOut: hwCout, carryInMsb, hardwareCarryOut: hwCout };
    if (isSub) notes.push('Hardware datapath executed A + ~B + 1. CF = 1 indicates borrow.');
  } else if (op === 'AND' || op === 'OR' || op === 'XOR' || op === 'NOT') {
    rawResult = op === 'AND' ? (uA & uB) & mask : op === 'OR' ? (uA | uB) & mask : op === 'XOR' ? (uA ^ uB) & mask : (~uA) & mask;
    flags = { Z: computeZeroFlag(rawResult, width), C: computeLogicCarryFlag(), S: computeSignFlag(rawResult, width), O: computeLogicOverflowFlag() };
    flagContext = { op, width, a: uA, b: uB, result: rawResult };
    notes.push('Logic operations clear CF and OF to 0 per 8086 specification.');
  } else if (op === 'INC' || op === 'DEC') {
    rawResult = op === 'INC' ? (uA + 1) & mask : (uA - 1) & mask;
    const c = options.previousC ?? 0;
    const o = op === 'INC' ? computeIncOverflowFlag(uA, width) : computeDecOverflowFlag(uA, width);
    flags = { Z: computeZeroFlag(rawResult, width), C: c, S: computeSignFlag(rawResult, width), O: o };
    flagContext = { op, width, a: uA, b: 1, result: rawResult, previousC: c };
    notes.push(`${op} leaves Carry Flag (CF) unchanged per 8086 architecture.`);
  } else {
    let lastShiftedBit: 0 | 1 = 0;
    if (op === 'SHL') {
      lastShiftedBit = getBit(uA, width - shiftCount);
      rawResult = logicalShiftLeft(uA, shiftCount, width);
    } else if (op === 'SHR') {
      lastShiftedBit = getBit(uA, shiftCount - 1);
      rawResult = logicalShiftRight(uA, shiftCount, width);
    } else if (op === 'SAR') {
      lastShiftedBit = getBit(uA, shiftCount - 1);
      rawResult = arithmeticShiftRight(uA, shiftCount, width);
    } else if (op === 'ROL') {
      rawResult = rotateLeft(uA, shiftCount, width);
      lastShiftedBit = getBit(rawResult, 0);
    } else {
      rawResult = rotateRight(uA, shiftCount, width);
      lastShiftedBit = getBit(rawResult, width - 1);
    }
    const c = computeShiftCarryFlag(lastShiftedBit);
    const o = computeShiftOverflowFlag(op, shiftCount, uA, rawResult, c, width);
    flags = { Z: computeZeroFlag(rawResult, width), C: c, S: computeSignFlag(rawResult, width), O: o };
    flagContext = { op, width, a: uA, b: shiftCount, result: rawResult, shiftCount };
    if (shiftCount > 1) notes.push('Overflow flag (OF) is undefined for multi-bit shifts per 8086 specification.');
  }

  const explanations: FlagExplanation[] = [
    explainFlag('Z', flags.Z, flagContext),
    explainFlag('C', flags.C, flagContext),
    explainFlag('S', flags.S, flagContext),
    explainFlag('O', flags.O, flagContext),
  ];

  const trace: AluStepTrace = {
    aBits: toBinaryString(uA, width),
    bBits: toBinaryString(uB, width),
    intermediateValues: { op, width, resultBits: toBinaryString(rawResult, width), unsignedResult: rawResult },
    notes,
  };

  return {
    ok: true,
    op,
    width,
    a: uA,
    b: uB,
    aBits: toBinaryString(uA, width),
    bBits: toBinaryString(uB, width),
    result: { unsigned: rawResult, signed: toSigned(rawResult, width), bits: toBinaryString(rawResult, width), isDiscarded },
    flags,
    flagExplanations: explanations,
    gateTrace: carryChainModel?.gates,
    carryChain: carryChainModel,
    borrowConvention: 'cf-is-borrow',
    trace,
    notes,
  };
}

/**
 * Derives unsigned comparison relations (equal, below, above) between A and B from CMP flags.
 */
export function compareUnsigned(a: number | string, b: number | string, width: number = 4): AluComparisonRelations {
  const res = execute('CMP', a, b, width);
  if (!res.ok) throw new Error(res.error.message);
  const { Z, C, S, O } = res.flags;
  const sXorO = (S ^ (O === 'undefined' ? 0 : O)) === 1;
  return {
    equal: Z === 1,
    notEqual: Z === 0,
    below: C === 1,
    belowOrEqual: C === 1 || Z === 1,
    above: C === 0 && Z === 0,
    aboveOrEqual: C === 0,
    less: sXorO,
    lessOrEqual: sXorO || Z === 1,
    greater: !sXorO && Z === 0,
    greaterOrEqual: !sXorO,
  };
}

/**
 * Derives signed comparison relations (equal, less, greater) between A and B from CMP flags.
 */
export function compareSigned(a: number | string, b: number | string, width: number = 4): AluComparisonRelations {
  return compareUnsigned(a, b, width);
}
