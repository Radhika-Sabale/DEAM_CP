/**
 * @file layout.ts
 * Geometry, coordinate projections, adjacency, and visual rectangle decomposition
 * for 2, 3, 4, and 5-variable Karnaugh maps.
 *
 * Variable ordering convention:
 * Variable index 0 is the MOST significant bit of a minterm index.
 * - 2 variables [A, B]: row A (bit 1), col B (bit 0)
 * - 3 variables [A, B, C]: row A (bit 2), cols BC (bits 1, 0)
 * - 4 variables [A, B, C, D]: rows AB (bits 3, 2), cols CD (bits 1, 0)
 * - 5 variables [A, B, C, D, E]: layer A (bit 4), rows BC (bits 3, 2), cols DE (bits 1, 0)
 *
 * Cube representation:
 * { careMask: number, valueMask: number } where careMask has 1s for specified literals,
 * and valueMask has the required bit values (valueMask & ~careMask === 0).
 */

import { getBit, hammingDistance } from '../common/bitUtils';
import {
  kmapAxisLabels,
  kmapCellToMinterm,
  mintermToKMapCell,
} from '../common/grayCode';

/**
 * Fundamental cube representation:
 * - careMask: bitmask indicating which variable positions are constrained (1 = constrained, 0 = don't-care)
 * - valueMask: required bit values for constrained positions (unconstrained bits must be 0)
 */
export interface Cube {
  readonly careMask: number;
  readonly valueMask: number;
}

export interface KMapPosition {
  readonly layer: number;
  readonly row: number;
  readonly col: number;
}

export type WrapEdge =
  | 'none'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

/**
 * A rectangular piece of an implicant group drawn on a K-map grid.
 * Groups that wrap around boundaries decompose into multiple coordinate rectangles.
 */
export interface KMapOverlayRect {
  readonly layer: number;
  readonly row: number;
  readonly col: number;
  readonly width: number;
  readonly height: number;
  readonly wrap: WrapEdge;
  readonly minterms: readonly number[];
}

export interface AxisVariables {
  readonly layerVar?: string;
  readonly rowVars: readonly string[];
  readonly colVars: readonly string[];
}

export interface CellsToCubeSuccess {
  readonly ok: true;
  readonly cube: Cube;
}

export interface CellsToCubeFailure {
  readonly ok: false;
  readonly reason: string;
}

export type CellsToCubeResult = CellsToCubeSuccess | CellsToCubeFailure;

function validateVarCount(varCount: number): void {
  if (!Number.isInteger(varCount) || varCount < 2 || varCount > 5) {
    throw new RangeError(`variableCount must be an integer between 2 and 5. Received: ${varCount}`);
  }
}

/**
 * Maps a grid cell coordinate (row, col, optional layer) to its minterm index.
 */
export function cellAt(row: number, col: number, layer = 0, varCount = 4): number {
  validateVarCount(varCount);
  return kmapCellToMinterm({ layer, row, col }, varCount);
}

/**
 * Maps a minterm index to its 3D grid cell coordinate (layer, row, col).
 */
export function positionOf(minterm: number, varCount: number): KMapPosition {
  validateVarCount(varCount);
  const pos = mintermToKMapCell(minterm, varCount);
  return {
    layer: pos.layer ?? 0,
    row: pos.row,
    col: pos.col,
  };
}

/**
 * Returns the Gray code labels for K-map row headers (e.g. ['00', '01', '11', '10']).
 */
export function rowHeaderLabels(varCount: number): readonly string[] {
  validateVarCount(varCount);
  const rowBits = varCount === 2 || varCount === 3 ? 1 : 2;
  return kmapAxisLabels(rowBits);
}

/**
 * Returns the Gray code labels for K-map column headers (e.g. ['00', '01', '11', '10']).
 */
export function colHeaderLabels(varCount: number): readonly string[] {
  validateVarCount(varCount);
  const colBits = varCount === 2 ? 1 : 2;
  return kmapAxisLabels(colBits);
}

/**
 * Identifies which variables label the layer, rows, and columns of the map.
 */
