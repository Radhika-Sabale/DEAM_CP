/**
 * @file nextStateEquations.ts
 * Next-state and output Boolean equation synthesis using the Quine-McCluskey K-map solver (Stage 10B).
 * Translates function columns into minimal Sum-of-Products (SOP) ASTs, provides cost metrics,
 * and performs strict self-verification against care rows using the Boolean evaluator.
 *
 * ============================================================================
 * EQUATION PRINTING CONVENTION:
 * To avoid multi-character juxtaposition ambiguity (such as "Q1Q0" or "Q1DN"),
 * equation text is printed using the 'symbolic' style (e.g. "Q1 & Q0 | !Q2") or explicit
 * operators, and proved idempotent via parser round-trip.
 * ============================================================================
 */

import type { BoolNode, LogicValue } from '../../types/ast';
import type { FunctionColumn } from '../../types/sequential';
import { evaluateBinary } from '../boolean/evaluator';
import { parse } from '../boolean/parser';
import { toString as printAst } from '../boolean/printer';
import { mintermToAssignment } from '../common/bitUtils';
import { solveSOP } from '../kmap/solver';
import { rowIndex } from './encoding';

/** Cost metrics for a synthesized Sum-of-Products Boolean equation. */
export interface EquationCost {
  readonly terms: number;
  readonly literals: number;
}

/** Individual derived next-state or output equation specification. */
export interface DerivedEquation {
  readonly name: string;
  readonly variables: readonly string[];
  readonly column: readonly LogicValue[];
  readonly expression: BoolNode;
  readonly text: string;
  readonly cost: EquationCost;
  readonly minimalCoverCount: number;
  readonly usedDontCares: readonly number[];
  readonly constant: 0 | 1 | null;
  readonly note?: string;
}

/** Discriminated result of deriving Boolean equations for sequential function columns. */
export type DeriveEquationsResult =
  | { readonly ok: true; readonly equations: readonly DerivedEquation[] }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string; readonly column?: string } };

/**
 * Derives minimal SOP Boolean equations for each function column using the Stage 7A K-map solver.
 * Explicitly preserves the variable ordering (MSB state bits first, input LSB).
 *
 * @param functionColumns Array of function columns (flip-flop inputs and outputs)
 * @returns Discriminated result with derived equations or self-verification error
 */
