/**
 * @file BooleanPage.test.tsx
 * Tests for BooleanPage: store synchronization, pipeline handoff execution,
 * 6-variable handoff blocking, persisted state restoration, and accessible navigation.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { parse } from '../../engine/boolean';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { createEmptyDesignProject } from '../../types/designProject';
import { BooleanPage } from './BooleanPage';

describe('BooleanPage integration', () => {
  beforeEach(() => {
    // Reset Zustand stores to clean default state
    const cleanProject = createEmptyDesignProject('test-proj', 'Test Project');
    useProjectStore.getState().setProject(cleanProject);
    useUiStore.getState().setModule('boolean-tool');
  });

  it('typing an expression writes parsed AST, variables, and truth table to project store', async () => {
    render(<BooleanPage />);

    const input = screen.getByRole('textbox', { name: /boolean expression/i });
    fireEvent.change(input, { target: { value: 'A + B' } });

    await waitFor(
      () => {
        const state = useProjectStore.getState();
        expect(state.project.variables).toEqual(['A', 'B']);
        expect(state.project.expression).not.toBeNull();
        expect(state.project.truthTable?.rows.length).toBe(4);
      },
      { timeout: 600 }
    );
  });

  it('clicking Send button executes handoff to K-Map, records handoff, and completes Boolean step', async () => {
    render(<BooleanPage />);

    const input = screen.getByRole('textbox', { name: /boolean expression/i });
    fireEvent.change(input, { target: { value: 'A + B' } });

    await waitFor(
      () => {
        const sendBtn = screen.getAllByRole('button', {
          name: /send to karnaugh map minimizer/i,
        })[0];
        expect(sendBtn).toBeEnabled();
      },
      { timeout: 600 }
    );

    const sendBtn = screen.getAllByRole('button', {
      name: /send to karnaugh map minimizer/i,
    })[0];
    if (!sendBtn) throw new Error('Send button not found');
    fireEvent.click(sendBtn);

    // Verify navigation to kmap-solver
    expect(useUiStore.getState().currentModule).toBe('kmap-solver');

    // Verify Boolean step marked completed
    const completed =
      useProjectStore.getState().project.pipelineProgress?.completedModules ?? [];
    expect(completed).toContain('boolean-tool');

    // Verify lastHandoff recorded
    const lastHandoff = useProjectStore.getState().project.lastHandoff;
    expect(lastHandoff?.from).toBe('boolean-tool');
    expect(lastHandoff?.to).toBe('kmap-solver');
  });

  it('blocks handoff and displays readable message for 6-variable expression', async () => {
    render(<BooleanPage />);

    const input = screen.getByRole('textbox', { name: /boolean expression/i });
    // 6 variables: A, B, C, D, E, F
    fireEvent.change(input, { target: { value: 'A + B + C + D + E + F' } });

    await waitFor(
      () => {
        expect(
          screen.getAllByText(/K-maps support 2 to 5 variables; your expression has 6\./i).length
        ).toBeGreaterThan(0);
      },
      { timeout: 600 }
    );

    const sendBtn = screen.getAllByRole('button', {
      name: /send to karnaugh map minimizer/i,
    })[0];
    expect(sendBtn).toBeDisabled();
  });

  it('restores expression and truth table when loading an existing persisted project', async () => {
    const parseRes = parse("A'B + C");
    if (!parseRes.ok) throw new Error('Parse failed');

    const persisted = {
      ...createEmptyDesignProject('persisted-proj', 'Persisted'),
      expression: parseRes.ast,
      variables: ['A', 'B', 'C'],
      truthTable: {
        variables: ['A', 'B', 'C'],
        rows: [
          { index: 0, inputs: [0, 0, 0] as const, output: 0 as const },
          { index: 1, inputs: [0, 0, 1] as const, output: 1 as const },
          { index: 2, inputs: [0, 1, 0] as const, output: 1 as const },
          { index: 3, inputs: [0, 1, 1] as const, output: 1 as const },
          { index: 4, inputs: [1, 0, 0] as const, output: 0 as const },
          { index: 5, inputs: [1, 0, 1] as const, output: 1 as const },
          { index: 6, inputs: [1, 1, 0] as const, output: 0 as const },
          { index: 7, inputs: [1, 1, 1] as const, output: 1 as const },
        ],
      },
    };

    useProjectStore.getState().setProject(persisted);

    render(<BooleanPage />);

    const input = screen.getByRole('textbox', { name: /boolean expression/i });
    expect(input).toHaveValue("A'B + C");
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('meets accessibility standards: tablist navigation and tabpanel roles', () => {
    render(<BooleanPage />);

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(5);

    const activeTab = tabs[0];
    expect(activeTab).toHaveAttribute('aria-selected', 'true');

    const panel = screen.getByRole('tabpanel');
    expect(panel).toBeInTheDocument();
  });

  it('integration: Boolean practice with wrong De Morgan step shows demorgan-misapplied and progressive hints 1, 2, 3', () => {
    render(<BooleanPage />);

    // Open Practice Simplification tab
    const practiceTab = screen.getByRole('tab', { name: /Practice Simplification/i });
    fireEvent.click(practiceTab);

    // Initial problem is (A + B)'
    expect(screen.getByText("(A + B)'")).toBeInTheDocument();

    // Student enters wrong De Morgan expansion: A' + B' (distributed NOT without flipping + to *)
    const exprInput = screen.getByLabelText(/Resulting Algebraic Expression/i);
    fireEvent.change(exprInput, { target: { value: "A' + B'" } });

    // Submit step
    const checkBtn = screen.getByRole('button', { name: /Check My Step/i });
    fireEvent.click(checkBtn);

    // Verification 1: DiagnosisCard displays demorgan-misapplied diagnosis
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText(/Cognitive Diagnosis: De Morgan's Law Misapplied/i)
    ).toBeInTheDocument();

    // Verification 2: Progressive hint ladder 1, 2, 3
    // Level 1: Nudge
    const hint1Btn = screen.getByRole('button', { name: /Unlock hint level 1/i });
    fireEvent.click(hint1Btn);
    expect(screen.getByText(/Level 1: Nudge/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/break the complement bar AND flip the operator/i).length
    ).toBeGreaterThan(0);

    // Level 2: Pointed hint
    const hint2Btn = screen.getByRole('button', { name: /Unlock hint level 2/i });
    fireEvent.click(hint2Btn);
    expect(screen.getByText(/Level 2: Pointed/i)).toBeInTheDocument();
    expect(screen.getByText(/Check your operator/i)).toBeInTheDocument();

    // Level 3: Worked step
    const hint3Btn = screen.getByRole('button', { name: /Unlock hint level 3/i });
    fireEvent.click(hint3Btn);
    expect(screen.getByText(/Level 3: Worked Step/i)).toBeInTheDocument();
    expect(screen.getByText(/Applying De Morgan's theorem correctly/i)).toBeInTheDocument();
    expect(screen.getByText(/Status: Assisted by Worked Step/i)).toBeInTheDocument();
  });

  it('integration: Boolean practice with wrong intermediate step triggers answer-trap banner on final check', () => {
    render(<BooleanPage />);

    // Open Practice Simplification tab
    const practiceTab = screen.getByRole('tab', { name: /Practice Simplification/i });
    fireEvent.click(practiceTab);

    // 1. Submit invalid step
    const exprInput = screen.getByLabelText(/Resulting Algebraic Expression/i);
    fireEvent.change(exprInput, { target: { value: "A' + B'" } });
    const checkBtn = screen.getByRole('button', { name: /Check My Step/i });
    fireEvent.click(checkBtn);

    // 2. Click Try Again, enter correct final answer A'B'
    const tryAgainBtn = screen.getByRole('button', { name: /Try Again/i });
    fireEvent.click(tryAgainBtn);

    fireEvent.change(exprInput, { target: { value: "A'B'" } });
    fireEvent.click(screen.getByRole('button', { name: /Check My Step/i }));

    expect(screen.getByText(/Correct! Step verified/i)).toBeInTheDocument();

    // 3. Click Final Complete Check
    const finalCheckBtn = screen.getByRole('button', {
      name: /Check Complete Simplification & Trap Detection/i,
    });
    fireEvent.click(finalCheckBtn);

    // Banner is rendered
    expect(screen.getByText(/Answer Trap Detected/i)).toBeInTheDocument();
  });
});
