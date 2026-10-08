/**
 * @file arithmetic.ts
 * Fixed-width binary arithmetic (1..32 bits, matches bitUtils.ts).
 *
 * SUBTRACTION CARRY/BORROW CONVENTION:
 * Subtraction A - B is performed as A + ~B + 1.
 * Hardware Cout = 1 means NO borrow (A >= B unsigned).
 * 8086 convention defines CF = 1 as BORROW (CF = 1 - Cout = borrow).
 * This module defaults to 8086 convention ('borrow_is_cf') for Phase 2 compatibility.
 */

import { decode, encode, onesComplement, twosComplement } from './complements';
import type {
  ArithmeticFlags,
  BinaryArithmeticResult,
  BitCarryStep,
  BorrowConvention,
  NumberSystemResult,
  OnesComplementAddResult,
  SignMagnitudeAddResult,
  StepRecord,
} from './types';

function validateWidth(width: number): void {
  if (!Number.isInteger(width)) throw new TypeError(`Width must be an integer. Received: ${width}`);
  if (width < 1 || width > 32) throw new RangeError(`Width must be between 1 and 32. Received: ${width}`);
}

function normalizeOperand(val: string | number, width: number, mode: 'unsigned' | 'signed'): NumberSystemResult<string> {
  if (typeof val === 'number') {
    const enc = encode(val, width, mode === 'unsigned' ? 'unsigned' : 'twos-complement');
    return enc.ok ? { ok: true, value: enc.value } : enc;
  }
  const clean = val.replace(/[\s_]/g, '');
  if (clean.length !== width || !/^[01]+$/.test(clean)) {
    return { ok: false, error: { message: `Expected ${width}-bit binary string, received "${val}"` } };
  }
  return { ok: true, value: clean };
}

/** Performs fixed-width binary addition with carry chain and condition flags (C, borrow, N, Z, V). */
export function addBinary(
  a: string | number,
  b: string | number,
  width: number,
  mode: 'unsigned' | 'signed' = 'unsigned',
  initialCarry: 0 | 1 = 0,
): NumberSystemResult<BinaryArithmeticResult> {
  validateWidth(width);
  const aNorm = normalizeOperand(a, width, mode);
  if (!aNorm.ok) return aNorm;
  const bNorm = normalizeOperand(b, width, mode);
  if (!bNorm.ok) return bNorm;

  const aBits = aNorm.value;
  const bBits = bNorm.value;
  const carryChain: BitCarryStep[] = [];
  const steps: StepRecord[] = [];
  const sumChars = new Array<string>(width);
  let carry: 0 | 1 = initialCarry;

  for (let i = width - 1; i >= 0; i--) {
    const pos = width - 1 - i;
    const bitA = (aBits[i] === '1' ? 1 : 0) as 0 | 1;
    const bitB = (bBits[i] === '1' ? 1 : 0) as 0 | 1;
    const sum = (bitA ^ bitB ^ carry) as 0 | 1;
    const carryOut = ((bitA & bitB) | (carry & (bitA ^ bitB))) as 0 | 1;

    carryChain.push({ position: pos, carryIn: carry, a: bitA, b: bitB, sum, carryOut });
    sumChars[i] = sum.toString();
    steps.push({
      kind: 'bit_addition',
      description: `Pos ${pos}: A(${bitA}) + B(${bitB}) + Cin(${carry}) = sum ${sum}, Cout ${carryOut}`,
      inputs: { position: pos, a: bitA, b: bitB, carryIn: carry },
      output: { sum, carryOut },
    });
    carry = carryOut;
  }

  const resultBits = sumChars.join('');
  const msbStep = carryChain[width - 1];
  const carryInMsb = msbStep ? msbStep.carryIn : 0;
  const carryOutMsb = msbStep ? msbStep.carryOut : 0;
  const flags: ArithmeticFlags = {
    C: carryOutMsb,
    borrow: 0,
    N: (resultBits[0] === '1' ? 1 : 0) as 0 | 1,
    Z: (resultBits.indexOf('1') === -1 ? 1 : 0) as 0 | 1,
    V: (carryInMsb ^ carryOutMsb) as 0 | 1,
  };

  const decU = decode(resultBits, width, 'unsigned');
  const decS = decode(resultBits, width, 'twos-complement');
  const overflowExp = explainOverflow(flags, aBits, bBits, 'add', mode, width);

  return {
    ok: true,
    value: { resultBits, unsignedValue: decU.ok ? decU.value : 0, signedValue: decS.ok ? decS.value : 0, carryChain, flags, steps, overflowExplanation: overflowExp },
  };
}

