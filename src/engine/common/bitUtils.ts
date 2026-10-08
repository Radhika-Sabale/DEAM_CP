/**
 * @file bitUtils.ts
 * Core bit manipulation utilities, width validators, minterm conversions, and shift/rotate helpers.
 *
 * ============================================================================
 * BIT ORDERING CONVENTION FOR DIGITAL ELECTRONICS VIRTUAL LAB:
 * Variable index 0 (e.g., "A") is ALWAYS the MOST SIGNIFICANT BIT (MSB) of a
 * minterm index.
 *
 * For example, given variable list [A, B, C]:
 * - Index 0: A (MSB, weight 2^2 = 4)
 * - Index 1: B (weight 2^1 = 2)
 * - Index 2: C (LSB, weight 2^0 = 1)
 *
 * Therefore, minterm 5 (binary 101) represents the variable valuation:
 * A = 1, B = 0, C = 1.
 *
 * All array representations (such as bitsToArray) strictly follow this MSB-first order.
 * All bitwise operations use unsigned 32-bit semantics (>>> 0) so bit 31 never produces
 * negative JavaScript numbers.
 * ============================================================================
 */

export const MAX_GENERAL_WIDTH = 32;
export const MAX_MINTERM_VARIABLES = 6;

function validateWidth(width: number, max = MAX_GENERAL_WIDTH): void {
  if (typeof width !== 'number' || !Number.isInteger(width)) {
    throw new TypeError(`Width must be an integer. Received: ${width}`);
  }
  if (width < 1 || width > max) {
    throw new RangeError(`Width must be between 1 and ${max}. Received: ${width}`);
  }
}

function validateNonNegativeInt(val: number, name: string): void {
  if (typeof val !== 'number' || !Number.isInteger(val)) {
    throw new TypeError(`${name} must be an integer. Received: ${val}`);
  }
  if (val < 0) {
    throw new RangeError(`${name} must be non-negative. Received: ${val}`);
  }
}

/** Returns maximum unsigned integer for a given bit width (1..32). */
export function maxValueForWidth(width: number): number {
  validateWidth(width);
  return width === 32 ? 0xffffffff : ((1 << width) - 1) >>> 0;
}

/** Checks whether value fits within unsigned range of width. */
export function fitsInWidth(value: number, width: number): boolean {
  validateWidth(width);
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return false;
  return value <= maxValueForWidth(width);
}

/** Calculates minimum bits required to represent value (at least 1). */
export function minimumWidth(value: number): number {
  validateNonNegativeInt(value, 'Value');
  if (value > 0xffffffff) {
    throw new RangeError(`Value ${value} exceeds 32-bit unsigned maximum.`);
  }
  if (value === 0) return 1;
  return 32 - Math.clz32(value >>> 0);
}

/** Retrieves bit at 0-based bitIndex (0 = LSB). */
export function getBit(value: number, bitIndex: number): 0 | 1 {
  validateNonNegativeInt(value, 'Value');
  if (!Number.isInteger(bitIndex) || bitIndex < 0 || bitIndex >= MAX_GENERAL_WIDTH) {
    throw new RangeError(`bitIndex must be between 0 and ${MAX_GENERAL_WIDTH - 1}. Received: ${bitIndex}`);
  }
  return (((value >>> bitIndex) & 1) === 1 ? 1 : 0);
}

/** Sets or clears bit at 0-based bitIndex (0 = LSB). */
export function setBit(value: number, bitIndex: number, bitValue: 0 | 1): number {
  validateNonNegativeInt(value, 'Value');
  if (value > 0xffffffff) throw new RangeError(`Value ${value} exceeds 32-bit maximum.`);
  if (!Number.isInteger(bitIndex) || bitIndex < 0 || bitIndex >= MAX_GENERAL_WIDTH) {
    throw new RangeError(`bitIndex must be between 0 and ${MAX_GENERAL_WIDTH - 1}. Received: ${bitIndex}`);
  }
  if (bitValue !== 0 && bitValue !== 1) {
    throw new RangeError(`bitValue must be 0 or 1. Received: ${bitValue}`);
  }
  const uVal = value >>> 0;
  return bitValue === 1 ? (uVal | (1 << bitIndex)) >>> 0 : (uVal & ~(1 << bitIndex)) >>> 0;
}

