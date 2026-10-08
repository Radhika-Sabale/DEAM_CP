/**
 * @file grayCode.ts
 * Reflected Gray code conversions, sequence generators, cyclic adjacency,
 * and standard Karnaugh map axis ordering and coordinate mapping.
 *
 * ============================================================================
 * K-MAP LAYOUT CONVENTION (Variables 2 to 5, MSB = Variable 0):
 *
 * 2 Variables [A, B]:
 *   Rows: A (1 bit, 0..1), Cols: B (1 bit, 0..1)
 *   Row 0 (A=0): m0, m1
 *   Row 1 (A=1): m2, m3
 *
 * 3 Variables [A, B, C]:
 *   Rows: A (1 bit, 0..1), Cols: BC (2 bits, Gray order 00, 01, 11, 10)
 *   Row 0 (A=0): m0, m1, m3, m2
 *   Row 1 (A=1): m4, m5, m7, m6
 *
 * 4 Variables [A, B, C, D]:
 *   Rows: AB (2 bits, Gray order 00, 01, 11, 10), Cols: CD (2 bits, Gray order 00, 01, 11, 10)
 *   Row 0 (AB=00): m0,  m1,  m3,  m2
 *   Row 1 (AB=01): m4,  m5,  m7,  m6
 *   Row 2 (AB=11): m12, m13, m15, m14
 *   Row 3 (AB=10): m8,  m9,  m11, m10
 *
 * 5 Variables [A, B, C, D, E]:
 *   Split across two 4x4 layers selected by Variable A (MSB):
 *   - Layer 0 (A=0): Rows BC, Cols DE -> minterms 0..15 (identical to 4-variable map)
 *   - Layer 1 (A=1): Rows BC, Cols DE -> minterms 16..31 (4-variable map + 16)
 * ============================================================================
 */

import {
  fitsInWidth,
  fromBinaryString,
  hammingDistance,
  lowBitMask,
  maxValueForWidth,
  toBinaryString,
} from './bitUtils';

export interface KMapCellPosition {
  readonly layer?: number;
  readonly row: number;
  readonly col: number;
}

function validateWidth(width: number, max = 32): void {
  if (typeof width !== 'number' || !Number.isInteger(width)) {
    throw new TypeError(`Width must be an integer. Received: ${width}`);
  }
  if (width < 1 || width > max) {
    throw new RangeError(`Width must be between 1 and ${max}. Received: ${width}`);
  }
}

/** Converts a binary unsigned integer into its reflected Gray code equivalent. */
export function binaryToGray(value: number, width: number): number {
  validateWidth(width);
  if (!fitsInWidth(value, width)) {
    throw new RangeError(`Value ${value} does not fit in width ${width}`);
  }
  return ((value ^ (value >>> 1)) & lowBitMask(width)) >>> 0;
}

/** Converts a reflected Gray code integer back to binary unsigned integer. */
export function grayToBinary(gray: number, width: number): number {
  validateWidth(width);
  if (!fitsInWidth(gray, width)) {
    throw new RangeError(`Gray code ${gray} does not fit in width ${width}`);
  }
  let b = gray >>> 0;
  b ^= b >>> 1;
  b ^= b >>> 2;
  b ^= b >>> 4;
  b ^= b >>> 8;
  b ^= b >>> 16;
  return (b & lowBitMask(width)) >>> 0;
}

/** Converts a binary string to a Gray code string of identical length. */
export function binaryStringToGrayString(binStr: string): string {
  const width = binStr.length;
  const num = fromBinaryString(binStr);
  const gray = binaryToGray(num, width);
  return toBinaryString(gray, width);
}

/** Converts a Gray code string back to a binary string of identical length. */
export function grayStringToBinaryString(grayStr: string): string {
  const width = grayStr.length;
  const gray = fromBinaryString(grayStr);
  const num = grayToBinary(gray, width);
  return toBinaryString(num, width);
}

/** Generates the full sequence of reflected Gray codes for a given bit width. */
export function generateGraySequence(width: number): readonly number[] {
  validateWidth(width, 16);
  const count = 1 << width;
  const result: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = binaryToGray(i, width);
  }
  return result;
}

/** Computes the Gray distance (Hamming distance) between two code words. */
export function grayDistance(a: number, b: number): number {
  return hammingDistance(a, b);
}

