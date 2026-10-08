/**
 * @file TimingDiagram.test.tsx
 * Unit tests for TimingDiagram component: SVG title/desc, trace change table, and hazard marker alerts.
 */

import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SimulationTrace } from '../../engine/circuit';
import { halfAdder } from '../../engine/circuit/examples';
import { TimingDiagram } from './TimingDiagram';

describe('TimingDiagram component', () => {
  it('renders SVG waveform chart with accessible title and desc', () => {
    const graph = halfAdder();
    const trace: SimulationTrace = {
      changes: [
        { time: 1, nodeId: 'in_a', value: 1 },
        { time: 2, nodeId: 'out_s', value: 1 },
      ],
      truncated: false,
    };

    render(<TimingDiagram graph={graph} trace={trace} currentTime={2} />);

    expect(screen.getByText(/Timing Waveform Diagram & Signal Inspector/i)).toBeInTheDocument();
    expect(screen.getByText(/Digital Circuit Simulation Timing Waveforms/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Displays logic signal transitions over discrete simulation time/i)
    ).toBeInTheDocument();
  });

  it('displays trace events in the accessible collapsible table', () => {
    const graph = halfAdder();
    const trace: SimulationTrace = {
      changes: [
        { time: 1, nodeId: 'in_a', value: 1 },
        { time: 2, nodeId: 'out_s', value: 1 },
      ],
      truncated: false,
    };

    render(<TimingDiagram graph={graph} trace={trace} currentTime={2} />);

    // Click button to show changes table
    const toggleButton = screen.getByRole('button', { name: /Show Complete Trace Event Log/i });
    fireEvent.click(toggleButton);

    expect(screen.getByText('in_a')).toBeInTheDocument();
    expect(screen.getByText('out_s')).toBeInTheDocument();
    expect(screen.getAllByText('t = 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('t = 2').length).toBeGreaterThan(0);
  });

  it('detects and flags static logic hazards on momentary glitch transitions', () => {
    const graph = halfAdder();
    const trace: SimulationTrace = {
      changes: [
        { time: 0, nodeId: 'out_s', value: 1 },
        { time: 1, nodeId: 'out_s', value: 0 }, // Glitch dip to 0
        { time: 2, nodeId: 'out_s', value: 1 }, // Reverts back to 1
      ],
      truncated: false,
    };

    render(<TimingDiagram graph={graph} trace={trace} currentTime={3} />);

    expect(screen.getAllByText(/Static Logic Hazard Detected/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/momentary glitch 1 → 0 → 1/i)).toBeInTheDocument();
  });
});
