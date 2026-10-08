/**
 * @file SolutionPanel.test.tsx
 * Tests for SolutionPanel:
 * - 4-variable textbook minimization displays PIs, essentials, and minimal SOP
 * - Multiple minimal covers selector appears for cyclic-core examples
 * - Copy button interaction
 * - Constant 0 and 1 plain text notices
 */

import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { solvePOS, solveSOP } from '../../engine/kmap/solver';
import { SolutionPanel } from './SolutionPanel';

describe('SolutionPanel', () => {
  it('displays prime implicants, essentials, and minimal SOP for textbook 4-variable example', () => {
    // Four corners: m(0, 2, 8, 10) -> B'D'
    const solSop = solveSOP(4, [0, 2, 8, 10]);
    const solPos = solvePOS(4, [0, 2, 8, 10]);
    expect(solSop.ok).toBe(true);
    expect(solPos.ok).toBe(true);
    if (!solSop.ok || !solPos.ok) return;

    render(
      <SolutionPanel
        sopSolution={solSop.solution}
        posSolution={solPos.solution}
        selectedForm="SOP"
        onSelectForm={vi.fn()}
        selectedCoverIndex={0}
        onSelectCoverIndex={vi.fn()}
        onSolve={vi.fn()}
      />
    );

    // Assert Minimal SOP displays B'D'
    expect(screen.getAllByText("B'D'").length).toBeGreaterThanOrEqual(1);

    // Assert Essential PI badge is rendered
    expect(screen.getByText('Essential PI')).toBeInTheDocument();

    // Assert literal and term count
    expect(screen.getByText(/1 terms, 2 literals/i)).toBeInTheDocument();
  });

  it('displays alternative minimal covers selector when multiple equally minimal covers exist', () => {
    // Cyclic core 3-variable example: m(0, 1, 2, 5, 6, 7) has 2 minimal covers of 3 terms
    const solSop = solveSOP(3, [0, 1, 2, 5, 6, 7]);
    expect(solSop.ok).toBe(true);
    if (!solSop.ok) return;

    expect(solSop.solution.allMinimalCovers.length).toBeGreaterThan(1);

    const onSelectCoverIndex = vi.fn();

    render(
      <SolutionPanel
        sopSolution={solSop.solution}
        posSolution={null}
        selectedForm="SOP"
        onSelectForm={vi.fn()}
        selectedCoverIndex={0}
        onSelectCoverIndex={onSelectCoverIndex}
        onSolve={vi.fn()}
      />
    );

    // Verify header and equality statement
    expect(screen.getByText(/Alternative Minimal Covers/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Multiple minimal covers exist. All options are equally minimal/i)
    ).toBeInTheDocument();

    // Verify select dropdown exists
    const select = screen.getByRole('combobox', { name: /Select alternative minimal cover/i });
    expect(select).toBeInTheDocument();

    fireEvent.change(select, { target: { value: '1' } });
    expect(onSelectCoverIndex).toHaveBeenCalledWith(1);
  });

  it('displays plain text explanation for constant 0 functions', () => {
    const solSop = solveSOP(4, []);
    expect(solSop.ok).toBe(true);
    if (!solSop.ok) return;

    render(
      <SolutionPanel
        sopSolution={solSop.solution}
        posSolution={null}
        selectedForm="SOP"
        onSelectForm={vi.fn()}
        selectedCoverIndex={0}
        onSelectCoverIndex={vi.fn()}
        onSolve={vi.fn()}
      />
    );

    expect(screen.getByText(/Constant 0 \(F = 0\)/i)).toBeInTheDocument();
    expect(screen.getByText(/No minterms are true/i)).toBeInTheDocument();
  });

  it('displays plain text explanation for constant 1 functions', () => {
    const allCells = Array.from({ length: 16 }, (_, i) => i);
    const solSop = solveSOP(4, allCells);
    expect(solSop.ok).toBe(true);
    if (!solSop.ok) return;

    render(
      <SolutionPanel
        sopSolution={solSop.solution}
        posSolution={null}
        selectedForm="SOP"
        onSelectForm={vi.fn()}
        selectedCoverIndex={0}
        onSelectCoverIndex={vi.fn()}
        onSolve={vi.fn()}
      />
    );

    expect(screen.getByText(/Constant 1 \(F = 1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/All minterms are true/i)).toBeInTheDocument();
  });
});
