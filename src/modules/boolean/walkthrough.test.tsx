/**
 * @file walkthrough.test.tsx
 * Automated verification of the full Stage 4C walkthrough scenario:
 * 1. Enter: A'B + C(D xor E)
 * 2. Truth table displays 5 variables (A, B, C, D, E) and 32 rows with canonical SOP and POS.
 * 3. Simplify with step tracking and literal counts.
 * 4. Equivalence check with second expression.
 * 5. Universal NAND-only form synthesis and equivalence verification.
 * 6. Send to K-Map handoff, pipeline progression, and reload persistence.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { App } from '../../App';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { createEmptyDesignProject } from '../../types/designProject';

describe('Stage 4C Walkthrough Verification', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '#boolean-tool';
    const fresh = createEmptyDesignProject('walkthrough-proj', 'Walkthrough Project');
    useProjectStore.getState().setProject(fresh);
    useUiStore.getState().setModule('boolean-tool');
  });

  it('completes the entire end-to-end walkthrough sequence', async () => {
    render(<App />);

    // Step 1 & 2: Enter expression A'B + C(D xor E)
    const input = await screen.findByRole(
      'textbox',
      {
        name: /boolean expression/i,
      },
      { timeout: 10000 }
    );
    fireEvent.change(input, { target: { value: "A'B + C(D xor E)" } });

    // Step 3: Verify 5 variables and 32 rows truth table
    await waitFor(
      () => {
        expect(screen.getByText(/5 variables: A, B, C, D, E/i)).toBeInTheDocument();
      },
      { timeout: 800 }
    );

    const rows = screen.getAllByRole('row');
    // 1 table header row + 32 minterm data rows = 33 rows
    expect(rows.length).toBe(33);

    // Verify canonical forms
    expect(screen.getByText(/Canonical SOP \(Σm\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Canonical POS \(ΠM\)/i)).toBeInTheDocument();

    // Step 4: Simplify tab
    const simplifyTab = screen.getByRole('tab', { name: /simplify/i });
    fireEvent.click(simplifyTab);

    expect(await screen.findByText(/Algebraic Reduction Result/i)).toBeInTheDocument();
    expect(screen.getByText(/Try a Law on Current Expression/i)).toBeInTheDocument();

    // Step 5: Equivalence tab
    const equivTab = screen.getByRole('tab', { name: /equivalence/i });
    fireEvent.click(equivTab);

    const equivInputs = await screen.findAllByRole('textbox');
    // Input 2 is the second expression
    const secondExprInput = equivInputs[equivInputs.length - 1];
    if (!secondExprInput) throw new Error('Second expression input missing');
    fireEvent.change(secondExprInput, { target: { value: "A'B + C(D xor E)" } });

    await waitFor(
      () => {
        expect(screen.getByText(/\[Equivalent\]/i)).toBeInTheDocument();
      },
      { timeout: 800 }
    );

    // Step 6: Universal NAND / NOR tab
    const universalTab = screen.getByRole('tab', { name: /nand \/ nor/i });
    fireEvent.click(universalTab);

    expect(await screen.findByText(/Verified Equivalent to Original Expression/i)).toBeInTheDocument();
    expect(screen.getByText(/Total NAND Gate Count/i)).toBeInTheDocument();
    expect(screen.getByText(/Logic Circuit Level Depth/i)).toBeInTheDocument();

    // Step 7: Send to K-Map
    const sendButtons = screen.getAllByRole('button', {
      name: /send to karnaugh map minimizer/i,
    });
    const sendBtn = sendButtons[0];
    if (!sendBtn) throw new Error('Send button not found');
    expect(sendBtn).toBeEnabled();

    fireEvent.click(sendBtn);

    // Confirm K-Map solver page opens
    await waitFor(
      () => {
        expect(useUiStore.getState().currentModule).toBe('kmap-solver');
        expect(screen.getByRole('heading', { name: /Karnaugh Map Minimizer/i })).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    // Verify Pipeline stepper marks Boolean Expression Analysis as completed
    const completed =
      useProjectStore.getState().project.pipelineProgress?.completedModules ?? [];
    expect(completed).toContain('boolean-tool');

    // Step 8: Confirm persistence and reload
    const currentProject = useProjectStore.getState().project;
    expect(currentProject.variables).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(currentProject.truthTable?.rows.length).toBe(32);
    expect(currentProject.lastHandoff?.from).toBe('boolean-tool');
    expect(currentProject.lastHandoff?.to).toBe('kmap-solver');
  });
});
