/**
 * @file SimulateCounter.test.tsx
 * Tests for SimulateCounter component (Stage 10E).
 * Verifies mod-5 count sequence table, text Current marker, unused start state lockout note,
 * pattern detector "1011" match detection, waveform changes table listing, and reproducible seeded random bits.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { designSequential } from '../../engine/sequential/counterDesigner';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { createEmptyDesignProject } from '../../types/designProject';
import type { CounterSpec, DetectorSpec } from '../../types/sequential';
import { createInitialSequentialSession, type SequentialSessionState } from './sequentialSession';
import { SimulateCounter } from './SimulateCounter';
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

describe('SimulateCounter component', () => {
  const mod5Spec: CounterSpec = {
    kind: 'counter',
    modulus: 5,
    direction: 'up',
    flipFlop: 'D',
    style: 'sync',
  };

  const detectorSpec: DetectorSpec = {
    kind: 'detector',
    pattern: '1011',
    machine: 'mealy',
    overlapping: true,
    flipFlop: 'D',
  };

  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
    useLogStore.getState().clearLog();
    const fresh = createEmptyDesignProject('sim-test', 'Sim Test');
    fresh.sequentialSpec = mod5Spec;
    fresh.flipFlopType = 'D';
    useProjectStore.setState({ project: fresh });
    useUiStore.setState({ currentModule: 'sequential-designer' });
  });

  it('renders mod-5 count sequence in table with textual Current marker', () => {
    const dRes = designSequential(mod5Spec);
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: mod5Spec },
      referenceDesign: dRes.design,
    });

    render(<SimulateCounter session={session} />);

    // Table headers
    expect(screen.getByRole('columnheader', { name: /Present State/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Next State/i })).toBeInTheDocument();

    // Check count transitions S0, S1, S2, S3, S4
    expect(screen.getAllByText(/S0 \(000\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/S1 \(001\)/i).length).toBeGreaterThan(0);

    // Current marker text is present
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('starting in an unused state shows the lockout analysis result', () => {
    const dRes = designSequential(mod5Spec);
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: mod5Spec },
      referenceDesign: dRes.design,
    });

    render(<SimulateCounter session={session} />);

    // Change initial state select to unused state S5
    const select = screen.getByLabelText(/Initial State Select/i);
    fireEvent.change(select, { target: { value: '5' } });

    // Warning callout appears describing unused state behavior
    expect(screen.getByText(/Initial state S5 is an unused state:/i)).toBeInTheDocument();
    expect(screen.getByText(/Returns to valid operation/i)).toBeInTheDocument();
  });

  it('detector "1011" finds pattern at the right bit index', () => {
    const dRes = designSequential(detectorSpec);
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: detectorSpec },
      referenceDesign: dRes.design,
    });

    render(<SimulateCounter session={session} />);

    // Type input sequence "10110"
    const inputElem = screen.getByLabelText(/Input Bit Sequence/i);
    fireEvent.change(inputElem, { target: { value: '10110' } });

    // Pattern 1011 completes at bit index 3
    expect(screen.getByText(/Detected the pattern at bit 3/i)).toBeInTheDocument();
  });

  it('waveform change table lists every change event', () => {
    const dRes = designSequential(mod5Spec);
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: mod5Spec },
      referenceDesign: dRes.design,
    });

    render(<SimulateCounter session={session} />);

    const toggleBtn = screen.getByRole('button', { name: /Accessible Signal Changes Table/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByRole('columnheader', { name: /Time \(t\)/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Signal/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Signal CLK transitioned/i).length).toBeGreaterThan(0);
  });

  it('seeded Random button produces deterministic, reproducible bit sequence', () => {
    const dRes = designSequential(detectorSpec);
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: detectorSpec },
      referenceDesign: dRes.design,
    });

    render(<SimulateCounter session={session} />);

    const seedInput = screen.getByLabelText(/Random PRNG Seed/i);
    const randomBtn = screen.getByRole('button', { name: /Random/i });
    const bitInput = screen.getByLabelText(/Input Bit Sequence/i) as HTMLInputElement;

    fireEvent.change(seedInput, { target: { value: '123' } });
    fireEvent.click(randomBtn);
    const seq1 = bitInput.value;

    // Change seed to something else, then back to 123
    fireEvent.change(seedInput, { target: { value: '999' } });
    fireEvent.click(randomBtn);
    const seqDifferent = bitInput.value;
    expect(seqDifferent).not.toEqual(seq1);

    fireEvent.change(seedInput, { target: { value: '123' } });
    fireEvent.click(randomBtn);
    expect(bitInput.value).toEqual(seq1);
  });
});
