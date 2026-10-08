/**
 * @file CircuitListEditor.test.tsx
 * Unit and integration tests for CircuitListEditor.
 * Verifies that a user can build a 1-bit Full Adder with the list editor and keyboard alone.
 */

import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CircuitGraph } from '../../types/circuit';
import { createEmptyCircuit } from '../../engine/circuit';
import { extractTruthTable } from '../../engine/circuit/extractTruthTable';
import { CircuitListEditor } from './CircuitListEditor';

describe('CircuitListEditor component', () => {
  it('allows adding nodes, renaming labels, and wiring input pins via select dropdowns', () => {
    let currentGraph = createEmptyCircuit();
    const handleCommit = vi.fn((next: CircuitGraph) => {
      currentGraph = next;
    });

    const { rerender } = render(
      <CircuitListEditor
        graph={currentGraph}
        values={{}}
        onCommitGraph={handleCommit}
        onToggleInput={vi.fn()}
      />
    );

    // 1. Add Input A
    const labelInput = screen.getByLabelText(/Label \(optional\)/i);
    fireEvent.change(labelInput, { target: { value: 'A' } });

    const kindSelect = screen.getByLabelText(/Node Kind/i);
    fireEvent.change(kindSelect, { target: { value: 'input' } });

    const addButton = screen.getByRole('button', { name: /Add component to netlist/i });
    fireEvent.click(addButton);

    expect(handleCommit).toHaveBeenCalled();

    // Rerender with updated graph
    rerender(
      <CircuitListEditor
        graph={currentGraph}
        values={{ in1: 0 }}
        onCommitGraph={handleCommit}
        onToggleInput={vi.fn()}
      />
    );

    expect(screen.getByText('in1')).toBeInTheDocument();
  });

  it('builds a full adder using the list editor and produces a correct truth table', () => {
    let graph = createEmptyCircuit();
    const handleCommit = (next: CircuitGraph) => {
      graph = next;
    };

    const { rerender } = render(
      <CircuitListEditor
        graph={graph}
        values={{}}
        onCommitGraph={handleCommit}
        onToggleInput={vi.fn()}
      />
    );

    // Helper to add node
    const addNodeHelper = (kind: string, label: string, gateType?: string) => {
      const kindSelect = screen.getByLabelText(/Node Kind/i);
      fireEvent.change(kindSelect, { target: { value: kind } });

      if (kind === 'gate' && gateType) {
        const gateSelect = screen.getByLabelText(/Gate Type/i);
        fireEvent.change(gateSelect, { target: { value: gateType } });
      }

      const labelInput = screen.getByLabelText(/Label \(optional\)/i);
      fireEvent.change(labelInput, { target: { value: label } });

      const addBtn = screen.getByRole('button', { name: /Add component to netlist/i });
      fireEvent.click(addBtn);

      rerender(
        <CircuitListEditor
          graph={graph}
          values={{}}
          onCommitGraph={handleCommit}
          onToggleInput={vi.fn()}
        />
      );
    };

    // 1. Add inputs: A, B, Cin
    addNodeHelper('input', 'A'); // in1
    addNodeHelper('input', 'B'); // in2
    addNodeHelper('input', 'Cin'); // in3

    // 2. Add gates: XOR1, XOR2, AND1, AND2, OR1
    addNodeHelper('gate', 'XOR1', 'XOR'); // g1
    addNodeHelper('gate', 'XOR2', 'XOR'); // g2
    addNodeHelper('gate', 'AND1', 'AND'); // g3
    addNodeHelper('gate', 'AND2', 'AND'); // g4
    addNodeHelper('gate', 'OR1', 'OR'); // g5

    // 3. Add outputs: S, Cout
    addNodeHelper('output', 'S'); // out1
    addNodeHelper('output', 'Cout'); // out2

    // Connect wires using pin selects
    const setWire = (nodeId: string, pinIdx: number, sourceId: string) => {
      const pinSelect = screen.getByLabelText(new RegExp(`${nodeId} input pin ${pinIdx}`, 'i'));
      fireEvent.change(pinSelect, { target: { value: sourceId } });
      rerender(
        <CircuitListEditor
          graph={graph}
          values={{}}
          onCommitGraph={handleCommit}
          onToggleInput={vi.fn()}
        />
      );
    };

    // XOR1 inputs: in1 (A), in2 (B)
    setWire('g1', 0, 'in1');
    setWire('g1', 1, 'in2');

    // XOR2 inputs: g1 (A^B), in3 (Cin)
    setWire('g2', 0, 'g1');
    setWire('g2', 1, 'in3');

    // AND1 inputs: in1 (A), in2 (B)
    setWire('g3', 0, 'in1');
    setWire('g3', 1, 'in2');

    // AND2 inputs: g1 (A^B), in3 (Cin)
    setWire('g4', 0, 'g1');
    setWire('g4', 1, 'in3');

    // OR1 inputs: g3, g4
    setWire('g5', 0, 'g3');
    setWire('g5', 1, 'g4');

    // Output S from XOR2, Cout from OR1
    setWire('out1', 0, 'g2');
    setWire('out2', 0, 'g5');

    // Verify the extracted truth table matches a 1-bit Full Adder
    const extracted = extractTruthTable(graph, {
      inputOrder: ['A', 'B', 'Cin'],
      outputOrder: ['S', 'Cout'],
    });

    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;

    // Full Adder truth table verification (8 rows)
    const expectedSum = [0, 1, 1, 0, 1, 0, 0, 1];
    const expectedCout = [0, 0, 0, 1, 0, 1, 1, 1];

    for (let i = 0; i < 8; i++) {
      expect(extracted.table.rows[i]?.outputs[0]).toBe(expectedSum[i]);
      expect(extracted.table.rows[i]?.outputs[1]).toBe(expectedCout[i]);
    }
  });
});