/** Performs fixed-width binary subtraction as A + ~B + 1. */
export function subtractBinary(
  a: string | number,
  b: string | number,
  width: number,
  mode: 'unsigned' | 'signed' = 'unsigned',
  options: { borrowConvention?: BorrowConvention } = {},
): NumberSystemResult<BinaryArithmeticResult> {
  validateWidth(width);
  const aNorm = normalizeOperand(a, width, mode);
  if (!aNorm.ok) return aNorm;
  const bNorm = normalizeOperand(b, width, mode);
  if (!bNorm.ok) return bNorm;

  const aBits = aNorm.value;
  const bBits = bNorm.value;
  const bOnes = onesComplement(bBits).result;
  const bTwos = twosComplement(bBits);
  const addRes = addBinary(aBits, bOnes, width, mode, 1);
  if (!addRes.ok) return addRes;

  const convention = options.borrowConvention ?? 'borrow_is_cf';
  const rawCout = addRes.value.flags.C;
  const borrow = (rawCout === 1 ? 0 : 1) as 0 | 1;
  const C = (convention === 'borrow_is_cf' ? borrow : rawCout) as 0 | 1;

  const aSign = aBits[0] === '1' ? 1 : 0;
  const bSign = bBits[0] === '1' ? 1 : 0;
  const rSign = addRes.value.resultBits[0] === '1' ? 1 : 0;
  const V = (aSign !== bSign && rSign !== aSign) ? 1 : 0;
  const flags: ArithmeticFlags = { C, borrow, N: addRes.value.flags.N, Z: addRes.value.flags.Z, V };

  const steps: StepRecord[] = [
    {
      kind: 'subtraction_setup',
      description: `Compute A - B as A + ~B + 1: ~B is ${bOnes}, Cin = 1 (twos complement: ${bTwos.result})`,
      inputs: { a: aBits, b: bBits, invertedB: bOnes, twosComplement: bTwos.result, initialCarry: 1 },
      output: { invertedB: bOnes, twosComplement: bTwos.result },
    },
    ...addRes.value.steps,
  ];

  const overflowExp = explainOverflow(flags, aBits, bBits, 'subtract', mode, width);
  return {
    ok: true,
    value: { resultBits: addRes.value.resultBits, unsignedValue: addRes.value.unsignedValue, signedValue: addRes.value.signedValue, carryChain: addRes.value.carryChain, flags, steps, overflowExplanation: overflowExp },
  };
}

/** Explains condition flags and overflow causes in structured educational prose. */
export function explainOverflow(
  flags: ArithmeticFlags,
  aBits: string,
  bBits: string,
  op: 'add' | 'subtract',
  mode: 'unsigned' | 'signed',
  width: number,
): string | undefined {
  if (mode === 'unsigned') {
    if (op === 'add' && flags.C === 1) return `Unsigned overflow: sum exceeded maximum ${width}-bit value (${Math.pow(2, width) - 1}) (carry out generated).`;
    if (op === 'subtract' && flags.borrow === 1) return `Unsigned underflow: minuend was smaller than subtrahend (borrow required).`;
    return undefined;
  }
  if (flags.V === 1) {
    const aSign = aBits[0] === '1' ? 'negative' : 'positive';
    const bSign = bBits[0] === '1' ? 'negative' : 'positive';
    return op === 'add'
      ? `Signed overflow: ${aSign} + ${bSign} produced a result with inverted sign (exceeded signed range).`
      : `Signed overflow: ${aSign} - ${bSign} produced a result with inverted sign (exceeded signed range).`;
  }
  return undefined;
}

