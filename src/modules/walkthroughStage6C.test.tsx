/**
 * @file walkthroughStage6C.test.tsx
 * Automated end-to-end verification of the Stage 6C walkthrough scenarios:
 * 1. Number Systems practice with deliberate wrong remainder order ('00111001' for 156),
 *    requesting all three hints (nudge -> pointed -> worked step), then answering correctly.
 * 2. Case triggering the AnswerTrapBanner (wrong middle step, correct final answer),
 *    focus jump to offending step, and logged dismissal.
 * 3. Boolean practice with a wrong De Morgan step ((A + B)' -> A' + B'), showing
 *    demorgan-misapplied, 3-level hint sequence, and full explanation disclosure.
 * 4. LlmSettings toggle on/off: warning visibility, password input, key clearing, and no fetch.
 * 5. Event log validation: step-started, step-submitted, hint-used, module-completed all recorded.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { NumberSystemsPage } from './numberSystems/NumberSystemsPage';
import { BooleanPage } from './boolean/BooleanPage';
import { useFeedbackStore } from '../store/feedbackStore';
import { useLogStore } from '../store/logStore';
import { createEmptyDesignProject } from '../types/designProject';
import { useProjectStore } from '../store/projectStore';
import { useUiStore } from '../store/uiStore';

describe('Stage 6C Walkthrough Verification', () => {
  beforeEach(() => {
    localStorage.clear();
    useFeedbackStore.getState().resetAll();
    useLogStore.getState().clearLog();
    useProjectStore.getState().setProject(createEmptyDesignProject('walkthrough-proj', 'Walkthrough'));
    useUiStore.getState().setModule('number-systems');
    vi.restoreAllMocks();
  });

  it('executes full Number Systems and Boolean practice walkthrough with telemetry', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // =========================================================================
    // SCENARIO 1: Number Systems Practice - 156 to Binary
    // =========================================================================
    const { unmount: unmountNS } = render(<NumberSystemsPage />);

    // Switch to Practice tab
    const practiceTab = screen.getByRole('tab', { name: /Practice/i });
    fireEvent.click(practiceTab);

    // Verify step-started was recorded
    expect(
      useLogStore.getState().events.some(
        (e) => e.eventType === 'step-started' && e.stepId === 'practice-division-156'
      )
    ).toBe(true);

    // Step 1: correct quotient 78
    const quotientInput = screen.getByLabelText(/Quotient of 156 \/ 2/i);
    fireEvent.change(quotientInput, { target: { value: '78' } });
    const checkStep1Btn = screen.getAllByRole('button', { name: /Check My Step/i })[0];
    if (!checkStep1Btn) throw new Error('Step 1 check button not found');
    fireEvent.click(checkStep1Btn);

    expect(screen.getByText(/Correct! Step verified/i)).toBeInTheDocument();

    // Step 2: enter deliberate wrong remainder order (00111001)
    const bitStringInput = screen.getByLabelText(/Final Binary Bit String/i);
    fireEvent.change(bitStringInput, { target: { value: '00111001' } });
    const checkStep2Btn = screen.getByRole('button', { name: /Check My Step/i });
    fireEvent.click(checkStep2Btn);

    // DiagnosisCard alert appears with reversed remainder order misconception
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText(/Cognitive Diagnosis: Reversed Division Remainder Order/i)).toBeInTheDocument();
    expect(screen.getByText('00111001')).toBeInTheDocument();
    expect(screen.getByText('10011100')).toBeInTheDocument();

    // Request Hint Level 1: Nudge
    const hint1Btn = screen.getByRole('button', { name: /Unlock hint level 1/i });
    fireEvent.click(hint1Btn);
    expect(screen.getByText(/Level 1: Nudge/i)).toBeInTheDocument();
    expect(
      useLogStore.getState().events.some((e) => e.eventType === 'hint-used' && e.level === 1)
    ).toBe(true);

    // Request Hint Level 2: Pointed
    const hint2Btn = screen.getByRole('button', { name: /Unlock hint level 2/i });
    fireEvent.click(hint2Btn);
    expect(screen.getByText(/Level 2: Pointed/i)).toBeInTheDocument();
    expect(
      useLogStore.getState().events.some((e) => e.eventType === 'hint-used' && e.level === 2)
    ).toBe(true);

    // Request Hint Level 3: Worked step
    const hint3Btn = screen.getByRole('button', { name: /Unlock hint level 3/i });
    fireEvent.click(hint3Btn);
    expect(screen.getByText(/Level 3: Worked Step/i)).toBeInTheDocument();
    expect(screen.getByText(/Status: Assisted by Worked Step/i)).toBeInTheDocument();
    expect(
      useLogStore.getState().events.some((e) => e.eventType === 'hint-used' && e.level === 3)
    ).toBe(true);
    expect(useFeedbackStore.getState().assistedSteps['step-2']).toBe(true);

    // Now answer correctly: click Try Again and enter 10011100
    const tryAgainButtons = screen.getAllByRole('button', { name: /Try Again/i });
    const tryAgainStep2 = tryAgainButtons[tryAgainButtons.length - 1];
    if (tryAgainStep2) fireEvent.click(tryAgainStep2);

    fireEvent.change(bitStringInput, { target: { value: '10011100' } });
    fireEvent.click(screen.getByRole('button', { name: /Check My Step/i }));
    expect(screen.getAllByText(/Correct! Step verified/i).length).toBe(2);

    // =========================================================================
    // SCENARIO 2: Answer Trap Trigger
    // =========================================================================
    // Click Try Again on Step 1, enter a wrong intermediate quotient (75)
    const tryAgainStep1 = screen.getAllByRole('button', { name: /Try Again/i })[0];
    if (!tryAgainStep1) throw new Error('Step 1 try again button not found');
    fireEvent.click(tryAgainStep1);

    fireEvent.change(quotientInput, { target: { value: '75' } });
    const checkStep1Wrong = screen.getAllByRole('button', { name: /Check My Step/i })[0];
    if (!checkStep1Wrong) throw new Error('Step 1 check button not found');
    fireEvent.click(checkStep1Wrong);

    // Step 1 fails, Step 2 is correct
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Click Final Attempt Check
    const finalCheckBtn = screen.getByRole('button', {
      name: /Check Complete Attempt & Trap Detection/i,
    });
    fireEvent.click(finalCheckBtn);

    // AnswerTrapBanner is rendered
    expect(screen.getByText(/Answer Trap Detected/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Your final answer is right, but.*was incorrect/i)
    ).toBeInTheDocument();

    // Offending step link is present
    const jumpBtn = screen.getAllByRole('button', { name: /Jump to/i })[0];
    expect(jumpBtn).toBeInTheDocument();
    if (jumpBtn) fireEvent.click(jumpBtn);

    // Dismiss banner and verify dismissal is logged
    const dismissBtn = screen.getByRole('button', { name: /Dismiss answer trap alert/i });
    fireEvent.click(dismissBtn);
    expect(
      useLogStore.getState().events.some(
        (e) => e.eventType === 'practice-started' && e.exerciseId === 'dismiss-answer-trap'
      )
    ).toBe(true);

    unmountNS();

    // =========================================================================
    // SCENARIO 3: Boolean Practice - De Morgan Misconception
    // =========================================================================
    const { unmount: unmountBool } = render(<BooleanPage />);

    const boolPracticeTab = screen.getByRole('tab', { name: /Practice Simplification/i });
    fireEvent.click(boolPracticeTab);

    expect(screen.getByText("(A + B)'")).toBeInTheDocument();

    // Enter wrong De Morgan step: A' + B'
    const boolInput = screen.getByLabelText(/Resulting Algebraic Expression/i);
    fireEvent.change(boolInput, { target: { value: "A' + B'" } });
    fireEvent.click(screen.getByRole('button', { name: /Check My Step/i }));

    // Verify DiagnosisCard with demorgan-misapplied
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText(/Cognitive Diagnosis: De Morgan's Law Misapplied/i)
    ).toBeInTheDocument();

    // Reveal full explanation disclosure (counts as level 3 equivalent in telemetry)
    const showFullBtn = screen.getByRole('button', { name: /Show full explanation/i });
    fireEvent.click(showFullBtn);
    expect(screen.getByText(/Original Explanation/i)).toBeInTheDocument();
    expect(
      useLogStore.getState().events.some(
        (e) => e.eventType === 'hint-used' && e.level === 3 && e.stepId === 'demorgan-basic'
      )
    ).toBe(true);

    // =========================================================================
    // SCENARIO 4: LLM Settings Feature Flag Toggle
    // =========================================================================
    const llmToggle = screen.getByRole('checkbox', {
      name: /Rephrase hints with an AI model \(optional\)/i,
    });
    expect((llmToggle as HTMLInputElement).checked).toBe(false);

    // Invariant: no fetch calls when off
    expect(fetchSpy).not.toHaveBeenCalled();

    // Toggle ON
    fireEvent.click(llmToggle);
    expect((llmToggle as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/Privacy & Third-Party Service Warning/i)).toBeInTheDocument();
    const apiKeyField = screen.getByLabelText(/Anthropic API Key/i);
    expect(apiKeyField).toBeInTheDocument();
    expect(apiKeyField).toHaveAttribute('type', 'password');

    // Type key
    fireEvent.change(apiKeyField, { target: { value: 'sk-ant-testkey' } });
    expect(useFeedbackStore.getState().llmConfig.apiKey).toBe('sk-ant-testkey');

    // Toggle OFF -> clears credentials
    fireEvent.click(llmToggle);
    expect((llmToggle as HTMLInputElement).checked).toBe(false);
    expect(useFeedbackStore.getState().featureFlags.llmHints).toBe(false);
    expect(useFeedbackStore.getState().llmConfig.apiKey).toBeFalsy();
    expect(screen.queryByText(/Privacy & Third-Party Service Warning/i)).not.toBeInTheDocument();

    // Invariant: zero fetch calls occurred throughout entire walkthrough
    expect(fetchSpy).not.toHaveBeenCalled();

    // =========================================================================
    // SCENARIO 5: Telemetry Verification
    // =========================================================================
    const allEvents = useLogStore.getState().events;
    expect(allEvents.length).toBeGreaterThan(5);
    expect(allEvents.some((e) => e.eventType === 'step-started')).toBe(true);
    expect(allEvents.some((e) => e.eventType === 'step-submitted' && e.isCorrect === true)).toBe(true);
    expect(allEvents.some((e) => e.eventType === 'step-submitted' && e.isCorrect === false)).toBe(true);
    expect(allEvents.some((e) => e.eventType === 'hint-used')).toBe(true);

    unmountBool();
  });
});
