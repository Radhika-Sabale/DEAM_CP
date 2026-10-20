/**
 * @file WizardStepper.test.tsx
 * Tests for WizardStepper: statuses as text, aria-current, lock reasons, and keyboard navigation.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import {
  createInitialSequentialSession,
  sequentialSessionReducer,
  type SequentialSessionState,
} from './sequentialSession';
import { WizardStepper } from './WizardStepper';

describe('WizardStepper component', () => {
  it('renders all 8 steps in a real <ol> element with text statuses', () => {
    const state = createInitialSequentialSession();
    render(<WizardStepper state={state} onSelectStep={vi.fn()} />);

    const list = screen.getByRole('list');
    expect(list.tagName.toLowerCase()).toBe('ol');

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(8);

    // The initial step is current and remaining steps are locked.
    expect(screen.getByText('Current')).toBeInTheDocument();
    const lockedBadges = screen.getAllByText('Locked');
    expect(lockedBadges.length).toBe(7);
  });

  it('marks active step with aria-current="step"', () => {
    let state = createInitialSequentialSession();
    state = sequentialSessionReducer(state, {
      type: 'markVerified',
      stepId: 'flipflop',
      draft: 'D',
    });
    state = sequentialSessionReducer(state, {
      type: 'selectStep',
      stepId: 'define',
    });

    render(<WizardStepper state={state} onSelectStep={vi.fn()} />);

    const defineButton = screen.getByRole('button', {
      name: /Step 2.*Define Machine/i,
    });
    expect(defineButton).toHaveAttribute('aria-current', 'step');

    const flipFlopButton = screen.getByRole('button', {
      name: /Step 1.*Select Flip-Flop/i,
    });
    expect(flipFlopButton).not.toHaveAttribute('aria-current');
  });

  it('shows why a step is locked in plain language', () => {
    const state = createInitialSequentialSession();
    render(<WizardStepper state={state} onSelectStep={vi.fn()} />);

    expect(screen.getByText('Choose a flip-flop first')).toBeInTheDocument();
    expect(screen.getByText('Define a valid sequential specification first.')).toBeInTheDocument();
  });

  it('allows keyboard navigation to unlocked steps and ignores locked steps', () => {
    let state: SequentialSessionState = createInitialSequentialSession();
    state = sequentialSessionReducer(state, {
      type: 'markVerified',
      stepId: 'flipflop',
      draft: 'D',
    });

    const handleSelect = vi.fn();
    render(<WizardStepper state={state} onSelectStep={handleSelect} />);

    // Step 2 is unlocked
    const defineButton = screen.getByRole('button', {
      name: /Step 2.*Define Machine/i,
    });
    expect(defineButton).not.toBeDisabled();

    // Trigger keyboard click
    fireEvent.click(defineButton);
    expect(handleSelect).toHaveBeenCalledWith('define');

    // Step 3 is locked
    const diagramButton = screen.getByRole('button', {
      name: /Step 3.*State Diagram/i,
    });
    expect(diagramButton).toBeDisabled();
    fireEvent.click(diagramButton);
    expect(handleSelect).not.toHaveBeenCalledWith('diagram');
  });
});
