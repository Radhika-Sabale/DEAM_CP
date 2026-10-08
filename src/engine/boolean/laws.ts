/**
 * @file laws.ts
 * Local, pattern-based Boolean algebra rewrite rules.
 *
 * DESIGN PRINCIPLE: Correctness comes from exact algorithms, never from guesswork.
 * Every rule is a structural, local pattern match on the AST.  After EVERY step the
 * engine re-verifies equivalence with `areEquivalent` (truth-table check over all
 * binary inputs) and throws if the rewrite was unsound.
 *
 * Rules operate bottom-up: they are applied to the smallest sub-tree where the
 * pattern fires, then the caller re-runs the rule set until fixpoint.
 *
 * Exported types and functions are intentionally narrow – callers should go through
 * `simplify.ts` for full fixpoint reduction.
 */

import type { BoolNode, BooleanLaw, SimplificationStep } from '../../types/ast';
import { areEquivalent } from './equivalence';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Shallow structural equality check (used to detect trivial no-ops). */
function shallowEq(a: BoolNode, b: BoolNode): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'constant':
      return a.value === (b as typeof a).value;
    case 'variable':
      return a.name === (b as typeof a).name;
    default:
      return false; // compound nodes: use areEquivalent for correctness
  }
}

/** Returns true if the node is a literal (variable or its NOT). */
function isLiteral(n: BoolNode): boolean {
  return n.type === 'variable' || (n.type === 'not' && n.child.type === 'variable');
}

/** If n is `not(variable(x))` returns the variable name, else null. */
function negatedVarName(n: BoolNode): string | null {
  if (n.type === 'not' && n.child.type === 'variable') return n.child.name;
  return null;
}

/** Recursively count nodes. */
function nodeCount(n: BoolNode): number {
  switch (n.type) {
    case 'constant':
    case 'variable':
      return 1;
    case 'not':
      return 1 + nodeCount(n.child);
    case 'and':
    case 'or':
      return 1 + n.children.reduce((s, c) => s + nodeCount(c), 0);
    case 'xor':
    case 'nand':
    case 'nor':
    case 'xnor':
      return 1 + nodeCount(n.left) + nodeCount(n.right);
  }
}

// ---------------------------------------------------------------------------
// The rule function signature
// ---------------------------------------------------------------------------

/**
 * A rewrite rule attempts to transform `node` into a simpler form.
 * Returns null if the rule does not apply at this node.
 * Returns `{ after, law, explanation }` if the rule fires.
 */
export interface RuleMatch {
  readonly after: BoolNode;
  readonly law: BooleanLaw;
  readonly explanation: string;
}

type Rule = (node: BoolNode) => RuleMatch | null;

// ---------------------------------------------------------------------------
// Individual rules
// ---------------------------------------------------------------------------

/** involution: NOT(NOT(x)) → x */
const ruleInvolution: Rule = (node) => {
  if (node.type === 'not' && node.child.type === 'not') {
    return {
      after: node.child.child,
      law: 'involution',
      explanation: `Double negation eliminated: NOT(NOT(x)) = x`,
    };
  }
  return null;
};

/** identity: x AND 1 → x, x OR 0 → x */
const ruleIdentity: Rule = (node) => {
  if (node.type === 'and') {
    const rest = node.children.filter((c) => !(c.type === 'constant' && c.value === 1));
    if (rest.length < node.children.length) {
      const after: BoolNode =
        rest.length === 0
          ? { type: 'constant', value: 1 }
          : rest.length === 1
            ? rest[0]!
            : { type: 'and', children: rest };
      return { after, law: 'identity', explanation: `Identity: x AND 1 = x` };
    }
  }
  if (node.type === 'or') {
    const rest = node.children.filter((c) => !(c.type === 'constant' && c.value === 0));
    if (rest.length < node.children.length) {
      const after: BoolNode =
        rest.length === 0
          ? { type: 'constant', value: 0 }
          : rest.length === 1
            ? rest[0]!
            : { type: 'or', children: rest };
      return { after, law: 'identity', explanation: `Identity: x OR 0 = x` };
    }
  }
  return null;
};

/** null: x AND 0 → 0, x OR 1 → 1 */
const ruleNull: Rule = (node) => {
  if (node.type === 'and' && node.children.some((c) => c.type === 'constant' && c.value === 0)) {
    return { after: { type: 'constant', value: 0 }, law: 'null', explanation: `Null law: x AND 0 = 0` };
  }
  if (node.type === 'or' && node.children.some((c) => c.type === 'constant' && c.value === 1)) {
    return { after: { type: 'constant', value: 1 }, law: 'null', explanation: `Null law: x OR 1 = 1` };
  }
  return null;
};

