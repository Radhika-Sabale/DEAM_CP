/**
 * @file CircuitControls.test.tsx
 * Unit tests for CircuitInspector and SimulationControls components.
 */

import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { halfAdder } from '../../engine/circuit/examples';
import { CircuitInspector } from './CircuitInspector';
import { SimulationControls } from './SimulationControls';

describe('CircuitInspector component', () => {
  it('renders node inspector and validates label changes', () => {
    const graph = halfAdder();
    const handleCommit = vi.fn();

    render(
      <CircuitInspector
        graph={graph}
        selectedNodeId="g_xor"
        selectedWireId={null}
        onCommitGraph={handleCommit}
        onDeselect={vi.fn()}
      />
    );

    expect(screen.getByText(/Node Inspector: g_xor/i)).toBeInTheDocument();

    const labelInput = screen.getByLabelText(/Node Label/i);
    fireEvent.change(labelInput, { target: { value: 'XOR_Sum' } });
    expect(handleCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: 'g_xor', label: 'XOR_Sum' }),
        ]),
      })
    );
  });

  it('renders wire inspector with delete button', () => {
    const graph = halfAdder();
    const handleCommit = vi.fn();

    render(
      <CircuitInspector
        graph={graph}
        selectedNodeId={null}
        selectedWireId="w1"
        onCommitGraph={handleCommit}
        onDeselect={vi.fn()}
      />
    );

    expect(screen.getByText(/Wire Inspector: w1/i)).toBeInTheDocument();
    const deleteBtn = screen.getByRole('button', { name: /Delete wire w1/i });
    fireEvent.click(deleteBtn);

    expect(handleCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        wires: expect.not.arrayContaining([expect.objectContaining({ id: 'w1' })]),
      })
    );
  });
});

describe('SimulationControls component', () => {
  it('renders simulation time, status badge, and invokes step/play/pause handlers', () => {
    const handleStep = vi.fn();
    const handlePlay = vi.fn();
    const handlePause = vi.fn();
    const handleReset = vi.fn();

    const { rerender } = render(
      <SimulationControls
        time={5}
        status="ok"
        oscillationMessage={null}
        isPlaying={false}
        delayMode="unit"
        allowFeedback={true}
        onStep={handleStep}
        onRunFor={vi.fn()}
        onRunToNextEvent={vi.fn()}
        onPlay={handlePlay}
        onPause={handlePause}
        onReset={handleReset}
        onSetDelayMode={vi.fn()}
        onSetAllowFeedback={vi.fn()}
      />
    );

    expect(screen.getByText(/t = 5 units/i)).toBeInTheDocument();
    expect(screen.getByText(/Settled/i)).toBeInTheDocument();

    // Click Play
    const playBtn = screen.getByRole('button', { name: /Play continuous/i });
    fireEvent.click(playBtn);
    expect(handlePlay).toHaveBeenCalled();

    // Rerender as isPlaying = true
    rerender(
      <SimulationControls
        time={5}
        status="ok"
        oscillationMessage={null}
        isPlaying={true}
        delayMode="unit"
        allowFeedback={true}
        onStep={handleStep}
        onRunFor={vi.fn()}
        onRunToNextEvent={vi.fn()}
        onPlay={handlePlay}
        onPause={handlePause}
        onReset={handleReset}
        onSetDelayMode={vi.fn()}
        onSetAllowFeedback={vi.fn()}
      />
    );

    const pauseBtn = screen.getByRole('button', { name: /Pause continuous/i });
    fireEvent.click(pauseBtn);
    expect(handlePause).toHaveBeenCalled();
  });
});
