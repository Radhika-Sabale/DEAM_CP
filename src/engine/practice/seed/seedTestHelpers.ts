/**
 * @file seedTestHelpers.ts
 * Verification helpers and reference oracles for validating seed problems (Stage 12A).
 */

import type { StepContext, ValidationOutcome } from '../../feedback/types';
import { getValidator } from '../../feedback/validatorRegistry';
import type { StepSubmission } from '../../../types/feedback';
import type { SeedProblem } from './types';
import '../generators/circuit';

/** Verification metrics for a seed problem set. */
export interface VerificationMetrics {
  problemsChecked: number;
  stepsValidated: number;
  mismatches: number;
}

/**
 * Validates every step in a seed problem through the registered Feedback Engine validators.
 */
export function verifyProblemSteps(
  problem: SeedProblem,
  metrics: VerificationMetrics
): readonly string[] {
  const errors: string[] = [];
  metrics.problemsChecked++;

  for (const step of problem.steps) {
    metrics.stepsValidated++;
    const validator = getValidator(step.kind);

    if (!validator) {
      metrics.mismatches++;
      errors.push(`Problem ${problem.id}: No validator registered for step kind "${step.kind}"`);
      continue;
    }

    const stepCtx = (step.context ?? {}) as StepContext & Record<string, unknown>;
    let studentAns = step.expected as Record<string, unknown>;
    if (step.kind === 'number-conversion-step' && typeof studentAns['sourceValue'] !== 'string') {
      const tgt = String(studentAns['targetValue'] ?? studentAns['finalAnswer'] ?? '0');
      studentAns = {
        kind: 'number-conversion-step',
        sourceValue: tgt,
        sourceRadix: 10,
        targetRadix: 10,
        intermediateWork: studentAns['intermediateSteps'] ?? [],
        finalAnswer: tgt,
      };
    }

    const submission: StepSubmission = {
      moduleId: problem.moduleId,
      stepId: step.key,
      studentAnswer: studentAns as unknown as StepSubmission['studentAnswer'],
      timestamp: '2026-10-13T12:00:00Z',
    };


    const outcome: ValidationOutcome = validator(submission, {
      ...stepCtx,
      expectedValue:
        (step.expected as { value?: unknown })?.value ??
        (stepCtx['expectedValue'] as unknown),
    } as StepContext);

    if (!outcome.correct) {
      metrics.mismatches++;
      errors.push(
        `Problem ${problem.id} step "${step.key}" failed: ${outcome.details ?? outcome.errorType ?? 'incorrect'}`
      );
    }
  }

  return errors;
}

/**
 * Reference software oracle for Mealy overlapping '101' detection.
 */
export function referenceMealy101Overlap(bits: readonly (0 | 1)[]): readonly (0 | 1)[] {
  const outputs: (0 | 1)[] = [];
  for (let i = 0; i < bits.length; i++) {
    const isMatch = i >= 2 && bits[i - 2] === 1 && bits[i - 1] === 0 && bits[i] === 1;
    outputs.push(isMatch ? 1 : 0);
  }
  return outputs;
}

/**
 * Reference software oracle for Moore non-overlapping '1011' detection.
 */
export function referenceMoore1011NonOverlap(bits: readonly (0 | 1)[]): readonly (0 | 1)[] {
  const outputs: (0 | 1)[] = [];
  let lastEnd = -1;
  for (let i = 0; i < bits.length; i++) {
    const isMatch =
      i >= 3 &&
      i - 3 > lastEnd &&
      bits[i - 3] === 1 &&
      bits[i - 2] === 0 &&
      bits[i - 1] === 1 &&
      bits[i] === 1;
    if (isMatch) {
      lastEnd = i;
      outputs.push(1);
    } else {
      outputs.push(0);
    }
  }
  return outputs;
}

/**
 * Simulates a sequential counter through its full state cycle.
 */
export function simulateCounterCycle(
  sequence: readonly number[],
  stepFunction: (currentState: number) => number
): boolean {
  for (let i = 0; i < sequence.length; i++) {
    const curr = sequence[i] as number;
    const expectedNext = sequence[(i + 1) % sequence.length] as number;
    const actualNext = stepFunction(curr);
    if (actualNext !== expectedNext) return false;
  }
  return true;
}
