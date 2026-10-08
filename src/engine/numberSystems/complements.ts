/**
 * @file complements.ts
 * Fixed-width representations (unsigned, sign-magnitude, one's complement, two's complement).
 *
 * Fixed-width arithmetic in this module is limited to widths 1 to 32 bits,
 * matching src/engine/common/bitUtils.ts.
 *
 * Explicit Handling:
 * - Two representations of zero exist in sign-magnitude (+0 and -0) and one's complement (+0 and -0).
 * - Asymmetric range in two's complement: min is -2^(w-1), max is 2^(w-1) - 1.
 *   The most negative value -2^(w-1) (bit pattern 100...0) has no positive twin;
 *   negating it in fixed width produces an overflow.
 */

import type {
  BitInterpretation,
  NumberSystemResult,
  Representation,
  RepresentationRange,
  StepRecord,
} from './types';

function validateWidth(width: number): void {
  if (!Number.isInteger(width)) throw new TypeError(`Width must be an integer. Received: ${width}`);
  if (width < 1 || width > 32) throw new RangeError(`Width must be between 1 and 32. Received: ${width}`);
}

function validateBits(bits: string, width: number): NumberSystemResult<void> {
  if (typeof bits !== 'string' || bits.length !== width || !/^[01]+$/.test(bits)) {
    return { ok: false, error: { message: `Expected ${width}-bit binary string ('0' and '1'), received "${bits}"` } };
  }
  return { ok: true, value: undefined };
}

/** Calculates valid numerical range for a given width and representation. */
export function range(width: number, representation: Representation): RepresentationRange {
  validateWidth(width);
  if (representation === 'unsigned') {
    return { min: 0, max: Math.pow(2, width) - 1 };
  }
  if (width === 1) {
    return representation === 'twos-complement' ? { min: -1, max: 0 } : { min: 0, max: 0 };
  }
  const maxAbs = Math.pow(2, width - 1) - 1;
  if (representation === 'twos-complement') {
    return { min: -Math.pow(2, width - 1), max: maxAbs };
  }
  return { min: -maxAbs, max: maxAbs };
}

/** Returns true if value is within range for representation. */
export function fits(value: number, width: number, representation: Representation): boolean {
  validateWidth(width);
  if (typeof value !== 'number' || !Number.isInteger(value)) return false;
  const r = range(width, representation);
  return value >= r.min && value <= r.max;
}

/** Encodes integer value into fixed-width binary string. */
export function encode(value: number, width: number, representation: Representation): NumberSystemResult<string> {
  validateWidth(width);
  if (!fits(value, width, representation)) {
    return { ok: false, error: { message: `Value ${value} does not fit in ${width}-bit ${representation}` } };
  }
  const isNegZero = Object.is(value, -0);
  if (representation === 'unsigned') {
    return { ok: true, value: value.toString(2).padStart(width, '0') };
  }
  if (width === 1) {
    if (representation === 'twos-complement') return { ok: true, value: value === -1 ? '1' : '0' };
    return { ok: true, value: isNegZero ? '1' : '0' };
  }
  if (representation === 'sign-magnitude') {
    const signBit = isNegZero || value < 0 ? '1' : '0';
    const mag = Math.abs(value).toString(2).padStart(width - 1, '0');
    return { ok: true, value: signBit + mag };
  }
  if (representation === 'ones-complement') {
    if (isNegZero) return { ok: true, value: '1'.repeat(width) };
    if (value >= 0) return { ok: true, value: value.toString(2).padStart(width, '0') };
    const pos = Math.abs(value).toString(2).padStart(width, '0');
    return { ok: true, value: pos.split('').map(b => (b === '0' ? '1' : '0')).join('') };
  }
  // two's complement
  if (value >= 0) return { ok: true, value: value.toString(2).padStart(width, '0') };
  const val = Math.pow(2, width) + value;
  return { ok: true, value: val.toString(2).padStart(width, '0') };
}

/** Decodes fixed-width binary string into integer. Correctly distinguishes -0. */
export function decode(bits: string, width: number, representation: Representation): NumberSystemResult<number> {
  validateWidth(width);
  const v = validateBits(bits, width);
  if (!v.ok) return v;

  if (representation === 'unsigned') return { ok: true, value: parseInt(bits, 2) };
  if (width === 1) {
    if (representation === 'twos-complement') return { ok: true, value: bits === '1' ? -1 : 0 };
    return { ok: true, value: bits === '1' ? -0 : 0 };
  }
  if (representation === 'sign-magnitude') {
    const sign = bits[0];
    const mag = parseInt(bits.slice(1), 2);
    if (sign === '1' && mag === 0) return { ok: true, value: -0 };
    return { ok: true, value: sign === '1' ? -mag : mag };
  }
  if (representation === 'ones-complement') {
    if (bits[0] === '0') return { ok: true, value: parseInt(bits, 2) };
    if (bits === '1'.repeat(width)) return { ok: true, value: -0 };
    const inv = bits.split('').map(b => (b === '0' ? '1' : '0')).join('');
    return { ok: true, value: -parseInt(inv, 2) };
  }
  // two's complement
  if (bits[0] === '0') return { ok: true, value: parseInt(bits, 2) };
  return { ok: true, value: parseInt(bits, 2) - Math.pow(2, width) };
}

