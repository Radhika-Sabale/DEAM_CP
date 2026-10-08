/**
 * @file truthTable.ts
 * Truth table generator and analysis helpers for Boolean expressions.
 *
 * Adheres to laboratory bit-ordering convention:
 * Variable index 0 (e.g., "A") is ALWAYS the MOST SIGNIFICANT BIT (MSB) of a minterm index.
 * Truth table rows are strictly sorted in ascending minterm index order (0 to 2^n - 1).
 */

import type { BoolNode, LogicValue, TruthTable, TruthTableRow } from '../../types/ast';
import { bitsToArray, MAX_MINTERM_VARIABLES } from '../common';
import { evaluateBinary } from './evaluator';

/**
 * Discriminated result returned by truth table generation.
 */
export type TruthTableResult =
  | {
      readonly ok: true;
      readonly table: TruthTable;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

/**
 * Traverses an AST to extract all unique variable names.
 *
 * @param ast Boolean AST node
 * @returns Sorted unique variable names
 */
function extractVariables(ast: BoolNode): string[] {
  const vars = new Set<string>();
  function walk(node: BoolNode): void {
    switch (node.type) {
      case 'variable':
        vars.add(node.name);
        break;
      case 'not':
        walk(node.child);
        break;
      case 'and':
      case 'or':
        node.children.forEach(walk);
        break;
      case 'xor':
      case 'nand':
      case 'nor':
      case 'xnor':
        walk(node.left);
        walk(node.right);
        break;
      case 'constant':
        break;
    }
  }
  walk(ast);
  return [...vars].sort();
}

/**
 * Builds a truth table for a given Boolean expression AST.
 * Pure function. Supports up to MAX_MINTERM_VARIABLES (6) variables.
 * For 7 or more variables, returns a descriptive error result instead of throwing.
 *
 * @param ast Parsed Boolean expression AST
 * @param variables Optional custom variable order (defaults to sorted AST variables)
 * @param dontCares Optional collection of minterm indices designated as don't-care ('X')
 * @returns Discriminated result containing generated TruthTable or error message
 * @throws TypeError if ast is invalid
 */
export function buildTruthTable(
  ast: BoolNode,
  variables?: readonly string[],
  dontCares?: readonly number[] | ReadonlySet<number>
): TruthTableResult {
  if (!ast || typeof ast !== 'object' || typeof ast.type !== 'string') {
    throw new TypeError(`Expected ast to be a valid BoolNode. Received: ${typeof ast}`);
  }

  const vars = variables ? [...variables] : extractVariables(ast);
  const n = vars.length;

  if (n > MAX_MINTERM_VARIABLES) {
    return {
      ok: false,
      error: `Truth table supports at most ${MAX_MINTERM_VARIABLES} variables (received ${n}). Generating a truth table with ${n} variables (2^${n} = ${Math.pow(2, n)} rows) exceeds laboratory computational and display limits.`,
    };
  }

  const dcSet = dontCares instanceof Set ? dontCares : new Set(dontCares ?? []);
  const rowCount = Math.pow(2, n);
  const rows: TruthTableRow[] = new Array(rowCount);

  for (let i = 0; i < rowCount; i++) {
    const inputs = bitsToArray(i, n);
    let output: LogicValue;

    if (dcSet.has(i)) {
      output = 'X';
    } else {
      const assignment: Record<string, 0 | 1> = {};
      for (let c = 0; c < n; c++) {
        const varName = vars[c];
        const bitVal = inputs[c];
        if (varName !== undefined && bitVal !== undefined) {
          assignment[varName] = bitVal;
        }
      }
      output = evaluateBinary(ast, assignment);
    }

    rows[i] = {
      index: i,
      inputs,
      output,
    };
  }

  return {
    ok: true,
    table: {
      variables: vars,
      rows,
    },
  };
}

/**
 * Builds a truth table directly from minterm and don't-care indices without an expression.
 * Used for Karnaugh map solvers, practice exercises, and reverse synthesis.
 *
 * @param variables Ordered input variable identifiers (variable 0 is MSB)
 * @param minterms Array of decimal row indices evaluating to 1
 * @param dontCares Optional array of decimal row indices evaluating to 'X'
 * @returns Discriminated result containing generated TruthTable or error message
 * @throws TypeError if variables or minterms are invalid
 */
export function tableFromMinterms(
  variables: readonly string[],
  minterms: readonly number[],
  dontCares: readonly number[] = []
): TruthTableResult {
  if (!Array.isArray(variables)) {
    throw new TypeError('Expected variables to be an array of strings.');
  }
  if (!Array.isArray(minterms)) {
    throw new TypeError('Expected minterms to be an array of numbers.');
  }

  const n = variables.length;
  if (n > MAX_MINTERM_VARIABLES) {
    return {
      ok: false,
      error: `Truth table supports at most ${MAX_MINTERM_VARIABLES} variables (received ${n}).`,
    };
  }

  const mintermSet = new Set(minterms);
  const dcSet = new Set(dontCares);
  const rowCount = Math.pow(2, n);
  const rows: TruthTableRow[] = new Array(rowCount);

  for (let i = 0; i < rowCount; i++) {
    const inputs = bitsToArray(i, n);
    let output: LogicValue = 0;

    if (dcSet.has(i)) {
      output = 'X';
    } else if (mintermSet.has(i)) {
      output = 1;
    }

    rows[i] = {
      index: i,
      inputs,
      output,
    };
  }

  return {
    ok: true,
    table: {
      variables: [...variables],
      rows,
    },
  };
}

/**
 * Extracts minterm indices (rows where output === 1) from a truth table.
 *
 * @param table Truth table instance
 * @returns Ascending array of minterm decimal indices
 */
export function getMinterms(table: TruthTable): readonly number[] {
  return table.rows.filter((r) => r.output === 1).map((r) => r.index);
}

/**
 * Extracts maxterm indices (rows where output === 0) from a truth table.
 *
 * @param table Truth table instance
 * @returns Ascending array of maxterm decimal indices
 */
export function getMaxterms(table: TruthTable): readonly number[] {
  return table.rows.filter((r) => r.output === 0).map((r) => r.index);
}

/**
 * Extracts don't-care indices (rows where output === 'X') from a truth table.
 *
 * @param table Truth table instance
 * @returns Ascending array of don't-care decimal indices
 */
export function getDontCares(table: TruthTable): readonly number[] {
  return table.rows.filter((r) => r.output === 'X').map((r) => r.index);
}

/**
 * Tests whether a truth table represents a tautology (constant 1 for all rows).
 *
 * @param table Truth table instance
 * @returns True if table has at least one row and all outputs equal 1
 */
export function isTautology(table: TruthTable): boolean {
  return table.rows.length > 0 && table.rows.every((r) => r.output === 1);
}

/**
 * Tests whether a truth table represents a contradiction (constant 0 for all rows).
 *
 * @param table Truth table instance
 * @returns True if table has at least one row and all outputs equal 0
 */
export function isContradiction(table: TruthTable): boolean {
  return table.rows.length > 0 && table.rows.every((r) => r.output === 0);
}
