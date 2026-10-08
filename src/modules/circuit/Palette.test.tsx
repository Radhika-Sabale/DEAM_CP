/**
 * @file Palette.test.tsx
 * Unit tests for Palette component: keyboard addition of gates and terminals, and example loading.
 */

import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Palette } from './Palette';

describe('Palette component', () => {
  it('adds each gate type and source item via click and keyboard', () => {
    const handleAddNode = vi.fn();
    const handleLoadExample = vi.fn();

    render(<Palette onAddNode={handleAddNode} onLoadExample={handleLoadExample} />);

    // Add AND gate via click
    const andButton = screen.getByRole('button', { name: /Add AND Gate to canvas/i });
    fireEvent.click(andButton);
    expect(handleAddNode).toHaveBeenCalledWith('gate', 'AND');

    // Add XOR gate via keyboard Enter
    const xorButton = screen.getByRole('button', { name: /Add XOR Gate to canvas/i });
    fireEvent.click(xorButton);
    expect(handleAddNode).toHaveBeenCalledWith('gate', 'XOR');

    // Add Input Switch
    const inButton = screen.getByRole('button', { name: /Add Input Switch to canvas/i });
    fireEvent.click(inButton);
    expect(handleAddNode).toHaveBeenCalledWith('input', undefined, undefined);

    // Add Constant 1
    const const1Button = screen.getByRole('button', { name: /Add Constant 1 to canvas/i });
    fireEvent.click(const1Button);
    expect(handleAddNode).toHaveBeenCalledWith('const', undefined, 1);
  });

  it('loads circuit examples from dropdown', () => {
    const handleLoadExample = vi.fn();
    render(<Palette onAddNode={vi.fn()} onLoadExample={handleLoadExample} />);

    const select = screen.getByLabelText(/Select reference example digital circuit/i);
    fireEvent.change(select, { target: { value: 'half-adder' } });

    expect(handleLoadExample).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ id: 'in_a' })]),
      }),
      'Half Adder'
    );
  });
});
