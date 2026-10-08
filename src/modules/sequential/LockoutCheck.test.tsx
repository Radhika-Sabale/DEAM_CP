/**
 * @file LockoutCheck.test.tsx
 * Tests for LockoutCheck component (Stage 10E).
 * Verifies locked states display with icon and word, omitting locked state
 * triggers ignored-lockout-state misconception diagnostic title,
 * applying fix re-derives design with no lockout, and "Keep as is" shows warning.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { designSequential } from '../../engine/sequential/counterDesigner';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { createEmptyDesignProject } from '../../types/designProject';
import type { CounterSpec } from '../../types/sequential';
import { createInitialSequentialSession, type SequentialSessionState } from './sequentialSession';
import { LockoutCheck } from './LockoutCheck';
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

describe('LockoutCheck component', () => {
  const customSrSpec: CounterSpec = {
    kind: 'counter',
    direction: 'custom',
    sequence: [0, 1, 2],
    stateBits: 3,
    flipFlop: 'SR',
    style: 'sync',
  };

  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
    const fresh = createEmptyDesignProject('lockout-test', 'Lockout Test');
    fresh.sequentialSpec = customSrSpec;
    fresh.flipFlopType = 'SR';
    useProjectStore.setState({ project: fresh });
    useUiStore.setState({ currentModule: 'sequential-designer' });
  });

  it('shows locked/indeterminate states with icon + word', () => {
    const dRes = designSequential(customSrSpec);
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: customSrSpec },
      referenceDesign: dRes.design,
    });

    render(<LockoutCheck session={session} />);

    // Check table headers
    expect(screen.getByRole('columnheader', { name: /Unused State/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Status/i })).toBeInTheDocument();

    // Check for status icon/word (Locked or Indeterminate)
    const lockedElements = screen.getAllByText(/Locked|Indeterminate/i);
    expect(lockedElements.length).toBeGreaterThan(0);
  });

  it('omitting a locked state in the claim triggers ignored-lockout-state diagnostic title', () => {
    const dRes = designSequential(customSrSpec);
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: customSrSpec },
      referenceDesign: dRes.design,
    });

    render(<LockoutCheck session={session} />);

    // Click "Check Lockout Claim" with 0 states checked (omitting the locked unused states)
    const checkBtn = screen.getByRole('button', { name: /Check Lockout Claim/i });
    fireEvent.click(checkBtn);

    // Should display diagnosis with the catalog title
    expect(screen.getByText(/Ignored Unused State Lockout \/ Deadlock/i)).toBeInTheDocument();
  });

  it('applying the fix re-derives the design and confirms resolution', () => {
    const dRes = designSequential(customSrSpec);
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    const markVerified = vi.fn();
    const updateDraft = vi.fn();

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: customSrSpec },
      referenceDesign: dRes.design,
      markVerified,
      updateDraft,
    });

    render(<LockoutCheck session={session} />);

    // Propose fix panel has "Apply fix" button
    const applyBtn = screen.getByRole('button', { name: /Apply fix/i });
    fireEvent.click(applyBtn);

    // Confirmation dialog appears
    expect(screen.getByText(/Confirm Applying Lockout Fix:/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm and Re-derive/i });
    fireEvent.click(confirmBtn);

    // Draft is updated and resolution verified
    expect(updateDraft).toHaveBeenCalled();
    expect(screen.getByText(/Fix Applied/i)).toBeInTheDocument();
  });

  it('"Keep as is" shows warning and allows verification', () => {
    const dRes = designSequential(customSrSpec);
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    const markVerified = vi.fn();
    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: customSrSpec },
      referenceDesign: dRes.design,
      markVerified,
    });

    render(<LockoutCheck session={session} />);

    // Click claim for all locked states: S4, S5, S6, S7
    const cb4 = screen.getByRole('checkbox', { name: /S4/i });
    const cb5 = screen.getByRole('checkbox', { name: /S5/i });
    const cb6 = screen.getByRole('checkbox', { name: /S6/i });
    const cb7 = screen.getByRole('checkbox', { name: /S7/i });
    fireEvent.click(cb4);
    fireEvent.click(cb5);
    fireEvent.click(cb6);
    fireEvent.click(cb7);

    const checkBtn = screen.getByRole('button', { name: /Check Lockout Claim/i });
    fireEvent.click(checkBtn);

    const keepAsIsBtn = screen.getByRole('button', { name: /Keep as is/i });
    fireEvent.click(keepAsIsBtn);

    // Shows warning
    expect(
      screen.getByText(/Warning: Counter may hang in an unused sequence if it powers on into an unhandled state\./i)
    ).toBeInTheDocument();
    expect(markVerified).toHaveBeenCalledWith('lockout', expect.objectContaining({ keptAsIs: true }));
  });
});
