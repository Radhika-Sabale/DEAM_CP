/**
 * @file SequenceDetectorPage.test.tsx
 * Tests for SequenceDetectorPage component (Stage 10E).
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { createEmptyDesignProject } from '../../types/designProject';
import type { DetectorSpec } from '../../types/sequential';
import { createInitialSequentialSession, type SequentialSessionState } from './sequentialSession';
import { SequenceDetectorPage } from './SequenceDetectorPage';
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

describe('SequenceDetectorPage component', () => {
  const detectorSpec: DetectorSpec = {
    kind: 'detector',
    pattern: '1011',
    machine: 'mealy',
    overlapping: true,
    flipFlop: 'D',
  };

  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
    const fresh = createEmptyDesignProject('det-page-test', 'Detector Page Test');
    fresh.sequentialSpec = detectorSpec;
    useProjectStore.setState({ project: fresh });
    useUiStore.setState({ currentModule: 'sequential-designer' });
  });

  it('renders sequence detector title, wizard stepper, and K-Map function selector', () => {
    const session = createMockSession({
      state: {
        ...createInitialSequentialSession(),
        spec: detectorSpec,
        currentStep: 'define',
      },
    });

    render(<SequenceDetectorPage session={session} />);

    expect(screen.getByText(/Sequence Detector \(Mealy \/ Moore FSM\)/i)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Sequential design steps/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Choose function to open in the K-Map/i)).toBeInTheDocument();
  });
});