export function axisVariables(varCount: number, varNames?: readonly string[]): AxisVariables {
  validateVarCount(varCount);
  const names = varNames ?? ['A', 'B', 'C', 'D', 'E'].slice(0, varCount);
  switch (varCount) {
    case 2:
      return { rowVars: [names[0] ?? 'A'], colVars: [names[1] ?? 'B'] };
    case 3:
      return { rowVars: [names[0] ?? 'A'], colVars: [names[1] ?? 'B', names[2] ?? 'C'] };
    case 4:
      return {
        rowVars: [names[0] ?? 'A', names[1] ?? 'B'],
        colVars: [names[2] ?? 'C', names[3] ?? 'D'],
      };
    case 5:
    default:
      return {
        layerVar: names[0] ?? 'A',
        rowVars: [names[1] ?? 'B', names[2] ?? 'C'],
        colVars: [names[3] ?? 'D', names[4] ?? 'E'],
      };
  }
}

/**
 * Returns all minterms that differ from the given minterm by exactly one bit.
 * For 5 variables, this includes the adjacent cell in the opposite layer.
 */
export function neighbours(minterm: number, varCount: number): readonly number[] {
  validateVarCount(varCount);
  const maxMinterm = (1 << varCount) - 1;
  if (!Number.isInteger(minterm) || minterm < 0 || minterm > maxMinterm) {
    throw new RangeError(`Minterm ${minterm} out of range (0..${maxMinterm})`);
  }
  const result: number[] = [];
  for (let bit = 0; bit < varCount; bit++) {
    result.push(minterm ^ (1 << bit));
  }
  return result;
}

/**
 * Returns true if two minterms are adjacent (differ by exactly one bit).
 */
export function isAdjacent(mintermA: number, mintermB: number, varCount: number): boolean {
  validateVarCount(varCount);
  const maxMinterm = (1 << varCount) - 1;
  if (
    !Number.isInteger(mintermA) ||
    mintermA < 0 ||
    mintermA > maxMinterm ||
    !Number.isInteger(mintermB) ||
    mintermB < 0 ||
    mintermB > maxMinterm
  ) {
    return false;
  }
  return hammingDistance(mintermA, mintermB) === 1;
}

/**
 * Returns the minterms occupying the 4 corners of the map grid.
 */
export function cornerMinterms(varCount: number): readonly number[] {
  validateVarCount(varCount);
  switch (varCount) {
    case 2:
      return [0, 1, 2, 3];
    case 3:
      return [0, 2, 4, 6];
    case 4:
      return [0, 2, 8, 10];
    case 5:
    default:
      return [0, 2, 8, 10, 16, 18, 24, 26];
  }
}

/**
 * Returns all minterm indices covered by a product cube.
 */
export function cubeCells(cube: Cube, varCount: number): readonly number[] {
  validateVarCount(varCount);
  const total = 1 << varCount;
  const cells: number[] = [];
  for (let m = 0; m < total; m++) {
    if (((m & cube.careMask) >>> 0) === cube.valueMask) {
      cells.push(m);
    }
  }
  return cells;
}

/**
 * Determines whether a set of cell indices corresponds to a valid subcube,
 * returning the Cube descriptor or an explanatory rejection reason.
 */
export function cellsToCube(cells: readonly number[], varCount: number): CellsToCubeResult {
  validateVarCount(varCount);
  if (!cells || cells.length === 0) {
    return { ok: false, reason: 'Cell set is empty.' };
  }

  const total = 1 << varCount;
  const unique = Array.from(new Set(cells));
  for (const c of unique) {
    if (!Number.isInteger(c) || c < 0 || c >= total) {
      return { ok: false, reason: `Cell index ${c} out of range [0, ${total - 1}].` };
    }
  }

  const count = unique.length;
  // Must be a non-zero power of 2
  if ((count & (count - 1)) !== 0) {
    return { ok: false, reason: `Number of cells (${count}) is not a power of two.` };
  }

  // Derive common bits
  let careMask = 0;
  let valueMask = 0;
  const first = unique[0];
  if (first === undefined) return { ok: false, reason: 'Empty cell list.' };

  for (let bit = 0; bit < varCount; bit++) {
    const bitVal = getBit(first, bit);
    const allSame = unique.every((c) => getBit(c, bit) === bitVal);
    if (allSame) {
      careMask |= (1 << bit);
      if (bitVal === 1) {
        valueMask |= (1 << bit);
      }
    }
  }

  const derivedCube: Cube = { careMask: careMask >>> 0, valueMask: valueMask >>> 0 };
  const covered = cubeCells(derivedCube, varCount);
  if (covered.length !== count || !covered.every((m) => unique.includes(m))) {
    return { ok: false, reason: 'Selected cells do not form a contiguous subcube on the hypercube.' };
  }

  return { ok: true, cube: derivedCube };
}

