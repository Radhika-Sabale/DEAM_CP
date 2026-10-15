/**
 * @file TraceView.test.tsx
 * Unit tests for TraceView: empty state, trace rows, slider jumping,
 * read-only historical banner, and return button.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { TraceView } from './TraceView';
import type { TraceTableRow } from '../../engine/cpu8086/history';

describe('TraceView', () => {
  const sampleRows: readonly TraceTableRow[] = [
    {
      stepNumber: 1,
      address: 0x0100,
      sourceLine: 2,
      instructionText: 'MOV AX, 5',
      registersChanged: 'AX: 0x0005',
      flagsChanged: '—',
      memoryWrites: '—',
    },
    {
      stepNumber: 2,
      address: 0x0103,
      sourceLine: 3,
      instructionText: 'ADD AX, 3',
      registersChanged: 'AX: 0x0008',
      flagsChanged: 'ZF=0, CF=0',
      memoryWrites: '—',
    },
  ];

  it('renders empty trace message when rows is empty', () => {
    render(
      <TraceView
        rows={[]}
        historyLength={0}
        historyIndex={-1}
        historyTruncated={false}
      />
    );

    expect(screen.getByText(/Step through the program to see the execution trace/i)).toBeInTheDocument();
  });

  it('renders trace rows with instruction details and change summaries', () => {
    const onGoTo = vi.fn();

    render(
      <TraceView
        rows={sampleRows}
        historyLength={2}
        historyIndex={1}
        historyTruncated={false}
        onGoTo={onGoTo}
      />
    );

    expect(screen.getByText('MOV AX, 5')).toBeInTheDocument();
    expect(screen.getByText('ADD AX, 3')).toBeInTheDocument();
    expect(screen.getByText('AX: 0x0005')).toBeInTheDocument();
    expect(screen.getByText('AX: 0x0008')).toBeInTheDocument();

    // Clicking row 1 jumps to step 0
    const row1 = screen.getByText('MOV AX, 5').closest('tr');
    expect(row1).not.toBeNull();
    fireEvent.click(row1!);
    expect(onGoTo).toHaveBeenCalledWith(0);
  });

  it('shows read-only past banner when historyIndex < historyLength - 1', () => {
    const onReturnToCurrent = vi.fn();

    render(
      <TraceView
        rows={sampleRows}
        historyLength={5}
        historyIndex={1}
        historyTruncated={false}
        onReturnToCurrent={onReturnToCurrent}
      />
    );

    // Banner indicates viewing past step
    expect(screen.getByText(/Viewing step 2 of 5 \(read-only\)/i)).toBeInTheDocument();

    // Return to current button
    const returnBtn = screen.getByRole('button', { name: /Return to current execution state/i });
    fireEvent.click(returnBtn);
    expect(onReturnToCurrent).toHaveBeenCalledTimes(1);
  });

  it('navigates through history using the step slider', () => {
    const onGoTo = vi.fn();

    render(
      <TraceView
        rows={sampleRows}
        historyLength={5}
        historyIndex={4}
        historyTruncated={false}
        onGoTo={onGoTo}
      />
    );

    const slider = screen.getByLabelText(/Execution history step slider/i);
    fireEvent.change(slider, { target: { value: '2' } });
    expect(onGoTo).toHaveBeenCalledWith(2);
  });
});
