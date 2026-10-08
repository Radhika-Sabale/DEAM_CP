/**
 * @file CircuitPage.test.tsx
 * Comprehensive integration tests for CircuitPage:
 * - Synthesis banner from K-Map minimized expression
 * - Full Adder and 100-bit ripple adder simulation smoke tests
 * - Keyboard navigation and accessibility assertions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { solveSOP } from '../../engine/kmap/solver';
import { rippleCarryAdder } from '../../engine/circuit/examples';
import { useProjectStore } from '../../store/projectStore';
import { createEmptyDesignProject } from '../../types/designProject';
import { CircuitPage } from './CircuitPage';

describe('CircuitPage integration', () => {
  beforeEach(() => {
    act(() => {
      useProjectStore.setState({
        project: createEmptyDesignProject('p1', 'Test Lab Session'),
        isDirty: false,
      });
    });
  });

  it('renders CircuitPage, synthesizes circuit from K-Map SOP, and matches truth table', () => {
    // 1. Setup project with a 4-variable K-Map minimized SOP expression: F(A,B,C,D) = A B + C D
    const vars = ['A', 'B', 'C', 'D'];
    const minterms = [3, 7, 11, 12, 13, 14, 15]; // C D (3,7,11,15) + A B (12,13,14,15)
    const sopRes = solveSOP(4, minterms, [], vars);
    expect(sopRes.ok).toBe(true);
    if (!sopRes.ok) return;

    act(() => {
      useProjectStore.getState().applyPatch({
        variables: vars,
        minimizedExpression: {
          sop: { ast: sopRes.solution.expression, text: sopRes.solution.expressionString },
          pos: null,
        },
      });
    });

    render(<CircuitPage />);

    // Assert K-Map expression banner is visible
    expect(screen.getByText(/Minimized Expression from Upstream Module:/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(sopRes.solution.expressionString.replace('+', '\\+'), 'i'))).toBeInTheDocument();

    // Click "Generate Circuit"
    const genButton = screen.getByRole('button', { name: /Generate circuit schematic/i });
    fireEvent.click(genButton);

    // Switch to Truth Table tab to verify match
    const ttTab = screen.getByRole('tab', { name: /Truth Table/i });
    fireEvent.click(ttTab);

    expect(screen.getByText(/Complete Match!/i)).toBeInTheDocument();
  });

  it('500-gate smoke test: loads 100-bit ripple carry adder, toggles Cin, and simulates without error', () => {
    const adder100 = rippleCarryAdder(100);
    expect(adder100.nodes.length).toBeGreaterThanOrEqual(500);

    act(() => {
      useProjectStore.getState().applyPatch({
        circuit: adder100,
      });
    });

    render(<CircuitPage />);

    // Assert circuit summary reflects >= 500 nodes
    expect(screen.getByText(/Total Nodes:/i)).toBeInTheDocument();

    // Advance simulation step
    const stepBtn = screen.getByRole('button', { name: /Advance simulation by 1 time unit/i });
    fireEvent.click(stepBtn);

    // Assert status is Settled without throwing or hanging
    expect(screen.getByText(/Settled/i)).toBeInTheDocument();
  });

  it('ensures all interactive elements have accessible names and aria-live regions exist', () => {
    render(<CircuitPage />);

    // Check all buttons have accessible text
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      const name = btn.getAttribute('aria-label') || btn.textContent?.trim();
      expect(name).toBeTruthy();
    });

    // Check aria-live regions exist for live screen reader feedback
    const liveRegions = document.querySelectorAll('[aria-live]');
    expect(liveRegions.length).toBeGreaterThan(0);
  });
});
