/**
 * @file verifyStepEquation.ts
 * Verifier for next-state and output Boolean equations (Stage 10C).
 */

import type { BoolNode, LogicValue } from '../../types/ast';
import { evaluateBinary } from '../boolean/evaluator';
import { parse } from '../boolean/parser';
import { solveSOP } from '../kmap/solver';
import type { EquationVerificationResult } from './verifyStepTypes';

function extractVariables(node: BoolNode): Set<string> {
  const vars = new Set<string>();
  function walk(n: BoolNode): void {
    if (n.type === 'variable') {
      vars.add(n.name);
    } else if (n.type === 'not') {
      walk(n.child);
    } else if (n.type === 'and' || n.type === 'or') {
      for (const c of n.children) {
        walk(c);
      }
    } else if (n.type === 'xor' || n.type === 'xnor' || n.type === 'nand' || n.type === 'nor') {
      walk(n.left);
      walk(n.right);
    }
  }
  walk(node);
  return vars;
}

function countLiterals(node: BoolNode): number {
  if (node.type === 'constant') return 0;
  if (node.type === 'variable') return 1;
  if (node.type === 'not') return countLiterals(node.child);
  if (node.type === 'and' || node.type === 'or') {
    return node.children.reduce((sum, c) => sum + countLiterals(c), 0);
  }
  if (node.type === 'xor' || node.type === 'xnor' || node.type === 'nand' || node.type === 'nor') {
    return countLiterals(node.left) + countLiterals(node.right);
  }
  return 1;
}

function calculateCost(node: BoolNode): { terms: number; literals: number } {
  if (node.type === 'constant') return { terms: 0, literals: 0 };
  if (node.type === 'variable' || node.type === 'not') return { terms: 1, literals: countLiterals(node) };

  if (node.type === 'or') {
    const terms = node.children;
    const literals = terms.reduce((sum, t) => sum + countLiterals(t), 0);
    return { terms: terms.length, literals };
  }

  if (node.type === 'and') {
    return { terms: 1, literals: countLiterals(node) };
  }

  return { terms: 1, literals: countLiterals(node) };
}

function parseAndEvaluateEquation(
  text: string,
  variables: readonly string[]
): {
  readonly ast: BoolNode | null;
  readonly unknownVars: readonly string[];
  readonly parseError?: string;
  readonly evaluator: ((env: Record<string, 0 | 1>) => 0 | 1) | null;
} {
  const clean = text.trim();
  if (!clean) return { ast: null, unknownVars: [], parseError: 'Expression is empty', evaluator: null };

  const singleCharVars = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const varMap = new Map<string, string>();
  const reverseVarMap = new Map<string, string>();

  variables.forEach((v, i) => {
    const alias = singleCharVars[i] ?? `V${i}`;
    varMap.set(v, alias);
    reverseVarMap.set(alias, v);
  });

  const sortedVars = [...variables].sort((a, b) => b.length - a.length);
  let aliasedText = clean;
  for (const v of sortedVars) {
    const alias = varMap.get(v);
    if (alias) {
      const regex = new RegExp(`\\b${v}\\b`, 'g');
      aliasedText = aliasedText.replace(regex, alias);
    }
  }

  const parseRes = parse(aliasedText);
  if (!parseRes.ok) {
    return { ast: null, unknownVars: [], parseError: parseRes.error.message, evaluator: null };
  }

  const ast = parseRes.ast;
  const usedAliasedVars = extractVariables(ast);
  const unknownVars: string[] = [];

  for (const u of usedAliasedVars) {
    if (!reverseVarMap.has(u)) {
      unknownVars.push(u);
    }
  }

  if (unknownVars.length > 0) {
    return { ast, unknownVars, evaluator: null };
  }

  const evaluator = (env: Record<string, 0 | 1>) => {
    const aliasedEnv: Record<string, 0 | 1> = {};
    for (const [realVar, val] of Object.entries(env)) {
      const alias = varMap.get(realVar);
      if (alias) aliasedEnv[alias] = val;
    }
    return evaluateBinary(ast, aliasedEnv);
  };

  return { ast, unknownVars: [], evaluator };
}

