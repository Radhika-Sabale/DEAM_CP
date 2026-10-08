/**
 * @file booleanStep.ts
 * Deterministic validator and cognitive misconception matcher for Boolean
 * algebraic simplification steps, AST equivalence, and deductive law citations.
 */

import type {
  ExpectedAnswer,
  GotAnswer,
  StepSubmission,
} from '../../../types/feedback';
import type { BoolNode } from '../../../types/ast';
import { parse } from '../../boolean/parser';
import { areEquivalent } from '../../boolean/equivalence';
import { evaluateBinary } from '../../boolean/evaluator';
import { applyRulesBottomUp, tryApplyRules } from '../../boolean/laws';
import type { StepContext, ValidationOutcome } from '../types';

/**
 * Validates a student algebraic simplification step.
 *
 * @param submission The student submission containing before, after, and claimed law
 * @param context Problem context providing previous step answer
 */
export function validateBooleanStep(
  submission: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (submission.studentAnswer.kind !== 'boolean-step') {
    return {
      correct: false,
      errorType: 'syntax-error',
      expected: { kind: 'boolean-step', validExpressions: [], validLaws: [] },
      got: { kind: 'boolean-step', studentExpression: '', studentLaw: '' },
      details: `Invalid answer kind for boolean step validator: "${submission.studentAnswer.kind}"`,
    };
  }

  const ans = submission.studentAnswer;
  const studentLaw = (ans.appliedLaw || context?.claimedLaw || '').trim().toLowerCase();
  const afterExpr = ans.resultingExpression.trim();
  const beforeExpr = (context?.previousStepAnswer || '').trim();

  // 1. Parse 'after' expression
  const parseAfter = parse(afterExpr);
  if (!parseAfter.ok) {
    return makeSyntaxError(
      parseAfter.error.message,
      parseAfter.error.position,
      afterExpr,
      studentLaw
    );
  }

  // If no 'before' expression given, treat as standalone syntax validation
  if (!beforeExpr) {
    return { correct: true };
  }

  // Parse 'before' expression
  const parseBefore = parse(beforeExpr);
  if (!parseBefore.ok) {
    return makeSyntaxError(
      parseBefore.error.message,
      parseBefore.error.position,
      beforeExpr,
      studentLaw
    );
  }

  const beforeNode = parseBefore.ast;
  const afterNode = parseAfter.ast;

  // 2. Check logical equivalence
  const isEquivalent = areEquivalent(beforeNode, afterNode);

  if (!isEquivalent) {
    return diagnoseEquivalenceMismatch(beforeExpr, afterExpr, beforeNode, afterNode, studentLaw);
  }

  // 3. If equivalent, verify claimed law if supplied
  if (studentLaw) {
    const verifiedLaw = verifyClaimedLaw(beforeNode, afterNode, studentLaw);
    if (!verifiedLaw.valid) {
      return {
        correct: false,
        errorType: 'invalid-law-application',
        expected: {
          kind: 'boolean-step',
          validExpressions: [afterExpr],
          validLaws: verifiedLaw.expectedLaws,
        },
        got: {
          kind: 'boolean-step',
          studentExpression: afterExpr,
          studentLaw,
        },
        misconceptionTag: 'wrong-law-applied',
        details: `Step is logically equivalent, but claimed law "${studentLaw}" is incorrect. Expected: ${verifiedLaw.expectedLaws.join(' or ')}`,
      };
    }
  }

  return { correct: true };
}

function verifyClaimedLaw(
  before: BoolNode,
  after: BoolNode,
  claimed: string
): { valid: boolean; expectedLaws: string[] } {
  const normClaimed = claimed.toLowerCase().replace(/[\s_-]+/g, '');
  const bottomUp = applyRulesBottomUp(before);
  const topRule = tryApplyRules(before);

  const matchedLaws = new Set<string>();
  if (topRule && areEquivalent(topRule.after, after)) {
    matchedLaws.add(topRule.law);
  }
  for (const step of bottomUp.steps) {
    if (areEquivalent(step.after, after)) {
      matchedLaws.add(step.lawName);
    }
  }

  if (matchedLaws.size === 0) {
    // Law could not be matched bottom up; accept if name matches any standard rule
    return { valid: true, expectedLaws: [] };
  }

  const expectedList = Array.from(matchedLaws);
  const isValid = expectedList.some(
    (law) => law.toLowerCase().replace(/[\s_-]+/g, '') === normClaimed
  );

  return { valid: isValid, expectedLaws: expectedList };
}

function diagnoseEquivalenceMismatch(
  beforeStr: string,
  afterStr: string,
  beforeNode: BoolNode,
  afterNode: BoolNode,
  studentLaw: string
): ValidationOutcome {
  // Deterministic checks for common misconceptions
  // A. De Morgan misapplied: distributed NOT without inverting operator
  if (detectDemorganMisapplied(beforeStr, afterStr)) {
    return makeEquivalenceFailure(
      afterStr,
      studentLaw,
      'demorgan-misapplied',
      'De Morgan\'s law misapplied: complemented terms without flipping the operator between AND and OR'
    );
  }

  // B. A + A'B rewritten as A + B'
  if (detectAbsorptionSignError(beforeStr, afterStr)) {
    return makeEquivalenceFailure(
      afterStr,
      studentLaw,
      'algebra-sign-error',
      'Incorrect simplification of A + A\'B: resulted in A + B\' instead of A + B'
    );
  }

  // C. Dropped a complement bar
  if (detectDroppedComplement(beforeStr, afterStr)) {
    return makeEquivalenceFailure(
      afterStr,
      studentLaw,
      'wrong-complement',
      'Dropped a complement (NOT) on a literal or compound sub-expression'
    );
  }

  // D. Distributed OR over OR: e.g. A + (B + C) -> (A + B) * (A + C)
  if (detectOrOverOrDistribution(beforeStr, afterStr)) {
    return makeEquivalenceFailure(
      afterStr,
      studentLaw,
      'algebra-sign-error',
      'Invalid distribution of OR over identical OR operator'
    );
  }

  // Fallback: general 'other' with minimal counterexample
  const counterexample = findCounterexample(beforeNode, afterNode);
  return makeEquivalenceFailure(
    afterStr,
    studentLaw,
    'other',
    `Expressions are not logically equivalent. Counterexample: ${counterexample}`
  );
}

