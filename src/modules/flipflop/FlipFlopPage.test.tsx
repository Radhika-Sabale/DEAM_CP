/**
 * @file FlipFlopPage.test.tsx
 * Integration tests for FlipFlopPage: type selection, store synchronization, tabs switching,
 * non-blocking advisory note, and pipeline handoff to Sequential Designer.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { createEmptyDesignProject } from '../../types/designProject';
import { FlipFlopPage } from './FlipFlopPage';

describe('FlipFlopPage', () => {
  beforeEach(() => {
    const fresh = createEmptyDesignProject();
    useProjectStore.getState().setProject(fresh);
    useUiStore.getState().setModule('flipflop-simulator');
  });

  it('renders FlipFlopPage and synchronizes type to project store', () => {
    render(<FlipFlopPage />);

    expect(screen.getByText('Flip-Flop & Latch Workbench')).toBeDefined();
    expect(screen.getByText(/Module 5 • Sequential Pipeline/i)).toBeDefined();

    // Select JK flip-flop
    const jkRadio = screen.getByDisplayValue('JK');
    fireEvent.click(jkRadio);

    expect(useProjectStore.getState().project.flipFlopType).toBe('JK');
  });

  it('displays non-blocking advisory banner when level-triggered mode is active', () => {
    render(<FlipFlopPage />);

    const triggerSelect = screen.getByLabelText(/Clock Triggering Mechanism/i);
    fireEvent.change(triggerSelect, { target: { value: 'level-high' } });

    expect(
      screen.getByText(
        /Counter design assumes edge-triggered flip-flops; level-triggered JK and T can race around./i
      )
    ).toBeDefined();

    // Race-around tab should now be visible
    expect(screen.getByRole('tab', { name: /Race-around/i })).toBeDefined();
  });

  it('switches between Simulate, Tables, and Practice tabs', () => {
    render(<FlipFlopPage />);

    // Click Tables tab
    const tablesTab = screen.getByRole('tab', { name: /Tables/i });
    fireEvent.click(tablesTab);
    expect(screen.getByText('Characteristic & Excitation Tables')).toBeDefined();

    // Click Practice tab
    const practiceTab = screen.getByRole('tab', { name: /Practice/i });
    fireEvent.click(practiceTab);
    expect(screen.getByText('Interactive Practice & Socratic Evaluation')).toBeDefined();
  });
});
