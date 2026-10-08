/**
 * @file equivalence.ts
 * Boolean equivalence checking.
 *
 * DESIGN PRINCIPLE: Correctness comes from exact algorithms, never from guesswork.
 * Equivalence is decided by exhaustive truth-table comparison over all 2^n binary
 * assignments of the union of variables from both expressions. No heuristics.
 */

import type { BoolNode } from '../../types/ast';
import { evaluateBinary } from './evaluator';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Collects all unique variable names reachable from a BoolNode. */
function collectVars(node: BoolNode, out: Set<string>): void {
  switch (node.type) {
    case 'variable':
      out.add(node.name);
      break;
    case 'constant':
      break;
    case 'not':
      collectVars(node.child, out);
      break;
    case 'and':
    case 'or':
      for (const c of node.children) collectVars(c, out);
      break;
    case 'xor':
    case 'nand':
    case 'nor':
    case 'xnor':
      collectVars(node.left, out);
      collectVars(node.right, out);
      break;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determines whether two Boolean ASTs are logically equivalent.
 *
 * The check is performed by exhaustive binary truth-table comparison over
 * all 2^n input combinations of the union of variables from both expressions.
 * Variables present in one expression but absent in the other are treated as
 * don't-affect: both assignments (0 and 1) are tested.
 *
 * Complexity: O(2^n) where n = |vars(a) ∪ vars(b)|, capped at 2^12 for
 * interactive use (expressions with > 12 variables are rejected).
 *
 * @param a First Boolean AST
 * @param b Second Boolean AST
 * @returns `true` if the expressions are logically equivalent; `false` otherwise
 * @throws RangeError if the union variable count exceeds 12
 */
export function areEquivalent(a: BoolNode, b: BoolNode): boolean {
  const varSet = new Set<string>();
  collectVars(a, varSet);
  collectVars(b, varSet);

  const vars = [...varSet].sort();
  const n = vars.length;

  if (n > 12) {
    throw new RangeError(
      `Equivalence checking supports at most 12 variables; got ${n}. ` +
        `Reduce expression complexity before comparing.`
    );
  }

  const total = 1 << n; // 2^n
  const assignment: Record<string, 0 | 1> = {};

  for (let mask = 0; mask < total; mask++) {
    for (let i = 0; i < n; i++) {
      const varName = vars[i];
      if (varName !== undefined) {
        assignment[varName] = ((mask >> (n - 1 - i)) & 1) as 0 | 1;
      }
    }
    if (evaluateBinary(a, assignment) !== evaluateBinary(b, assignment)) {
      return false;
    }
  }

  return true;
}
