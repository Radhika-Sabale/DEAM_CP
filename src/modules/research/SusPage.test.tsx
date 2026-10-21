/**
 * @file SusPage.test.tsx
 * Tests for SusPage: validation of incomplete items, 0-100 scoring accuracy (all 3s = 50),
 * percentile interpretation text, and rough guide note (Stage 11C).
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useLogStore } from '../../store/logStore';
import { useStudyStore } from '../../store/studyStore';
import { SusPage } from './SusPage';

describe('SusPage Component', () => {
  const continueAsAuthenticated = (event: Event) => (event as CustomEvent<{ continueAction: () => void }>).detail.continueAction();
  beforeEach(() => {
    window.addEventListener('deam:require-account', continueAsAuthenticated);
    useLogStore.getState().clearLog();
    useStudyStore.getState().deleteStudyData();
  });
  afterEach(() => window.removeEventListener('deam:require-account', continueAsAuthenticated));

  it('validates incomplete submission and names missing items in alert', () => {
    render(<SusPage />);

    // Click submit without answering anything
    const submitBtn = screen.getByRole('button', { name: /Submit Usability Evaluation/i });
    fireEvent.click(submitBtn);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/Please answer the following items before submitting/i);
    expect(alert).toHaveTextContent('Item 1');
    expect(alert).toHaveTextContent('Item 10');
  });

  it('computes exact Brooke score of 50.0 when all responses are Neutral (3)', () => {
    render(<SusPage />);

    // For each of the 10 items, click "Neutral"
    const neutralOptions = screen.getAllByRole('radio', { name: /Neutral/i });
    expect(neutralOptions.length).toBe(10);

    for (const opt of neutralOptions) {
      fireEvent.click(opt);
    }

    const submitBtn = screen.getByRole('button', { name: /Submit Usability Evaluation/i });
    fireEvent.click(submitBtn);

    // Score 50.0 displayed
    expect(screen.getByText('50.0 / 100')).toBeInTheDocument();

    // Stored in studyStore
    expect(useStudyStore.getState().latestSusResult?.score).toBe(50);
    expect(useStudyStore.getState().completedTasks.susCompleted).toBe(true);

    // Telemetry logged
    expect(
      useLogStore.getState().events.some((e) => e.eventType === 'sus-submitted' && e.score === 50)
    ).toBe(true);
  });

  it('displays the rough guide note explaining SUS is not a percentage mark', () => {
    render(<SusPage />);

    // Answer all 10 items with Agree (value 4)
    const agreeOptions = screen.getAllByRole('radio', { name: /^Agree$/i });
    expect(agreeOptions.length).toBe(10);
    for (const opt of agreeOptions) {
      fireEvent.click(opt);
    }

    const submitBtn = screen.getByRole('button', { name: /Submit Usability Evaluation/i });
    fireEvent.click(submitBtn);

    // Verify "rough guide" note
    expect(
      screen.getByText(/This interpretation is a rough guide/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The SUS score is a percentile ranking on a 0–100 scale, not a percentage mark/i)
    ).toBeInTheDocument();
  });
});
