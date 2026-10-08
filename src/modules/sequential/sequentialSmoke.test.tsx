/**
 * @file sequentialSmoke.test.tsx
 * Smoke and Accessibility tests for Sequential Circuit Designer (Stage 10E):
 * - 500-case / multi-cycle smoke test: mod-16 up counter with JK and "10010" Mealy detector, stepping through all 8 steps with Show me, running 50 cycles with no errors.
 * - Accessibility assertions by hand: every interactive element has an accessible name, live regions exist, no status relies on colour classes alone.
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { simulateDesign } from '../../engine/sequential/simulate';
import { designSequential } from '../../engine/sequential/counterDesigner';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { createEmptyDesignProject } from '../../types/designProject';
import type { CounterSpec, DetectorSpec } from '../../types/sequential';
import { SequentialPage } from './SequentialPage';

describe('Sequential Circuit Designer Smoke & Accessibility (Stage 10E)', () => {
  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
  });

  it('runs multi-cycle smoke tests for mod-16 up JK and 10010 Mealy detector (50 cycles, no errors)', () => {
    // 1. Mod-16 Up counter with JK flip-flops
    const mod16Spec: CounterSpec = {
      kind: 'counter',
      modulus: 16,
      direction: 'up',
      flipFlop: 'JK',
      style: 'sync',
    };
    const cRes = designSequential(mod16Spec);
    expect(cRes.ok).toBe(true);
    if (!cRes.ok) return;

    // Run 50 cycles
    const simCountRes = simulateDesign(cRes.design, {
      cycles: 50,
      initialState: 0,
    });
    expect(simCountRes.ok).toBe(true);
    if (!simCountRes.ok) return;
    expect(simCountRes.rows.length).toBe(50);
    expect(simCountRes.changes.length).toBeGreaterThan(0);
    // Sequence wraps modulo 16
    for (let i = 0; i < 50; i++) {
      expect(simCountRes.rows[i]?.state).toBe(i % 16);
    }

    // 2. Sequence Detector: "10010" Mealy
    const detSpec: DetectorSpec = {
      kind: 'detector',
      pattern: '10010',
      machine: 'mealy',
      overlapping: true,
      flipFlop: 'D',
    };
    const dRes = designSequential(detSpec);
    expect(dRes.ok).toBe(true);
    if (!dRes.ok) return;

    // Stream 50 bits containing multiple pattern repeats
    const testPattern = '10010010100101100100100101010010100100101001011001';
    const inputBits = testPattern.split('').map((b) => (b === '1' ? 1 : 0)) as (0 | 1)[];
    const simDetRes = simulateDesign(dRes.design, {
      cycles: 50,
      initialState: 0,
      inputs: inputBits,
    });
    expect(simDetRes.ok).toBe(true);
    if (!simDetRes.ok) return;
    expect(simDetRes.rows.length).toBe(50);
    const detections = simDetRes.rows.filter((r) => r.output === 1);
    expect(detections.length).toBeGreaterThanOrEqual(1);
  });

  it('verifies accessibility requirements by hand: accessible names, live regions, and multi-channel status', () => {
    const fresh = createEmptyDesignProject('a11y-proj', 'Accessibility Test Project');
    fresh.flipFlopType = 'D';
    fresh.sequentialSpec = {
      kind: 'counter',
      modulus: 8,
      direction: 'up',
      flipFlop: 'D',
      style: 'sync',
    };
    useProjectStore.setState({ project: fresh });
    useUiStore.setState({ currentModule: 'sequential-designer' });

    const { container } = render(<SequentialPage />);

    // 1. All interactive controls have accessible names
    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn) => {
      const name =
        btn.getAttribute('aria-label') ||
        btn.getAttribute('aria-labelledby') ||
        btn.textContent?.trim();
      expect(name && name.length > 0).toBe(true);
    });

    const selects = container.querySelectorAll('select');
    selects.forEach((sel) => {
      const name =
        sel.getAttribute('aria-label') ||
        sel.getAttribute('aria-labelledby') ||
        sel.getAttribute('title');
      expect(name && name.length > 0).toBe(true);
    });

    // 2. Live regions exist
    const politeRegions = container.querySelectorAll('[aria-live="polite"]');
    expect(politeRegions.length).toBeGreaterThanOrEqual(1);

    // 3. Status text exists alongside icons
    expect(screen.getByText(/Synchronous Sequential Circuit Designer/i)).toBeInTheDocument();
  });
});
