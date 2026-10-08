/**
 * @file simplify.ts
 * Algebraic Boolean simplification with step-by-step law tracking.
 *
 * DESIGN PRINCIPLE: Correctness comes from exact algorithms, never from guesswork.
 * The simplifier is a fixpoint engine: it repeatedly applies bottom-up rewrite rules
 * from laws.ts until the expression no longer changes.  After every full pass the
 * truth-table equivalence of the result vs. the original input is re-checked.
 *
 * The result is always the logically equivalent minimal form reachable by the rule set.
 */

import type { BoolNode, SimplificationStep } from '../../types/ast';
import { areEquivalent } from './equivalence';
import { applyRulesBottomUp } from './laws';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Result returned by `simplify`.
 */
export interface SimplifyResult {
  /** The simplified Boolean AST (logically equivalent to the input) */
  readonly simplified: BoolNode;
  /** Ordered sequence of law applications that transformed the expression */
  readonly steps: readonly SimplificationStep[];
  /** Whether any simplification was actually performed */
  readonly changed: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Simplifies a Boolean AST using a fixpoint application of algebraic rewrite rules.
 *
 * The simplifier repeatedly applies all available rules bottom-up until no rule fires.
 * A maximum of `maxPasses` iterations prevents infinite loops caused by oscillating rules.
 *
 * After every pass the result is verified to be logically equivalent to `ast`.
 * If equivalence is ever violated (a serious internal bug), an Error is thrown.
 *
 * @param ast Input Boolean AST to simplify
 * @param maxPasses Maximum number of fixpoint passes (default: 64)
 * @returns SimplifyResult with simplified expression and ordered step list
 * @throws Error if the simplifier produces an inequivalent expression (internal bug)
 */
export function simplify(ast: BoolNode, maxPasses = 64): SimplifyResult {
  const allSteps: SimplificationStep[] = [];
  let current = ast;

  for (let pass = 0; pass < maxPasses; pass++) {
    const { node: next, steps } = applyRulesBottomUp(current);
    allSteps.push(...steps);

    if (steps.length === 0) {
      // Fixpoint reached
      break;
    }

    // Correctness invariant: the result of every pass must be equivalent to the original.
    if (!areEquivalent(ast, next)) {
      throw new Error(
        `[simplify] Equivalence invariant violated after pass ${pass + 1}. ` +
          `This is an internal bug. Please report it.`
      );
    }

    current = next;
  }

  return {
    simplified: current,
    steps: allSteps,
    changed: allSteps.length > 0,
  };
}

/**
 * Simplifies an expression and returns only the final simplified AST,
 * discarding the step list. Convenience wrapper for callers that need
 * the simplified form but do not require a step-by-step trace.
 *
 * @param ast Input Boolean AST
 * @returns Simplified Boolean AST (logically equivalent to the input)
 */
export function simplifiedAst(ast: BoolNode): BoolNode {
  return simplify(ast).simplified;
}
