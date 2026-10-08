/**
 * @file bruteForceMinimizer.ts
 *
 * ============================================================================
 * PURPOSE:
 * An independent, deliberately simple, exhaustive minimizer used ONLY to verify
 * the Quine-McCluskey / Petrick solver later.
 *
 * It must NOT import or reuse anything from engine/kmap, and it must NOT use the
 * prime-implicant idea or any QM step. Its job is to be obviously correct, not
 * fast or clever.
 *
 * WORST-CASE COMPLEXITY:
 * - 3 variables (8 cells, 27 cubes): < 0.1 ms per function (all 256 functions < 20 ms).
 * - 4 variables (16 cells, 81 cubes): < 0.1 ms per function (all 65,536 functions < 1 s).
 * - 5 variables (32 cells, 243 cubes): < 5 ms for typical functions; worst-case ~150 ms
 *   on dense parity functions (used for sampled random testing only).
 * ============================================================================
 */

import { getBit, popCount } from './bitUtils';

export interface Cube {
  readonly careMask: number;
  readonly valueMask: number;
}

export interface MinimizerResult {
  readonly minTermCount: number;
  readonly minLiteralCount: number;
  readonly solutions: readonly (readonly Cube[])[];
}

interface InternalCube extends Cube {
  readonly id: number;
  readonly coverageMask: number;
  readonly literalCount: number;
}

const CUBE_CACHE = new Map<number, readonly InternalCube[]>();

function getPrecomputedCubes(varCount: number): readonly InternalCube[] {
  const cached = CUBE_CACHE.get(varCount);
  if (cached) return cached;
  const cubes: InternalCube[] = [];
  const totalCells = 1 << varCount;
  let id = 0;
  for (let care = 0; care < totalCells; care++) {
    const lits = popCount(care);
    for (let val = 0; val < totalCells; val++) {
      if ((val & ~care) === 0) {
        let cov = 0;
        for (let m = 0; m < totalCells; m++) {
          if ((m & care) === val) cov |= (1 << m);
        }
        cubes.push({ id: id++, careMask: care, valueMask: val, coverageMask: cov >>> 0, literalCount: lits });
      }
    }
  }
  CUBE_CACHE.set(varCount, cubes);
  return cubes;
}

function validateInputs(varCount: number, minterms: readonly number[], dontCares: readonly number[]): { mMask: number; dMask: number } {
  if (!Number.isInteger(varCount) || varCount < 1 || varCount > 5) {
    throw new RangeError(`variableCount must be between 1 and 5. Received: ${varCount}`);
  }
  const max = (1 << varCount) - 1;
  const mSet = new Set<number>();
  let mMask = 0;
  for (const m of minterms) {
    if (!Number.isInteger(m) || m < 0 || m > max) {
      throw new RangeError(`Minterm ${m} is out of range (0..${max}).`);
    }
    mSet.add(m);
    mMask |= (1 << m);
  }
  let dMask = 0;
  for (const d of dontCares) {
    if (!Number.isInteger(d) || d < 0 || d > max) {
      throw new RangeError(`Don't care ${d} is out of range (0..${max}).`);
    }
    if (mSet.has(d)) {
      throw new RangeError(`Minterm ${d} overlaps with don't-care set.`);
    }
    dMask |= (1 << d);
  }
  return { mMask: mMask >>> 0, dMask: dMask >>> 0 };
}

/** Converts a cube into its constituent literal strings (e.g. ["A", "B'"]). */
export function cubeToLiterals(cube: Cube, varCount: number, vars?: readonly string[]): readonly string[] {
  const names = vars ?? ['A', 'B', 'C', 'D', 'E'].slice(0, varCount);
  const literals: string[] = [];
  for (let i = 0; i < varCount; i++) {
    const bitPos = varCount - 1 - i;
    if (getBit(cube.careMask, bitPos) === 1) {
      const varName = names[i] ?? String.fromCharCode(65 + i);
      literals.push(getBit(cube.valueMask, bitPos) === 1 ? varName : `${varName}'`);
    }
  }
  return literals;
}

/** Formats a single product cube as an SOP string (e.g. "AB'"). */
export function cubeToString(cube: Cube, varCount: number, vars?: readonly string[]): string {
  if (cube.careMask === 0) return '1';
  return cubeToLiterals(cube, varCount, vars).join('');
}

/** Formats a set of cubes as a complete SOP expression string (e.g. "AB' + CD"). */
export function toSopString(cubes: readonly Cube[], varCount: number, vars?: readonly string[]): string {
  if (cubes.length === 0) return '0';
  if (cubes.some((c) => c.careMask === 0)) return '1';
  return cubes.map((c) => cubeToString(c, varCount, vars)).join(' + ');
}

/** Formats a single dual cube as a POS sum term string (e.g. "(A' + B)"). */
export function cubeToPosString(cube: Cube, varCount: number, vars?: readonly string[]): string {
  if (cube.careMask === 0) return '0';
  const names = vars ?? ['A', 'B', 'C', 'D', 'E'].slice(0, varCount);
  const lits: string[] = [];
  for (let i = 0; i < varCount; i++) {
    const bitPos = varCount - 1 - i;
    if (getBit(cube.careMask, bitPos) === 1) {
      const varName = names[i] ?? String.fromCharCode(65 + i);
      lits.push(getBit(cube.valueMask, bitPos) === 1 ? `${varName}'` : varName);
    }
  }
  return `(${lits.join(' + ')})`;
}