/** Returns the canonical Gray code integer order for K-map headers of 1..3 bits. */
export function kmapAxisOrder(bitCount: number): readonly number[] {
  validateWidth(bitCount, 3);
  return generateGraySequence(bitCount);
}

/** Returns the string labels for K-map headers of 1..3 bits (e.g. ['00','01','11','10']). */
export function kmapAxisLabels(bitCount: number): readonly string[] {
  validateWidth(bitCount, 3);
  const order = kmapAxisOrder(bitCount);
  return order.map((val) => toBinaryString(val, bitCount));
}

/** Returns adjacent coordinates along a cyclic axis with wrap-around [prev, next]. */
export function cyclicAdjacency(position: number, axisLength: number): readonly [number, number] {
  if (!Number.isInteger(axisLength) || (axisLength !== 2 && axisLength !== 4 && axisLength !== 8)) {
    throw new RangeError(`axisLength must be 2, 4, or 8. Received: ${axisLength}`);
  }
  if (!Number.isInteger(position) || position < 0 || position >= axisLength) {
    throw new RangeError(`position must be in range [0, ${axisLength - 1}]. Received: ${position}`);
  }
  const prev = (position - 1 + axisLength) % axisLength;
  const next = (position + 1) % axisLength;
  return [prev, next];
}

function getDimensions(variableCount: number): { layerCount: number; rowCount: number; colCount: number; rowBits: number; colBits: number } {
  if (!Number.isInteger(variableCount) || variableCount < 2 || variableCount > 5) {
    throw new RangeError(`variableCount must be between 2 and 5. Received: ${variableCount}`);
  }
  switch (variableCount) {
    case 2:
      return { layerCount: 1, rowCount: 2, colCount: 2, rowBits: 1, colBits: 1 };
    case 3:
      return { layerCount: 1, rowCount: 2, colCount: 4, rowBits: 1, colBits: 2 };
    case 4:
      return { layerCount: 1, rowCount: 4, colCount: 4, rowBits: 2, colBits: 2 };
    case 5:
    default:
      return { layerCount: 2, rowCount: 4, colCount: 4, rowBits: 2, colBits: 2 };
  }
}

/** Maps a K-map cell position (row, col, optional layer) to a minterm index. */
export function kmapCellToMinterm(pos: KMapCellPosition, variableCount: number): number {
  if (!pos || typeof pos !== 'object') throw new TypeError('Position must be an object.');
  const dims = getDimensions(variableCount);
  const layer = pos.layer ?? 0;
  if (!Number.isInteger(layer) || layer < 0 || layer >= dims.layerCount) {
    throw new RangeError(`Invalid layer ${layer} for ${variableCount} variables.`);
  }
  if (!Number.isInteger(pos.row) || pos.row < 0 || pos.row >= dims.rowCount) {
    throw new RangeError(`Invalid row ${pos.row} for ${variableCount} variables.`);
  }
  if (!Number.isInteger(pos.col) || pos.col < 0 || pos.col >= dims.colCount) {
    throw new RangeError(`Invalid col ${pos.col} for ${variableCount} variables.`);
  }

  const rowVal = binaryToGray(pos.row, dims.rowBits);
  const colVal = binaryToGray(pos.col, dims.colBits);
  const baseMinterm = (rowVal << dims.colBits) | colVal;
  return layer === 1 ? (baseMinterm | (1 << 4)) >>> 0 : baseMinterm >>> 0;
}

/** Maps a minterm index to its K-map cell position (row, col, layer). */
export function mintermToKMapCell(minterm: number, variableCount: number): KMapCellPosition {
  const dims = getDimensions(variableCount);
  const maxMinterm = maxValueForWidth(variableCount);
  if (!Number.isInteger(minterm) || minterm < 0 || minterm > maxMinterm) {
    throw new RangeError(`Minterm ${minterm} out of range for ${variableCount} variables (0..${maxMinterm}).`);
  }

  let layer = 0;
  let remaining = minterm;
  if (variableCount === 5) {
    layer = (minterm >>> 4) & 1;
    remaining = minterm & 0x0f;
  }

  const colMask = lowBitMask(dims.colBits);
  const colVal = remaining & colMask;
  const rowVal = (remaining >>> dims.colBits) & lowBitMask(dims.rowBits);

  const row = grayToBinary(rowVal, dims.rowBits);
  const col = grayToBinary(colVal, dims.colBits);

  return variableCount === 5 ? { layer, row, col } : { row, col };
}