/**
 * Verifies a student Boolean equation submission against a function column with don't-cares.
 */
export function verifyEquation(
  text: string,
  functionColumn: readonly LogicValue[],
  variables: readonly string[]
): EquationVerificationResult {
  const minterms: number[] = [];
  const dontCares: number[] = [];

  for (let i = 0; i < functionColumn.length; i++) {
    const v = functionColumn[i];
    if (v === 1) minterms.push(i);
    else if (v === 'X') dontCares.push(i);
  }

  let solverCost = { terms: 1, literals: 1 };
  if (minterms.length === 0) {
    solverCost = { terms: 0, literals: 0 };
  } else if (minterms.length + dontCares.length === functionColumn.length) {
    solverCost = { terms: 1, literals: 0 };
  } else {
    const solverRes = solveSOP(variables.length, minterms, dontCares, variables);
    if (solverRes.ok) {
      solverCost = {
        terms: solverRes.solution.primarySolution.termCount,
        literals: solverRes.solution.primarySolution.literalCount,
      };
    }
  }

  const parsed = parseAndEvaluateEquation(text, variables);
  if (parsed.parseError) {
    return {
      correct: false,
      isMinimal: false,
      cost: { terms: 0, literals: 0 },
      solverCost,
      mismatchRows: [],
      unknownVariables: [],
      parseError: parsed.parseError,
      message: `Syntax error in equation: ${parsed.parseError}`,
    };
  }

  if (parsed.unknownVars.length > 0) {
    return {
      correct: false,
      isMinimal: false,
      cost: { terms: 0, literals: 0 },
      solverCost,
      mismatchRows: [],
      unknownVariables: parsed.unknownVars,
      message: `Unknown variable(s): ${parsed.unknownVars.join(', ')}`,
    };
  }

  if (!parsed.evaluator || !parsed.ast) {
    return {
      correct: false,
      isMinimal: false,
      cost: { terms: 0, literals: 0 },
      solverCost,
      mismatchRows: [],
      unknownVariables: [],
      message: 'Failed to construct evaluator',
    };
  }

  const mismatchRows: number[] = [];
  const numRows = 1 << variables.length;

  for (let i = 0; i < numRows; i++) {
    const expected = functionColumn[i];
    if (expected === 'X') continue;

    const env: Record<string, 0 | 1> = {};
    for (let bit = 0; bit < variables.length; bit++) {
      const varName = variables[bit];
      if (varName !== undefined) {
        const bitVal = (i >> (variables.length - 1 - bit)) & 1;
        env[varName] = bitVal as 0 | 1;
      }
    }

    const evaluated = parsed.evaluator(env);
    const expectedNum = expected === 1 ? 1 : 0;
    if (evaluated !== expectedNum) {
      mismatchRows.push(i);
    }
  }

  const cost = calculateCost(parsed.ast);
  const correct = mismatchRows.length === 0;
  const isMinimal = correct &&
    (cost.terms < solverCost.terms ||
     (cost.terms === solverCost.terms && cost.literals <= solverCost.literals));

  let message: string | undefined = undefined;
  if (!correct) {
    message = `Equation fails on ${mismatchRows.length} care row(s) (first mismatch at row index ${mismatchRows[0]})`;
  } else if (!isMinimal) {
    const termDiff = cost.terms - solverCost.terms;
    const litDiff = cost.literals - solverCost.literals;
    message = `Equation is valid on all care rows but non-minimal (${termDiff > 0 ? `${termDiff} extra terms, ` : ''}${litDiff} extra literals compared to minimal cover)`;
  }

  return {
    correct,
    isMinimal,
    cost,
    solverCost,
    mismatchRows,
    unknownVariables: [],
    message,
  };
}
