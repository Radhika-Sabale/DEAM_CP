/**
 * @file SequentialPage.test.tsx
 * Tests for SequentialPage top-level component (Stage 10E).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { createEmptyDesignProject } from '../../types/designProject';
import type { CounterSpec } from '../../types/sequential';
import { SequentialPage } from './SequentialPage';

describe('SequentialPage component', () => {
  const mod8Spec: CounterSpec = {
    kind: 'counter',
    modulus: 8,
    direction: 'up',
    flipFlop: 'JK',
    style: 'sync',
  };

  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
    const fresh = createEmptyDesignProject('seq-page-test', 'Sequential Page Test');
    fresh.sequentialSpec = mod8Spec;
    fresh.flipFlopType = 'JK';
    useProjectStore.setState({ project: fresh });
    useUiStore.setState({ currentModule: 'sequential-designer' });
  });

  it('renders the module heading, tabs, WizardStepper, and K-Map handoff', () => {
    render(<SequentialPage />);

    // Header title
    expect(screen.getByText(/Synchronous Sequential Circuit Designer/i)).toBeInTheDocument();

    // Mode switch tabs
    const counterTab = screen.getByRole('button', { name: /Counter designer/i });
    const detectorTab = screen.getByRole('button', { name: /Sequence detector/i });
    expect(counterTab).toBeInTheDocument();
    expect(detectorTab).toBeInTheDocument();

    expect(screen.getByText('MODULE 06')).toBeInTheDocument();

    // Wizard stepper
    expect(screen.getByRole('navigation', { name: /Sequential design steps/i })).toBeInTheDocument();

    // K-Map handoff dropdown
    expect(screen.getByLabelText(/Choose function to open in the K-Map/i)).toBeInTheDocument();
  });

  it('switches between Counter designer and Sequence detector tabs', () => {
    render(<SequentialPage />);

    const detectorTab = screen.getByRole('button', { name: /Sequence detector/i });
    fireEvent.click(detectorTab);

    // Sequence detector view rendered
    expect(screen.getByText(/Sequence Detector \(Mealy \/ Moore FSM\)/i)).toBeInTheDocument();

    const counterTab = screen.getByRole('button', { name: /Counter designer/i });
    fireEvent.click(counterTab);

    // Counter view restored
    expect(screen.queryByText(/Sequence Detector \(Mealy \/ Moore FSM\)/i)).not.toBeInTheDocument();
  });
});