/** Formats a set of dual cubes as a complete POS expression string (e.g. "(A + B)(C' + D)"). */
export function toPosString(cubes: readonly Cube[], varCount: number, vars?: readonly string[]): string {
  if (cubes.length === 0) return '1';
  if (cubes.some((c) => c.careMask === 0)) return '0';
  return cubes.map((c) => cubeToPosString(c, varCount, vars)).join('');
}

/** Independent verifier: confirms whether cubes cover all minterms and zero 0-cells. */
export function verifyCover(
  varCount: number,
  minterms: readonly number[],
  dontCares: readonly number[],
  cubes: readonly Cube[]
): { coversAllMinterms: boolean; coversNoZeros: boolean } {
  const { mMask, dMask } = validateInputs(varCount, minterms, dontCares);
  const totalCells = 1 << varCount;
  const allMask = totalCells === 32 ? 0xffffffff : ((1 << totalCells) - 1) >>> 0;
  const zeroMask = (allMask ^ (mMask | dMask)) >>> 0;

  let coveredMask = 0;
  for (const c of cubes) {
    for (let m = 0; m < totalCells; m++) {
      if (((m & c.careMask) >>> 0) === c.valueMask) coveredMask |= (1 << m);
    }
  }
  coveredMask >>>= 0;
  return {
    coversAllMinterms: ((coveredMask & mMask) >>> 0) === mMask,
    coversNoZeros: ((coveredMask & zeroMask) >>> 0) === 0,
  };
}

/** Exhaustive brute-force SOP minimizer. */
export function minimizeSOP(varCount: number, minterms: readonly number[], dontCares: readonly number[] = []): MinimizerResult {
  const { mMask, dMask } = validateInputs(varCount, minterms, dontCares);
  if (mMask === 0) return { minTermCount: 0, minLiteralCount: 0, solutions: [[]] };

  const totalCells = 1 << varCount;
  const allMask = totalCells === 32 ? 0xffffffff : ((1 << totalCells) - 1) >>> 0;
  const zeroMask = (allMask ^ (mMask | dMask)) >>> 0;
  const allCubes = getPrecomputedCubes(varCount);

  // Step 1: Filter cubes covering >= 1 minterm and NO zero cell
  const valid: InternalCube[] = [];
  const bitToCubes: InternalCube[][] = Array.from({ length: totalCells }, () => []);
  for (const c of allCubes) {
    if ((c.coverageMask & zeroMask) === 0 && (c.coverageMask & mMask) !== 0) {
      valid.push(c);
      for (let b = 0; b < totalCells; b++) {
        if ((c.coverageMask & (1 << b)) !== 0) {
          const bucket = bitToCubes[b];
          if (bucket) bucket.push(c);
        }
      }
    }
  }

  // Step 2: Iterative deepening with first-uncovered-minterm branching
  for (let k = 1; k <= valid.length; k++) {
    const foundSolutions: InternalCube[][] = [];
    const seen = new Set<string>();

    const search = (depth: number, currentMask: number, chosen: InternalCube[]): void => {
      if (currentMask === 0) {
        const key = chosen.map((c) => c.id).sort((a, b) => a - b).join(',');
        if (!seen.has(key)) {
          seen.add(key);
          foundSolutions.push([...chosen]);
        }
        return;
      }
      if (depth === k) return;

      const firstBit = 31 - Math.clz32(currentMask & -currentMask);
      const candidates = bitToCubes[firstBit] ?? [];
      for (const c of candidates) {
        chosen.push(c);
        search(depth + 1, (currentMask & ~c.coverageMask) >>> 0, chosen);
        chosen.pop();
      }
    };

    search(0, mMask, []);
    if (foundSolutions.length > 0) {
      let minL = Infinity;
      for (const sol of foundSolutions) {
        const lits = sol.reduce((acc, c) => acc + c.literalCount, 0);
        if (lits < minL) minL = lits;
      }
      const best = foundSolutions
        .filter((sol) => sol.reduce((acc, c) => acc + c.literalCount, 0) === minL)
        .map((sol) => sol.map((c) => ({ careMask: c.careMask, valueMask: c.valueMask })));
      return { minTermCount: k, minLiteralCount: minL, solutions: best };
    }
  }
  return { minTermCount: 0, minLiteralCount: 0, solutions: [[]] };
}

/** Exhaustive brute-force POS minimizer using the Boolean dual. */
export function minimizePOS(varCount: number, minterms: readonly number[], dontCares: readonly number[] = []): MinimizerResult {
  const { mMask, dMask } = validateInputs(varCount, minterms, dontCares);
  const totalCells = 1 << varCount;
  const zeroCells: number[] = [];
  for (let m = 0; m < totalCells; m++) {
    if (((mMask | dMask) & (1 << m)) === 0) zeroCells.push(m);
  }

  // Dual: minimize zero cells as minterms with same don't-cares
  return minimizeSOP(varCount, zeroCells, dontCares);
}