/** One's complement bitwise inversion with steps. */
export function onesComplement(bits: string): { result: string; steps: readonly StepRecord[] } {
  const steps: StepRecord[] = [];
  const chars = bits.split('');
  const invChars: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const inverted = chars[i] === '0' ? '1' : '0';
    invChars.push(inverted);
    steps.push({
      kind: 'invert_bit',
      description: `Bit ${chars.length - 1 - i} ('${chars[i]}') inverted -> '${inverted}'`,
      inputs: { position: chars.length - 1 - i, bit: chars[i] },
      output: { invertedBit: inverted },
    });
  }
  return { result: invChars.join(''), steps };
}

/** Two's complement negation with bitwise carry chain and right-to-left shortcut steps. */
export function twosComplement(bits: string): {
  result: string;
  steps: readonly StepRecord[];
  shortcutSteps: readonly StepRecord[];
  overflow: boolean;
} {
  const ones = onesComplement(bits);
  const steps: StepRecord[] = [...ones.steps];
  const inverted = ones.result.split('');
  let carry = 1;
  const resultChars = new Array<string>(bits.length);

  for (let i = bits.length - 1; i >= 0; i--) {
    const bitVal = inverted[i] === '1' ? 1 : 0;
    const sum = (bitVal ^ carry) as 0 | 1;
    const nextCarry = (bitVal & carry) as 0 | 1;
    resultChars[i] = sum.toString();
    steps.push({
      kind: 'add_one',
      description: `Pos ${bits.length - 1 - i}: ${bitVal} + carry ${carry} = sum ${sum}, carryOut ${nextCarry}`,
      inputs: { position: bits.length - 1 - i, bit: bitVal, carryIn: carry },
      output: { sum, carryOut: nextCarry },
    });
    carry = nextCarry;
  }
  const result = resultChars.join('');

  // Shortcut: copy up to rightmost 1, invert remaining
  const shortcutSteps: StepRecord[] = [];
  const lastOneIndex = bits.lastIndexOf('1');
  if (lastOneIndex === -1) {
    shortcutSteps.push({ kind: 'shortcut_zero', description: 'Pattern is all zeros, result is unchanged', inputs: { bits }, output: { result: bits } });
  } else {
    for (let i = bits.length - 1; i >= 0; i--) {
      const action = i >= lastOneIndex ? 'copied' : 'inverted';
      const outBit = i >= lastOneIndex ? bits[i] : bits[i] === '0' ? '1' : '0';
      shortcutSteps.push({
        kind: 'shortcut_bit',
        description: `Pos ${bits.length - 1 - i} ('${bits[i]}') ${action} -> '${outBit}'`,
        inputs: { position: bits.length - 1 - i, originalBit: bits[i], phase: action },
        output: { resultBit: outBit },
      });
    }
  }

  // Most negative value check: 100...0 has no positive twin
  const isMostNegative = bits[0] === '1' && bits.slice(1).indexOf('1') === -1;
  return { result, steps, shortcutSteps, overflow: isMostNegative };
}

/** Sign extends binary string from fromWidth to toWidth. */
export function signExtend(bits: string, fromWidth: number, toWidth: number): { result: string; lostInformation: boolean } {
  validateWidth(fromWidth);
  validateWidth(toWidth);
  if (bits.length !== fromWidth) throw new RangeError(`bits length (${bits.length}) does not match fromWidth (${fromWidth})`);
  if (toWidth < fromWidth) {
    const truncated = bits.slice(fromWidth - toWidth);
    const lost = bits.slice(0, fromWidth - toWidth).split('').some(b => b !== truncated[0]);
    return { result: truncated, lostInformation: lost };
  }
  const sign = bits[0] ?? '0';
  return { result: sign.repeat(toWidth - fromWidth) + bits, lostInformation: false };
}

/** Truncates binary string from fromWidth to toWidth. Flags information loss. */
export function truncate(bits: string, fromWidth: number, toWidth: number): { result: string; lostInformation: boolean } {
  validateWidth(fromWidth);
  validateWidth(toWidth);
  if (bits.length !== fromWidth) throw new RangeError(`bits length (${bits.length}) does not match fromWidth (${fromWidth})`);
  if (toWidth >= fromWidth) return { result: bits.padStart(toWidth, '0'), lostInformation: false };
  const truncated = bits.slice(fromWidth - toWidth);
  const discarded = bits.slice(0, fromWidth - toWidth);
  const lost = discarded.split('').some(b => b !== truncated[0]);
  return { result: truncated, lostInformation: lost };
}

/** Side-by-side evaluation of a bit pattern under all 4 representations. */
export function interpretBits(bits: string, width = bits.length): NumberSystemResult<BitInterpretation> {
  validateWidth(width);
  const v = validateBits(bits, width);
  if (!v.ok) return v;
  const u = decode(bits, width, 'unsigned');
  const sm = decode(bits, width, 'sign-magnitude');
  const oc = decode(bits, width, 'ones-complement');
  const tc = decode(bits, width, 'twos-complement');
  if (!u.ok || !sm.ok || !oc.ok || !tc.ok) {
    return { ok: false, error: { message: 'Invalid bit string' } };
  }
  return {
    ok: true,
    value: {
      bits,
      width,
      unsigned: u.value,
      signMagnitude: sm.value,
      onesComplement: oc.value,
      twosComplement: tc.value,
    },
  };
}