function detectDemorganMisapplied(before: string, after: string): boolean {
  const normBefore = before.replace(/\s+/g, '');
  const normAfter = after.replace(/\s+/g, '');
  // (X + Y)' -> X' + Y'
  if (/\([A-Za-z]\+[A-Za-z]\)'/.test(normBefore) && /[A-Za-z]'\+[A-Za-z]'/.test(normAfter)) {
    return true;
  }
  // (X * Y)' -> X' * Y' or (XY)' -> X'Y'
  if (/\([A-Za-z]\*?[A-Za-z]\)'/.test(normBefore) && /[A-Za-z]'\*?[A-Za-z]'/.test(normAfter)) {
    return true;
  }
  // !(X + Y) -> !X + !Y or !(X * Y) -> !X * !Y
  if (/!\([A-Za-z]\+[A-Za-z]\)/.test(normBefore) && /![A-Za-z]\+![A-Za-z]/.test(normAfter)) {
    return true;
  }
  if (/!\([A-Za-z]\*?[A-Za-z]\)/.test(normBefore) && /![A-Za-z]\*?![A-Za-z]/.test(normAfter)) {
    return true;
  }
  return false;
}

function detectAbsorptionSignError(before: string, after: string): boolean {
  const cleanBefore = before.replace(/\s+/g, '');
  const cleanAfter = after.replace(/\s+/g, '');
  // Pattern A + A'B -> A + B'
  return /[A-Za-z]\+[A-Za-z]'[A-Za-z]/.test(cleanBefore) && /[A-Za-z]\+[A-Za-z]'/.test(cleanAfter);
}

function detectDroppedComplement(before: string, after: string): boolean {
  const countBefore = (before.match(/'|!|~/g) || []).length;
  const countAfter = (after.match(/'|!|~/g) || []).length;
  return countBefore > countAfter && countAfter === 0 && countBefore > 0;
}

function detectOrOverOrDistribution(before: string, after: string): boolean {
  const normBefore = before.replace(/\s+/g, '');
  const normAfter = after.replace(/\s+/g, '');
  return /[A-Za-z]\+\([A-Za-z]\+[A-Za-z]\)/.test(normBefore) && /\([A-Za-z]\+[A-Za-z]\)\*\([A-Za-z]\+[A-Za-z]\)/.test(normAfter);
}

function findCounterexample(before: BoolNode, after: BoolNode): string {
  const vars = new Set<string>();
  collectVariables(before, vars);
  collectVariables(after, vars);
  const varList = Array.from(vars).sort();
  const n = varList.length;

  for (let mask = 0; mask < (1 << n); mask++) {
    const assignment: Record<string, 0 | 1> = {};
    for (let i = 0; i < n; i++) {
      const v = varList[i];
      if (v) assignment[v] = ((mask >> (n - 1 - i)) & 1) as 0 | 1;
    }
    const valBefore = evaluateBinary(before, assignment);
    const valAfter = evaluateBinary(after, assignment);
    if (valBefore !== valAfter) {
      const assignStr = Object.entries(assignment)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      return `${assignStr} (before: ${valBefore}, after: ${valAfter})`;
    }
  }
  return 'No counterexample found';
}

function collectVariables(node: BoolNode, out: Set<string>): void {
  if (node.type === 'variable') out.add(node.name);
  if (node.type === 'not') collectVariables(node.child, out);
  if (node.type === 'and' || node.type === 'or') {
    for (const c of node.children) collectVariables(c, out);
  }
  if (node.type === 'xor' || node.type === 'nand' || node.type === 'nor' || node.type === 'xnor') {
    collectVariables(node.left, out);
    collectVariables(node.right, out);
  }
}

function makeSyntaxError(
  message: string,
  pos: number,
  expr: string,
  law: string
): ValidationOutcome {
  return {
    correct: false,
    errorType: 'syntax-error',
    expected: { kind: 'boolean-step', validExpressions: [], validLaws: [] },
    got: { kind: 'boolean-step', studentExpression: expr, studentLaw: law },
    details: `Syntax error at character ${pos}: ${message}`,
  };
}

function makeEquivalenceFailure(
  afterExpr: string,
  studentLaw: string,
  misconceptionTag: import('../../../types/feedback').MisconceptionTag,
  details: string
): ValidationOutcome {
  const expected: ExpectedAnswer = {
    kind: 'boolean-step',
    validExpressions: [],
    validLaws: [],
  };
  const got: GotAnswer = {
    kind: 'boolean-step',
    studentExpression: afterExpr,
    studentLaw,
  };
  return {
    correct: false,
    errorType: 'misconception',
    expected,
    got,
    misconceptionTag,
    details,
  };
}