export function deriveEquations(
  functionColumns: readonly FunctionColumn[]
): DeriveEquationsResult {
  const equations: DerivedEquation[] = [];

  for (const col of functionColumns) {
    const { name, variables, column } = col;
    const varCount = variables.length;
    const totalRows = column.length;

    const minterms: number[] = [];
    const dontCares: number[] = [];

    for (let i = 0; i < totalRows; i++) {
      const val = column[i];
      if (val === 1) {
        minterms.push(i);
      } else if (val === 'X') {
        dontCares.push(i);
      }
    }

    // 1. All-0 or all-X column: constant 0
    if (minterms.length === 0) {
      const expr: BoolNode = { type: 'constant', value: 0 };
      const text = '0';
      equations.push({
        name,
        variables,
        column,
        expression: expr,
        text,
        cost: { terms: 0, literals: 0 },
        minimalCoverCount: 1,
        usedDontCares: [],
        constant: 0,
        note: dontCares.length === totalRows ? 'All rows are don`t-cares -> constant 0' : 'Column has no active minterms -> constant 0',
      });
      continue;
    }

    // 2. All-1 column (or minterms + dontCares cover all cells with at least one 1)
    if (minterms.length + dontCares.length === totalRows && minterms.length > 0) {
      const expr: BoolNode = { type: 'constant', value: 1 };
      const text = '1';
      equations.push({
        name,
        variables,
        column,
        expression: expr,
        text,
        cost: { terms: 1, literals: 0 },
        minimalCoverCount: 1,
        usedDontCares: [],
        constant: 1,
        note: 'Column has only active minterms and don`t-cares -> constant 1',
      });
      continue;
    }

    // 3. General SOP minimization via Stage 7A solver
    const solverRes = solveSOP(varCount, minterms, dontCares, variables);
    if (!solverRes.ok) {
      return {
        ok: false,
        error: {
          code: 'solver-error',
          message: `K-map solver failed for column '${name}': ${solverRes.error.message}`,
          column: name,
        },
      };
    }

    const sol = solverRes.solution;
    const expr = sol.expression;
    const text = printAst(expr, 'symbolic');

    // Calculate which don't-cares were actually utilized in the primary solution cover
    const usedDcSet = new Set<number>();
    const dcSet = new Set(dontCares);
    for (const pi of sol.primarySolution.primeImplicants) {
      for (const m of pi.minterms) {
        if (dcSet.has(m)) {
          usedDcSet.add(m);
        }
      }
    }
    const usedDontCares = Array.from(usedDcSet).sort((a, b) => a - b);

    // 4. Strict self-verification against all care rows
    for (let r = 0; r < totalRows; r++) {
      const targetVal = column[r];
      if (targetVal === 0 || targetVal === 1) {
        const assignmentBits = mintermToAssignment(r, varCount);
        const env: Record<string, 0 | 1> = {};
        for (let v = 0; v < varCount; v++) {
          const vName = variables[v] ?? `v${v}`;
          env[vName] = assignmentBits[v] ?? 0;
        }

        const evalResult = evaluateBinary(expr, env);
        if (evalResult !== targetVal) {
          return {
            ok: false,
            error: {
              code: 'verification-failed',
              message: `Synthesized equation for '${name}' evaluated to ${evalResult} at row ${r}, expected ${targetVal}.`,
              column: name,
            },
          };
        }
      }
    }

    // 5. Verify text parses back to equivalent AST
    const reparse = parse(text);
    if (!reparse.ok || !reparse.ast) {
      return {
        ok: false,
        error: {
          code: 'unparseable-text',
          message: `Generated equation text "${text}" could not be parsed.`,
          column: name,
        },
      };
    }

    const isConst = expr.type === 'constant' ? (expr.value as 0 | 1) : null;

    equations.push({
      name,
      variables,
      column,
      expression: expr,
      text,
      cost: {
        terms: isConst === 0 ? 0 : sol.primarySolution.termCount,
        literals: isConst !== null ? 0 : sol.primarySolution.literalCount,
      },
      minimalCoverCount: sol.allMinimalCovers.length,
      usedDontCares,
      constant: isConst,
    });
  }

  return {
    ok: true,
    equations,
  };
}

/**
 * Evaluates all derived equations for a specific state code and input value.
 *
 * @param equations Array of derived equations
 * @param code Integer state code
 * @param inputValue External input value (0 or 1)
 * @param hasInput Whether the machine uses an external input
 * @returns Map of terminal names to evaluated logic values (0 or 1)
 */
export function evaluateEquations(
  equations: readonly DerivedEquation[],
  code: number,
  inputValue = 0,
  hasInput = false
): Record<string, LogicValue> {
  const result: Record<string, LogicValue> = {};

  for (const eq of equations) {
    if (eq.constant !== null) {
      result[eq.name] = eq.constant;
      continue;
    }

    const varCount = eq.variables.length;
    // Determine row index for this specific equation's variable set
    const eqHasInput = hasInput && eq.variables.some((v) => v === 'IN' || v === 'DN');
    const rIdx = rowIndex(code, inputValue, eqHasInput);

    const assignmentBits = mintermToAssignment(rIdx, varCount);
    const env: Record<string, 0 | 1> = {};
    for (let v = 0; v < varCount; v++) {
      const vName = eq.variables[v] ?? `v${v}`;
      env[vName] = assignmentBits[v] ?? 0;
    }

    result[eq.name] = evaluateBinary(eq.expression, env);
  }

  return result;
}

/**
 * Computes the aggregated total cost (terms and literals) across all derived equations.
 *
 * @param equations Array of derived equations
 * @returns Aggregated EquationCost
 */
export function totalCost(equations: readonly DerivedEquation[]): EquationCost {
  let terms = 0;
  let literals = 0;

  for (const eq of equations) {
    terms += eq.cost.terms;
    literals += eq.cost.literals;
  }

  return { terms, literals };
}
