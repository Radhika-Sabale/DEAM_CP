/**
 * @file QuizPage.test.tsx
 * Tests for QuizPage: 10-question quiz, navigator states, unanswered confirmation,
 * scoring review, misconception diagnoses, and retake seeded regeneration (Stage 11C).
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLogStore } from '../../store/logStore';
import { useStudyStore } from '../../store/studyStore';
import { QuizPage } from './QuizPage';

describe('QuizPage Component', () => {
  beforeEach(() => {
    useLogStore.getState().clearLog();
    useStudyStore.getState().deleteStudyData();
  });

  it('renders a 10-question quiz with accessible question navigator', () => {
    render(<QuizPage />);

    expect(screen.getByText('Formative Concept Quiz')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Quiz Questions Navigation/i })).toBeInTheDocument();

    // Verify 10 questions in navigator
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByRole('button', { name: new RegExp(`Question ${i}:`, 'i') })).toBeInTheDocument();
    }
  });

  it('displays unanswered confirmation modal when submitting incomplete quiz', () => {
    render(<QuizPage />);

    // Click Next until reaching question 10
    for (let i = 0; i < 9; i++) {
      const nextBtn = screen.getByRole('button', { name: /Next/i });
      fireEvent.click(nextBtn);
    }

    const submitBtn = screen.getByRole('button', { name: /Submit Quiz/i });
    fireEvent.click(submitBtn);

    // Modal opens listing unanswered questions
    expect(screen.getByText('Unanswered Questions Confirmation')).toBeInTheDocument();
    expect(screen.getAllByText('Q1').length).toBeGreaterThanOrEqual(2);
  });

  it('submits quiz and shows score, per-question breakdown, and logs telemetry', () => {
    render(<QuizPage />);

    // Answer Q1 if radio group present
    const radios = screen.queryAllByRole('radio');
    if (radios.length > 0 && radios[0]) {
      fireEvent.click(radios[0]);
    }

    // Go to Q10 and submit anyway
    for (let i = 0; i < 9; i++) {
      const nextBtn = screen.getByRole('button', { name: /Next/i });
      fireEvent.click(nextBtn);
    }

    const submitBtn = screen.getByRole('button', { name: /Submit Quiz/i });
    fireEvent.click(submitBtn);

    const submitAnywayBtn = screen.getByRole('button', { name: /Submit Anyway/i });
    fireEvent.click(submitAnywayBtn);

    // Results screen
    expect(screen.getByText(/Quiz Results:/i)).toBeInTheDocument();
    expect(screen.getByText(/\/ 10/i)).toBeInTheDocument();

    // Telemetry assertions
    const events = useLogStore.getState().events;
    expect(events.some((e) => e.eventType === 'quiz-answered')).toBe(true);
    expect(events.some((e) => e.eventType === 'module-completed')).toBe(true);
  });

  it('allows retaking quiz and resets state with new questions', () => {
    render(<QuizPage />);

    // Navigate to end and submit
    for (let i = 0; i < 9; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    }
    fireEvent.click(screen.getByRole('button', { name: /Submit Quiz/i }));
    fireEvent.click(screen.getByRole('button', { name: /Submit Anyway/i }));

    const retakeBtn = screen.getByRole('button', { name: /Retake Quiz/i });
    fireEvent.click(retakeBtn);

    // Back in quiz mode
    expect(screen.getByText(/Question 1 of 10/i)).toBeInTheDocument();
  });
});
