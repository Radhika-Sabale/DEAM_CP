/**
 * @file SequentialWaveform.test.tsx
 * Tests for SequentialWaveform component (Stage 10E).
 * Verifies SVG title/desc, tracks rendering, and accessible change table toggle with all events.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { ValueChange } from '../../engine/circuit/simulatorTypes';
import { SequentialWaveform } from './SequentialWaveform';

describe('SequentialWaveform component', () => {
  const sampleChanges: ValueChange[] = [
    { time: 0, nodeId: 'CLK', value: 0 },
    { time: 0, nodeId: 'Q0', value: 0 },
    { time: 5, nodeId: 'CLK', value: 1 },
    { time: 10, nodeId: 'CLK', value: 0 },
    { time: 10, nodeId: 'Q0', value: 1 },
  ];

  it('renders SVG waveform with title, desc, and signal tracks', () => {
    const { container } = render(
      <SequentialWaveform
        changes={sampleChanges}
        totalTime={20}
        signalNames={['CLK', 'Q0']}
      />
    );

    expect(container.querySelector('title')).toHaveTextContent('Sequential Simulation Waveforms');
    expect(container.querySelector('desc')).toHaveTextContent(/Digital waveform timing diagram/i);

    expect(screen.getByText('CLK')).toBeInTheDocument();
    expect(screen.getByText('Q0')).toBeInTheDocument();
  });

  it('toggles accessible changes table and lists every change event', () => {
    render(
      <SequentialWaveform
        changes={sampleChanges}
        totalTime={20}
        signalNames={['CLK', 'Q0']}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /Accessible Signal Changes Table/i });
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);

    // Columns present
    expect(screen.getByRole('columnheader', { name: /Time \(t\)/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Signal/i })).toBeInTheDocument();

    // Changes listed
    expect(screen.getAllByText(/t = 0/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/t = 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Signal Q0 transitioned to 1 \(High\) at time 10/i)).toBeInTheDocument();
  });
});