interface AxisInterval {
  readonly start: number;
  readonly length: number;
  readonly wrap: 'none' | 'primary' | 'secondary';
}

function getAxisIntervals(careBits: number, valBits: number, axisBits: number): readonly AxisInterval[] {
  if (axisBits === 1) {
    if (careBits === 0) {
      return [{ start: 0, length: 2, wrap: 'none' }];
    }
    // Fixed bit 0 or 1
    const pos = valBits === 0 ? 0 : 1;
    return [{ start: pos, length: 1, wrap: 'none' }];
  }

  // axisBits === 2 (Gray sequence: 00 -> pos 0, 01 -> pos 1, 11 -> pos 2, 10 -> pos 3)
  if (careBits === 0) {
    return [{ start: 0, length: 4, wrap: 'none' }];
  }

  if (careBits === 3) {
    // Both bits constrained (size 1)
    const grayPosMap: Record<number, number> = { 0: 0, 1: 1, 3: 2, 2: 3 };
    const pos = grayPosMap[valBits] ?? 0;
    return [{ start: pos, length: 1, wrap: 'none' }];
  }

  // Exactly 1 bit constrained (size 2):
  // Care on bit 1 (MSB of axis)
  if (careBits === 2) {
    if (valBits === 0) return [{ start: 0, length: 2, wrap: 'none' }]; // 00, 01 -> pos 0..1
    return [{ start: 2, length: 2, wrap: 'none' }]; // 11, 10 -> pos 2..3
  }

  // Care on bit 0 (LSB of axis)
  if (valBits === 1) {
    return [{ start: 1, length: 2, wrap: 'none' }]; // 01, 11 -> pos 1..2
  }

  // valBits === 0 -> 00 (pos 0) and 10 (pos 3) -> WRAPS!
  return [
    { start: 0, length: 1, wrap: 'primary' },
    { start: 3, length: 1, wrap: 'secondary' },
  ];
}

/**
 * Decomposes a valid subcube into drawing rectangle pieces in grid coordinates.
 * Handles toroidal wrap-around boundaries (returning 1, 2, or 4 pieces) and 5-variable dual layers.
 */
export function decomposeCubeToRectangles(cube: Cube, varCount: number): readonly KMapOverlayRect[] {
  validateVarCount(varCount);

  const layers: number[] = [0];

  if (varCount === 5) {
    const aCare = getBit(cube.careMask, 4);
    if (aCare === 1) {
      layers[0] = getBit(cube.valueMask, 4);
    } else {
      layers[0] = 0;
      layers.push(1);
    }
  }

  const rowBits = varCount === 2 || varCount === 3 ? 1 : 2;
  const colBits = varCount === 2 ? 1 : 2;

  const rowCare = (cube.careMask >>> colBits) & ((1 << rowBits) - 1);
  const rowVal = (cube.valueMask >>> colBits) & ((1 << rowBits) - 1);

  const colCare = cube.careMask & ((1 << colBits) - 1);
  const colVal = cube.valueMask & ((1 << colBits) - 1);

  const rowIntervals = getAxisIntervals(rowCare, rowVal, rowBits);
  const colIntervals = getAxisIntervals(colCare, colVal, colBits);

  const rects: KMapOverlayRect[] = [];

  for (const layer of layers) {
    for (const rInt of rowIntervals) {
      for (const cInt of colIntervals) {
        let wrap: WrapEdge = 'none';
        const rWrap = rInt.wrap === 'primary' ? 'top' : rInt.wrap === 'secondary' ? 'bottom' : '';
        const cWrap = cInt.wrap === 'primary' ? 'left' : cInt.wrap === 'secondary' ? 'right' : '';

        if (rWrap && cWrap) {
          wrap = `${rWrap}-${cWrap}` as WrapEdge;
        } else if (rWrap) {
          wrap = rWrap as WrapEdge;
        } else if (cWrap) {
          wrap = cWrap as WrapEdge;
        }

        const rectMinterms: number[] = [];
        for (let r = 0; r < rInt.length; r++) {
          for (let c = 0; c < cInt.length; c++) {
            rectMinterms.push(cellAt(rInt.start + r, cInt.start + c, layer, varCount));
          }
        }

        rects.push({
          layer,
          row: rInt.start,
          col: cInt.start,
          width: cInt.length,
          height: rInt.length,
          wrap,
          minterms: rectMinterms,
        });
      }
    }
  }

  return rects;
}
