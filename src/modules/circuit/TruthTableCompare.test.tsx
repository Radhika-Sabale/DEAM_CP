/**
 * @file TruthTableCompare.test.tsx
 * Unit tests for TruthTableCompare component: table headers, mismatch display,
 * incomparable message, and local expression parse errors.
 */

import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CircuitGraph } from '../../types/circuit';
import { addNode, addWire, createEmptyCircuit } from '../../engine/circuit';
import { halfAdder } from '../../engine/circuit/examples';
import { createEmptyDesignProject } from '../../types/designProject';
import { TruthTableCompare } from './TruthTableCompare';

function wire(g: CircuitGraph, fromNode: string, toNode: string, toPin: number): CircuitGraph {
  const res = addWire(g, { from: { nodeId: fromNode, pin: 0 }, to: { nodeId: toNode, pin: toPin } });
  return res.ok ? res.graph : g;
}

describe('TruthTableCompare component', () => {
  it('renders comparative truth table with scope headers and matches for Half Adder', () => {
    const project = createEmptyDesignProject('p1', 'Half Adder Project');
    project.variables = ['A', 'B'];
    project.truthTable = {
      variables: ['A', 'B'],
      rows: [
        { index: 0, inputs: [0, 0], output: 0 },
        { index: 1, inputs: [0, 1], output: 1 },
        { index: 2, inputs: [1, 0], output: 1 },
        { index: 3, inputs: [1, 1], output: 0 },
      ],
    };

    const graph = halfAdder();

    render(<TruthTableCompare graph={graph} project={project} />);

    // Select Sum output S
    const outputSelect = screen.getByLabelText(/Output Terminal:/i);
    fireEvent.change(outputSelect, { target: { value: 'S' } });

    expect(screen.getByText(/Truth Table Verification & Comparison/i)).toBeInTheDocument();
    expect(screen.getByText(/Complete Match!/i)).toBeInTheDocument();

    // Check table scope headers
    const colHeaders = screen.getAllByRole('columnheader');
    expect(colHeaders.length).toBeGreaterThan(0);
    colHeaders.forEach((th) => {
      expect(th).toHaveAttribute('scope', 'col');
    });
  });

  it('displays Mismatch word when circuit output differs from intended', () => {
    const project = createEmptyDesignProject('p1', 'Target Project');
    project.variables = ['A', 'B'];
    project.truthTable = {
      variables: ['A', 'B'],
      rows: [
        { index: 0, inputs: [0, 0], output: 1 }, // Target is NAND
        { index: 1, inputs: [0, 1], output: 1 },
        { index: 2, inputs: [1, 0], output: 1 },
        { index: 3, inputs: [1, 1], output: 0 },
      ],
    };

    // Graph is AND gate (opposite of NAND)
    let graph = createEmptyCircuit();
    graph = addNode(graph, { id: 'in_a', kind: 'input', label: 'A', value: 0, x: 50, y: 50 });
    graph = addNode(graph, { id: 'in_b', kind: 'input', label: 'B', value: 0, x: 50, y: 100 });
    graph = addNode(graph, { id: 'g_and', kind: 'gate', gateType: 'AND', inputCount: 2, x: 200, y: 75 });
    graph = addNode(graph, { id: 'out_f', kind: 'output', label: 'F', x: 350, y: 75 });
    graph = wire(graph, 'in_a', 'g_and', 0);
    graph = wire(graph, 'in_b', 'g_and', 1);
    graph = wire(graph, 'g_and', 'out_f', 0);

    render(<TruthTableCompare graph={graph} project={project} />);

    expect(screen.getByText(/Mismatch detected/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Mismatch/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/inverted across all care rows/i)).toBeInTheDocument();
  });

  it('handles custom expression input and displays parse errors in plain language', () => {
    const project = createEmptyDesignProject('p1', 'Empty Project');
    const graph = halfAdder();

    render(<TruthTableCompare graph={graph} project={project} />);

    // Toggle custom expression checkbox
    const customCheckbox = screen.getByLabelText(/Custom Expression/i);
    fireEvent.click(customCheckbox);

    const input = screen.getByLabelText(/Custom Boolean target expression/i);

    // Enter invalid expression
    fireEvent.change(input, { target: { value: 'A +' } });
    expect(screen.getByText(/Syntax error at position/i)).toBeInTheDocument();

    // Select Sum output node S
    const outputSelect = screen.getByLabelText(/Output Terminal:/i);
    fireEvent.change(outputSelect, { target: { value: 'S' } });

    // Enter valid XOR expression
    fireEvent.change(input, { target: { value: "A' B + A B'" } });
    expect(screen.getByText(/Complete Match!/i)).toBeInTheDocument();
  });
});
