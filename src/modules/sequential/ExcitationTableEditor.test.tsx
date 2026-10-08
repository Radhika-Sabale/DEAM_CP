/**
 * @file ExcitationTableEditor.test.tsx
 * Comprehensive unit tests for ExcitationTableEditor (Stage 10E).
 * Verifies confused-q-and-qnext misconception diagnosis, 3-tier progressive hint ladder
 * without value leaks on levels 1-2, accepted-with-note concrete entries on don't-cares,
 * Show me auto-complete, and accessible names on all select controls.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { designSequential } from '../../engine/sequential/counterDesigner';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';
import type { CounterSpec } from '../../types/sequential';
import { createInitialSequentialSession, type SequentialSessionState } from './sequentialSession';
import { ExcitationTableEditor } from './ExcitationTableEditor';
import type { UseSequentialSessionResult } from './useSequentialSession';

function createMockSession(overrides: Partial<UseSequentialSessionResult>): UseSequentialSessionResult {
  const defaultState: SequentialSessionState = createInitialSequentialSession();
  return {
    state: defaultState,
    referenceDesign: null,
    asyncDesign: null,
    activeDesign: null,
    errors: [],
    isUnlocked: () => true,
    setSpec: vi.fn(),
    selectStep: vi.fn(),
    updateDraft: vi.fn(),
    markVerified: vi.fn(),
    markAssisted: vi.fn(),
    resetStep: vi.fn(),
    resetAll: vi.fn(),
    specChangeConfirm: { isOpen: false, pendingSpec: null, confirm: vi.fn(), cancel: vi.fn() },
    ...overrides,
  };
}

describe('ExcitationTableEditor component', () => {
  const mod10JkSpec: CounterSpec = {
    kind: 'counter',
    modulus: 10,
    direction: 'up',
    flipFlop: 'JK',
    style: 'sync',
  };

  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
    useLogStore.getState().clearLog();
  });

  it('diagnoses confused-q-and-qnext when student enters reversed transition and checks hint tiers', () => {
    const dRes = designSequential(mod10JkSpec);
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: mod10JkSpec },
      referenceDesign: dRes.design,
    });

    render(<ExcitationTableEditor session={session} />);

    // In State S0 (0000 -> 0001):
    // For bit 0: Q=0, Q+=1. Expected J0=1, K0=X.
    // Reversed transition (1 -> 0): requires J=X, K=1.
    // Entering 'X' for J0 evaluates reverse transition (1 -> 0) instead of (0 -> 1)!
    const j0Select = screen.getByRole('combobox', { name: /Row S0, input J0/i });
    fireEvent.change(j0Select, { target: { value: 'X' } });

    // Click Check Excitation Table
    const checkBtn = screen.getByRole('button', { name: /Check Excitation Table/i });
    fireEvent.click(checkBtn);

    // Displays catalog title for confused-q-and-qnext
    const titleElements = screen.getAllByText(/Confused Present State Q with Next State Q\+/i);
    expect(titleElements.length).toBeGreaterThan(0);

    // Progress HintLadder
    const unlockBtn = screen.getByRole('button', { name: /Unlock hint level 1 of 3/i });
    fireEvent.click(unlockBtn);

    // Level 1 hint appears and does NOT contain the exact expected target value '1'
    const level1Badge = screen.getByText(/LEVEL 1/i);
    expect(level1Badge).toBeInTheDocument();
    expect(screen.queryByText(/The correct excitation value is 1/i)).not.toBeInTheDocument();

    // Unlock Level 2
    const level2Btn = screen.getByRole('button', { name: /Unlock hint level 2/i });
    fireEvent.click(level2Btn);
    expect(screen.getByText(/LEVEL 2/i)).toBeInTheDocument();
    expect(screen.queryByText(/The correct excitation value is 1/i)).not.toBeInTheDocument();

    // Unlock Level 3 (Worked solution) -> marks assisted
    const level3Btn = screen.getByRole('button', { name: /Unlock hint level 3/i });
    fireEvent.click(level3Btn);
    expect(screen.getAllByText(/LEVEL 3/i).length).toBeGreaterThan(0);
    expect(useFeedbackStore.getState().assistedSteps['ff-excitation-row']).toBe(true);
  });

  it('accepts concrete value (0 or 1) on a dont-care cell with accepted-with-note', () => {
    const dRes = designSequential(mod10JkSpec);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: mod10JkSpec },
      referenceDesign: dRes.design,
    });

    render(<ExcitationTableEditor session={session} />);

    // In State S0 for bit 0: Q=0, Q+=1. Expected J0=1, K0=X (don't care).
    // Set J0 to 1 (correct) and K0 to 0 (concrete on don't care cell)
    const j0Select = screen.getByRole('combobox', { name: /Row S0, input J0/i });
    const k0Select = screen.getByRole('combobox', { name: /Row S0, input K0/i });

    fireEvent.change(j0Select, { target: { value: '1' } });
    fireEvent.change(k0Select, { target: { value: '0' } });

    const checkBtn = screen.getByRole('button', { name: /Check Excitation Table/i });
    fireEvent.click(checkBtn);

    // Shows accepted concrete badge/note
    const acceptedNotes = screen.getAllByText(/Accepted \(concrete\)/i);
    expect(acceptedNotes.length).toBeGreaterThan(0);
  });

  it('guarantees every select element has an accessible name specifying row and column', () => {
    const dRes = designSequential(mod10JkSpec);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: mod10JkSpec },
      referenceDesign: dRes.design,
    });

    render(<ExcitationTableEditor session={session} />);

    // Total active rows = 10, each row has 4 flip-flops x 2 inputs = 8 inputs (J3,K3, J2,K2, J1,K1, J0,K0)
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(10 * 8);

    for (const select of selects) {
      const name = select.getAttribute('aria-label');
      expect(name).toBeTruthy();
      expect(name).toMatch(/Row S\d+, input [JKSDT]\d+/);
    }
  });

  it('fills table and marks assisted when Show me is clicked', () => {
    const dRes = designSequential(mod10JkSpec);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: mod10JkSpec },
      referenceDesign: dRes.design,
    });

    render(<ExcitationTableEditor session={session} />);

    const showMeBtn = screen.getByRole('button', { name: /Show me/i });
    fireEvent.click(showMeBtn);

    expect(session.markAssisted).toHaveBeenCalledWith(
      'excitation',
      expect.any(Object),
      expect.objectContaining({ excitationTable: expect.any(Object) })
    );
    expect(screen.getByText(/Assisted: Correct excitation table entries loaded\./i)).toBeInTheDocument();
  });
});