/** Returns number of set bits (population count) in 32-bit unsigned value. */
export function popCount(value: number): number {
  validateNonNegativeInt(value, 'Value');
  let v = value >>> 0;
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** Converts integer to array of bits (index 0 is MSB). */
export function bitsToArray(value: number, width: number): readonly (0 | 1)[] {
  validateWidth(width);
  if (!fitsInWidth(value, width)) {
    throw new RangeError(`Value ${value} does not fit in width ${width}`);
  }
  const result: (0 | 1)[] = new Array(width);
  for (let i = 0; i < width; i++) {
    result[i] = ((value >>> (width - 1 - i)) & 1) === 1 ? 1 : 0;
  }
  return result;
}

/** Converts array of bits (index 0 is MSB) to unsigned integer. */
export function arrayToBits(bits: readonly (0 | 1)[]): number {
  if (!Array.isArray(bits) || bits.length < 1 || bits.length > MAX_GENERAL_WIDTH) {
    throw new RangeError(`bits length must be between 1 and ${MAX_GENERAL_WIDTH}.`);
  }
  let acc = 0;
  for (let i = 0; i < bits.length; i++) {
    const b = bits[i];
    if (b !== 0 && b !== 1) throw new RangeError(`Bit at index ${i} is not 0 or 1. Received: ${b}`);
    acc = ((acc << 1) | b) >>> 0;
  }
  return acc;
}

/** Formats integer as zero-padded binary string of fixed width. */
export function toBinaryString(value: number, width: number): string {
  validateWidth(width);
  if (!fitsInWidth(value, width)) {
    throw new RangeError(`Value ${value} does not fit in width ${width}`);
  }
  return (value >>> 0).toString(2).padStart(width, '0');
}

/** Parses binary string to unsigned integer. */
export function fromBinaryString(binaryStr: string): number {
  if (typeof binaryStr !== 'string' || binaryStr.length === 0 || !/^[01]+$/.test(binaryStr)) {
    throw new TypeError(`Expected non-empty binary string ('0' and '1'). Received: "${binaryStr}"`);
  }
  if (binaryStr.length > MAX_GENERAL_WIDTH) {
    throw new RangeError(`Binary string exceeds maximum width of ${MAX_GENERAL_WIDTH}.`);
  }
  return parseInt(binaryStr, 2) >>> 0;
}

/** Maps minterm index to variable assignments (MSB = variable 0). */
export function mintermToAssignment(minterm: number, variableCount: number): readonly (0 | 1)[] {
  validateWidth(variableCount, MAX_MINTERM_VARIABLES);
  const maxMinterm = maxValueForWidth(variableCount);
  if (typeof minterm !== 'number' || !Number.isInteger(minterm) || minterm < 0 || minterm > maxMinterm) {
    throw new RangeError(`Minterm ${minterm} out of bounds for ${variableCount} variables (0..${maxMinterm}).`);
  }
  return bitsToArray(minterm, variableCount);
}

/** Maps variable assignments array (MSB = variable 0) to minterm index. */
export function assignmentToMinterm(assignment: readonly (0 | 1)[]): number {
  if (!Array.isArray(assignment) || assignment.length < 1 || assignment.length > MAX_MINTERM_VARIABLES) {
    throw new RangeError(`Assignment length must be between 1 and ${MAX_MINTERM_VARIABLES}.`);
  }
  return arrayToBits(assignment);
}

/** Computes Hamming distance between two values. */
export function hammingDistance(a: number, b: number): number {
  validateNonNegativeInt(a, 'a');
  validateNonNegativeInt(b, 'b');
  return popCount((a ^ b) >>> 0);
}

/** Returns true if a and b differ by exactly one bit. */
export function differsByOneBit(a: number, b: number): boolean {
  validateNonNegativeInt(a, 'a');
  validateNonNegativeInt(b, 'b');
  const diff = (a ^ b) >>> 0;
  return diff !== 0 && (diff & (diff - 1)) === 0;
}

/** Generates low-bit mask for given width. */
export function lowBitMask(width: number): number {
  return maxValueForWidth(width);
}

function validateShiftAndWidth(val: number, shift: number, width: number): void {
  validateWidth(width);
  validateNonNegativeInt(shift, 'Shift');
  if (!fitsInWidth(val, width)) {
    throw new RangeError(`Value ${val} does not fit in width ${width}`);
  }
}

/** Width-bounded logical shift left. */
export function logicalShiftLeft(value: number, shift: number, width: number): number {
  validateShiftAndWidth(value, shift, width);
  if (shift >= width) return 0;
  return ((value << shift) & lowBitMask(width)) >>> 0;
}

/** Width-bounded logical shift right. */
export function logicalShiftRight(value: number, shift: number, width: number): number {
  validateShiftAndWidth(value, shift, width);
  if (shift >= width) return 0;
  return (value >>> shift) >>> 0;
}

/** Width-bounded arithmetic shift right (sign-preserving relative to MSB of width). */
export function arithmeticShiftRight(value: number, shift: number, width: number): number {
  validateShiftAndWidth(value, shift, width);
  const mask = lowBitMask(width);
  const isNegative = ((value >>> (width - 1)) & 1) === 1;
  const effectiveShift = Math.min(shift, width);
  const shifted = value >>> effectiveShift;
  if (!isNegative) return shifted >>> 0;
  const fill = (mask << (width - effectiveShift)) & mask;
  return (shifted | fill) >>> 0;
}

/** Width-bounded circular bitwise rotate left. */
export function rotateLeft(value: number, shift: number, width: number): number {
  validateShiftAndWidth(value, shift, width);
  const s = shift % width;
  if (s === 0) return value >>> 0;
  const mask = lowBitMask(width);
  return (((value << s) & mask) | (value >>> (width - s))) >>> 0;
}

/** Width-bounded circular bitwise rotate right. */
export function rotateRight(value: number, shift: number, width: number): number {
  validateShiftAndWidth(value, shift, width);
  const s = shift % width;
  if (s === 0) return value >>> 0;
  const mask = lowBitMask(width);
  return ((value >>> s) | ((value << (width - s)) & mask)) >>> 0;
}

/** Width-bounded circular bitwise rotate (default direction left). */
export function rotate(value: number, shift: number, width: number, direction: 'left' | 'right' = 'left'): number {
  return direction === 'right' ? rotateRight(value, shift, width) : rotateLeft(value, shift, width);
}
