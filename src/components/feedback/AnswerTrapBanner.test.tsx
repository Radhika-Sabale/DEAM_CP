/**
 * @file AnswerTrapBanner.test.tsx
 * Unit and accessibility tests for AnswerTrapBanner:
 * renders plain language warning, displays step buttons, tests dismissal and logging.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { AnswerTrapFlag } from '../../types/feedback';
import { useLogStore } from '../../store/logStore';
import { AnswerTrapBanner } from './AnswerTrapBanner';

describe('AnswerTrapBanner Component', () => {
  beforeEach(() => {
    useLogStore.getState().clearLog();
  });

  const sampleTrap: AnswerTrapFlag = {
    finalAnswerCorrect: true,
    inconsistentSteps: ['step-1', 'step-3'],
    notes: 'Your final answer is right, but step 3 does not follow from step 2.',
  };

  it('renders plain language reasoning notes and offending step buttons', () => {
    render(<AnswerTrapBanner flag={sampleTrap} />);

    expect(screen.getByText(/Answer Trap Detected/i)).toBeInTheDocument();
    expect(
      screen.getByText('Your final answer is right, but step 3 does not follow from step 2.')
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Jump to step-1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Jump to step-3/i })).toBeInTheDocument();
  });

  it('clicking a step button invokes onSelectStep callback and shifts focus to target element', () => {
    const target = document.createElement('div');
    target.id = 'step-3';
    target.tabIndex = -1;
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    const onSelect = vi.fn();
    render(<AnswerTrapBanner flag={sampleTrap} onSelectStep={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /Jump to step-3/i }));
    expect(onSelect).toHaveBeenCalledWith('step-3');
    expect(document.activeElement).toBe(target);

    document.body.removeChild(target);
  });

  it('dismissing the banner logs telemetry event and fires onDismiss callback', () => {
    const onDismiss = vi.fn();
    render(<AnswerTrapBanner flag={sampleTrap} onDismiss={onDismiss} />);

    const dismissBtn = screen.getByRole('button', { name: /Dismiss answer trap alert/i });
    fireEvent.click(dismissBtn);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    const logged = useLogStore.getState().events;
    expect(
      logged.some((e) => e.eventType === 'practice-started' && e.exerciseId === 'dismiss-answer-trap')
    ).toBe(true);
  });
});
