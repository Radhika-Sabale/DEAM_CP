/**
 * @file Canvas.test.tsx
 * Unit & keyboard integration tests for the Canvas component.
 */

import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { addNode, createEmptyCircuit } from '../../engine/circuit';
import { Canvas } from './Canvas';

describe('Canvas component', () => {
  it('renders SVG canvas with toolbar controls', () => {
    const graph = createEmptyCircuit();
    render(
      <Canvas
        graph={graph}
        values={{}}
        onCommitGraph={vi.fn()}
        onBeginTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
        onCommitTransaction={vi.fn()}
        onToggleInput={vi.fn()}
      />
    );

    expect(screen.getByRole('region', { name: /Digital Circuit Schematic Canvas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zoom in canvas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zoom out canvas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fit circuit to view/i })).toBeInTheDocument();
  });

  it('wires components together via pin clicks', () => {
    let graph = createEmptyCircuit();
    graph = addNode(graph, { id: 'in_a', kind: 'input', label: 'A', value: 0, x: 50, y: 50 });
    graph = addNode(graph, { id: 'g_and', kind: 'gate', gateType: 'AND', inputCount: 2, x: 200, y: 50 });

    const handleCommit = vi.fn();

    render(
      <Canvas
        graph={graph}
        values={{ in_a: 0, g_and: 0 }}
        onCommitGraph={handleCommit}
        onBeginTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
        onCommitTransaction={vi.fn()}
        onToggleInput={vi.fn()}
      />
    );

    // 1. Click output pin of in_a
    const outPin = screen.getByRole('button', { name: 'in_a output' });
    fireEvent.click(outPin);

    // 2. Click input pin 0 of g_and
    const inPin0 = screen.getByRole('button', { name: 'g_and input 0' });
    fireEvent.click(inPin0);

    // Assert graph with new wire was committed
    expect(handleCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        wires: expect.arrayContaining([
          expect.objectContaining({
            from: { nodeId: 'in_a', pin: 0 },
            to: { nodeId: 'g_and', pin: 0 },
          }),
        ]),
      })
    );
  });

  it('navigates nodes with keyboard arrows and toggles input with Space key', () => {
    let graph = createEmptyCircuit();
    graph = addNode(graph, { id: 'in_a', kind: 'input', label: 'A', value: 0, x: 50, y: 50 });
    graph = addNode(graph, { id: 'out_y', kind: 'output', label: 'Y', x: 250, y: 50 });

    const handleToggle = vi.fn();
    const handleCommit = vi.fn();

    render(
      <Canvas
        graph={graph}
        values={{ in_a: 0, out_y: 0 }}
        onCommitGraph={handleCommit}
        onBeginTransaction={vi.fn()}
        onUpdateTransaction={vi.fn()}
        onCommitTransaction={vi.fn()}
        onToggleInput={handleToggle}
      />
    );

    const svgRegion = screen.getByRole('region', { name: /Digital Circuit Schematic Canvas/i });

    // Press ArrowRight to focus the first topological node
    fireEvent.keyDown(svgRegion, { key: 'ArrowRight' });

    // Press Space on focused input node
    fireEvent.keyDown(svgRegion, { key: ' ' });
    expect(handleToggle).toHaveBeenCalledWith('in_a');
  });
});
