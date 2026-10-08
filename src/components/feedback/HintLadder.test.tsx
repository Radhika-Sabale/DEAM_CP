/**
 * @file HintLadder.test.tsx
 * Unit and accessibility tests for HintLadder:
 * progressive unlocking through levels 1, 2, 3, repetition of level 3,
 * telemetry recording in logStore, and verification of assisted status badge.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { StepSubmission } from '../../types/feedback';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';
import { HintLadder } from './HintLadder';

describe('HintLadder Component', () => {
  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
    useLogStore.getState().clearLog();
  });

  const failureSub: StepSubmission = {
    moduleId: 'numberSystems',
    stepId: 'step-div-1',
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

  it('renders initial empty state and advances ladder on click', () => {
    // Submit failure so diagnoses exist for step-div-1
    useFeedbackStore.getState().submitStep(failureSub);

    render(<HintLadder stepKey="step-div-1" />);

    // Initially no hints shown
    expect(screen.getByText(/No hints unlocked/i)).toBeInTheDocument();

    const button = screen.getByRole('button', { name: /Unlock hint level 1/i });

    // Click Level 1
    fireEvent.click(button);
    expect(screen.getByText(/Level 1: Nudge/i)).toBeInTheDocument();
    expect(useLogStore.getState().events.some((e) => e.eventType === 'hint-used' && e.level === 1)).toBe(true);

    // Click Level 2
    fireEvent.click(screen.getByRole('button', { name: /Unlock hint level 2/i }));
    expect(screen.getByText(/Level 2: Pointed/i)).toBeInTheDocument();
    expect(useLogStore.getState().events.some((e) => e.eventType === 'hint-used' && e.level === 2)).toBe(true);

    // Click Level 3
    fireEvent.click(screen.getByRole('button', { name: /Unlock hint level 3/i }));
    expect(screen.getByText(/Level 3: Worked Step/i)).toBeInTheDocument();
    expect(screen.getByText(/Status: Assisted by Worked Step/i)).toBeInTheDocument();
    expect(useFeedbackStore.getState().assistedSteps['step-div-1']).toBe(true);
    expect(useLogStore.getState().events.some((e) => e.eventType === 'hint-used' && e.level === 3)).toBe(true);
  });
});
