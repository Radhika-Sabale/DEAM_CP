/**
 * @file StepChecker.test.tsx
 * Unit and integration tests for StepChecker component:
 * submission execution, success indicator rendering, DiagnosisCard appearance on failure,
 * and double-submit debounce prevention.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { StepSubmission } from '../../types/feedback';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';
import { StepChecker } from './StepChecker';

describe('StepChecker Component', () => {
  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
    useLogStore.getState().clearLog();
  });

  it('correct submission displays success state and logs step-submitted event', () => {
    const onSuccess = vi.fn();
    const buildSub = (): StepSubmission => ({
      moduleId: 'boolean',
      stepId: 'step-identity',
      timestamp: '2026-10-05T00:00:00Z',
      studentAnswer: { kind: 'boolean-step', appliedLaw: 'identity', resultingExpression: 'A' },
    });

    render(
      <StepChecker
        moduleId="boolean"
        stepId="step-identity"
        title="Identity Practice"
        buildSubmission={buildSub}
        context={{ previousStepAnswer: 'A + 0' }}
        onSuccess={onSuccess}
        renderInput={() => <input data-testid="test-input" readOnly value="A" />}
      />
    );

    const checkBtn = screen.getByRole('button', { name: /Check My Step/i });
    fireEvent.click(checkBtn);

    expect(screen.getByText(/Correct! Step verified/i)).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledTimes(1);

    const events = useLogStore.getState().events;
    expect(events.some((e) => e.eventType === 'step-submitted' && e.isCorrect === true)).toBe(true);
  });

  it('wrong submission displays DiagnosisCard with misconception headline', () => {
    const buildSub = (): StepSubmission => ({
      moduleId: 'numberSystems',
      stepId: 'step-div',
      timestamp: '2026-10-05T00:00:00Z',
      studentAnswer: {
        kind: 'number-conversion-step',
        sourceValue: '13',
        sourceRadix: 10,
        targetRadix: 2,
        intermediateWork: [],
        finalAnswer: '1011', // reversed remainders
      },
    });

    render(
      <StepChecker
        moduleId="numberSystems"
        stepId="step-div"
        title="Division Practice"
        buildSubmission={buildSub}
        renderInput={() => <input data-testid="test-input" readOnly value="1011" />}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Check My Step/i }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Cognitive Diagnosis: Reversed Division Remainder Order/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
  });

  it('try again button clears diagnosis and allows resubmission', () => {
    let answer = '1011';
    const buildSub = (): StepSubmission => ({
      moduleId: 'numberSystems',
      stepId: 'step-div',
      timestamp: '2026-10-05T00:00:00Z',
      studentAnswer: {
        kind: 'number-conversion-step',
        sourceValue: '13',
        sourceRadix: 10,
        targetRadix: 2,
        intermediateWork: [],
        finalAnswer: answer,
      },
    });

    render(
      <StepChecker
        moduleId="numberSystems"
        stepId="step-div"
        title="Division Practice"
        buildSubmission={buildSub}
        renderInput={() => <input data-testid="test-input" readOnly value={answer} />}
      />
    );

    // First attempt: wrong
    fireEvent.click(screen.getByRole('button', { name: /Check My Step/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Click Try Again
    fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Second attempt: correct
    answer = '1101';
    fireEvent.click(screen.getByRole('button', { name: /Check My Step/i }));
    expect(screen.getByText(/Correct! Step verified/i)).toBeInTheDocument();
  });

  it('ignores double submissions while debouncing', () => {
    const submitSpy = vi.spyOn(useFeedbackStore.getState(), 'submitStep');
    const buildSub = (): StepSubmission => ({
      moduleId: 'boolean',
      stepId: 'step-identity-double',
      timestamp: '2026-10-05T00:00:00Z',
      studentAnswer: { kind: 'boolean-step', appliedLaw: 'identity', resultingExpression: 'A' },
    });

    render(
      <StepChecker
        moduleId="boolean"
        stepId="step-identity-double"
        title="Double Submit Test"
        buildSubmission={buildSub}
        renderInput={() => <input data-testid="test-input" readOnly value="A" />}
      />
    );

    const checkBtn = screen.getByRole('button', { name: /Check My Step/i });
    fireEvent.click(checkBtn);
    fireEvent.click(checkBtn);

    expect(submitSpy).toHaveBeenCalledTimes(1);
  });
});
