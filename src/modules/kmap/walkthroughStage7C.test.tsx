/**
 * @file walkthroughStage7C.test.tsx
 * Comprehensive end-to-end walkthrough integration test for Stage 7C:
 * 1. Handoff from Boolean module (four corners: m(0, 2, 8, 10))
 * 2. Explore & Solve view: 4-variable map, wrap annotations, minimal SOP B'D'
 * 3. Student mode: 3-cell non-power-of-two diagnosis & hint ladder
 * 4. Student mode: non-wrapping edge cells diagnosis (toroidal wrap)
 * 5. Student mode: valid four-corner group addition
 * 6. Student mode: final check with AnswerTrapBanner
 * 7. 5-variable dual 4x4 layout inspection
 * 8. Handoff to Circuit Simulator & pipeline progress completion
 */

import { beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../App';
import { createEmptyDesignProject } from '../../types/designProject';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';

describe('Stage 7C End-to-End Walkthrough', () => {
  beforeEach(() => {
    const emptyProj = createEmptyDesignProject('e2e-kmap-project', 'K-Map Walkthrough');
    useProjectStore.setState({
      project: emptyProj,
      isDirty: false,
    });
    useUiStore.setState({
      currentModule: 'boolean-tool',
      toasts: [],
    });
    useFeedbackStore.getState().resetAll();
    useLogStore.getState().clearLog();
  });

  it('completes the entire Stage 7C verification walkthrough sequence', async () => {
    render(<App />);

    // Step 1: In Boolean Expression module, enter four corners: A'B'C'D' + A'B'CD' + AB'C'D' + AB'CD'
    const exprInput = await screen.findByRole(
      'textbox',
      {
        name: /boolean expression/i,
      },
      { timeout: 10000 }
    );
    fireEvent.change(exprInput, {
      target: { value: "A'B'C'D' + A'B'CD' + AB'C'D' + AB'CD'" },
    });

    // Wait for parse & truth table to populate
    await waitFor(() => {
      const mintermText = screen.getByText(/Σm\(0, 2, 8, 10\)/i);
      expect(mintermText).toBeInTheDocument();
    });

    // Step 2: Click "Send to Karnaugh Map Minimizer"
    const sendButtons = screen.getAllByRole('button', {
      name: /Send to Karnaugh Map Minimizer/i,
    });
    const sendToKMapBtn = sendButtons[0];
    if (!sendToKMapBtn) throw new Error('Send button not found');
    expect(sendToKMapBtn).toBeEnabled();
    fireEvent.click(sendToKMapBtn);

    // Step 3: Verify navigation to K-Map module
    await waitFor(
      () => {
        expect(useUiStore.getState().currentModule).toBe('kmap-solver');
        expect(screen.getByRole('heading', { name: /Karnaugh Map Minimizer/i })).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    // Step 4: Verify 4-variable grid and auto-solved minimal SOP B'D'
    expect(screen.getByRole('grid', { name: /4-variable Karnaugh Map/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("B'D'").length).toBeGreaterThan(0);
    });

    // Step 5: Switch to Student Practice Mode tab
    const studentTabBtn = screen.getByRole('button', { name: /Student Practice Mode/i });
    fireEvent.click(studentTabBtn);
    expect(screen.getByText(/Drawn Groups \(0\)/i)).toBeInTheDocument();

    // Step 6: Test non-power-of-two group (3 cells: 0, 1, 2)
    const cell0 = screen.getByRole('gridcell', { name: /minterm 0\b/i });
    const cell1 = screen.getByRole('gridcell', { name: /minterm 1\b/i });
    const cell2 = screen.getByRole('gridcell', { name: /minterm 2\b/i });

    fireEvent.click(cell0);
    fireEvent.click(cell1);
    fireEvent.click(cell2);

    const addGroupBtn3 = screen.getByRole('button', { name: /Add Group \(3 cells\)/i });
    fireEvent.click(addGroupBtn3);

    // Verify DiagnosisCard appears with power-of-two diagnosis
    expect(screen.getByText(/Grouped Non-Power-of-Two/i)).toBeInTheDocument();

    // Unlock Level 1 hint
    const hintBtn = screen.getByRole('button', { name: /Unlock hint level 1 of 3/i });
    fireEvent.click(hintBtn);
    expect(screen.getByText(/Level 1: Nudge/i)).toBeInTheDocument();

    // Step 7: Test wrap-around omission (2 edge cells: 0, 2)
    const clearSelBtn = screen.getByRole('button', { name: /Clear Selection/i });
    fireEvent.click(clearSelBtn);

    fireEvent.click(cell0);
    fireEvent.click(cell2);

    const addGroupBtn2 = screen.getByRole('button', { name: /Add Group \(2 cells\)/i });
    fireEvent.click(addGroupBtn2);

    // Verify DiagnosisCard for toroidal wraparound
    expect(screen.getByText(/wraparound|wrap-around|group can be doubled/i)).toBeInTheDocument();

    // Step 8: Add valid four-corner group: m(0, 2, 8, 10)
    fireEvent.click(clearSelBtn);

    const cell8 = screen.getByRole('gridcell', { name: /minterm 8\b/i });
    const cell10 = screen.getByRole('gridcell', { name: /minterm 10\b/i });

    fireEvent.click(cell0);
    fireEvent.click(cell2);
    fireEvent.click(cell8);
    fireEvent.click(cell10);

    const addGroupBtn4 = screen.getByRole('button', { name: /Add Group \(4 cells\)/i });
    fireEvent.click(addGroupBtn4);

    // Verify group added
    expect(screen.getByText(/Drawn Groups \(1\)/i)).toBeInTheDocument();

    // Step 9: Click "Check My Solution" and verify AnswerTrapBanner appears
    const checkSolutionBtn = screen.getByRole('button', { name: /Check My Solution/i });
    fireEvent.click(checkSolutionBtn);

    expect(screen.getByText(/Valid & Minimal Solution!/i)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Pedagogical reasoning alert/i })).toBeInTheDocument();
    expect(screen.getByText(/Your final answer is right, but/i)).toBeInTheDocument();

    // Step 10: Switch back to Explore & Solve, switch to 5 variables
    const exploreTabBtn = screen.getByRole('button', { name: /Explore & Solve/i });
    fireEvent.click(exploreTabBtn);

    const varSelect = screen.getByLabelText(/Variables:/i);
    fireEvent.change(varSelect, { target: { value: '5' } });

    // Verify dual layer labels are rendered
    expect(screen.getByText(/Layer A = 0/i)).toBeInTheDocument();
    expect(screen.getByText(/Layer A = 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Inter-layer adjacency/i)).toBeInTheDocument();

    // Step 11: Click "Send to Digital Circuit Schematic Simulator"
    const circuitButtons = screen.getAllByRole('button', {
      name: /Send to Digital Circuit Schematic Simulator/i,
    });
    const sendToCircuitBtn = circuitButtons[0];
    if (!sendToCircuitBtn) throw new Error('Send to Circuit button not found');
    expect(sendToCircuitBtn).toBeEnabled();
    fireEvent.click(sendToCircuitBtn);

    // Step 12: Verify navigation and pipeline completion
    await waitFor(
      () => {
        expect(useUiStore.getState().currentModule).toBe('circuit-simulator');
      },
      { timeout: 10000 }
    );

    const completed = useProjectStore.getState().project.pipelineProgress?.completedModules ?? [];
    expect(completed).toContain('boolean-tool');
    expect(completed).toContain('kmap-solver');
  });
});
