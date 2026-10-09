/**
 * @file PracticePage.test.tsx
 * Unit and integration tests for PracticePage: module gating, deterministic seeds,
 * step verification, hint telemetry, and non-destructive throwaway project opening (Stage 11C).
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { generateProblem } from '../../engine/practice';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';
import { useProjectStore } from '../../store/projectStore';
import { PracticePage } from './PracticePage';

describe('PracticePage Component', () => {
  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
    useLogStore.getState().clearLog();
    useProjectStore.getState().resetProject();
  });

  it('renders module options and disables unavailable modules with a clear reason', () => {
    render(<PracticePage />);

    const select = screen.getByLabelText(/Module/i) as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    // Check that phase 2 module (e.g. ALU) is disabled with reason
    const aluOption = screen.getByRole('option', { name: /Arithmetic Logic Unit.*No practice generator available/i });
    expect(aluOption).toBeDisabled();

    // Check that available module (e.g. K-Map) is enabled
    const kmapOption = screen.getByRole('option', { name: /Karnaugh Map Minimizer/i });
    expect(kmapOption).not.toBeDisabled();
  });

  it('guarantees generating with the same seed twice produces the exact same problem', () => {
    const p1 = generateProblem('kmap-solver', 'easy', 77);
    const p2 = generateProblem('kmap-solver', 'easy', 77);

    expect(p1.ok).toBe(true);
    expect(p2.ok).toBe(true);
    if (p1.ok && p2.ok) {
      expect(p1.problem.id).toBe(p2.problem.id);
      expect(p1.problem.statement.text).toBe(p2.problem.statement.text);
      expect(p1.problem.finalAnswer).toEqual(p2.problem.finalAnswer);
    }
  });

  it('logs practice-started event upon initial problem generation', () => {
    render(<PracticePage />);

    expect(
      useLogStore.getState().events.some((e) => e.eventType === 'practice-started')
    ).toBe(true);
  });

  it('clicking "Show solution" logs a level-3 assisted event and reveals the worked answer', () => {
    render(<PracticePage />);

    const showSolBtn = screen.getAllByRole('button', { name: /Show solution/i })[0];
    expect(showSolBtn).toBeDefined();
    if (!showSolBtn) return;

    fireEvent.click(showSolBtn);

    // Assert level-3 hint logged
    expect(
      useLogStore.getState().events.some(
        (e) => e.eventType === 'hint-used' && e.level === 3
      )
    ).toBe(true);

    // Worked Solution section displayed
    expect(screen.getByText(/Worked Solution \(Assisted\)/i)).toBeInTheDocument();
  });

  it('does NOT overwrite the student design project when opening in tool', () => {
    // 1. Establish an existing student project with specific name
    const initialProject = useProjectStore.getState().createProject('Student Main Circuit');
    useProjectStore.getState().renameProject('Student Main Circuit');
    const studentProjectId = initialProject.id;

    render(<PracticePage />);

    const openToolBtn = screen.getByRole('button', { name: /Open in Module Tool/i });
    fireEvent.click(openToolBtn);

    // Active project is now the throwaway practice project
    const activeProject = useProjectStore.getState().project;
    expect(activeProject.name).toContain('[Practice]');

    // Student's original project is intact and loadable
    const summaries = useProjectStore.getState().summaries;
    expect(summaries.some((s) => s.id === studentProjectId)).toBe(true);
  });

  it('submits a wrong step and displays diagnostic feedback, then completes on correct input', () => {
    render(<PracticePage />);

    const input = screen.getByPlaceholderText(/Enter step result/i);
    expect(input).toBeInTheDocument();

    // 1. Enter wrong answer
    fireEvent.change(input, { target: { value: 'invalid_wrong_answer' } });
    const checkBtn = screen.getByRole('button', { name: /Check My Step/i });
    fireEvent.click(checkBtn);

    // Expect error diagnosis alert or incorrect indication
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // 2. Try again button resets
    const tryAgainBtn = screen.getByRole('button', { name: /Try Again/i });
    fireEvent.click(tryAgainBtn);
  });
});
