/**
 * @file bcd.ts
 * Binary Coded Decimal (8421, excess-3, 2421, 84-2-1) conversions and arithmetic,
 * plus reflected Gray code step explanations using src/engine/common/grayCode.ts.
 */

import { binaryStringToGrayString, grayStringToBinaryString } from '../common/grayCode';
import type {
  BCDCode,
  BCDFormat,
  BcdAddResult,
  BcdConversionResult,
  BcdToDecimalResult,
  NumberSystemResult,
  StepRecord,
} from './types';

const BCD_TABLES: Readonly<Record<BCDCode, readonly string[]>> = {
  '8421': ['0000', '0001', '0010', '0011', '0100', '0101', '0110', '0111', '1000', '1001'],
  'excess-3': ['0011', '0100', '0101', '0110', '0111', '1000', '1001', '1010', '1011', '1100'],
  '2421': ['0000', '0001', '0010', '0011', '0100', '1011', '1100', '1101', '1110', '1111'],
  '84-2-1': ['0000', '0111', '0110', '0101', '0100', '1011', '1010', '1001', '1000', '1111'],
};

/** Converts a decimal string to BCD in the specified code and packaging format. */
export function decimalToBcd(
  decimalStr: string,
  code: BCDCode = '8421',
  format: BCDFormat = 'packed',
): NumberSystemResult<BcdConversionResult> {
  const clean = decimalStr.trim();
  if (!/^\d+$/.test(clean)) {
    return { ok: false, error: { message: `Expected non-empty decimal digits, received "${decimalStr}"` } };
  }
  const table = BCD_TABLES[code];
  const nibbles: string[] = [];
  const steps: StepRecord[] = [];

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i] ?? '0';
    const digit = parseInt(ch, 10);
    const nibble = table[digit] ?? '0000';
    nibbles.push(nibble);
    steps.push({
      kind: 'decimal_to_bcd_digit',
      description: `Digit '${digit}' at index ${i} encoded as ${code} -> ${nibble}`,
      inputs: { digit, index: i, code },
      output: { nibble },
    });
  }

  const bits = format === 'packed'
    ? nibbles.join('')
    : nibbles.map(n => '0000' + n).join('');

  return { ok: true, value: { bits, nibbles, code, format, steps } };
}

/** Converts BCD bits back to decimal string, validating every nibble. */
export function bcdToDecimal(
  bcdBits: string,
  code: BCDCode = '8421',
  format: BCDFormat = 'packed',
): NumberSystemResult<BcdToDecimalResult> {
  const clean = bcdBits.replace(/[\s_]/g, '');
  if (!/^[01]+$/.test(clean)) {
    return { ok: false, error: { message: `Expected binary string for BCD, received "${bcdBits}"` } };
  }
  const nibbleWidth = format === 'packed' ? 4 : 8;
  if (clean.length % nibbleWidth !== 0) {
    return { ok: false, error: { message: `Bit length ${clean.length} is not a multiple of ${nibbleWidth} for ${format} format` } };
  }

  const table = BCD_TABLES[code];
  const digits: number[] = [];
  const steps: StepRecord[] = [];
  const count = clean.length / nibbleWidth;

  for (let i = 0; i < count; i++) {
    const chunk = clean.slice(i * nibbleWidth, (i + 1) * nibbleWidth);
    const nibble = format === 'packed' ? chunk : chunk.slice(4);
    const digit = table.indexOf(nibble);
    if (digit === -1) {
      return {
        ok: false,
        error: { message: `Invalid ${code} BCD nibble '${nibble}' at nibble index ${i}`, position: i * nibbleWidth },
      };
    }
    digits.push(digit);
    steps.push({
      kind: 'bcd_nibble_to_digit',
      description: `Nibble ${i} ('${nibble}') decoded from ${code} -> digit '${digit}'`,
      inputs: { nibble, index: i, code },
      output: { digit },
    });
  }

  return { ok: true, value: { decimal: digits.join(''), digits, steps } };
}

