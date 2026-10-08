/**
 * @file feedbackStore.test.ts
 * Unit tests for feedback store:
 * step submissions, telemetry forwarding to logStore, progressive hints,
 * assisted flag tracking, answer trap recording, and proof of immutability invariant
 * when toggling optional LLM rephrasing feature flags.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { StepSubmission } from '../types/feedback';
import { useFeedbackStore } from './feedbackStore';
import { useLogStore } from './logStore';

describe('Feedback Store Unit Tests', () => {
  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
    useLogStore.getState().clearLog();
    useFeedbackStore.getState().setLlmHintsEnabled(false);
  });

  const correctSubmission: StepSubmission = {
    moduleId: 'boolean',
    stepId: 'step-1',
    timestamp: '2026-10-05T00:00:00Z',
    studentAnswer: {
      kind: 'boolean-step',
      appliedLaw: 'identity',
      resultingExpression: 'A',
    },
  };

  const incorrectSubmission: StepSubmission = {
    moduleId: 'numberSystems',
    stepId: 'step-2',
    timestamp: '2026-10-05T00:00:00Z',
    studentAnswer: {
      kind: 'number-conversion-step',
      sourceValue: '13',
      sourceRadix: 10,
      targetRadix: 2,
      intermediateWork: [],
      finalAnswer: '1011', // reversed remainders
    },
  };

  it('submitStep records correct submission and forwards telemetry event to logStore', () => {
    const res = useFeedbackStore.getState().submitStep(correctSubmission, {
      previousStepAnswer: 'A + 0',
    });

    expect(res.ok).toBe(true);
    expect(useFeedbackStore.getState().attemptHistory['step-1']?.length).toBe(1);

    const loggedEvents = useLogStore.getState().events;
    expect(loggedEvents.length).toBe(1);
    expect(loggedEvents[0]?.eventType).toBe('step-submitted');
    if (loggedEvents[0]?.eventType === 'step-submitted') {
      expect(loggedEvents[0].isCorrect).toBe(true);
    }
  });

  it('submitStep records incorrect submission, saves diagnosis, and logs telemetry', () => {
    const res = useFeedbackStore.getState().submitStep(incorrectSubmission);

    expect(res.ok).toBe(false);
    const diags = useFeedbackStore.getState().latestDiagnoses['step-2'];
    expect(diags?.length).toBe(1);
    expect(diags?.[0]?.misconceptionTag).toBe('wrong-remainder-order');

    const loggedEvents = useLogStore.getState().events;
    expect(loggedEvents.length).toBe(1);
    if (loggedEvents[0]?.eventType === 'step-submitted') {
      expect(loggedEvents[0].isCorrect).toBe(false);
      expect(loggedEvents[0].misconceptionTag).toBe('wrong-remainder-order');
    }
  });

  it('requestHint advances hint ladder and logs hint-used event', () => {
    useFeedbackStore.getState().submitStep(incorrectSubmission);

    const h1 = useFeedbackStore.getState().requestHint('step-2');
    expect(h1?.level).toBe(1);
    expect(useFeedbackStore.getState().assistedSteps['step-2']).toBeFalsy();

    const h2 = useFeedbackStore.getState().requestHint('step-2');
    expect(h2?.level).toBe(2);

    const h3 = useFeedbackStore.getState().requestHint('step-2');
    expect(h3?.level).toBe(3);
    expect(useFeedbackStore.getState().assistedSteps['step-2']).toBe(true);

    const events = useLogStore.getState().events.filter((e) => e.eventType === 'hint-used');
    expect(events.length).toBe(3);
  });

  it('resetStep clears step state while leaving other steps intact', () => {
    useFeedbackStore.getState().submitStep(correctSubmission, { previousStepAnswer: 'A + 0' });
    useFeedbackStore.getState().submitStep(incorrectSubmission);

    useFeedbackStore.getState().resetStep('step-1');
    expect(useFeedbackStore.getState().attemptHistory['step-1']).toBeUndefined();
    expect(useFeedbackStore.getState().attemptHistory['step-2']?.length).toBe(1);
  });

  it('completeAttempt detects answer trap when earlier step was wrong', () => {
    useFeedbackStore.getState().submitStep(incorrectSubmission);

    const trap = useFeedbackStore.getState().completeAttempt(
      {
        kind: 'number-conversion-step',
        sourceValue: '13',
        sourceRadix: 10,
        targetRadix: 2,
        intermediateWork: [],
        finalAnswer: '1101',
      },
      'numberSystems',
      { expectedFinalAnswer: '1101' }
    );

    expect(trap).not.toBeNull();
    expect(trap?.finalAnswerCorrect).toBe(true);
    expect(useFeedbackStore.getState().latestAnswerTrap).toBe(trap);
  });

  it('immutability invariant: toggling llmHints flag never mutates any deterministic diagnosis fields or ok verdict', () => {
    useFeedbackStore.getState().setLlmHintsEnabled(false);
    const resDisabled = useFeedbackStore.getState().submitStep(incorrectSubmission);

    const diag1 = useFeedbackStore.getState().latestDiagnoses['step-2']?.[0];
    expect(diag1).toBeDefined();

    useFeedbackStore.getState().setLlmHintsEnabled(true);
    const resEnabled = useFeedbackStore.getState().submitStep(incorrectSubmission);

    const diag2 = useFeedbackStore.getState().latestDiagnoses['step-2']?.[0];
    expect(diag2).toBeDefined();

    expect(resDisabled.ok).toBe(resEnabled.ok);
    expect(diag1?.errorType).toBe(diag2?.errorType);
    expect(JSON.stringify(diag1?.expected)).toBe(JSON.stringify(diag2?.expected));
    expect(JSON.stringify(diag1?.got)).toBe(JSON.stringify(diag2?.got));
    expect(diag1?.misconceptionTag).toBe(diag2?.misconceptionTag);
    expect(diag1?.fullExplanation).toBe(diag2?.fullExplanation);
  });
});
