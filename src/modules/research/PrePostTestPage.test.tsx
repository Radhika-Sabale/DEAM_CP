/**
 * @file PrePostTestPage.test.tsx
 * Tests for PrePostTestPage: no feedback during test, disabled hint advisory notice,
 * retake locking, researcher unlock dialog, and neutral completion screen (Stage 11C).
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLogStore } from '../../store/logStore';
import { useStudyStore } from '../../store/studyStore';
import { PrePostTestPage } from './PrePostTestPage';

describe('PrePostTestPage Component', () => {
  beforeEach(() => {
    useLogStore.getState().clearLog();
    useStudyStore.getState().deleteStudyData();
  });

  it('renders research assessment advisory note stating hints and solutions are disabled', () => {
    render(<PrePostTestPage />);

    expect(screen.getByText(/Research Assessment Notice:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Hints, "Show solution", and practice assistance are strictly disabled/i)
    ).toBeInTheDocument();
  });

  it('provides no feedback or correct answer indications during test execution', () => {
    render(<PrePostTestPage />);

    // Select an answer
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(0);
    fireEvent.click(radios[0]!);

    // Verify no correctness badge or diagnosis alert is shown
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/Correct!/i)).toBeNull();
    expect(screen.queryByText(/Incorrect/i)).toBeNull();
  });

  it('submits assessment and displays neutral completion view without score unless requested', () => {
    render(<PrePostTestPage />);

    // Answer question 1
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]!);

    // Navigate to question 20 using the navigator
    const q20Btn = screen.getByRole('button', { name: /Question 20:/i });
    fireEvent.click(q20Btn);

    const submitBtn = screen.getByRole('button', { name: /Submit Assessment/i });
    fireEvent.click(submitBtn);

    // Neutral completion view appears
    expect(screen.getByText('Assessment Completed')).toBeInTheDocument();
    expect(screen.getByText(/Thank you for completing this assessment/i)).toBeInTheDocument();

    // Verify score is NOT shown by default
    expect(screen.queryByText(/Score:/i)).toBeNull();

    // Stored in studyStore
    expect(useStudyStore.getState().latestPretestResult).not.toBeNull();
    expect(useStudyStore.getState().completedTasks.pretestCompleted).toBe(true);

    // Telemetry event recorded
    expect(
      useLogStore.getState().events.some((e) => e.eventType === 'pretest/posttest-submitted')
    ).toBe(true);
  });

  it('locks retake by default and allows retake only after confirmation modal unlock', () => {
    // Set pretest completed in study store
    useStudyStore.getState().recordTaskCompleted('pretestCompleted');

    render(<PrePostTestPage />);

    expect(screen.getByText(/Pre-Test Already Completed/i)).toBeInTheDocument();
    const unlockBtn = screen.getByRole('button', { name: /Unlock Retake/i });
    fireEvent.click(unlockBtn);

    expect(screen.getByText('Unlock Assessment Retake')).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /Confirm Unlock/i });
    fireEvent.click(confirmBtn);

    // Test unlocked and active again
    expect(screen.getAllByText(/Question 1 of/i).length).toBeGreaterThanOrEqual(1);
  });
});