/** One's complement addition with end-around carry. */
export function onesComplementAdd(
  a: string | number,
  b: string | number,
  width: number,
): NumberSystemResult<OnesComplementAddResult> {
  validateWidth(width);
  const aNorm = normalizeOperand(a, width, 'signed');
  if (!aNorm.ok) return aNorm;
  const bNorm = normalizeOperand(b, width, 'signed');
  if (!bNorm.ok) return bNorm;

  const rawAdd = addBinary(aNorm.value, bNorm.value, width, 'unsigned');
  if (!rawAdd.ok) return rawAdd;

  const initialBits = rawAdd.value.resultBits;
  const endAroundCarry = rawAdd.value.flags.C;
  const steps: StepRecord[] = [
    ...rawAdd.value.steps,
    {
      kind: 'ones_complement_intermediate',
      description: `Initial sum: ${initialBits}, Carry-out: ${endAroundCarry}`,
      inputs: { a: aNorm.value, b: bNorm.value },
      output: { initialSum: initialBits, endAroundCarry },
    },
  ];

  let finalBits = initialBits;
  if (endAroundCarry === 1) {
    const addOne = addBinary(initialBits, 1, width, 'unsigned');
    if (!addOne.ok) return addOne;
    finalBits = addOne.value.resultBits;
    steps.push({
      kind: 'end_around_carry',
      description: `End-around carry detected: added 1 to LSB -> ${finalBits}`,
      inputs: { initialSum: initialBits, carry: 1 },
      output: { finalBits },
    });
  }

  const dec = decode(finalBits, width, 'ones-complement');
  return { ok: true, value: { initialSumBits: initialBits, endAroundCarry, finalBits, finalValue: dec.ok ? dec.value : 0, steps } };
}

/** Sign-magnitude addition with separate sign and magnitude analysis. */
export function signMagnitudeAdd(
  a: string | number,
  b: string | number,
  width: number,
): NumberSystemResult<SignMagnitudeAddResult> {
  validateWidth(width);
  const aNorm = normalizeOperand(a, width, 'signed');
  if (!aNorm.ok) return aNorm;
  const bNorm = normalizeOperand(b, width, 'signed');
  if (!bNorm.ok) return bNorm;

  const aBits = aNorm.value;
  const bBits = bNorm.value;
  const signA = (aBits[0] === '1' ? 1 : 0) as 0 | 1;
  const signB = (bBits[0] === '1' ? 1 : 0) as 0 | 1;
  const magA = width > 1 ? parseInt(aBits.slice(1), 2) : 0;
  const magB = width > 1 ? parseInt(bBits.slice(1), 2) : 0;
  const maxMag = Math.pow(2, width - 1) - 1;

  const steps: StepRecord[] = [];
  let resultSign: 0 | 1 = 0;
  let resultMag = 0;
  let overflow = false;

  if (signA === signB) {
    resultSign = signA;
    resultMag = magA + magB;
    overflow = resultMag > maxMag;
    steps.push({
      kind: 'sign_mag_same_sign',
      description: `Signs match (${signA}): added magnitudes ${magA} + ${magB} = ${resultMag}${overflow ? ' (OVERFLOW)' : ''}`,
      inputs: { signA, magA, signB, magB },
      output: { resultSign, resultMag, overflow },
    });
  } else {
    resultSign = magA >= magB ? signA : signB;
    resultMag = Math.abs(magA - magB);
    steps.push({
      kind: 'sign_mag_diff_sign',
      description: `Signs differ: subtracted magnitudes |${magA} - ${magB}| = ${resultMag}, sign of larger is ${resultSign}`,
      inputs: { signA, magA, signB, magB },
      output: { resultSign, resultMag, overflow: false },
    });
  }

  const boundedMag = resultMag & (width > 1 ? maxMag : 0);
  const magBits = width > 1 ? boundedMag.toString(2).padStart(width - 1, '0') : '';
  const resultBits = `${resultSign}${magBits}`;

  return { ok: true, value: { signA, magA, signB, magB, resultSign, resultMag, resultBits, overflow, steps } };
}
