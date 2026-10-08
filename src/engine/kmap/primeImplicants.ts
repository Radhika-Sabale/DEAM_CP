/**
 * @file primeImplicants.ts
 * Prime implicant chart construction and iterative reduction.
 *
 * Implements:
 * - Identification of prime implicant properties (literals, coverage, algebraic term string).
 * - Prime implicant chart creation (rows = PIs, columns = required minterms only).
 * - Iterative extraction of Essential Prime Implicants (EPIs).
 * - Iterative reduction via row dominance and column dominance.
 * - Extraction of the cyclic core when reductions cannot proceed further.
 */

import { popCount } from '../common/bitUtils';
import type { Cube } from './layout';
import type { QmResult } from './quineMcCluskey';

/**
 * Prime implicant with literal count, coverage details, and algebraic string.
 */
export interface PrimeImplicant {
  readonly id: string;
  readonly cube: Cube;
  readonly minterms: readonly number[];
  readonly requiredMinterms: readonly number[];
  readonly literalCount: number;
  readonly termString: string;
}

/**
 * Prime implicant chart structure.
 */
export interface PiChart {
  readonly primeImplicants: readonly PrimeImplicant[];
  readonly minterms: readonly number[];
  readonly matrix: readonly (readonly boolean[])[];
}

/**
 * Step in the iterative reduction of the PI chart.
 */
export type ReductionStep =
  | {
      readonly type: 'essential';
      readonly pi: PrimeImplicant;
      readonly coveredMinterms: readonly number[];
      readonly reason: string;
    }
  | {
      readonly type: 'rowDominance';
      readonly removedPi: PrimeImplicant;
      readonly dominatingPi: PrimeImplicant;
      readonly reason: string;
    }
  | {
      readonly type: 'colDominance';
      readonly removedMinterm: number;
      readonly dominatingMinterm: number;
      readonly reason: string;
    };

/**
 * Unresolvable chart remnant requiring Petrick's branch-and-bound or algebraic expansion.
 */
export interface CyclicCore {
  readonly primeImplicants: readonly PrimeImplicant[];
  readonly minterms: readonly number[];
  readonly matrix: readonly (readonly boolean[])[];
}

/**
 * Outcome of the complete chart reduction process.
 */
export interface ChartReductionResult {
  readonly initialChart: PiChart;
  readonly essentialPrimeImplicants: readonly PrimeImplicant[];
  readonly reductionSteps: readonly ReductionStep[];
  readonly cyclicCore: CyclicCore | null;
}

/**
 * Converts a cube to a product term string (e.g. "A'BD'").
 * For careMask === 0, returns "1".
 */
export function cubeToProductString(
  cube: Cube,
  varCount: number,
  varNames?: readonly string[]
): string {
  if (cube.careMask === 0) return '1';
  const names = varNames ?? ['A', 'B', 'C', 'D', 'E'].slice(0, varCount);
  let result = '';
  for (let i = 0; i < varCount; i++) {
    const bitPos = varCount - 1 - i;
    if (((cube.careMask >>> bitPos) & 1) === 1) {
      const v = names[i] ?? String.fromCharCode(65 + i);
      const isOne = ((cube.valueMask >>> bitPos) & 1) === 1;
      result += isOne ? v : `${v}'`;
    }
  }
  return result;
}

/**
 * Converts a cube to a sum term string (e.g. "(A + B' + D)").
 * For careMask === 0, returns "0".
 */
export function cubeToSumString(
  cube: Cube,
  varCount: number,
  varNames?: readonly string[]
): string {
  if (cube.careMask === 0) return '0';
  const names = varNames ?? ['A', 'B', 'C', 'D', 'E'].slice(0, varCount);
  const literals: string[] = [];
  for (let i = 0; i < varCount; i++) {
    const bitPos = varCount - 1 - i;
    if (((cube.careMask >>> bitPos) & 1) === 1) {
      const v = names[i] ?? String.fromCharCode(65 + i);
      const isOne = ((cube.valueMask >>> bitPos) & 1) === 1;
      // In POS, value 1 is negated (A'), value 0 is unnegated (A)
      literals.push(isOne ? `${v}'` : v);
    }
  }
  return `(${literals.join(' + ')})`;
}

/**
 * Builds the list of enriched PrimeImplicant records from a Quine-McCluskey result.
 */
export function extractPrimeImplicants(
  qmResult: QmResult,
  varCount: number,
  requiredMinterms: readonly number[],
  varNames?: readonly string[]
): readonly PrimeImplicant[] {
  const reqSet = new Set(requiredMinterms);
  return qmResult.primeImplicants.map((imp) => {
    const coveredReq = imp.minterms.filter((m) => reqSet.has(m)).sort((a, b) => a - b);
    return {
      id: imp.id,
      cube: imp.cube,
      minterms: imp.minterms,
      requiredMinterms: coveredReq,
      literalCount: popCount(imp.cube.careMask),
      termString: cubeToProductString(imp.cube, varCount, varNames),
    };
  });
}

/**
 * Builds the initial Prime Implicant chart.
 */
export function buildPiChart(
  primeImplicants: readonly PrimeImplicant[],
  requiredMinterms: readonly number[]
): PiChart {
  const sortedMinterms = Array.from(new Set(requiredMinterms)).sort((a, b) => a - b);
  const matrix: boolean[][] = [];

  for (const pi of primeImplicants) {
    const row: boolean[] = [];
    for (const m of sortedMinterms) {
      row.push(((m & pi.cube.careMask) >>> 0) === pi.cube.valueMask);
    }
    matrix.push(row);
  }

  return {
    primeImplicants,
    minterms: sortedMinterms,
    matrix,
  };
}

