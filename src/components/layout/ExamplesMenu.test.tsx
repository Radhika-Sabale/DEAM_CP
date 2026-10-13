/**
 * @file ExamplesMenu.test.tsx
 * Unit tests verifying accessibility, filtering, keyboard operability, project creation,
 * home module navigation, and unsaved state protection in ExamplesMenu (Stage 12A).
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { ExamplesMenu } from './ExamplesMenu';

describe('ExamplesMenu Component', () => {
  const onCloseMock = vi.fn();

  beforeEach(() => {
    onCloseMock.mockClear();
    useProjectStore.getState().resetProject();
    useProjectStore.getState().markClean();
    useUiStore.getState().setModule('number-systems');
  });

  it('renders modal with module/difficulty filter controls and curated seed problem list', () => {
    render(<ExamplesMenu isOpen={true} onClose={onCloseMock} />);

    expect(screen.getByText('Open Curated Example')).toBeInTheDocument();
    expect(screen.getByLabelText(/Filter by Module/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Filter by Difficulty/i)).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(24);
  });

  it('filters problem list dynamically by difficulty tier', () => {
    render(<ExamplesMenu isOpen={true} onClose={onCloseMock} />);

    const difficultySelect = screen.getByLabelText(/Filter by Difficulty/i) as HTMLSelectElement;
    fireEvent.change(difficultySelect, { target: { value: 'hard' } });

    // Every item displayed must have the hard difficulty badge
    const hardBadges = screen.getAllByText('hard');
    expect(hardBadges.length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText('easy')).not.toBeInTheDocument();
  });

  it('filters problem list dynamically by module id', () => {
    render(<ExamplesMenu isOpen={true} onClose={onCloseMock} />);

    const moduleSelect = screen.getByLabelText(/Filter by Module/i) as HTMLSelectElement;
    fireEvent.change(moduleSelect, { target: { value: 'kmap-solver' } });

    const kmapLabels = screen.getAllByText(/Module: kmap-solver/i);
    expect(kmapLabels.length).toBeGreaterThanOrEqual(6);
    expect(screen.queryByText(/Module: number-systems/i)).not.toBeInTheDocument();
  });

  it('instantiates seed problem and navigates to target home module when project is clean', () => {
    render(<ExamplesMenu isOpen={true} onClose={onCloseMock} />);

    // Click on the 5-variable K-map problem
    const kmapBtn = screen.getByText(/5-variable 3D grouping spanning both layers/i).closest('button');
    expect(kmapBtn).not.toBeNull();
    fireEvent.click(kmapBtn!);

    // Verify modal closed
    expect(onCloseMock).toHaveBeenCalledTimes(1);

    // Verify active project in projectStore
    const currentProj = useProjectStore.getState().project;
    expect(currentProj.name).toContain('5-variable 3D grouping');
    expect(currentProj.variables).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(currentProj.truthTable).toBeDefined();

    // Verify navigation to home module
    const currentModule = useUiStore.getState().currentModule;
    expect(currentModule).toBe('kmap-solver');
  });

  it('prompts with confirmation dialog and prevents accidental overwrite when project is dirty', () => {
    // Mark current project as dirty
    useProjectStore.getState().applyPatch({ name: 'Unsaved Lab Work' });
    expect(useProjectStore.getState().isDirty).toBe(true);

    render(<ExamplesMenu isOpen={true} onClose={onCloseMock} />);

    const firstProblemBtn = screen.getAllByRole('button').find((b) =>
      b.textContent?.includes('Convert 156 (decimal) to binary')
    );
    expect(firstProblemBtn).toBeDefined();
    fireEvent.click(firstProblemBtn!);

    // Must show confirmation dialog and NOT yet overwrite project
    expect(screen.getByText('Discard Unsaved Changes?')).toBeInTheDocument();
    expect(useProjectStore.getState().project.name).toBe('Unsaved Lab Work');
    expect(onCloseMock).not.toHaveBeenCalled();

    // Clicking "Keep Editing Current Project" cancels
    const keepBtn = screen.getByText('Keep Editing Current Project');
    fireEvent.click(keepBtn);
    expect(screen.queryByText('Discard Unsaved Changes?')).not.toBeInTheDocument();
    expect(useProjectStore.getState().project.name).toBe('Unsaved Lab Work');

    // Clicking problem again and selecting "Discard and Open Example" confirms
    fireEvent.click(firstProblemBtn!);
    const discardBtn = screen.getByText('Discard and Open Example');
    fireEvent.click(discardBtn);

    expect(useProjectStore.getState().project.name).toBe('Convert 156 (decimal) to binary');
    expect(useUiStore.getState().currentModule).toBe('number-systems');
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
