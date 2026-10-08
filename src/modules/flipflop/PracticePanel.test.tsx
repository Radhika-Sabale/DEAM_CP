/**
 * @file PracticePanel.test.tsx
 * Unit tests for PracticePanel: characteristic table checking, JK excitation reversed transition diagnosis,
 * progressive hint ladder level 1-3, pulse prediction, and logStore telemetry logging.
 */

import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';
import { PracticePanel } from './PracticePanel';
import { useFlipFlopSession } from './useFlipFlopSession';

describe('PracticePanel', () => {
  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
    useLogStore.getState().clearLog();
  });

  it('diagnoses deliberate SR excitation error with reversed transition showing confused-q-and-qnext', () => {
    const { result } = renderHook(() => useFlipFlopSession('SR'));
    render(<PracticePanel session={result.current} />);

    // Switch to excitation practice tab
    const excTab = screen.getByRole('tab', { name: /Fill the excitation table/i });
    fireEvent.click(excTab);

    // Find transition 0 -> 1 (S input)
    const step0to1Heading = screen.getByText(/Transition 0 → 1 \(S input\)/i);
    expect(step0to1Heading).toBeDefined();

    // Find select inside step container
    const stepContainer = step0to1Heading.closest('.rounded-xl');
    expect(stepContainer).not.toBeNull();

    const select = stepContainer!.querySelector('select');
    expect(select).not.toBeNull();

    // Set student value to 0 (reversed transition for 1 -> 0)
    fireEvent.change(select!, { target: { value: '0' } });

    // Click "Check My Step"
    const checkBtn = stepContainer!.querySelector('button');
    expect(checkBtn).not.toBeNull();
    fireEvent.click(checkBtn!);

    // Should show diagnosis with confused-q-and-qnext title
    expect(screen.getByText(/Cognitive Diagnosis: Confused Present State Q with Next State Q\+/i)).toBeDefined();

    // Unlock Hint 1
    const unlockHintBtn = screen.getByRole('button', { name: /Unlock hint level 1/i });
    fireEvent.click(unlockHintBtn);
    expect(screen.getByText(/Level 1: Nudge/i)).toBeDefined();

    // Unlock Hint 2
    const unlockHint2Btn = screen.getByRole('button', { name: /Unlock hint level 2/i });
    fireEvent.click(unlockHint2Btn);
    expect(screen.getByText(/Level 2: Pointed/i)).toBeDefined();

    // Unlock Hint 3
    const unlockHint3Btn = screen.getByRole('button', { name: /Unlock hint level 3/i });
    fireEvent.click(unlockHint3Btn);
    expect(screen.getByText(/Level 3: Worked Step/i)).toBeDefined();
    expect(screen.getByText(/Status: Assisted by Worked Step/i)).toBeDefined();

    // Verify logStore recorded hint-used with level 3
    const events = useLogStore.getState().events;
    const hint3Events = events.filter(
      (e) => e.eventType === 'hint-used' && 'level' in e && e.level === 3
    );
    expect(hint3Events.length).toBeGreaterThanOrEqual(1);
  });

  it('accepts concrete 0 or 1 on don`t-care cells in excitation table', () => {
    const { result } = renderHook(() => useFlipFlopSession('JK'));
    render(<PracticePanel session={result.current} />);

    // Switch to excitation practice tab
    const excTab = screen.getByRole('tab', { name: /Fill the excitation table/i });
    fireEvent.click(excTab);

    // Transition 0 -> 0 for K input has expected value 'X'
    const step0to0KHeading = screen.getByText(/Transition 0 → 0 \(K input\)/i);
    const stepContainer = step0to0KHeading.closest('.rounded-xl')!;
    const select = stepContainer.querySelector('select')!;

    // Student selects concrete '0'
    fireEvent.change(select, { target: { value: '0' } });

    const checkBtn = stepContainer.querySelector('button')!;
    fireEvent.click(checkBtn);

    // Should be accepted as correct!
    expect(screen.getByText(/Correct! Step verified./i)).toBeDefined();
  });

  it('handles pulse prediction correct and wrong paths', () => {
    const { result } = renderHook(() => useFlipFlopSession('D'));
    render(<PracticePanel session={result.current} />);

    // Switch to pulse prediction tab
    const pulseTab = screen.getByRole('tab', { name: /Predict the next pulse/i });
    fireEvent.click(pulseTab);

    // Prediction step: D=1, Q(0)=0 -> next Q should be 1
    const predictStep = screen.getByText(/Predict Q After 1 Clock Pulse/i).closest('.rounded-xl')!;
    const choiceSelect = predictStep.querySelector('#predict-choice')!;

    // 1. Wrong answer: select 0
    fireEvent.change(choiceSelect, { target: { value: '0' } });
    const checkBtn = predictStep.querySelector('button')!;
    fireEvent.click(checkBtn);

    expect(screen.getByText(/Cognitive Diagnosis/i)).toBeDefined();

    // Try again
    const tryAgainBtn = screen.getByRole('button', { name: /Try Again/i });
    fireEvent.click(tryAgainBtn);

    // 2. Right answer: select 1
    fireEvent.change(choiceSelect, { target: { value: '1' } });
    const checkBtn2 = predictStep.querySelector('button')!;
    fireEvent.click(checkBtn2);

    expect(screen.getByText(/Correct! Step verified./i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Apply Predicted Pulse to Simulator/i })).toBeDefined();
  });
});
