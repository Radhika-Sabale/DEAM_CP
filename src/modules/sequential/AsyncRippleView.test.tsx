/**
 * @file AsyncRippleView.test.tsx
 * Tests for AsyncRippleView component (Stage 10E).
 * Verifies stage clock source descriptions in plain words, transient state 1010
 * reporting in mod-10, too-fast clock warning when propagation exceeds half-period,
 * and unsupported message for mod-6 down counter.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { createEmptyDesignProject } from '../../types/designProject';
import type { CounterSpec } from '../../types/sequential';
import { createInitialSequentialSession, type SequentialSessionState } from './sequentialSession';
import { AsyncRippleView } from './AsyncRippleView';
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

describe('AsyncRippleView component', () => {
  const asyncMod10Spec: CounterSpec = {
    kind: 'counter',
    modulus: 10,
    direction: 'up',
    flipFlop: 'JK',
    style: 'async',
    asyncTrigger: 'falling',
  };

  const asyncDownMod6Spec: CounterSpec = {
    kind: 'counter',
    modulus: 6,
    direction: 'down',
    flipFlop: 'T',
    style: 'async',
  };

  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
    const fresh = createEmptyDesignProject('async-test', 'Async Test');
    fresh.sequentialSpec = asyncMod10Spec;
    useProjectStore.setState({ project: fresh });
    useUiStore.setState({ currentModule: 'sequential-designer' });
  });

  it('renders stage descriptions in words and shows transient state 1010 in mod-10', () => {
    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: asyncMod10Spec },
    });

    render(<AsyncRippleView session={session} />);

    // Stage description in words
    expect(screen.getByText(/Stage 0 is clocked by the external clock input/i)).toBeInTheDocument();
    expect(screen.getByText(/Stage 1 is clocked by Q0's falling edge/i)).toBeInTheDocument();

    // Decode reset gate info
    expect(screen.getByText(/AND decode gate/i)).toBeInTheDocument();

    // Transient state 1010 reported in table
    expect(screen.getAllByText(/State 1010 appears for/i).length).toBeGreaterThan(0);
  });

  it('displays too-fast clock warning when stage propagation delay is high', () => {
    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: asyncMod10Spec },
    });

    render(<AsyncRippleView session={session} />);

    // Increase stage delay to 25 with clock period 40
    // Total ripple delay will exceed 40 / 2 = 20
    const delayInput = screen.getByLabelText(/Stage Delay/i);
    fireEvent.change(delayInput, { target: { value: '25' } });

    // Warning appears
    expect(
      screen.getByText(/Warning: The clock is faster than the counter can settle, so the count is unreliable/i)
    ).toBeInTheDocument();
  });

  it('shows unsupported message for mod-6 down counter', () => {
    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: asyncDownMod6Spec },
    });

    render(<AsyncRippleView session={session} />);

    // Asynchronous down-counters require power-of-2 modulus
    expect(
      screen.getByText(/Asynchronous ripple down-counters require a power-of-2 modulus/i)
    ).toBeInTheDocument();
  });
});
