/**
 * @file CircuitPreview.test.tsx
 * Tests for CircuitPreview component (Stage 10E).
 * Verifies SVG title/desc, gates table accessibility, self-check status text,
 * and style switching while maintaining verified self-check status.
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
import { CircuitPreview } from './CircuitPreview';
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

describe('CircuitPreview component', () => {
  const mod8Spec: CounterSpec = {
    kind: 'counter',
    modulus: 8,
    direction: 'up',
    flipFlop: 'T',
    style: 'sync',
  };

  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
    const fresh = createEmptyDesignProject('circuit-test', 'Circuit Test');
    fresh.sequentialSpec = mod8Spec;
    fresh.flipFlopType = 'T';
    useProjectStore.setState({ project: fresh });
    useUiStore.setState({ currentModule: 'sequential-designer' });
  });

  it('renders SVG with title, desc, selfCheck text, and flip-flop blocks', () => {
    const dRes = designSequential(mod8Spec);
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: mod8Spec },
      referenceDesign: dRes.design,
    });

    const { container } = render(<CircuitPreview session={session} />);

    // SVG title and desc
    expect(container.querySelector('title')).toHaveTextContent('Sequential Circuit Schematic');
    expect(container.querySelector('desc')).toHaveTextContent(/Combinational logic schematic/i);

    // Self-check status text
    expect(screen.getByText(/Circuit matches all 3 functions/i)).toBeInTheDocument();

    // Flip-flop block descriptors rendered
    expect(screen.getByText(/T Flip-Flop \(Bit 2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/T flip-flop, bit 2: T2 -> Q2/i)).toBeInTheDocument();
  });

  it('toggles collapsible accessible gate netlist table', () => {
    const dRes = designSequential(mod8Spec);
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: mod8Spec },
      referenceDesign: dRes.design,
    });

    render(<CircuitPreview session={session} />);

    const toggleBtn = screen.getByRole('button', { name: /Accessible Circuit Netlist & Gate Table/i });
    expect(toggleBtn).toBeInTheDocument();

    // Click to open
    fireEvent.click(toggleBtn);

    // Table headers visible
    expect(screen.getByRole('columnheader', { name: /Bit Index/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Node/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Type \/ Gate/i })).toBeInTheDocument();
  });

  it('switching style to sop-and-or and nand-only keeps selfCheck passing', () => {
    const dRes = designSequential(mod8Spec);
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    const session = createMockSession({
      state: { ...createInitialSequentialSession(), spec: mod8Spec },
      referenceDesign: dRes.design,
    });

    render(<CircuitPreview session={session} />);

    const styleSelect = screen.getByLabelText(/Schematic Gate Style/i);

    // Switch to sop-and-or
    fireEvent.change(styleSelect, { target: { value: 'sop-and-or' } });
    expect(screen.getByText(/Circuit matches all 3 functions/i)).toBeInTheDocument();

    // Switch to nand-only
    fireEvent.change(styleSelect, { target: { value: 'nand-only' } });
    expect(screen.getByText(/Circuit matches all 3 functions/i)).toBeInTheDocument();
  });
});
