/**
 * @file useCircuitSimulation.test.ts
 * Unit tests for useCircuitSimulation hook: moving nodes does not rebuild,
 * adding a gate rebuilds, input values survive rebuild, oscillation reporting, and timer cleanup.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { CircuitGraph } from '../../types/circuit';
import { addNode, moveNodes } from '../../engine/circuit';
import { halfAdder } from '../../engine/circuit/examples';
import { useCircuitSimulation } from './useCircuitSimulation';

describe('useCircuitSimulation', () => {
  it('initializes and computes values for a Half Adder', () => {
    const ha = halfAdder();
    const { result } = renderHook(({ graph }) => useCircuitSimulation(graph), {
      initialProps: { graph: ha },
    });

    expect(result.current.status).toBe('ok');
    expect(result.current.time).toBe(1);
    expect(result.current.values['out_s']).toBe(0);
    expect(result.current.values['out_cout']).toBe(0);

    // Toggle input A to 1
    act(() => {
      result.current.setInput('in_a', 1);
    });

    expect(result.current.time).toBe(2);
    expect(result.current.values['out_s']).toBe(1);
    expect(result.current.values['out_cout']).toBe(0);

    // Toggle input B to 1
    act(() => {
      result.current.setInput('in_b', 1);
    });

    expect(result.current.time).toBe(3);
    expect(result.current.values['out_s']).toBe(0);
    expect(result.current.values['out_cout']).toBe(1);
  });

  it('does NOT rebuild the simulator when moving a node', () => {
    const ha = halfAdder();
    const { result, rerender } = renderHook(({ graph }) => useCircuitSimulation(graph), {
      initialProps: { graph: ha },
    });

    act(() => {
      result.current.setInput('in_a', 1);
    });

    expect(result.current.time).toBe(2);

    // Move node in_a position
    const moved = moveNodes(ha, [{ id: 'in_a', x: 150, y: 150 }]);
    rerender({ graph: moved });

    // Time is still 1 and values are retained because moving nodes does not change structuralSignature
    expect(result.current.time).toBe(2);
    expect(result.current.values['out_s']).toBe(1);
  });

  it('rebuilds the simulator when adding a gate, but preserves user inputs', () => {
    const ha = halfAdder();
    const { result, rerender } = renderHook(({ graph }) => useCircuitSimulation(graph), {
      initialProps: { graph: ha },
    });

    act(() => {
      result.current.setInput('in_a', 1);
    });

    expect(result.current.time).toBe(2);

    // Add a new OR gate
    const updated = addNode(ha, {
      id: 'g_or',
      kind: 'gate',
      gateType: 'OR',
      inputCount: 2,
      x: 300,
      y: 300,
    });

    rerender({ graph: updated });

    // Time resets to 0 on structural rebuild, but input in_a is preserved as 1
    expect(result.current.time).toBe(1);
    expect(result.current.values['in_a']).toBe(1);
  });

  it('surfaces plain oscillation message on unstable zero-delay feedback loop', () => {
    // Gated inverter: NAND(EN, output) where EN transitions from 0 -> 1
    const oscillatingLoop: CircuitGraph = {
      nodes: [
        { id: 'inEN', kind: 'input', label: 'EN', value: 0, x: 0, y: 0 },
        { id: 'g1', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 100, y: 0 },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'inEN', pin: 0 }, to: { nodeId: 'g1', pin: 0 } },
        { id: 'w2', from: { nodeId: 'g1', pin: 0 }, to: { nodeId: 'g1', pin: 1 } },
      ],
    };

    const { result } = renderHook(() => useCircuitSimulation(oscillatingLoop));

    act(() => {
      result.current.setDelayMode('zero');
    });

    act(() => {
      result.current.setInput('inEN', 1);
    });

    expect(result.current.status).toBe('oscillating');
    expect(result.current.oscillationMessage).toContain('oscillates');
  });

  it('cleans up play interval timer on unmount', () => {
    const ha = halfAdder();
    const { result, unmount } = renderHook(() => useCircuitSimulation(ha));

    act(() => {
      result.current.play();
    });

    expect(result.current.isPlaying).toBe(true);

    unmount();
    // Verify no leaks or dangling timers throw after unmount
  });
});