/** idempotent: x AND x → x, x OR x → x */
const ruleIdempotent: Rule = (node) => {
  if (node.type !== 'and' && node.type !== 'or') return null;
  const seen: BoolNode[] = [];
  let changed = false;
  for (const c of node.children) {
    const dup = seen.some((s) => shallowEq(s, c));
    if (!dup) seen.push(c);
    else changed = true;
  }
  if (!changed) return null;
  const after: BoolNode =
    seen.length === 1
      ? seen[0]!
      : { type: node.type, children: seen };
  return { after, law: 'idempotent', explanation: `Idempotent: x ${node.type === 'and' ? 'AND' : 'OR'} x = x` };
};

/** complement: x AND x' → 0, x OR x' → 1 */
const ruleComplement: Rule = (node) => {
  if (node.type === 'and') {
    for (const c of node.children) {
      if (c.type === 'variable') {
        const hasComplement = node.children.some((d) => negatedVarName(d) === c.name);
        if (hasComplement) {
          return { after: { type: 'constant', value: 0 }, law: 'complement', explanation: `Complement: x AND x' = 0` };
        }
      }
    }
  }
  if (node.type === 'or') {
    for (const c of node.children) {
      if (c.type === 'variable') {
        const hasComplement = node.children.some((d) => negatedVarName(d) === c.name);
        if (hasComplement) {
          return { after: { type: 'constant', value: 1 }, law: 'complement', explanation: `Complement: x OR x' = 1` };
        }
      }
    }
  }
  return null;
};

/**
 * absorption: x AND (x OR y) → x, x OR (x AND y) → x
 * Works for any literal x that appears both at the top level and inside a nested term.
 */
const ruleAbsorption: Rule = (node) => {
  if (node.type === 'and') {
    // x AND (x OR ...) → x   when literal x exists at top level AND inside some OR child
    for (const lit of node.children) {
      if (!isLiteral(lit)) continue;
      const absorbable = node.children.some((c) => {
        if (c.type !== 'or') return false;
        return c.children.some((gc) => shallowEq(gc, lit));
      });
      if (absorbable) {
        // drop all OR children that contain lit; keep non-OR children
        const kept = node.children.filter((c) => {
          if (c.type !== 'or') return true;
          return !c.children.some((gc) => shallowEq(gc, lit));
        });
        const after: BoolNode = kept.length === 1 ? kept[0]! : { type: 'and', children: kept };
        return { after, law: 'absorption', explanation: `Absorption: x AND (x OR y) = x` };
      }
    }
  }
  if (node.type === 'or') {
    for (const lit of node.children) {
      if (!isLiteral(lit)) continue;
      const absorbable = node.children.some((c) => {
        if (c.type !== 'and') return false;
        return c.children.some((gc) => shallowEq(gc, lit));
      });
      if (absorbable) {
        const kept = node.children.filter((c) => {
          if (c.type !== 'and') return true;
          return !c.children.some((gc) => shallowEq(gc, lit));
        });
        const after: BoolNode = kept.length === 1 ? kept[0]! : { type: 'or', children: kept };
        return { after, law: 'absorption', explanation: `Absorption: x OR (x AND y) = x` };
      }
    }
  }
  return null;
};

/**
 * de-morgan: NOT(x AND y) → x' OR y', NOT(x OR y) → x' AND y'
 * Only fires when NOT wraps an AND/OR with literal children (avoids blowing up).
 */
const ruleDeMorgan: Rule = (node) => {
  if (node.type !== 'not') return null;
  const child = node.child;
  if (child.type === 'and' && child.children.every(isLiteral)) {
    const after: BoolNode = {
      type: 'or',
      children: child.children.map((c) =>
        c.type === 'variable'
          ? ({ type: 'not', child: c } as BoolNode)
          : (c as { type: 'not'; child: BoolNode }).child
      ),
    };
    return {
      after,
      law: 'de-morgan',
      explanation: `De Morgan: NOT(x AND y) = x' OR y'`,
    };
  }
  if (child.type === 'or' && child.children.every(isLiteral)) {
    const after: BoolNode = {
      type: 'and',
      children: child.children.map((c) =>
        c.type === 'variable'
          ? ({ type: 'not', child: c } as BoolNode)
          : (c as { type: 'not'; child: BoolNode }).child
      ),
    };
    return {
      after,
      law: 'de-morgan',
      explanation: `De Morgan: NOT(x OR y) = x' AND y'`,
    };
  }
  return null;
};

/**
 * distributive (factoring only): (xA OR xB OR ...) → x(A OR B OR ...)
 * Detects a common literal factor across all OR children and factors it out.
 * Applied only when it strictly reduces node count.
 */
