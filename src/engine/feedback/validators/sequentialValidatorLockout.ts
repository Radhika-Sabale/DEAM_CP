/**
 * @file sequentialValidatorLockout.ts
 * Validator handler for lockout and deadlock claim steps.
 */

import type { ExpectedAnswer, GotAnswer, StepSubmission } from '../../../types/feedback';
import { designSequential } from '../../sequential/counterDesigner';
import { analyzeLockout } from '../../sequential/lockout';
import { verifyLockoutClaim } from '../../sequential/verifyStep';
import type { StepContext, ValidationOutcome } from '../types';
import type { SequentialValidationContext } from './sequentialValidatorTypes';

/**
 * Validates a student claim of which unused state codes are lockout-prone or indeterminate.
 */
export function validateSeqLockoutClaim(
  submission: StepSubmission,
  context?: StepContext & SequentialValidationContext
): ValidationOutcome {
  const ctx = context?.sequential ?? context;
  const spec = ctx?.spec ?? { kind: 'counter', flipFlop: 'D', style: 'sync', direction: 'up', modulus: 5 };
  const dRes = designSequential(spec, { unusedRedirects: ctx?.unusedRedirects });
  if (!dRes.ok) {
    return {
      correct: false,
      errorType: 'syntax-error',
      expected: { kind: 'state-table-row', nextState: '[]' },
      got: { kind: 'state-table-row', nextState: '[]' },
      details: `Invalid sequential specification: ${dRes.errors.map((e) => e.message).join(', ')}`,
    };
  }

  const analysis = analyzeLockout({
    table: dRes.design.table,
    equations: dRes.design.equations,
    flipFlop: spec.flipFlop ?? 'D',
  });

  const ans = submission.studentAnswer;
  let claimedList: number[] = [];
  if ('lockedStates' in ans && Array.isArray((ans as { lockedStates: unknown }).lockedStates)) {
    claimedList = (ans as { lockedStates: number[] }).lockedStates;
  } else if ('claimedStates' in ans && Array.isArray((ans as { claimedStates: unknown }).claimedStates)) {
    claimedList = (ans as { claimedStates: number[] }).claimedStates;
  } else if ('value' in ans && Array.isArray((ans as { value: unknown }).value)) {
    claimedList = (ans as unknown as { value: number[] }).value;
  }

  const trueLockout = Array.from(new Set([...analysis.lockedStates, ...analysis.indeterminateStates])).sort((a, b) => a - b);
  const claimRes = verifyLockoutClaim(claimedList, analysis);

  if (claimRes.correct) {
    return { correct: true };
  }

  const expected: ExpectedAnswer = {
    kind: 'state-table-row',
    nextState: `[${trueLockout.join(', ')}]`,
  };
  const got: GotAnswer = {
    kind: 'state-table-row',
    nextState: `[${claimedList.join(', ')}]`,
  };

  if (claimRes.missing.length > 0) {
    return {
      correct: false,
      errorType: 'misconception',
      expected,
      got,
      misconceptionTag: 'ignored-lockout-state',
      details: `Omitted lockout-prone or indeterminate unused state(s): [${claimRes.missing.join(', ')}]. These unused states do not recover to valid operational states.`,
    };
  }

  return {
    correct: false,
    errorType: 'incorrect-transition',
    expected,
    got,
    misconceptionTag: 'other',
    details: `Claimed state(s) [${claimRes.extra.join(', ')}] are not lockout-prone; they safely recover to valid operational states.`,
  };
}
