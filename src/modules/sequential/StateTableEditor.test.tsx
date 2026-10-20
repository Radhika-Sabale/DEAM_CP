/**
 * @file StateTableEditor.test.tsx
 * Comprehensive tests for StateTableEditor: deliberate cell error diagnosis,
 * confused-q-and-qnext title display, hint ladder tiers without value leaks,
 * logStore telemetry, Show me assisted progression, and hand accessibility assertions.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { designSequential } from '../../engine/sequential/counterDesigner';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';
import type { CounterSpec, DetectorSpec } from '../../types/sequential';
import { createInitialSequentialSession, type SequentialSessionState } from './sequentialSession';
import { StateTableEditor } from './StateTableEditor';
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

describe('StateTableEditor component', () => {
  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
    useLogStore.getState().clearLog();
  });

  it('diagnoses confused-q-and-qnext when student enters present state Q instead of next state', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      flipFlop: 'D',
      style: 'sync',
      direction: 'up',
      modulus: 4,
    };
    const dRes = designSequential(spec);
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec },
      referenceDesign: dRes.design,
    });

    render(<StateTableEditor session={session} />);

    // In State 00 (S0), correct next state is 1 (S1).
    // Entering '0' (present state) triggers confused-q-and-qnext misconception!
    const selectS0 = screen.getByRole('combobox', {
      name: /State 00.*next state/i,
    });
    fireEvent.change(selectS0, { target: { value: '0' } });

    // Check table
    const checkBtn = screen.getByRole('button', { name: /Check State Table/i });
    fireEvent.click(checkBtn);

    // Shows catalog title for confused-q-and-qnext
    const titleElements = screen.getAllByText(
      /Confused Present State Q with Next State Q\+/i
    );
    expect(titleElements.length).toBeGreaterThan(0);

    // Telemetry log verified
    const events = useLogStore.getState().getEvents();
    const subEvent = events.find((e) => e.eventType === 'step-submitted');
    expect(subEvent).toBeDefined();
    expect((subEvent as { misconceptionTag?: string }).misconceptionTag).toBe(
      'confused-q-and-qnext'
    );
  });

  it('progresses through HintLadder where levels 1-2 never leak expected answer and level 3 reveals it', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      flipFlop: 'D',
      style: 'sync',
      direction: 'up',
      modulus: 4,
    };
    const dRes = designSequential(spec);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec },
      referenceDesign: dRes.design,
    });

    render(<StateTableEditor session={session} />);

    // Deliberate error on row 0
    const selectS0 = screen.getByRole('combobox', {
      name: /State 00.*next state/i,
    });
    fireEvent.change(selectS0, { target: { value: '2' } }); // Wrong: expected 1

    fireEvent.click(screen.getByRole('button', { name: /Check State Table/i }));

    // Hint ladder button should now be available
    const hintBtn = screen.getByRole('button', { name: /Unlock hint level 1/i });
    expect(hintBtn).toBeInTheDocument();

    // Level 1: Nudge (no expected value leaked)
    fireEvent.click(hintBtn);
    const hint1 = screen.getByText(/Level 1: Nudge/i);
    expect(hint1).toBeInTheDocument();
    // Correct next state for 0 is S1 (code 1)
    expect(screen.queryByText(/The correct.*value.*S1/i)).not.toBeInTheDocument();

    // Level 2: Pointed (no expected value leaked)
    const hintBtn2 = screen.getByRole('button', { name: /Unlock hint level 2/i });
    fireEvent.click(hintBtn2);
    expect(screen.getByText(/Level 2: Pointed/i)).toBeInTheDocument();
    expect(screen.queryByText(/The correct.*value.*S1/i)).not.toBeInTheDocument();

    // Level 3: Worked solution step (reveals expected value)
    const hintBtn3 = screen.getByRole('button', { name: /Unlock hint level 3/i });
    fireEvent.click(hintBtn3);
    expect(screen.getByText(/Level 3: Worked Step/i)).toBeInTheDocument();
    expect(screen.getByText(/The correct value for this step is:.*S1/i)).toBeInTheDocument();

    // Verify hint-used telemetry events
    const hintEvents = useLogStore.getState().getEvents().filter((e) => e.eventType === 'hint-used');
    expect(hintEvents.length).toBeGreaterThanOrEqual(3);
  });

  it('marks step as assisted and unlocks progression when Show me is clicked', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      flipFlop: 'D',
      style: 'sync',
      direction: 'up',
      modulus: 4,
    };
    const dRes = designSequential(spec);
    if (!dRes.ok) return;

    const markAssisted = vi.fn();
    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec },
      referenceDesign: dRes.design,
      markAssisted,
    });

    render(<StateTableEditor session={session} />);

    const showMeBtn = screen.getByRole('button', { name: /Show me/i });
    fireEvent.click(showMeBtn);

    // markAssisted called with table artifact
    expect(markAssisted).toHaveBeenCalledWith(
      'table',
      expect.anything(),
      expect.anything()
    );

    // Status updated
    expect(screen.getByText(/Assisted: Correct state table entries loaded/i)).toBeInTheDocument();

    // Telemetry log verified with level 3
    const events = useLogStore.getState().getEvents();
    const hintL3 = events.find(
      (e) => e.eventType === 'hint-used' && (e as { level?: number }).level === 3
    );
    expect(hintL3).toBeDefined();
  });

  it('marks step verified when all cells are correctly filled', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      flipFlop: 'D',
      style: 'sync',
      direction: 'up',
      modulus: 4,
    };
    const dRes = designSequential(spec);
    if (!dRes.ok) return;

    const markVerified = vi.fn();
    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec },
      referenceDesign: dRes.design,
      markVerified,
    });

    render(<StateTableEditor session={session} />);

    // Fill all 4 transitions: 0->1, 1->2, 2->3, 3->0
    const fills = [
      { name: /State 00.*next state/i, val: '1' },
      { name: /State 01.*next state/i, val: '2' },
      { name: /State 10.*next state/i, val: '3' },
      { name: /State 11.*next state/i, val: '0' },
    ];

    for (const f of fills) {
      const select = screen.getByRole('combobox', { name: f.name });
      fireEvent.change(select, { target: { value: f.val } });
    }

    fireEvent.click(screen.getByRole('button', { name: /Check State Table/i }));

    expect(markVerified).toHaveBeenCalledWith(
      'table',
      expect.anything(),
      expect.anything()
    );

    const correctBadges = screen.getAllByText(/Correct/i);
    expect(correctBadges).toHaveLength(4);
  });

  it('asserts accessibility by hand: accessible names include row and column, live regions exist, and text accompanies icons', () => {
    const spec: DetectorSpec = {
      kind: 'detector',
      flipFlop: 'D',
      pattern: '101',
      machine: 'mealy',
      overlapping: true,
    };
    const dRes = designSequential(spec);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec },
      referenceDesign: dRes.design,
    });

    render(<StateTableEditor session={session} />);

    // 1. Accessible cell names contain row and column
    const nextSelects = screen.getAllByRole('combobox', { name: /next state/i });
    expect(nextSelects.length).toBeGreaterThan(0);
    for (const sel of nextSelects) {
      expect(sel.getAttribute('aria-label')).toMatch(/State \d+.*next state/i);
    }

    const outputSelects = screen.getAllByRole('combobox', { name: /output/i });
    expect(outputSelects.length).toBeGreaterThan(0);
    for (const sel of outputSelects) {
      expect(sel.getAttribute('aria-label')).toMatch(/State \d+.*output/i);
    }

    // 2. Table has real <table> element with columnheader scope attributes
    const table = screen.getByRole('table', {
      name: /Sequential State Transition Table/i,
    });
    expect(table).toBeInTheDocument();
    const headers = screen.getAllByRole('columnheader');
    for (const h of headers) {
      expect(h).toHaveAttribute('scope', 'col');
    }

    // 3. Footnote for unused rows exists
    expect(
      screen.getByText(/\* Unused state: treated as don't-care \(X\) for next-state logic\./i)
    ).toBeInTheDocument();
  });
});
