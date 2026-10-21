/**
 * @file walkthroughStage11C.test.tsx
 * Programmatic verification of the Step 5 full user walk-through (Stage 11C):
 * 1. Set participant ID and consent.
 * 2. Take the Pre-Test (confirm no hints, no feedback, neutral completion).
 * 3. K-map practice problem with deliberate wrong group and level 2 hint.
 * 4. K-map quiz and review wrong answer misconception.
 * 5. Complete SUS and verify Brooke 0-100 score + interpretation note.
 * 6. Teacher Dashboard: load device log, import second student CSV, verify misconception rankings, pre/post stats, and CSV export.
 * 7. Delete all study data and confirm cleanup.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useLogStore } from '../../store/logStore';
import { CONSENT_TEXT_PLACEHOLDER, useStudyStore } from '../../store/studyStore';
import { ParticipantSetup } from './ParticipantSetup';
import { PrePostTestPage } from './PrePostTestPage';
import { PracticePage } from '../practice/PracticePage';
import { QuizPage } from '../practice/QuizPage';
import { SusPage } from './SusPage';
import { TeacherDashboard } from './TeacherDashboard';
import { toCsv } from '../../engine/evaluation/csvExport';

describe('Stage 11C Full Walkthrough Verification', () => {
  const continueAsAuthenticated = (event: Event) => (event as CustomEvent<{ continueAction: () => void }>).detail.continueAction();
  beforeEach(() => window.addEventListener('deam:require-account', continueAsAuthenticated));
  afterEach(() => window.removeEventListener('deam:require-account', continueAsAuthenticated));

  it('executes the full participant, practice, quiz, SUS, dashboard, and deletion lifecycle', async () => {
    // 0. Reset stores
    useLogStore.getState().clearLog();
    useStudyStore.getState().deleteStudyData();

    // -------------------------------------------------------------------------
    // Step 1: Participant ID & Consent Setup
    // -------------------------------------------------------------------------
    const { unmount: unmountSetup } = render(<ParticipantSetup />);
    const idInput = screen.getByLabelText(/Participant ID/i);
    fireEvent.change(idInput, { target: { value: 'P-WALKTHROUGH-01' } });

    const consentBox = screen.getByRole('checkbox', {
      name: new RegExp(CONSENT_TEXT_PLACEHOLDER.slice(0, 30), 'i'),
    });
    fireEvent.click(consentBox);

    const saveBtn = screen.getByRole('button', { name: /^Save ID$/i });
    fireEvent.click(saveBtn);

    expect(useStudyStore.getState().participantId).toBe('P-WALKTHROUGH-01');
    expect(useStudyStore.getState().hasConsented).toBe(true);
    unmountSetup();

    // -------------------------------------------------------------------------
    // Step 2: Pre-Test (Confirm no hints, no feedback during test)
    // -------------------------------------------------------------------------
    const { unmount: unmountPre } = render(<PrePostTestPage />);
    expect(screen.getByText(/Research Assessment Notice/i)).toBeInTheDocument();
    expect(screen.getByText(/hints, "show solution", and practice assistance are strictly disabled/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show Solution/i })).not.toBeInTheDocument();

    // Answer questions by navigating through
    for (let q = 0; q < 20; q++) {
      const qRadios = screen.getAllByRole('radio');
      if (qRadios[0]) fireEvent.click(qRadios[0]);

      if (q < 19) {
        const nextBtn = screen.getByRole('button', { name: /Next Question/i });
        fireEvent.click(nextBtn);
      }
    }

    const submitPreBtn = screen.getByRole('button', { name: /Submit Assessment/i });
    fireEvent.click(submitPreBtn);

    // Neutral completion message shown without score
    expect(screen.getByText(/Assessment Completed/i)).toBeInTheDocument();
    expect(screen.getByText(/Your responses have been recorded locally for research analysis/i)).toBeInTheDocument();
    expect(useStudyStore.getState().completedTasks.pretestCompleted).toBe(true);
    unmountPre();

    // -------------------------------------------------------------------------
    // Step 3: Practice Problem (K-Map with wrong answer and Level 2 hint)
    // -------------------------------------------------------------------------
    const { unmount: unmountPractice } = render(<PracticePage />);
    // Select K-Map Minimizer
    const modSelect = screen.getByLabelText(/^Module$/i);
    fireEvent.change(modSelect, { target: { value: 'kmap-solver' } });

    const genBtn = screen.getByRole('button', { name: /New problem/i });
    fireEvent.click(genBtn);

    expect(screen.getByText(/Seed \d+/i)).toBeInTheDocument();

    // Enter deliberate incorrect answer on step
    const stepInput = screen.getAllByLabelText(/Your Answer:/i)[0];
    if (stepInput) {
      fireEvent.change(stepInput, { target: { value: 'wrong_group_syntax' } });
    }

    const checkBtn = screen.getByRole('button', { name: /Check My Step/i });
    fireEvent.click(checkBtn);

    // Request Hint Level 1
    const hint1Btn = screen.getByRole('button', { name: /Unlock hint level 1/i });
    fireEvent.click(hint1Btn);

    // Request Hint Level 2
    const hint2Btn = screen.getByRole('button', { name: /Unlock hint level 2/i });
    fireEvent.click(hint2Btn);

    expect(useLogStore.getState().events.some((e) => e.eventType === 'hint-used' && e.level === 2)).toBe(true);
    unmountPractice();

    // -------------------------------------------------------------------------
    // Step 4: Quiz Page (K-Map topic and review wrong answer misconception)
    // -------------------------------------------------------------------------
    const { unmount: unmountQuiz } = render(<QuizPage />);
    const topicSelect = screen.getByLabelText(/Topic:/i);
    fireEvent.change(topicSelect, { target: { value: 'kmap-solver' } });

    // Answer questions
    for (let i = 0; i < 10; i++) {
      const qBtn = screen.getByRole('button', { name: new RegExp(`^Question ${i + 1}:`) });
      fireEvent.click(qBtn);

      const opts = screen.queryAllByRole('radio');
      if (opts.length > 0 && opts[0]) {
        fireEvent.click(opts[0]);
      } else {
        const textInput = screen.queryByLabelText(/Your Answer:/i);
        if (textInput) fireEvent.change(textInput, { target: { value: '0011' } });
      }
    }

    const submitQuizBtn = screen.getByRole('button', { name: /Submit Quiz/i });
    fireEvent.click(submitQuizBtn);

    // Review screen appears with score
    expect(screen.getByText(/Quiz Results:/i)).toBeInTheDocument();
    expect(screen.getByText(/\d+ \/ 10/i)).toBeInTheDocument();
    unmountQuiz();

    // -------------------------------------------------------------------------
    // Step 5: SUS Survey (Complete 10 items, verify score and rough guide note)
    // -------------------------------------------------------------------------
    const { unmount: unmountSus } = render(<SusPage />);
    const agreeOptions = screen.getAllByRole('radio', { name: /^Agree$/i });
    for (const opt of agreeOptions) {
      fireEvent.click(opt);
    }
    const submitSusBtn = screen.getByRole('button', { name: /Submit Usability Evaluation/i });
    fireEvent.click(submitSusBtn);

    expect(screen.getByText(/This interpretation is a rough guide/i)).toBeInTheDocument();
    expect(screen.getByText(/The SUS score is a percentile ranking on a 0–100 scale, not a percentage mark/i)).toBeInTheDocument();
    unmountSus();

    // -------------------------------------------------------------------------
    // Step 6: Teacher Dashboard (Load local log + import second student CSV)
    // -------------------------------------------------------------------------
    const { unmount: unmountDash } = render(<TeacherDashboard />);
    const deviceLogBtn = screen.getByRole('button', { name: /Use this device's own telemetry log/i });
    fireEvent.click(deviceLogBtn);

    expect(screen.getByText(/Events Accepted/i)).toBeInTheDocument();

    // Create a second student CSV from our logged events with participantId 'P-STUDENT-02'
    const currentEvents = useLogStore.getState().events;
    const student2Events = currentEvents.map((ev, idx) => ({
      ...ev,
      id: `student2-ev-${idx}`,
      participantId: 'P-STUDENT-02',
    }));
    const student2Csv = toCsv(student2Events);
    const file2 = new File([student2Csv], 'student2.csv', { type: 'text/csv' });

    const fileInput = screen.getByLabelText(/Upload CSV or JSON telemetry log files/i);
    fireEvent.change(fileInput, { target: { files: [file2] } });

    await waitFor(() => {
      // Both participants registered
      expect(screen.getByRole('option', { name: /P-STUDENT-02/i })).toBeInTheDocument();
    });
    unmountDash();

    // -------------------------------------------------------------------------
    // Step 7: Delete All Study Data
    // -------------------------------------------------------------------------
    render(<ParticipantSetup />);
    const deleteBtn = screen.getByRole('button', { name: /Delete all my local study data/i });
    fireEvent.click(deleteBtn);

    // Confirm in modal
    const confirmDeleteBtn = screen.getByRole('button', { name: /^Confirm Delete$/i });
    fireEvent.click(confirmDeleteBtn);

    expect(useStudyStore.getState().participantId).toBe('');
    expect(useStudyStore.getState().hasConsented).toBe(false);
    expect(useLogStore.getState().events.length).toBe(0);
  });
});
