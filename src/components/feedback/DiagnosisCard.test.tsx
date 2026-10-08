/**
 * @file DiagnosisCard.test.tsx
 * Unit and accessibility tests for DiagnosisCard:
 * renders status icon and text, shifts focus to card, shows expected/got side-by-side,
 * verifies full explanation disclosure, and tests AI friendly rephrasing block.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { Diagnosis } from '../../types/feedback';
import { useLogStore } from '../../store/logStore';
import { DiagnosisCard } from './DiagnosisCard';

describe('DiagnosisCard Component', () => {
  beforeEach(() => {
    useLogStore.getState().clearLog();
  });

  const sampleDiagnosis: Diagnosis = {
    step: 'step-1',
    errorType: 'misconception',
    expected: {
      kind: 'number-conversion-step',
      targetValue: '1101',
      intermediateSteps: ['1101'],
    },
    got: {
      kind: 'number-conversion-step',
      studentValue: '1011',
      intermediateWork: ['1011'],
    },
    misconceptionTag: 'wrong-remainder-order',
    hint: 'Read remainders bottom-to-top.',
    fullExplanation: 'You read remainders from top to bottom. The correct value is 1101.',
  };

  it('renders status icon, text, and side-by-side values with role="alert"', () => {
    render(<DiagnosisCard diagnosis={sampleDiagnosis} />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/Incorrect/);
    expect(alert).toHaveTextContent(/step-1/);

    expect(screen.getByText('You wrote:')).toBeInTheDocument();
    expect(screen.getByText('1011')).toBeInTheDocument();
    expect(screen.getByText('Expected:')).toBeInTheDocument();
    expect(screen.getByText('1101')).toBeInTheDocument();

    expect(screen.getByText(/Cognitive Diagnosis:/)).toBeInTheDocument();
  });

  it('moves focus to the card on mount', () => {
    render(<DiagnosisCard diagnosis={sampleDiagnosis} />);
    const alert = screen.getByRole('alert');
    expect(document.activeElement).toBe(alert);
  });

  it('toggles full explanation and logs level-3 telemetry event', () => {
    const onShow = vi.fn();
    render(<DiagnosisCard diagnosis={sampleDiagnosis} onShowFullExplanation={onShow} />);

    const button = screen.getByRole('button', { name: /Show full explanation/i });
    expect(screen.queryByText(/Original Explanation/i)).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(onShow).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Original Explanation/i)).toBeInTheDocument();
    expect(screen.getByText(sampleDiagnosis.fullExplanation)).toBeInTheDocument();

    const logged = useLogStore.getState().events;
    expect(logged.some((e) => e.eventType === 'hint-used' && e.level === 3)).toBe(true);
  });

  it('renders AI rephrased text with badge above original explanation without hiding original', () => {
    render(
      <DiagnosisCard
        diagnosis={sampleDiagnosis}
        friendlyText="Let's read the binary digits starting from the bottom upward!"
      />
    );

    // Expand disclosure
    fireEvent.click(screen.getByRole('button', { name: /Show full explanation/i }));

    expect(screen.getByText(/Rephrased by AI/i)).toBeInTheDocument();
    expect(
      screen.getByText("Let's read the binary digits starting from the bottom upward!")
    ).toBeInTheDocument();

    // Original explanation is also visible
    expect(screen.getByText(/Original Explanation/i)).toBeInTheDocument();
    expect(screen.getByText(sampleDiagnosis.fullExplanation)).toBeInTheDocument();
  });
});
