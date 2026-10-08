/**
 * @file petrick.ts
 * Petrick's method for finding all minimal sum-of-products covers
 * from a cyclic core or prime implicant chart.
 *
 * Implements:
 * - Product-of-sums formulation where each required minterm forms a sum clause of covering PIs.
 * - Expansion to sum-of-products with absorption (A + AB = A) and idempotence at every step.
 * - BigInt bitset representation of product terms for high speed and arbitrary PI counts.
 * - Safety cap guarding against exponential intermediate term blow-up.
 * - Selection of all minimal covers ranked by fewest terms, then fewest literals.
 */

import { popCount } from '../common/bitUtils';
import type { PrimeImplicant } from './primeImplicants';

export const DEFAULT_MAX_INTERMEDIATE_TERMS = 100_000;

/**
 * Diagnostic step recording the algebraic expansion of Petrick's product.
 */
export interface PetrickExpansionStep {
  readonly stepIndex: number;
  readonly minterm: number;
  readonly coveringPiIndices: readonly number[];
  readonly termCountAfterStep: number;
}

/**
 * Successful result of Petrick's minimization method.
 */
export interface PetrickSuccess {
  readonly ok: true;
  readonly steps: readonly PetrickExpansionStep[];
  readonly minimalCovers: readonly (readonly PrimeImplicant[])[];
  readonly minTermCount: number;
  readonly minLiteralCount: number;
}

/**
 * Failure result when the expansion exceeds the intermediate term cap.
 */
export interface PetrickTooComplex {
  readonly ok: false;
  readonly reason: 'EXCEEDED_TERM_CAP';
  readonly termCap: number;
}

export type PetrickResult = PetrickSuccess | PetrickTooComplex;

/**
 * Counts set bits in a BigInt bitset.
 */
function countBigIntBits(n: bigint): number {
  let count = 0;
  let temp = n;
  while (temp > 0n) {
    count += popCount(Number(temp & 0xffffffffn));
    temp >>= 32n;
  }
  return count;
}

/**
 * Reduces a collection of terms using the absorption law: A + AB = A.
 * When sorted ascending by population count, earlier terms can absorb later terms,
 * but later terms can never absorb earlier terms.
 */
function absorbTerms(terms: readonly bigint[]): bigint[] {
  if (terms.length <= 1) return [...terms];

  const sorted = [...terms].sort((a, b) => countBigIntBits(a) - countBigIntBits(b));
  const result: bigint[] = [];

  for (const t of sorted) {
    let absorbed = false;
    for (const r of result) {
      if ((r & t) === r) {
        absorbed = true;
        break;
      }
    }
    if (!absorbed) {
      result.push(t);
    }
  }
  return result;
}

/**
 * Solves a prime implicant chart (typically a cyclic core) using Petrick's method.
 *
 * @param primeImplicants Available prime implicants
 * @param minterms Required minterms to be covered
 * @param maxIntermediateTerms Maximum intermediate terms before returning 'too complex'
 * @returns All minimal covers or failure indication
 */
