/**
 * @file GateTraceView.test.tsx
 * Unit tests for GateTraceView table rendering and circuit protection modal paths.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { GateTraceView } from './GateTraceView';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { buildCarryChain } from '../../engine/alu/carryChain';
import type { CircuitGraph } from '../../types/circuit';

const MOCK_CIRCUIT: CircuitGraph = {
  nodes: [{ id: 'existing_node', kind: 'input', label: 'IN1', value: 0, x: 0, y: 0 }],
  wires: [],
};

describe('GateTraceView', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
    useUiStore.setState({ currentModule: 'alu' });
  });

  it('renders ripple carry table with MSB on left and proper row signals', () => {
    const chain = buildCarryChain(5, 3, 4, false);

    render(<GateTraceView carryChain={chain} width={4} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(/Bit 3 \(MSB\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Bit 0 \(LSB\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Carry In \(Cin\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Sum \(S\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Carry Out \(Cout\)/i)).toBeInTheDocument();
  });

  it('shows confirmation modal when project.circuit is non-null; on Cancel, nothing is written', () => {
    const chain = buildCarryChain(5, 3, 4, false);
    useProjectStore.getState().applyPatch({ circuit: MOCK_CIRCUIT });

    render(<GateTraceView carryChain={chain} width={4} />);

    // Click "Open adder in Circuit Simulator"
    fireEvent.click(screen.getByRole('button', { name: /open adder in circuit simulator/i }));

    // Confirmation modal should be visible
    expect(screen.getByText('This replaces your current circuit. Continue?')).toBeInTheDocument();

    // Click Cancel
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Circuit should remain unchanged
    const project = useProjectStore.getState().project;
    expect(project.circuit).toEqual(MOCK_CIRCUIT);
    expect(project.lastHandoff).toBeNull();
    expect(useUiStore.getState().currentModule).toBe('alu');
  });

  it('shows confirmation modal when project.circuit is non-null; on Continue, circuit is replaced and handoff recorded', () => {
    const chain = buildCarryChain(5, 3, 4, false);
    useProjectStore.getState().applyPatch({ circuit: MOCK_CIRCUIT });

    render(<GateTraceView carryChain={chain} width={4} />);

    // Click "Open adder in Circuit Simulator"
    fireEvent.click(screen.getByRole('button', { name: /open adder in circuit simulator/i }));

    // Confirmation modal should be visible
    expect(screen.getByText('This replaces your current circuit. Continue?')).toBeInTheDocument();

    // Click Continue
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const project = useProjectStore.getState().project;
    expect(project.circuit).not.toEqual(MOCK_CIRCUIT);
    expect(project.circuit?.nodes.length).toBeGreaterThan(0);
    expect(project.lastHandoff?.from).toBe('alu');
    expect(project.lastHandoff?.to).toBe('circuit-simulator');
    expect(useUiStore.getState().currentModule).toBe('circuit-simulator');
  });

  it('directly synthesizes circuit without modal when project.circuit is null', () => {
    const chain = buildCarryChain(5, 3, 4, false);
    useProjectStore.getState().applyPatch({ circuit: null });

    render(<GateTraceView carryChain={chain} width={4} />);

    fireEvent.click(screen.getByRole('button', { name: /open adder in circuit simulator/i }));

    expect(screen.queryByText('This replaces your current circuit. Continue?')).not.toBeInTheDocument();

    const project = useProjectStore.getState().project;
    expect(project.circuit?.nodes.length).toBeGreaterThan(0);
    expect(project.lastHandoff?.to).toBe('circuit-simulator');
    expect(useUiStore.getState().currentModule).toBe('circuit-simulator');
  });
});
