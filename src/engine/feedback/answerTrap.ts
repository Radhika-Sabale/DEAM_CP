/**
 * @file answerTrap.ts
 * Deterministic detection of "answer traps": situations where a student arrives at
 * a correct terminal answer through invalid intermediate steps, algebraic leaps,
 * broken reasoning chains, or direct level-3 worked hint reveals.
 */

import type { AnswerTrapFlag, StepSubmission } from '../../types/feedback';
import { parse } from '../boolean/parser';
import { areEquivalent } from '../boolean/equivalence';
import type { ValidationOutcome } from './types';

/**
 * Parameter payload for answer trap analysis.
 */
export interface AttemptChainPayload {
  readonly steps: readonly StepSubmission[];
  readonly outcomes: readonly ValidationOutcome[];
  readonly finalAnswer: string;
  readonly expectedFinalAnswer: string;
  readonly assistedSteps?: readonly string[];
}

/**
 * Evaluates a sequence of student steps and final answer to identify answer traps.
 *
 * @param payload The attempt chain containing steps, outcomes, and answers
 * @returns An AnswerTrapFlag if a trap condition is detected, null otherwise
 */
export function detectAnswerTrap(payload: AttemptChainPayload): AnswerTrapFlag | null {
  const { steps, outcomes, finalAnswer, expectedFinalAnswer, assistedSteps = [] } = payload;
  const isFinalCorrect = finalAnswer.trim().toLowerCase() === expectedFinalAnswer.trim().toLowerCase();

  const offendingSteps: string[] = [];
  const reasons: string[] = [];

  // Check 1: Incorrect intermediate step while final answer is correct
  for (let i = 0; i < steps.length; i++) {
    const outcome = outcomes[i];
    const step = steps[i];
    if (outcome && !outcome.correct && step) {
      offendingSteps.push(`step-${i + 1}`);
      reasons.push(
        `Step ${i + 1} (${step.stepId}) was incorrect (${outcome.errorType}), yet subsequent steps compensated for the error.`
      );
    }
  }

  // Check 2: Step-to-step chain consistency (step[i].before must follow from step[i-1].after)
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1]?.studentAnswer;
    const curr = steps[i]?.studentAnswer;

    if (prev && curr && prev.kind === 'boolean-step' && curr.kind === 'boolean-step') {
      const prevAfter = prev.resultingExpression.trim();
      const currResult = curr.resultingExpression.trim();

      // Check whether step i resulted in an algebraic jump without equivalence
      const parsePrev = parse(prevAfter);
      const parseCurr = parse(currResult);

      if (parsePrev.ok && parseCurr.ok) {
        // If the student claimed a transformation, but current does not logically follow from previous
        const follows = areEquivalent(parsePrev.ast, parseCurr.ast);
        if (!follows) {
          const stepKey = `step-${i + 1}`;
          if (!offendingSteps.includes(stepKey)) {
            offendingSteps.push(stepKey);
          }
          reasons.push(
            `Step ${i + 1} does not logically follow from step ${i}. The premise was altered between steps.`
          );
        }
      }
    }
  }

  // Check 3: Final answer correct only after Level 3 worked step hint
  const finalStepKey = steps.length > 0 ? steps[steps.length - 1]?.stepId : undefined;
  if (isFinalCorrect && finalStepKey && assistedSteps.includes(finalStepKey)) {
    reasons.push('The step was completed only after a Level 3 worked hint revealed the solution.');
  }

  // If no discrepancies found, or if final answer is not correct and no chain inconsistency
  if (offendingSteps.length === 0 && reasons.length === 0) {
    return null;
  }

  // Only trigger AnswerTrap when final answer is correct despite flaws, or when chain is broken
  if (!isFinalCorrect && offendingSteps.length === 0) {
    return null;
  }

  const notes = isFinalCorrect
    ? `Your final answer is right, but ${reasons.join(' ')}`
    : `Inconsistent reasoning chain detected: ${reasons.join(' ')}`;

  return {
    finalAnswerCorrect: isFinalCorrect,
    inconsistentSteps: offendingSteps,
    notes,
  };
}
