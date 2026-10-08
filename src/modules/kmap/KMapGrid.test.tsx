/**
 * @file KMapGrid.test.tsx
 * Unit and interaction tests for KMapGrid:
 * - Keyboard value cycling (0 -> 1 -> X) via Space/Enter and direct number keys
 * - Accessible ARIA labels, roles (grid, row, gridcell), and textual symbol display
 * - 5-variable dual-layer rendering with side-by-side Layer A=0 and Layer A=1
 * - Mouse painting drag across adjacent cells
 */

import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { LogicValue } from '../../types/ast';
import { KMapGrid } from './KMapGrid';

describe('KMapGrid', () => {
  it('renders a 4-variable grid with correct ARIA roles, labels, and text symbols', () => {
    const values: LogicValue[] = Array.from({ length: 16 }, () => 0 as LogicValue);
    values[3] = 1;
    values[5] = 'X';

    render(
      <KMapGrid
        variableCount={4}
        variableNames={['A', 'B', 'C', 'D']}
        values={values}
      />
    );

    const grid = screen.getByRole('grid', { name: /4-variable Karnaugh Map/i });
    expect(grid).toBeInTheDocument();

    // Check ARIA label on cell 3
    const cell3 = screen.getByRole('gridcell', {
      name: /Cell A=0 B=0 C=1 D=1, minterm 3, value 1/i,
    });
    expect(cell3).toBeInTheDocument();
    // Verify text symbol is explicitly displayed
    expect(cell3).toHaveTextContent('1');

    // Check ARIA label on cell 5 with don't-care value 'X'
    const cell5 = screen.getByRole('gridcell', {
      name: /Cell A=0 B=1 C=0 D=1, minterm 5, value X/i,
    });
    expect(cell5).toHaveTextContent('X');
  });

  it('cycles values by keyboard (Space and Enter) and allows direct key entry (0, 1, X)', () => {
    const onChangeValue = vi.fn();
    const values: LogicValue[] = Array.from({ length: 16 }, () => 0 as LogicValue);

    render(
      <KMapGrid
        variableCount={4}
        variableNames={['A', 'B', 'C', 'D']}
        values={values}
        onChangeValue={onChangeValue}
      />
    );

    const cell0 = screen.getByRole('gridcell', {
      name: /Cell A=0 B=0 C=0 D=0, minterm 0, value 0/i,
    });

    // Space key cycles 0 -> 1
    fireEvent.keyDown(cell0, { key: ' ' });
    expect(onChangeValue).toHaveBeenCalledWith(0, 1);

    // Enter key cycles
    fireEvent.keyDown(cell0, { key: 'Enter' });
    expect(onChangeValue).toHaveBeenCalledWith(0, 1);

    // Direct key '1'
    fireEvent.keyDown(cell0, { key: '1' });
    expect(onChangeValue).toHaveBeenCalledWith(0, 1);

    // Direct key 'x'
    fireEvent.keyDown(cell0, { key: 'x' });
    expect(onChangeValue).toHaveBeenCalledWith(0, 'X');

    // Direct key '0'
    fireEvent.keyDown(cell0, { key: '0' });
    expect(onChangeValue).toHaveBeenCalledWith(0, 0);
  });

  it('renders 5-variable maps as two side-by-side layers with inter-layer caption', () => {
    const values: LogicValue[] = Array.from({ length: 32 }, () => 0 as LogicValue);
    values[17] = 1;

    render(
      <KMapGrid
        variableCount={5}
        variableNames={['A', 'B', 'C', 'D', 'E']}
        values={values}
      />
    );

    expect(screen.getByText(/Layer A = 0/i)).toBeInTheDocument();
    expect(screen.getByText(/Layer A = 1/i)).toBeInTheDocument();

    // Verify inter-layer adjacency caption
    expect(
      screen.getByText(/Inter-layer adjacency: Corresponding cells at the same \(row, col\) in both layers/i)
    ).toBeInTheDocument();

    // Verify cell 17 is rendered in Layer A=1 with value 1
    const cell17 = screen.getByRole('gridcell', {
      name: /Cell A=1 B=0 C=0 D=0 E=1, minterm 17, value 1/i,
    });
    expect(cell17).toBeInTheDocument();
    expect(cell17).toHaveTextContent('1');
  });

  it('supports drag-painting the same value across adjacent cells', () => {
    const onChangeValue = vi.fn();
    const values: LogicValue[] = Array.from({ length: 16 }, () => 0 as LogicValue);

    render(
      <KMapGrid
        variableCount={4}
        variableNames={['A', 'B', 'C', 'D']}
        values={values}
        onChangeValue={onChangeValue}
      />
    );

    const cell0 = screen.getByRole('gridcell', {
      name: /minterm 0, value 0/i,
    });
    const cell1 = screen.getByRole('gridcell', {
      name: /minterm 1, value 0/i,
    });

    // Mouse down on cell 0 cycles 0 -> 1 and starts painting with value 1
    fireEvent.mouseDown(cell0);
    expect(onChangeValue).toHaveBeenCalledWith(0, 1);

    // Mouse enters cell 1 while mouse is down
    fireEvent.mouseEnter(cell1);
    expect(onChangeValue).toHaveBeenCalledWith(1, 1);

    // Mouse up ends painting
    fireEvent.mouseUp(window);

    // After mouse up, mouse enter should not change value
    onChangeValue.mockClear();
    fireEvent.mouseEnter(cell1);
    expect(onChangeValue).not.toHaveBeenCalled();
  });
});
