/**
 * @file canonical.ts
 * Canonical Boolean representations: Sum-Of-Products (SOP) and Product-Of-Sums (POS).
 *
 * Provides:
 * - Sigma minterm (Σm) and Pi maxterm (ΠM) indexing and dual conversions.
 * - Structured algebraic term types and formatted text representations.
 * - Bidirectional transformation between canonical forms and AST nodes.
 */

import type {
  BoolNode,
  CanonicalForms,
  CanonicalPos,
  CanonicalSop,
  LiteralTerm,
  ProductTerm,
  SumTerm,
  TruthTable,
} from '../../types/ast';
import { bitsToArray, toBinaryString } from '../common';
import { getDontCares, getMaxterms, getMinterms } from './truthTable';

/**
 * Result structure for Canonical Sum-Of-Products analysis.
 */
export interface CanonicalSopResult extends CanonicalSop {
  /** Formatted Sigma notation (e.g., "Σm(1, 3, 5)" or "Σm(1, 3, 5) + Σd(2)") */
  readonly sigmaM: string;
  /** Expanded algebraic sum-of-products text (e.g., "A'B'C + A'BC + AB'C" or "0") */
  readonly expanded: string;
}

/**
 * Result structure for Canonical Product-Of-Sums analysis.
 */
export interface CanonicalPosResult extends CanonicalPos {
  /** Formatted Pi notation (e.g., "ΠM(0, 2, 4)" or "ΠM(0, 2, 4) + Σd(2)") */
  readonly piM: string;
  /** Expanded algebraic product-of-sums text (e.g., "(A + B + C)(A + B' + C)" or "1") */
  readonly expanded: string;
}

/**
 * Complete canonical formulation including numeric and binary string formats.
 */
export interface CanonicalFormsResult extends CanonicalForms {
  readonly sop: CanonicalSopResult;
  readonly pos: CanonicalPosResult;
  readonly mintermBinaryStrings: readonly string[];
  readonly maxtermBinaryStrings: readonly string[];
  readonly dontCareBinaryStrings: readonly string[];
}

function literalToAst(lit: LiteralTerm): BoolNode {
  const node: BoolNode = { type: 'variable', name: lit.variable };
  return lit.negated ? { type: 'not', child: node } : node;
}

/**
 * Converts a structured canonical SOP or array of ProductTerms into a BoolNode AST.
 *
 * @param sop CanonicalSop instance or array of ProductTerms
 * @returns Equivalent BoolNode AST
 */
export function sopToAst(sop: CanonicalSop | readonly ProductTerm[]): BoolNode {
  const terms: readonly ProductTerm[] = Array.isArray(sop) ? sop : (sop as CanonicalSop).terms;
  if (terms.length === 0) return { type: 'constant', value: 0 };

  const termToAst = (term: ProductTerm): BoolNode => {
    if (term.literals.length === 0) return { type: 'constant', value: 1 };
    const firstLit = term.literals[0];
    if (term.literals.length === 1 && firstLit !== undefined) {
      return literalToAst(firstLit);
    }
    return { type: 'and', children: term.literals.map(literalToAst) };
  };

  const firstTerm = terms[0];
  return terms.length === 1 && firstTerm !== undefined
    ? termToAst(firstTerm)
    : { type: 'or', children: terms.map(termToAst) };
}

/**
 * Converts a structured canonical POS or array of SumTerms into a BoolNode AST.
 *
 * @param pos CanonicalPos instance or array of SumTerms
 * @returns Equivalent BoolNode AST
 */
export function posToAst(pos: CanonicalPos | readonly SumTerm[]): BoolNode {
  const terms: readonly SumTerm[] = Array.isArray(pos) ? pos : (pos as CanonicalPos).terms;
  if (terms.length === 0) return { type: 'constant', value: 1 };

  const termToAst = (term: SumTerm): BoolNode => {
    if (term.literals.length === 0) return { type: 'constant', value: 0 };
    const firstLit = term.literals[0];
    if (term.literals.length === 1 && firstLit !== undefined) {
      return literalToAst(firstLit);
    }
    return { type: 'or', children: term.literals.map(literalToAst) };
  };

  const firstTerm = terms[0];
  return terms.length === 1 && firstTerm !== undefined
    ? termToAst(firstTerm)
    : { type: 'and', children: terms.map(termToAst) };
}

/**
 * Constructs canonical Sum-Of-Products representation from a truth table.
 *
 * @param table Truth table instance
 * @returns CanonicalSopResult with structured terms, AST, Sigma notation, and expanded string
 */