export function solvePetrick(
  primeImplicants: readonly PrimeImplicant[],
  minterms: readonly number[],
  maxIntermediateTerms = DEFAULT_MAX_INTERMEDIATE_TERMS
): PetrickResult {
  if (minterms.length === 0) {
    return {
      ok: true,
      steps: [],
      minimalCovers: [[]],
      minTermCount: 0,
      minLiteralCount: 0,
    };
  }

  if (primeImplicants.length === 0) {
    return {
      ok: true,
      steps: [],
      minimalCovers: [],
      minTermCount: 0,
      minLiteralCount: 0,
    };
  }

  // Pre-calculate which PIs cover which minterm
  const clauses: { minterm: number; piIndices: number[]; clauseMask: bigint }[] = [];
  for (const m of minterms) {
    const indices: number[] = [];
    let mask = 0n;
    for (let i = 0; i < primeImplicants.length; i++) {
      const pi = primeImplicants[i];
      if (pi && ((m & pi.cube.careMask) >>> 0) === pi.cube.valueMask) {
        indices.push(i);
        mask |= 1n << BigInt(i);
      }
    }
    if (indices.length === 0) {
      // Uncoverable minterm
      return {
        ok: true,
        steps: [],
        minimalCovers: [],
        minTermCount: 0,
        minLiteralCount: 0,
      };
    }
    clauses.push({ minterm: m, piIndices: indices, clauseMask: mask });
  }

  // Sort clauses by number of covering PIs ascending (fail-fast / smallest branching first)
  clauses.sort((a, b) => a.piIndices.length - b.piIndices.length);

  const steps: PetrickExpansionStep[] = [];
  let currentTerms: bigint[] = [];

  for (let s = 0; s < clauses.length; s++) {
    const clause = clauses[s];
    if (!clause) continue;

    if (s === 0) {
      currentTerms = clause.piIndices.map((idx) => 1n << BigInt(idx));
      steps.push({
        stepIndex: 0,
        minterm: clause.minterm,
        coveringPiIndices: clause.piIndices,
        termCountAfterStep: currentTerms.length,
      });
      continue;
    }

    // Multiply current terms by clause (sum of PIs)
    const nextTerms: bigint[] = [];
    const alreadyCovered: bigint[] = [];
    const needExpansion: bigint[] = [];

    for (const t of currentTerms) {
      if ((t & clause.clauseMask) !== 0n) {
        alreadyCovered.push(t);
      } else {
        needExpansion.push(t);
      }
    }

    for (const t of needExpansion) {
      for (const idx of clause.piIndices) {
        nextTerms.push(t | (1n << BigInt(idx)));
      }
      if (alreadyCovered.length + nextTerms.length > maxIntermediateTerms) {
        return {
          ok: false,
          reason: 'EXCEEDED_TERM_CAP',
          termCap: maxIntermediateTerms,
        };
      }
    }

    currentTerms = absorbTerms([...alreadyCovered, ...nextTerms]);

    if (currentTerms.length > maxIntermediateTerms) {
      return {
        ok: false,
        reason: 'EXCEEDED_TERM_CAP',
        termCap: maxIntermediateTerms,
      };
    }

    steps.push({
      stepIndex: s,
      minterm: clause.minterm,
      coveringPiIndices: clause.piIndices,
      termCountAfterStep: currentTerms.length,
    });
  }

  if (currentTerms.length === 0) {
    return {
      ok: true,
      steps,
      minimalCovers: [],
      minTermCount: 0,
      minLiteralCount: 0,
    };
  }

  // Convert bigint bitsets back to PrimeImplicant lists and compute cost
  interface Candidate {
    readonly pis: readonly PrimeImplicant[];
    readonly termCount: number;
    readonly literalCount: number;
  }

  const candidates: Candidate[] = currentTerms.map((term) => {
    const pis: PrimeImplicant[] = [];
    let lits = 0;
    for (let i = 0; i < primeImplicants.length; i++) {
      if ((term & (1n << BigInt(i))) !== 0n) {
        const pi = primeImplicants[i];
        if (pi) {
          pis.push(pi);
          lits += pi.literalCount;
        }
      }
    }
    return {
      pis,
      termCount: pis.length,
      literalCount: lits,
    };
  });

  let minTerms = Infinity;
  for (const c of candidates) {
    if (c.termCount < minTerms) {
      minTerms = c.termCount;
    }
  }

  const termFiltered = candidates.filter((c) => c.termCount === minTerms);
  let minLiterals = Infinity;
  for (const c of termFiltered) {
    if (c.literalCount < minLiterals) {
      minLiterals = c.literalCount;
    }
  }

  const optimal = termFiltered.filter((c) => c.literalCount === minLiterals);
  const minimalCovers = optimal.map((c) => c.pis);

  return {
    ok: true,
    steps,
    minimalCovers,
    minTermCount: minTerms,
    minLiteralCount: minLiterals,
  };
}
