/**
 * @file kmapGroup.ts
 * Deterministic pedagogical validator for student K-map group drawings and complete covers.
 *
 * Registers validators for 'kmap-group' and 'kmap-group-set' submission kinds.
 */

import type {
  ExpectedAnswer,
  GotAnswer,
  StepSubmission,
} from '../../../types/feedback';
import {
  type GroupValidationContext,
  validateGroup,
  validateGroupSet,
} from '../../kmap/groupValidator';
import { solveSOP, solvePOS } from '../../kmap/solver';
import { registerValidator } from '../validatorRegistry';
import type { StepContext, ValidationOutcome } from '../types';

/**
 * Validates a single K-map group drawing step.
 */
export function validateKMapGroup(
  submission: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (submission.studentAnswer.kind !== 'kmap-group') {
    return {
      correct: false,
      errorType: 'syntax-error',
      expected: { kind: 'kmap-group', validGroups: [], minimalExpression: '' },
      got: { kind: 'kmap-group', studentGroup: [], studentExpression: '' },
      details: `Invalid submission kind for K-map group validator: "${submission.studentAnswer.kind}"`,
    };
  }

  const ans = submission.studentAnswer;
  const kCtx = context?.kmap;
  const varCount = kCtx?.variableCount ?? 4;
  const minterms = kCtx?.minterms ?? [];
  const dontCares = kCtx?.dontCares ?? [];
  const mode = kCtx?.mode ?? 'SOP';
  const groupsSoFar = kCtx?.groupsSoFar ?? [];

  const groupCtx: GroupValidationContext = {
    variableCount: varCount,
    minterms,
    dontCares,
    mode,
    groupsSoFar,
    variableNames: kCtx?.variableNames,
  };

  const res = validateGroup(groupCtx, ans.selectedCells);

  if (res.valid) {
    return { correct: true };
  }

  const finding = res.primaryFinding;
  const solverRes =
    mode === 'SOP'
      ? solveSOP(varCount, minterms, dontCares)
      : solvePOS(varCount, minterms, dontCares);

  const minimalExpression = solverRes.ok
    ? solverRes.solution.primarySolution.expressionString
    : kCtx?.expectedExpression ?? '';

  const validGroups = solverRes.ok
    ? solverRes.solution.primarySolution.primeImplicants.map((p) => p.minterms)
    : [];

  const expected: ExpectedAnswer = {
    kind: 'kmap-group',
    validGroups,
    minimalExpression,
  };

  const got: GotAnswer = {
    kind: 'kmap-group',
    studentGroup: ans.selectedCells,
    studentExpression: ans.expression,
  };

  let errorType: import('../../../types/feedback').ErrorType = 'invalid-group';
  if (finding?.misconceptionTag === 'group-not-maximal' || finding?.misconceptionTag === 'redundant-group') {
    errorType = 'suboptimal-group';
  } else if (finding?.misconceptionTag) {
    errorType = 'misconception';
  }

  return {
    correct: false,
    errorType,
    expected,
    got,
    misconceptionTag: finding?.misconceptionTag,
    details: finding?.message,
  };
}

/**
 * Validates a complete set of K-map groups submitted as the final solution.
 */
export function validateKMapGroupSet(
  submission: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (submission.studentAnswer.kind !== 'kmap-group-set') {
    return {
      correct: false,
      errorType: 'syntax-error',
      expected: { kind: 'kmap-group-set', minimalGroups: [], minimalExpression: '' },
      got: { kind: 'kmap-group-set', studentGroups: [] },
      details: `Invalid submission kind for K-map group set validator: "${submission.studentAnswer.kind}"`,
    };
  }

  const ans = submission.studentAnswer;
  const kCtx = context?.kmap;
  const varCount = kCtx?.variableCount ?? 4;
  const minterms = kCtx?.minterms ?? [];
  const dontCares = kCtx?.dontCares ?? [];
  const mode = kCtx?.mode ?? 'SOP';

  const groupCtx: GroupValidationContext = {
    variableCount: varCount,
    minterms,
    dontCares,
    mode,
    variableNames: kCtx?.variableNames,
  };

  const setRes = validateGroupSet(groupCtx, ans.groups);

  const solverRes =
    mode === 'SOP'
      ? solveSOP(varCount, minterms, dontCares)
      : solvePOS(varCount, minterms, dontCares);

  const minimalExpression = solverRes.ok
    ? solverRes.solution.primarySolution.expressionString
    : kCtx?.expectedExpression ?? '';

  const minimalGroups = solverRes.ok
    ? solverRes.solution.primarySolution.primeImplicants.map((p) => p.minterms)
    : [];

  const expected: ExpectedAnswer = {
    kind: 'kmap-group-set',
    minimalGroups,
    minimalExpression,
  };

  const got: GotAnswer = {
    kind: 'kmap-group-set',
    studentGroups: ans.groups,
    studentExpression: ans.expression,
  };

  if (setRes.valid && setRes.isMinimal) {
    return { correct: true };
  }

  const firstError = setRes.errors[0];

  return {
    correct: false,
    errorType: firstError?.errorType === 'empty-selection' ? 'uncovered-minterm' : 'suboptimal-group',
    expected,
    got,
    misconceptionTag: firstError?.misconceptionTag,
    details: firstError?.message ?? 'K-map solution is not minimal.',
  };
}

// Auto-register at import time
try {
  registerValidator('kmap-group', validateKMapGroup);
} catch {
  // Ignore in case of duplicate registration
}

try {
  registerValidator('kmap-group-set', validateKMapGroupSet);
} catch {
  // Ignore in case of duplicate registration
}