export function canonicalSOP(table: TruthTable): CanonicalSopResult {
  const minterms = getMinterms(table);
  const dontCares = getDontCares(table);
  const vars = table.variables;
  const n = vars.length;

  const terms: ProductTerm[] = minterms.map((m) => {
    const bits = bitsToArray(m, n);
    const literals: LiteralTerm[] = vars.map((v, i) => ({
      variable: v,
      negated: bits[i] === 0,
    }));
    return { literals, mintermIndex: m };
  });

  const sigmaM = `Σm(${minterms.join(', ')})${dontCares.length > 0 ? ` + Σd(${dontCares.join(', ')})` : ''}`;
  const expanded =
    terms.length === 0
      ? '0'
      : terms.map((t) => t.literals.map((l) => (l.negated ? `${l.variable}'` : l.variable)).join('')).join(' + ');

  return { terms, minterms, dontCares, expression: sopToAst(terms), sigmaM, expanded };
}

/**
 * Constructs canonical Product-Of-Sums representation from a truth table.
 *
 * @param table Truth table instance
 * @returns CanonicalPosResult with structured terms, AST, Pi notation, and expanded string
 */
export function canonicalPOS(table: TruthTable): CanonicalPosResult {
  const maxterms = getMaxterms(table);
  const dontCares = getDontCares(table);
  const vars = table.variables;
  const n = vars.length;

  const terms: SumTerm[] = maxterms.map((M) => {
    const bits = bitsToArray(M, n);
    const literals: LiteralTerm[] = vars.map((v, i) => ({
      variable: v,
      negated: bits[i] === 1,
    }));
    return { literals, maxtermIndex: M };
  });

  const piM = `ΠM(${maxterms.join(', ')})${dontCares.length > 0 ? ` + Σd(${dontCares.join(', ')})` : ''}`;
  const expanded =
    terms.length === 0
      ? '1'
      : terms.map((t) => `(${t.literals.map((l) => (l.negated ? `${l.variable}'` : l.variable)).join(' + ')})`).join('');

  return { terms, maxterms, dontCares, expression: posToAst(terms), piM, expanded };
}

/**
 * Converts a list of minterms to the complementary maxterm list.
 *
 * @param minterms Ascending array of minterm decimal indices
 * @param variableCount Number of Boolean variables
 * @param dontCares Optional array of don't-care indices to exclude from maxterms
 * @returns Complementary array of maxterm indices
 */
export function mintermListToMaxtermList(
  minterms: readonly number[],
  variableCount: number,
  dontCares: readonly number[] = []
): number[] {
  const total = Math.pow(2, variableCount);
  const minSet = new Set(minterms);
  const dcSet = new Set(dontCares);
  const maxterms: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!minSet.has(i) && !dcSet.has(i)) maxterms.push(i);
  }
  return maxterms;
}

/**
 * Converts a list of maxterms to the complementary minterm list.
 *
 * @param maxterms Ascending array of maxterm decimal indices
 * @param variableCount Number of Boolean variables
 * @param dontCares Optional array of don't-care indices to exclude from minterms
 * @returns Complementary array of minterm indices
 */
export function maxtermListToMintermList(
  maxterms: readonly number[],
  variableCount: number,
  dontCares: readonly number[] = []
): number[] {
  const total = Math.pow(2, variableCount);
  const maxSet = new Set(maxterms);
  const dcSet = new Set(dontCares);
  const minterms: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!maxSet.has(i) && !dcSet.has(i)) minterms.push(i);
  }
  return minterms;
}

/**
 * Converts decimal minterm/maxterm indices into zero-padded binary strings.
 *
 * @param indices Array of decimal indices
 * @param variableCount Number of Boolean variables
 * @returns Array of binary strings
 */
export function indicesToBinaryStrings(indices: readonly number[], variableCount: number): string[] {
  return indices.map((idx) => toBinaryString(idx, variableCount));
}

/**
 * Computes complete canonical representations (SOP, POS, indices, and binary strings).
 *
 * @param table Truth table instance
 * @returns Complete CanonicalFormsResult
 */
export function canonicalForms(table: TruthTable): CanonicalFormsResult {
  const sop = canonicalSOP(table);
  const pos = canonicalPOS(table);
  const n = table.variables.length;

  return {
    minterms: sop.minterms,
    maxterms: pos.maxterms,
    dontCares: sop.dontCares,
    sop,
    pos,
    mintermBinaryStrings: indicesToBinaryStrings(sop.minterms, n),
    maxtermBinaryStrings: indicesToBinaryStrings(pos.maxterms, n),
    dontCareBinaryStrings: indicesToBinaryStrings(sop.dontCares, n),
  };
}