/** Performs BCD addition on packed 8421 bit strings with correction step (+0110). */
export function bcdAdd(aBits: string, bBits: string): NumberSystemResult<BcdAddResult> {
  const aClean = aBits.replace(/[\s_]/g, '');
  const bClean = bBits.replace(/[\s_]/g, '');
  if (!/^[01]+$/.test(aClean) || !/^[01]+$/.test(bClean)) {
    return { ok: false, error: { message: 'Operands must be valid binary strings' } };
  }
  if (aClean.length % 4 !== 0 || bClean.length % 4 !== 0) {
    return { ok: false, error: { message: 'Operands must have length multiple of 4 (packed BCD)' } };
  }

  const maxLen = Math.max(aClean.length, bClean.length);
  const aPadded = aClean.padStart(maxLen, '0');
  const bPadded = bClean.padStart(maxLen, '0');
  const nibbleCount = maxLen / 4;

  const steps: StepRecord[] = [];
  const resultNibbles: string[] = [];
  let carry = 0;

  for (let i = nibbleCount - 1; i >= 0; i--) {
    const nA = aPadded.slice(i * 4, (i + 1) * 4);
    const nB = bPadded.slice(i * 4, (i + 1) * 4);
    const valA = parseInt(nA, 2);
    const valB = parseInt(nB, 2);

    if (valA > 9) return { ok: false, error: { message: `Invalid 8421 BCD nibble '${nA}' in operand A at nibble index ${i}` } };
    if (valB > 9) return { ok: false, error: { message: `Invalid 8421 BCD nibble '${nB}' in operand B at nibble index ${i}` } };

    const rawSum = valA + valB + carry;
    const rawBits = (rawSum & 0x0f).toString(2).padStart(4, '0');
    const rawCarry = rawSum > 15 ? 1 : 0;
    const needsCorrection = rawSum > 9 || rawCarry === 1;

    let correctedSum = rawSum;
    let nextCarry = 0;
    if (needsCorrection) {
      correctedSum = (rawSum + 6) & 0x0f;
      nextCarry = 1;
    }

    const correctedBits = correctedSum.toString(2).padStart(4, '0');
    resultNibbles.unshift(correctedBits);

    steps.push({
      kind: 'bcd_nibble_add',
      description: `Nibble ${i}: ${valA} + ${valB} + Cin(${carry}) = ${rawSum} [${rawBits}]. ` +
        (needsCorrection ? `Result > 9 or carry: +0110 (6) -> ${correctedBits}, Cout=1` : `Result <= 9: Cout=0`),
      inputs: { nibbleA: nA, nibbleB: nB, carryIn: carry, nibbleIndex: i },
      output: { rawSum, rawBits, needsCorrection, correctedBits, carryOut: nextCarry },
    });
    carry = nextCarry;
  }

  if (carry === 1) {
    resultNibbles.unshift('0001');
    steps.push({
      kind: 'bcd_final_carry',
      description: 'Final carry-out generated high-order BCD nibble 0001 (digit 1)',
      inputs: { carry },
      output: { nibble: '0001' },
    });
  }

  const bcdBits = resultNibbles.join('');
  const sumDigits = resultNibbles.map(n => parseInt(n, 2).toString()).join('');
  return { ok: true, value: { sumDigits, bcdBits, carryOut: carry as 0 | 1, steps } };
}

/** Binary to reflected Gray code conversion with XOR derivation steps. */
export function binaryToGrayWithSteps(
  binStr: string,
): NumberSystemResult<{ gray: string; steps: readonly StepRecord[] }> {
  const clean = binStr.replace(/[\s_]/g, '');
  if (!/^[01]+$/.test(clean)) {
    return { ok: false, error: { message: `Expected binary string, received "${binStr}"` } };
  }
  const steps: StepRecord[] = [];
  const grayChars = new Array<string>(clean.length);

  const firstChar = clean[0] ?? '0';
  grayChars[0] = firstChar;
  steps.push({
    kind: 'gray_bit_msb',
    description: `MSB (bit 0): G[0] = B[0] = '${firstChar}'`,
    inputs: { bitIndex: 0, bBit: firstChar },
    output: { grayBit: firstChar },
  });

  for (let i = 1; i < clean.length; i++) {
    const bPrev = (clean[i - 1] ?? '') === '1' ? 1 : 0;
    const bCurr = (clean[i] ?? '') === '1' ? 1 : 0;
    const gVal = (bPrev ^ bCurr) === 1 ? '1' : '0';
    grayChars[i] = gVal;
    steps.push({
      kind: 'gray_bit_xor',
      description: `Bit ${i}: G[${i}] = B[${i - 1}] (${bPrev}) ⊕ B[${i}] (${bCurr}) = '${gVal}'`,
      inputs: { bitIndex: i, bPrev, bCurr },
      output: { grayBit: gVal },
    });
  }

  const gray = grayChars.join('');
  // Cross-verify with common/grayCode.ts
  const ref = binaryStringToGrayString(clean);
  if (gray !== ref) throw new Error(`Internal Gray code generator mismatch: ${gray} vs ${ref}`);

  return { ok: true, value: { gray, steps } };
}

/** Reflected Gray code to binary conversion with XOR derivation steps. */
export function grayToBinaryWithSteps(
  grayStr: string,
): NumberSystemResult<{ binary: string; steps: readonly StepRecord[] }> {
  const clean = grayStr.replace(/[\s_]/g, '');
  if (!/^[01]+$/.test(clean)) {
    return { ok: false, error: { message: `Expected binary string, received "${grayStr}"` } };
  }
  const steps: StepRecord[] = [];
  const binChars = new Array<string>(clean.length);

  const firstGray = clean[0] ?? '0';
  binChars[0] = firstGray;
  steps.push({
    kind: 'binary_bit_msb',
    description: `MSB (bit 0): B[0] = G[0] = '${firstGray}'`,
    inputs: { bitIndex: 0, gBit: firstGray },
    output: { binBit: firstGray },
  });

  for (let i = 1; i < clean.length; i++) {
    const bPrev = (binChars[i - 1] ?? '') === '1' ? 1 : 0;
    const gCurr = (clean[i] ?? '') === '1' ? 1 : 0;
    const bVal = (bPrev ^ gCurr) === 1 ? '1' : '0';
    binChars[i] = bVal;
    steps.push({
      kind: 'binary_bit_xor',
      description: `Bit ${i}: B[${i}] = B[${i - 1}] (${bPrev}) ⊕ G[${i}] (${gCurr}) = '${bVal}'`,
      inputs: { bitIndex: i, bPrev, gCurr },
      output: { binBit: bVal },
    });
  }

  const binary = binChars.join('');
  // Cross-verify with common/grayCode.ts
  const ref = grayStringToBinaryString(clean);
  if (binary !== ref) throw new Error(`Internal Gray code decoder mismatch: ${binary} vs ${ref}`);

  return { ok: true, value: { binary, steps } };
}
