/**
 * @file verifyStepLockout.ts
 * Verifier for unused state lockout and deadlock claims (Stage 10C).
 */

import type { LockoutReport } from './lockout';
import type {
  LockoutClaimVerificationResult,
  StepItemResult,
  StepVerificationSummary,
} from './verifyStepTypes';

/**
 * Verifies student claims about which unused states lock out.
 * Compares claimed states against the engine's canonical lockout analysis.
 */
export function verifyLockoutClaim(
  claimedStates: readonly number[],
  analysis: LockoutReport
): LockoutClaimVerificationResult {
  const lockedOrIndet = new Set<number>();
  for (const s of analysis.lockedStates) {
    lockedOrIndet.add(s);
  }
  for (const s of analysis.indeterminateStates) {
    lockedOrIndet.add(s);
  }

  const claimedSet = new Set<number>(claimedStates);

  const missing: number[] = [];
  for (const s of lockedOrIndet) {
    if (!claimedSet.has(s)) {
      missing.push(s);
    }
  }

  const extra: number[] = [];
  for (const c of claimedSet) {
    if (!lockedOrIndet.has(c)) {
      extra.push(c);
    }
  }

  const items: StepItemResult[] = [];
  let correctCount = 0;

  for (const s of lockedOrIndet) {
    const isClaimed = claimedSet.has(s);
    if (isClaimed) {
      correctCount++;
      items.push({
        id: `lockout:${s}`,
        status: 'correct',
        expected: s,
        got: s,
        message: `Correctly identified state ${s} as non-recovering`,
      });
    } else {
      items.push({
        id: `lockout:${s}`,
        status: 'missing',
        expected: s,
        message: `State ${s} does not return to a valid state but was omitted from the lockout claim`,
      });
    }
  }

  for (const e of extra) {
    items.push({
      id: `lockout:extra:${e}`,
      status: 'incorrect',
      got: e,
      message: `State ${e} is claimed to lock out, but it safely transitions back to valid states`,
    });
  }

  const correct = missing.length === 0 && extra.length === 0;
  const total = items.length;
  const summary: StepVerificationSummary = {
    allCorrect: correct,
    correctCount,
    total,
  };

  return {
    correct,
    missing,
    extra,
    items,
    summary,
  };
}
