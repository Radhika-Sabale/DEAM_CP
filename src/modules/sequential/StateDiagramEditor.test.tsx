/**
 * @file StateDiagramEditor.test.tsx
 * Tests for StateDiagramEditor: keyboard-based entry for Mod-5 counter, missing transition diagnostics,
 * Mealy output select, and asynchronous ripple bypass.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { designSequential } from '../../engine/sequential/counterDesigner';
import type { CounterSpec, DetectorSpec } from '../../types/sequential';
import {
  createInitialSequentialSession,
  type SequentialSessionState,
} from './sequentialSession';
import { StateDiagramEditor } from './StateDiagramEditor';
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
    specChangeConfirm: {
      isOpen: false,
      pendingSpec: null,
      confirm: vi.fn(),
      cancel: vi.fn(),
    },
    ...overrides,
  };
}

describe('StateDiagramEditor component', () => {
  it('builds the mod-5 counter diagram with the keyboard only and verifies it', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      flipFlop: 'D',
      style: 'sync',
      direction: 'up',
      modulus: 5,
    };
    const dRes = designSequential(spec);
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    const markVerified = vi.fn();
    const session = createMockSession({
      referenceDesign: dRes.design,
      markVerified,
    });

    render(<StateDiagramEditor session={session} />);

    // Select transitions for states 0 -> 1, 1 -> 2, 2 -> 3, 3 -> 4, 4 -> 0
    const nextSelects = [
      { name: /State S0.*target state/i, target: '1' },
      { name: /State S1.*target state/i, target: '2' },
      { name: /State S2.*target state/i, target: '3' },
      { name: /State S3.*target state/i, target: '4' },
      { name: /State S4.*target state/i, target: '0' },
    ];

    for (const item of nextSelects) {
      const select = screen.getByRole('combobox', { name: item.name });
      fireEvent.change(select, { target: { value: item.target } });
    }

    // Check diagram
    const checkBtn = screen.getByRole('button', { name: /Check Diagram/i });
    fireEvent.click(checkBtn);

    // Should mark verified
    expect(markVerified).toHaveBeenCalledWith(
      'diagram',
      expect.anything(),
      expect.anything()
    );

    // Shows 5 correct verdicts
    const correctIndicators = screen.getAllByText(/✓ Correct/i);
    expect(correctIndicators).toHaveLength(5);
  });

  it('shows plain-language diagnostic when a transition arrow is missing', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      flipFlop: 'D',
      style: 'sync',
      direction: 'up',
      modulus: 5,
    };
    const dRes = designSequential(spec);
    if (!dRes.ok) return;

    const session = createMockSession({
      referenceDesign: dRes.design,
    });

    render(<StateDiagramEditor session={session} />);

    // Click check without selecting targets
    const checkBtn = screen.getByRole('button', { name: /Check Diagram/i });
    fireEvent.click(checkBtn);

    // Should indicate incorrect or missing transitions
    const incorrectBadges = screen.getAllByText(/✗/i);
    expect(incorrectBadges.length).toBeGreaterThan(0);
  });

  it('renders Mealy output selects when Mealy sequence detector is configured', () => {
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
      referenceDesign: dRes.design,
    });

    render(<StateDiagramEditor session={session} />);

    // Mealy outputs should have comboboxes
    const outputSelects = screen.getAllByRole('combobox', {
      name: /Mealy output/i,
    });
    expect(outputSelects.length).toBeGreaterThan(0);
  });

  it('bypasses editing for asynchronous ripple counters with an explanation', () => {
    const session = createMockSession({
      asyncDesign: {
        spec: { kind: 'counter', flipFlop: 'JK', style: 'async', direction: 'up', modulus: 4, stateBits: 2 },
        stateBits: 2,
        modulus: 4,
        direction: 'up',
        flipFlop: 'JK',
        trigger: 'falling',
        stages: [],
        decode: { active: false, targetNumber: 4, bitIndices: [], expression: '' },
        notes: [],
      },
    });

    render(<StateDiagramEditor session={session} />);

    expect(
      screen.getByText(/Asynchronous ripple counters follow a fixed binary ripple pattern/i)
    ).toBeInTheDocument();
  });
});
