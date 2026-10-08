/**
 * @file solverHelpers.ts
 * Helper utilities for input validation, deterministic tie-breaking,
 * and AST construction for the K-map solver.
 */

import type { BoolNode, LiteralTerm, ProductTerm, SumTerm } from '../../types/ast';
import { posToAst, sopToAst } from '../boolean/canonical';
import { cubeToSumString } from './primeImplicants';
import type { PrimeImplicant } from './primeImplicants';
import type { KMapInputError, MinimalCover } from './types';

/**
 * Validates solver user inputs against variable range and disjointness constraints.
 */
export function validateInputs(
  varCount: number,
  minterms: readonly number[],
  dontCares: readonly number[]
): KMapInputError | null {
  if (!Number.isInteger(varCount) || varCount < 2 || varCount > 5) {
    return {
      code: 'INVALID_VARIABLE_COUNT',
      message: `variableCount must be an integer between 2 and 5. Received: ${varCount}`,
    };
  }
  const max = (1 << varCount) - 1;
  const mSet = new Set<number>();
  for (const m of minterms) {
    if (!Number.isInteger(m) || m < 0 || m > max) {
      return { code: 'OUT_OF_RANGE', message: `Minterm ${m} is out of range (0..${max}).` };
    }
    mSet.add(m);
  }
  for (const d of dontCares) {
    if (!Number.isInteger(d) || d < 0 || d > max) {
      return { code: 'OUT_OF_RANGE', message: `Don't-care ${d} is out of range (0..${max}).` };
    }
    if (mSet.has(d)) {
      return { code: 'OVERLAPPING_DONT_CARES', message: `Minterm ${d} overlaps with don't-care set.` };
    }
  }
  return null;
}

/**
 * Deterministically selects the primary minimal cover from all candidate covers.
 * Criteria:
 * 1. Fewest product terms.
 * 2. Fewest total literals.
 * 3. Lexicographically smallest joined expression string.
 */
export function selectPrimaryCover(
  covers: readonly (readonly PrimeImplicant[])[],
  varCount: number,
  varNames: readonly string[],
  form: 'SOP' | 'POS'
): MinimalCover {
  const formatted = covers.map((pis) => {
    const sortedPis = [...pis].sort((a, b) => a.termString.localeCompare(b.termString));
    const termCount = sortedPis.length;
    const literalCount = sortedPis.reduce((acc, p) => acc + p.literalCount, 0);
    const exprString =
      form === 'SOP'
        ? termCount === 0
          ? '0'
          : sortedPis.some((p) => p.cube.careMask === 0)
          ? '1'
          : sortedPis.map((p) => p.termString).join(' + ')
        : termCount === 0
        ? '1'
        : sortedPis.some((p) => p.cube.careMask === 0)
        ? '0'
        : sortedPis.map((p) => cubeToSumString(p.cube, varCount, varNames)).join('');

    return {
      primeImplicants: sortedPis,
      termCount,
      literalCount,
      expressionString: exprString,
    };
  });

  formatted.sort((a, b) => {
    if (a.termCount !== b.termCount) return a.termCount - b.termCount;
    if (a.literalCount !== b.literalCount) return a.literalCount - b.literalCount;
    return a.expressionString.localeCompare(b.expressionString);
  });

  return (
    formatted[0] ?? {
      primeImplicants: [],
      termCount: 0,
      literalCount: 0,
      expressionString: form === 'SOP' ? '0' : '1',
    }
  );
}

/**
 * Converts a MinimalCover of prime implicants into a Sum-Of-Products BoolNode AST.
 */
export function coverToSopAst(cover: MinimalCover, varCount: number, varNames: readonly string[]): BoolNode {
  if (cover.primeImplicants.length === 0) return { type: 'constant', value: 0 };
  if (cover.primeImplicants.some((p) => p.cube.careMask === 0)) return { type: 'constant', value: 1 };

  const productTerms: ProductTerm[] = cover.primeImplicants.map((pi) => {
    const literals: LiteralTerm[] = [];
    for (let i = 0; i < varCount; i++) {
      const bitPos = varCount - 1 - i;
      if (((pi.cube.careMask >>> bitPos) & 1) === 1) {
        const isOne = ((pi.cube.valueMask >>> bitPos) & 1) === 1;
        literals.push({
          variable: varNames[i] ?? String.fromCharCode(65 + i),
          negated: !isOne,
        });
      }
    }
    return { literals };
  });

  return sopToAst(productTerms);
}

/**
 * Converts a MinimalCover of dual implicants into a Product-Of-Sums BoolNode AST.
 */
export function coverToPosAst(cover: MinimalCover, varCount: number, varNames: readonly string[]): BoolNode {
  if (cover.primeImplicants.length === 0) return { type: 'constant', value: 1 };
  if (cover.primeImplicants.some((p) => p.cube.careMask === 0)) return { type: 'constant', value: 0 };

  const sumTerms: SumTerm[] = cover.primeImplicants.map((pi) => {
    const literals: LiteralTerm[] = [];
    for (let i = 0; i < varCount; i++) {
      const bitPos = varCount - 1 - i;
      if (((pi.cube.careMask >>> bitPos) & 1) === 1) {
        const isOne = ((pi.cube.valueMask >>> bitPos) & 1) === 1;
        literals.push({
          variable: varNames[i] ?? String.fromCharCode(65 + i),
          negated: isOne,
        });
      }
    }
    return { literals };
  });

  return posToAst(sumTerms);
}
