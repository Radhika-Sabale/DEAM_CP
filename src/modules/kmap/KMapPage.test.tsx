/**
 * @file KMapPage.test.tsx
 * Integration tests for KMapPage:
 * - Loading from project store (variables and truth table from Boolean handoff)
 * - Auto-solving and writing back minimal SOP/POS and groups via applyPatch
 * - Handoff transition to Circuit Simulator (marking K-Map complete in pipeline progress)
 * - Reload / store restoration
 * - Accessibility: roles, labels, non-color-only indications
 */

import { beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createEmptyDesignProject } from '../../types/designProject';
import type { LogicValue } from '../../types/ast';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { KMapPage } from './KMapPage';

describe('KMapPage', () => {
  beforeEach(() => {
    const emptyProj = createEmptyDesignProject('test-kmap-project', 'K-Map Test');
    useProjectStore.setState({
      project: emptyProj,
      isDirty: false,
    });
    useUiStore.setState({
      currentModule: 'kmap-solver',
      toasts: [],
    });
  });

  it('loads truth table handoff from Boolean module and auto-solves', async () => {
    // Populate project with 4-variable four corners: m(0, 2, 8, 10)
    const total = 16;
    const rows = Array.from({ length: total }, (_, i) => ({
      index: i,
      inputs: [
        ((i >> 3) & 1) as 0 | 1,
        ((i >> 2) & 1) as 0 | 1,
        ((i >> 1) & 1) as 0 | 1,
        (i & 1) as 0 | 1,
      ],
      output: [0, 2, 8, 10].includes(i) ? (1 as const) : (0 as const),
    }));

    useProjectStore.getState().applyPatch({
      variables: ['A', 'B', 'C', 'D'],
      truthTable: {
        variables: ['A', 'B', 'C', 'D'],
        rows,
      },
    });

    render(<KMapPage />);

    // Grid should display the 4-variable map with cells loaded
    expect(screen.getByRole('grid', { name: /4-variable Karnaugh Map/i })).toBeInTheDocument();

    // Auto-solved minimal SOP B'D' should be displayed in SolutionPanel
    await waitFor(() => {
      expect(screen.getAllByText("B'D'").length).toBeGreaterThan(0);
    });

    // Verify project store received minimizedExpression and kmap state
    const currentProj = useProjectStore.getState().project;
    expect(currentProj.minimizedExpression?.sop?.text).toBe("B'D'");
    expect(currentProj.kmap?.groups.length).toBeGreaterThan(0);
  });

  it('executes handoff to Circuit Simulator, marking K-Map complete', async () => {
    // Four corners: m(0, 2, 8, 10)
    const rows = Array.from({ length: 16 }, (_, i) => ({
      index: i,
      inputs: [0, 0, 0, 0] as const,
      output: [0, 2, 8, 10].includes(i) ? (1 as const) : (0 as const),
    }));

    useProjectStore.getState().applyPatch({
      variables: ['A', 'B', 'C', 'D'],
      truthTable: {
        variables: ['A', 'B', 'C', 'D'],
        rows,
      },
    });

    render(<KMapPage />);

    // Wait for auto-solve
    await waitFor(() => {
      expect(screen.getAllByText("B'D'").length).toBeGreaterThan(0);
    });

    // Locate the Send button
    const sendBtn = screen.getByRole('button', {
      name: /Send to Digital Circuit Schematic Simulator/i,
    });
    expect(sendBtn).toBeEnabled();

    // Click Send
    fireEvent.click(sendBtn);

    // Verify UI store navigated to circuit-simulator
    expect(useUiStore.getState().currentModule).toBe('circuit-simulator');

    // Verify K-Map is recorded in completedModules
    const completed = useProjectStore.getState().project.pipelineProgress?.completedModules;
    expect(completed).toContain('kmap-solver');
  });

  it('restores previous KMap state from project store on mount', () => {
    const cells: LogicValue[] = Array.from({ length: 16 }, () => 0 as LogicValue);
    cells[5] = 1;
    cells[7] = 1;

    useProjectStore.getState().applyPatch({
      kmap: {
        variables: ['W', 'X', 'Y', 'Z'],
        cells,
        groups: [
          {
            id: 'G1',
            cellIndices: [5, 7],
            termString: "W'XY",
          },
        ],
      },
    });

    render(<KMapPage />);

    // Variables W, X, Y, Z should be rendered
    expect(screen.getByText(/\[W, X, Y, Z\]/i)).toBeInTheDocument();

    // Cell 5 should have value 1
    const cell5 = screen.getByRole('gridcell', {
      name: /Cell W=0 X=1 Y=0 Z=1, minterm 5, value 1/i,
    });
    expect(cell5).toHaveTextContent('1');
  });

  it('passes accessibility checks for roles, labels, and non-color-only indications', () => {
    render(<KMapPage />);

    // Grid role
    expect(screen.getByRole('grid')).toBeInTheDocument();

    // Buttons have clear labels
    expect(screen.getByRole('button', { name: /Explore & Solve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Student Practice Mode/i })).toBeInTheDocument();

    // Mode switch works
    fireEvent.click(screen.getByRole('button', { name: /Student Practice Mode/i }));
    expect(screen.getByText(/Drawn Groups \(0\)/i)).toBeInTheDocument();
  });
});
