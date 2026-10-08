/**
 * @file feedbackEngine.ts
 *
 * RESEARCH CONTEXT:
 * The contribution is STEP-LEVEL diagnosis, not final-answer checking.
 * Every verdict comes from exact deterministic code comparing the student's step
 * with the engine's correct result. An LLM may never decide correctness (that is a
 * later, optional, display-only layer).
 * `ok` and every diagnosis field are produced here only.
 */

import type {
  AnswerTrapFlag,
  FeedbackFailure,
  FeedbackResult,
  FeedbackSuccess,
  MisconceptionTag,
  StepSubmission,
  StudentAnswer,
} from '../../types/feedback';
import { getValidator, registerValidator } from './validatorRegistry';
import { validateNumberConversion } from './validators/numberConversion';
import { validateBooleanStep } from './validators/booleanStep';
import { validateKMapGroup, validateKMapGroupSet } from './validators/kmapGroup';
import { buildDiagnosis } from './diagnosis';
import { detectAnswerTrap } from './answerTrap';
import type { StepContext, ValidationOutcome } from './types';

// ============================================================================
// Automatic Import-Time Validator Registrations
// ============================================================================
try {
  registerValidator('number-conversion-step', validateNumberConversion);
} catch {
  // Ignore in case of re-import
}

try {
  registerValidator('boolean-step', validateBooleanStep);
} catch {
  // Ignore in case of re-import
}

try {
  registerValidator('kmap-group', validateKMapGroup);
} catch {
  // Ignore in case of re-import
}

try {
  registerValidator('kmap-group-set', validateKMapGroupSet);
} catch {
  // Ignore in case of re-import
}

/**
 * Result of evaluating an entire student exercise attempt.
 */
export interface AttemptEvaluationResult {
  readonly stepResults: readonly FeedbackResult[];
  readonly answerTrap: AnswerTrapFlag | null;
  readonly overall: boolean;
}

/**
 * Evaluates a single student step submission deterministically.
 *
 * @param submission Student step submission payload
 * @param context Problem metadata and prior state context
 */
export function evaluateStep(
  submission: StepSubmission,
  context?: StepContext
): FeedbackResult {
  const kind = submission.studentAnswer.kind;
  const validator = getValidator(kind);

  if (!validator) {
    const failure: FeedbackFailure = {
      ok: false,
      diagnoses: [
        {
          step: submission.stepId,
          errorType: 'syntax-error',
          expected: { kind: 'boolean-step', validExpressions: [], validLaws: [] },
          got: { kind: 'boolean-step', studentExpression: '', studentLaw: '' },
          hint: `No validator is currently registered for submission kind "${kind}".`,
          fullExplanation: `Unknown step submission kind "${kind}". Ensure the module validator is registered.`,
        },
      ],
    };
    return failure;
  }

  const outcome = validator(submission, context);

  if (outcome.correct) {
    const success: FeedbackSuccess = {
      ok: true,
      message: 'Step is correct.',
    };
    return success;
  }

  const diagnosis = buildDiagnosis(outcome, submission.stepId, context);
  const failure: FeedbackFailure = {
    ok: false,
    diagnoses: [diagnosis],
  };
  return failure;
}

/**
 * Evaluates an entire sequence of steps forming a complete student attempt.
 *
 * @param steps Chronological sequence of step submissions
 * @param finalAnswer Terminal student answer payload
 * @param context Problem metadata context
 */
export function evaluateAttempt(
  steps: readonly StepSubmission[],
  finalAnswer: StudentAnswer,
  context?: StepContext & { readonly expectedFinalAnswer?: string }
): AttemptEvaluationResult {
  const stepResults: FeedbackResult[] = [];
  const outcomes: ValidationOutcome[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step) continue;
    const priorContext: StepContext = {
      ...context,
      previousStepAnswer:
        i > 0 && steps[i - 1]?.studentAnswer.kind === 'boolean-step'
          ? (steps[i - 1]?.studentAnswer as { resultingExpression: string }).resultingExpression
          : context?.previousStepAnswer,
    };
    const res = evaluateStep(step, priorContext);
    stepResults.push(res);

    if (res.ok) {
      outcomes.push({ correct: true });
    } else {
      const diag = res.diagnoses[0];
      outcomes.push({
        correct: false,
        errorType: diag ? diag.errorType : 'syntax-error',
        expected: diag ? diag.expected : { kind: 'boolean-step', validExpressions: [], validLaws: [] },
        got: diag ? diag.got : { kind: 'boolean-step', studentExpression: '', studentLaw: '' },
        misconceptionTag: diag?.misconceptionTag,
        details: diag?.fullExplanation,
      });
    }
  }

  const expectedFinal = context?.expectedFinalAnswer ?? '';
  let finalAnsStr = '';
  if (finalAnswer.kind === 'boolean-step') {
    finalAnsStr = finalAnswer.resultingExpression;
  } else if (finalAnswer.kind === 'number-conversion-step') {
    finalAnsStr = finalAnswer.finalAnswer;
  } else if (finalAnswer.kind === 'kmap-group-set') {
    finalAnsStr = finalAnswer.expression ?? '';
  } else if (finalAnswer.kind === 'kmap-group') {
    finalAnsStr = finalAnswer.expression;
  }

  const trapPayload = {
    steps,
    outcomes,
    finalAnswer: finalAnsStr,
    expectedFinalAnswer: expectedFinal,
  };
  const answerTrap = detectAnswerTrap(trapPayload);

  const allStepsOk = stepResults.every((r) => r.ok);
  const overall = allStepsOk && (!expectedFinal || finalAnsStr.trim() === expectedFinal.trim());

  return {
    stepResults,
    answerTrap,
    overall,
  };
}

/**
 * Summarizes an evaluation result for telemetry logging without leaking freeform text.
 *
 * @param result Feedback evaluation result
 */
export function summarizeForLog(
  result: FeedbackResult
): {
  readonly isCorrect: boolean;
  readonly misconceptionTag?: MisconceptionTag;
} {
  if (result.ok) {
    return { isCorrect: true };
  }
  const firstDiagnosis = result.diagnoses[0];
  return {
    isCorrect: false,
    misconceptionTag: firstDiagnosis?.misconceptionTag,
  };
}