const ruleDistributive: Rule = (node) => {
  if (node.type !== 'or') return null;
  // All children must be AND nodes or literals
  if (!node.children.every((c) => c.type === 'and' || isLiteral(c))) return null;

  // Collect candidate common literals from first child
  const firstChild = node.children[0];
  if (!firstChild) return null;
  const candidates: BoolNode[] = firstChild.type === 'and' ? [...firstChild.children] : [firstChild];

  for (const candidate of candidates) {
    if (!isLiteral(candidate)) continue;
    const allHave = node.children.every((c) => {
      if (c.type === 'and') return c.children.some((gc) => shallowEq(gc, candidate));
      return shallowEq(c, candidate);
    });
    if (!allHave) continue;

    // Factor out candidate
    const rests: BoolNode[] = node.children.map((c) => {
      if (c.type === 'and') {
        const rem = c.children.filter((gc) => !shallowEq(gc, candidate));
        return rem.length === 0
          ? ({ type: 'constant', value: 1 } as BoolNode)
          : rem.length === 1
            ? rem[0]!
            : { type: 'and', children: rem };
      }
      // c === candidate itself
      return { type: 'constant', value: 1 };
    });

    const orPart: BoolNode =
      rests.length === 1 ? rests[0]! : { type: 'or', children: rests };
    const after: BoolNode = { type: 'and', children: [candidate, orPart] };

    // Only emit if we actually reduced node count
    if (nodeCount(after) < nodeCount(node)) {
      return { after, law: 'distributive', explanation: `Distributive (factoring): common factor extracted` };
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Ordered rule list
// ---------------------------------------------------------------------------

const RULES: Rule[] = [
  ruleInvolution,
  ruleNull,
  ruleIdentity,
  ruleComplement,
  ruleIdempotent,
  ruleAbsorption,
  ruleDeMorgan,
  ruleDistributive,
];

// ---------------------------------------------------------------------------
// Public: tryApplyRules
// ---------------------------------------------------------------------------

/**
 * Attempts to apply each rewrite rule to `node` at the top level.
 * Returns the first matching rule result, verified with `areEquivalent`.
 * Returns null if no rule fires or if the match is verified as unsound (bug guard).
 *
 * @param node The AST node to attempt simplification on
 * @returns A RuleMatch if any rule applies, null otherwise
 * @throws Error if a rule fires but produces an inequivalent result (internal bug)
 */
export function tryApplyRules(node: BoolNode): RuleMatch | null {
  for (const rule of RULES) {
    const match = rule(node);
    if (match === null) continue;

    // Correctness invariant: verify every rewrite is semantically sound.
    if (!areEquivalent(node, match.after)) {
      throw new Error(
        `[laws] Unsound rewrite detected for law "${match.law}". ` +
          `This is an internal bug. Please report it.`
      );
    }

    return match;
  }
  return null;
}

/**
 * Recursively applies rules bottom-up to all sub-trees of `node`.
 * Returns `{ node: BoolNode, steps: SimplificationStep[] }` where `steps`
 * holds one entry per successful bottom-up rewrite at any level.
 *
 * @param node AST to walk and reduce
 * @returns New (possibly unchanged) node plus the steps that were applied
 */
export function applyRulesBottomUp(
  node: BoolNode
): { node: BoolNode; steps: SimplificationStep[] } {
  const steps: SimplificationStep[] = [];

  function walk(n: BoolNode): BoolNode {
    // Recurse into children first
    let rebuilt: BoolNode;
    switch (n.type) {
      case 'constant':
      case 'variable':
        rebuilt = n;
        break;
      case 'not': {
        const newChild = walk(n.child);
        rebuilt = newChild === n.child ? n : { type: 'not', child: newChild };
        break;
      }
      case 'and':
      case 'or': {
        const newChildren = n.children.map(walk);
        const changed = newChildren.some((c, i) => c !== n.children[i]);
        rebuilt = changed ? { type: n.type, children: newChildren } : n;
        break;
      }
      case 'xor':
      case 'nand':
      case 'nor':
      case 'xnor': {
        const newLeft = walk(n.left);
        const newRight = walk(n.right);
        rebuilt =
          newLeft === n.left && newRight === n.right
            ? n
            : { type: n.type, left: newLeft, right: newRight };
        break;
      }
    }

    // Try to simplify at this node
    const match = tryApplyRules(rebuilt);
    if (match !== null) {
      steps.push({
        lawName: match.law,
        before: rebuilt,
        after: match.after,
        explanation: match.explanation,
      });
      // Continue walking into the result
      return walk(match.after);
    }
    return rebuilt;
  }

  const result = walk(node);
  return { node: result, steps };
}
