import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { InterruptTimeline } from './InterruptTimeline';
import type { InterruptLogEntry } from './useInterruptSession';

describe('InterruptTimeline', () => {
  it('renders empty timeline message when no interrupts recorded', () => {
    render(<InterruptTimeline interruptLog={[]} currentTick={0} />);

    expect(screen.getByText(/No interrupts have been recognized yet/i)).toBeInTheDocument();
  });

  it('renders recorded timeline entries with return status and latency', () => {
    const log: InterruptLogEntry[] = [
      {
        id: 'int-1',
        tick: 15,
        kind: 'nmi',
        source: 'hardware-nmi',
        vector: 2,
        recognizedAtInstructionIp: 0x0104,
        handlerIp: 0x0200,
        returnIp: 0x0104,
        returnCs: 0x0000,
        returnedByIretAtTick: 25,
        nestingDepth: 1,
        latencyTicks: 2,
      },
      {
        id: 'int-2',
        tick: 30,
        kind: 'intr',
        source: 'hardware-intr',
        vector: 0x30,
        recognizedAtInstructionIp: 0x0108,
        handlerIp: 0x0300,
        returnIp: 0x0108,
        returnCs: 0x0000,
        nestingDepth: 1,
        latencyTicks: 5,
      },
    ];

    render(<InterruptTimeline interruptLog={log} currentTick={35} />);

    expect(screen.getByText('NMI')).toBeInTheDocument();
    expect(screen.getByText('INTR')).toBeInTheDocument();
    expect(screen.getByText('Vector 2')).toBeInTheDocument();
    expect(screen.getByText('Vector 48')).toBeInTheDocument();
    expect(screen.getByText(/Tick 25/i)).toBeInTheDocument();
    expect(screen.getByText(/In Progress/i)).toBeInTheDocument();
    expect(screen.getByText('2 ticks')).toBeInTheDocument();
    expect(screen.getByText('5 ticks')).toBeInTheDocument();
  });
});
