/**
 * @file StepFrame.test.tsx
 * Unit and accessibility tests for StepFrame container component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StepFrame } from './StepFrame';
import { useLogStore } from '../../store/logStore';
import type { Diagnosis, AnswerTrapFlag } from '../../types/feedback';

describe('StepFrame component', () => {
  beforeEach(() => {
    useLogStore.getState().clearLog();
  });

  it('renders heading, instructions, and child contents with accessible landmarks', () => {
    render(
      <StepFrame
        stepId="table"
        title="State Transition Table"
        instructions="Map each state and input to the next state transition."
      >
        <div data-testid="step-child">Child table content</div>
      </StepFrame>
    );

    expect(screen.getByRole('heading', { level: 3, name: /State Transition Table/i })).toBeInTheDocument();
    expect(screen.getByText(/Map each state and input to the next state transition/i)).toBeInTheDocument();
    expect(screen.getByTestId('step-child')).toBeInTheDocument();

    // Verify step-started telemetry event logged on mount
    const events = useLogStore.getState().getEvents();
    expect(events.some((e) => e.eventType === 'step-started' && e.stepId === 'table')).toBe(true);
  });

  it('handles Check button interaction', () => {
    const handleCheck = vi.fn();
    render(
      <StepFrame
        stepId="diagram"
        title="State Diagram"
        instructions="Review transitions"
        onCheck={handleCheck}
      >
        <div>Content</div>
      </StepFrame>
    );

    const checkBtn = screen.getByRole('button', { name: /^Check$/i });
    fireEvent.click(checkBtn);
    expect(handleCheck).toHaveBeenCalledTimes(1);
  });

  it('shows confirmation dialog on Show me click, logs hint-used level 3 and invokes onShowMe upon confirmation', () => {
    const handleShowMe = vi.fn();
    render(
      <StepFrame
        stepId="table"
        title="State Table"
        instructions="Complete table"
        onShowMe={handleShowMe}
      >
        <div>Content</div>
      </StepFrame>
    );

    const showMeBtn = screen.getByRole('button', { name: /Show me/i });
    fireEvent.click(showMeBtn);

    // Confirmation dialog appears with explicit notice
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(
      screen.getByText(/This fills in the correct answer and marks the step as assisted/i)
    ).toBeInTheDocument();

    // Cancel first
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(handleShowMe).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    // Open again and confirm
    fireEvent.click(showMeBtn);
    const confirmBtn = screen.getByRole('button', { name: /Fill & Mark Assisted/i });
    fireEvent.click(confirmBtn);

    expect(handleShowMe).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    // Verify hint-used level 3 telemetry logged
    const hintEvents = useLogStore
      .getState()
      .getEvents()
      .filter((e) => e.eventType === 'hint-used');
    expect(hintEvents.length).toBe(1);
    expect(hintEvents[0]?.stepId).toBe('table');
    expect(hintEvents[0]?.level).toBe(3);
  });

  it('renders status message with icon and text without relying on color alone', () => {
    const { rerender } = render(
      <StepFrame
        stepId="equations"
        title="Equations"
        instructions="Derive excitation equations"
        status="verified"
        statusMessage="Verified: Equations are minimal."
      >
        <div>Content</div>
      </StepFrame>
    );

    expect(screen.getByText(/Verified: Equations are minimal/i)).toBeInTheDocument();

    rerender(
      <StepFrame
        stepId="equations"
        title="Equations"
        instructions="Derive excitation equations"
        status="assisted"
        statusMessage="Assisted: Completed with worked solution."
      >
        <div>Content</div>
      </StepFrame>
    );

    expect(screen.getByText(/Assisted: Completed with worked solution/i)).toBeInTheDocument();
  });

  it('renders DiagnosisCard, HintLadder, and AnswerTrapBanner when diagnostic state is provided', () => {
    const sampleDiag: Diagnosis = {
      step: 'seq-state-table-0-0-next',
      errorType: 'incorrect-transition',
      expected: { kind: 'state-table-row', nextState: 'S1' },
      got: { kind: 'state-table-row', nextState: 'S0' },
      hint: 'Check the next transition in the count sequence.',
      fullExplanation: 'Expected transition from 0 to 1.',
    };

    const sampleTrap: AnswerTrapFlag = {
      finalAnswerCorrect: true,
      inconsistentSteps: ['seq-state-table-0-0-next'],
      notes: 'Terminal answer is valid but reached via invalid transition logic.',
    };

    render(
      <StepFrame
        stepId="table"
        title="State Table"
        instructions="Table"
        lastDiagnosis={sampleDiag}
        lastFailedStepKey="seq-state-table-0-0-next"
        answerTrapFlag={sampleTrap}
      >
        <div>Table editor</div>
      </StepFrame>
    );

    // Diagnosis card rendered
    expect(screen.getByText(/Incorrect • seq-state-table-0-0-next/i)).toBeInTheDocument();
    expect(screen.getByText(/Check the next transition/i)).toBeInTheDocument();

    // Hint ladder rendered
    expect(screen.getByText(/Progressive Hint Ladder/i)).toBeInTheDocument();

    // Answer trap banner rendered
    expect(screen.getByRole('region', { name: /Pedagogical reasoning alert/i })).toBeInTheDocument();
  });
});