/**
 * Iteratively reduces the Prime Implicant chart by extracting essential prime implicants,
 * applying row dominance, and applying column dominance.
 */
export function reducePiChart(initialChart: PiChart): ChartReductionResult {
  const essentialPrimeImplicants: PrimeImplicant[] = [];
  const reductionSteps: ReductionStep[] = [];

  let activePis = [...initialChart.primeImplicants];
  let activeMinterms = [...initialChart.minterms];

  // Helper to determine if PI covers minterm
  const covers = (pi: PrimeImplicant, m: number): boolean =>
    ((m & pi.cube.careMask) >>> 0) === pi.cube.valueMask;

  let changed = true;

  while (changed && activeMinterms.length > 0 && activePis.length > 0) {
    changed = false;

    // Step 1: Look for Essential Prime Implicants
    const essentialsFoundThisRound: PrimeImplicant[] = [];
    for (const m of activeMinterms) {
      const covering = activePis.filter((pi) => covers(pi, m));
      if (covering.length === 1) {
        const epi = covering[0];
        if (epi && !essentialsFoundThisRound.some((x) => x.id === epi.id)) {
          essentialsFoundThisRound.push(epi);
          reductionSteps.push({
            type: 'essential',
            pi: epi,
            coveredMinterms: activeMinterms.filter((rem) => covers(epi, rem)),
            reason: `Minterm ${m} is uniquely covered by prime implicant ${epi.termString}`,
          });
        }
      }
    }

    if (essentialsFoundThisRound.length > 0) {
      for (const epi of essentialsFoundThisRound) {
        essentialPrimeImplicants.push(epi);
        activePis = activePis.filter((pi) => pi.id !== epi.id);
        activeMinterms = activeMinterms.filter((m) => !covers(epi, m));
      }
      changed = true;
      continue;
    }

    // Step 2: Row Dominance
    // PI A is dominated by PI B if B covers a superset of A's active minterms
    // and cost(B) <= cost(A), or covers the same minterms with strictly lower cost.
    let rowRemoved = false;
    for (let i = 0; i < activePis.length; i++) {
      const piA = activePis[i];
      if (!piA) continue;
      const covA = activeMinterms.filter((m) => covers(piA, m));

      for (let j = 0; j < activePis.length; j++) {
        if (i === j) continue;
        const piB = activePis[j];
        if (!piB) continue;
        const covB = activeMinterms.filter((m) => covers(piB, m));

        // Does B cover all active minterms of A?
        const bCoversAllA = covA.every((m) => covB.includes(m));
        if (bCoversAllA) {
          const strictlyMoreCov = covB.length > covA.length;
          const strictlyLowerCost = piB.literalCount < piA.literalCount;
          const sameCost = piB.literalCount === piA.literalCount;

          if ((strictlyMoreCov && (sameCost || strictlyLowerCost)) || (!strictlyMoreCov && strictlyLowerCost)) {
            reductionSteps.push({
              type: 'rowDominance',
              removedPi: piA,
              dominatingPi: piB,
              reason: `PI ${piA.termString} is dominated by ${piB.termString}`,
            });
            activePis.splice(i, 1);
            rowRemoved = true;
            changed = true;
            break;
          }
        }
      }
      if (rowRemoved) break;
    }

    if (changed) continue;

    // Step 3: Column Dominance
    // Minterm col 2 dominates col 1 if every PI covering col 1 also covers col 2.
    // If so, col 2 imposes no extra constraints and can be removed.
    let colRemoved = false;
    for (let i = 0; i < activeMinterms.length; i++) {
      const m1 = activeMinterms[i];
      if (m1 === undefined) continue;
      const pis1 = activePis.filter((pi) => covers(pi, m1));

      for (let j = 0; j < activeMinterms.length; j++) {
        if (i === j) continue;
        const m2 = activeMinterms[j];
        if (m2 === undefined) continue;
        const pis2 = activePis.filter((pi) => covers(pi, m2));

        // Every PI covering m1 also covers m2
        const pis1SubsetOfPis2 = pis1.every((pi) => pis2.some((p) => p.id === pi.id));
        if (pis1SubsetOfPis2) {
          // If identical, only remove if j > i to avoid removing both
          if (pis1.length === pis2.length && j < i) {
            continue;
          }
          reductionSteps.push({
            type: 'colDominance',
            removedMinterm: m2,
            dominatingMinterm: m1,
            reason: `Minterm ${m2} dominates minterm ${m1} (all PIs covering ${m1} also cover ${m2})`,
          });
          activeMinterms.splice(j, 1);
          colRemoved = true;
          changed = true;
          break;
        }
      }
      if (colRemoved) break;
    }
  }

  const cyclicCore: CyclicCore | null =
    activeMinterms.length > 0 && activePis.length > 0
      ? {
          primeImplicants: activePis,
          minterms: activeMinterms,
          matrix: activePis.map((pi) => activeMinterms.map((m) => covers(pi, m))),
        }
      : null;

  return {
    initialChart,
    essentialPrimeImplicants,
    reductionSteps,
    cyclicCore,
  };
}
