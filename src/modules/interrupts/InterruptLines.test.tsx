import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { InterruptLines } from './InterruptLines';

describe('InterruptLines', () => {
  it('renders line states and priority queue when idle', () => {
    render(
      <InterruptLines
        currentTick={42}
        pendingLines={{
          nmi: false,
          intr: null,
          ifFlag: 1,
          tfFlag: 0,
          stiShadow: false,
        }}
        pendingList={[]}
        hasInterruptWatchpoint={false}
        onToggleInterruptWatchpoint={vi.fn()}
      />
    );

    expect(screen.getByText('Tick: 42')).toBeInTheDocument();
    expect(screen.getByText('NMI Pin')).toBeInTheDocument();
    expect(screen.getAllByText('LOW').length).toBe(2);
    expect(screen.getByText('1 (Enabled)')).toBeInTheDocument();
    expect(screen.getByText('0 (Off)')).toBeInTheDocument();
    expect(screen.getByText(/No interrupts currently pending/i)).toBeInTheDocument();
  });

  it('renders active NMI and blocked INTR in priority queue', () => {
    const onToggle = vi.fn();
    render(
      <InterruptLines
        currentTick={100}
        pendingLines={{
          nmi: true,
          intr: { vector: 0x20 },
          ifFlag: 0,
          tfFlag: 1,
          stiShadow: true,
        }}
        pendingList={[
          {
            source: 'nmi',
            priority: 2,
            vector: 2,
            blocked: false,
            label: 'NMI (Vector 2, Non-Maskable)',
          },
          {
            source: 'intr',
            priority: 3,
            vector: 0x20,
            blocked: true,
            label: 'INTR (Vector 32 - Blocked by IF=0)',
          },
        ]}
        hasInterruptWatchpoint={true}
        onToggleInterruptWatchpoint={onToggle}
      />
    );

    expect(screen.getByText('HIGH (Latched)')).toBeInTheDocument();
    expect(screen.getByText('HIGH (Vec 32)')).toBeInTheDocument();
    expect(screen.getByText('0 (Masked)')).toBeInTheDocument();
    expect(screen.getByText('Active (1-instr delay)')).toBeInTheDocument();

    expect(screen.getByText(/Ready \(Will fire next\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Blocked \(IF=0 or STI shadow\)/i)).toBeInTheDocument();

    const watchBtn = screen.getByRole('button', { name: /Disable interrupt watchpoint/i });
    fireEvent.click(watchBtn);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
