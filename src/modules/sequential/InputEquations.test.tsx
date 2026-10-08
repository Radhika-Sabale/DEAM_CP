/**
 * @file InputEquations.test.tsx
 * Comprehensive unit tests for InputEquations (Stage 10E).
 * Verifies minimal equation verification, non-minimal accepted-with-note feedback,
 * parse error reporting with position, row mismatch diagnostics, solver reveal assistance,
 * and K-Map handoff writing variables and truthTable with navigation.
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
import { InputEquations } from './InputEquations';
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

describe('InputEquations component', () => {
  const mod4Spec: CounterSpec = {
    kind: 'counter',
    modulus: 4,
    direction: 'up',
    flipFlop: 'D',
    style: 'sync',
  };

  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
    const fresh = createEmptyDesignProject('eq-test', 'Equations Test');
    fresh.sequentialSpec = mod4Spec;
    fresh.flipFlopType = 'D';
    useProjectStore.setState({ project: fresh });
    useUiStore.setState({ currentModule: 'sequential-designer' });
  });

  it('passes minimal Boolean equation and accepts non-minimal with note', () => {
    const dRes = designSequential(mod4Spec);
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: mod4Spec },
      referenceDesign: dRes.design,
    });

    render(<InputEquations session={session} />);

    // Minimal equation for D0 is "!Q0"
    const d0Input = screen.getByRole('textbox', { name: /Boolean equation for D0/i });
    fireEvent.change(d0Input, { target: { value: '!Q0' } });

    // Non-minimal equation for D1: "!Q1 & Q0 | Q1 & !Q0" is minimal, but let's test a non-minimal expression
    // For D0, let's enter non-minimal "!Q0 & Q1 | !Q0 & !Q1" on D0
    fireEvent.change(d0Input, { target: { value: '!Q0 & Q1 | !Q0 & !Q1' } });

    const checkBtn = screen.getByRole('button', { name: /Check Equations/i });
    fireEvent.click(checkBtn);

    // Shows accepted with note for non-minimal D0
    expect(screen.getByText(/Accepted with note/i)).toBeInTheDocument();

    // Now change to minimal !Q0
    fireEvent.change(d0Input, { target: { value: '!Q0' } });
    fireEvent.click(checkBtn);
    expect(screen.getByText(/Verified: Minimal equation/i)).toBeInTheDocument();
  });

  it('displays parse error position text on syntax error and lists mismatch care rows on wrong logic', () => {
    const dRes = designSequential(mod4Spec);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: mod4Spec },
      referenceDesign: dRes.design,
    });

    render(<InputEquations session={session} />);

    const d0Input = screen.getByRole('textbox', { name: /Boolean equation for D0/i });
    const checkBtn = screen.getByRole('button', { name: /Check Equations/i });

    // 1. Syntax parse error: "! & Q0"
    fireEvent.change(d0Input, { target: { value: '! & Q0' } });
    fireEvent.click(checkBtn);

    expect(screen.getByText(/at position \d+/i)).toBeInTheDocument();

    // 2. Logic mismatch on care rows: entering "Q0" instead of "!Q0"
    fireEvent.change(d0Input, { target: { value: 'Q0' } });
    fireEvent.click(checkBtn);

    expect(screen.getByText(/Equation does not match function D0 on \d+ care condition/i)).toBeInTheDocument();
  });

  it('marks assisted and displays solver equation, cost, minimal covers, and used dont-cares on Reveal', () => {
    const dRes = designSequential(mod4Spec);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: mod4Spec },
      referenceDesign: dRes.design,
    });

    render(<InputEquations session={session} />);

    const revealBtns = screen.getAllByRole('button', { name: /Reveal solver result/i });
    fireEvent.click(revealBtns[0]!);

    expect(screen.getByText(/Solver Solution:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Cost:/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Minimal covers:/i)).toBeInTheDocument();
    expect(screen.getByText(/Used don't-cares:/i)).toBeInTheDocument();
  });

  it('performs K-Map handoff writing variables and truthTable and navigates to #/kmap', () => {
    const dRes = designSequential(mod4Spec);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: mod4Spec },
      referenceDesign: dRes.design,
    });

    render(<InputEquations session={session} />);

    const kmapBtns = screen.getAllByRole('button', { name: /Open in K-Map/i });
    fireEvent.click(kmapBtns[0]!);

    const p = useProjectStore.getState().project;
    expect(p.truthTable).toBeDefined();
    expect(p.truthTable?.variables).toEqual(['Q1', 'Q0']);
    expect(p.truthTable?.rows.length).toBe(4);
    expect(useUiStore.getState().currentModule).toBe('kmap-solver');
  });

  it('disables Open in K-Map with a clear reason for a 1-variable function', () => {
    const mod2Spec: CounterSpec = {
      kind: 'counter',
      modulus: 2,
      direction: 'up',
      flipFlop: 'D',
      style: 'sync',
    };
    const dRes = designSequential(mod2Spec);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: mod2Spec },
      referenceDesign: dRes.design,
    });

    render(<InputEquations session={session} />);

    const kmapBtn = screen.getByRole('button', { name: /Open in K-Map/i });
    expect(kmapBtn).toBeDisabled();
    expect(screen.getByText(/K-Map requires at least 2 variables/i)).toBeInTheDocument();
  });
});
