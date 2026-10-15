import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { IvtViewer } from './IvtViewer';
import { createMemory, writeByte } from '../../engine/cpu8086/memory';
import { writeVector } from '../../engine/interrupts';

describe('IvtViewer', () => {
  it('renders placeholder when memory is null', () => {
    render(<IvtViewer memory={null} />);
    expect(screen.getByText(/Interrupt Vector Table \(IVT\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Assemble a program to inspect IVT/i)).toBeInTheDocument();
  });

  it('renders vectors table and shows installed vs unset vectors', () => {
    let memory = createMemory();
    // Install vector 8 (timer handler at 0x0500)
    writeVector(
      (addr, val) => { memory = writeByte(memory, addr, val).memory; },
      8,
      0x0500
    );

    render(<IvtViewer memory={memory} />);

    // Table should exist
    expect(screen.getByRole('table', { name: /8086 Interrupt Vector Table entries/i })).toBeInTheDocument();

    // Check installed filter
    const installedBtn = screen.getByRole('button', { name: /Installed \(1\)/i });
    expect(installedBtn).toBeInTheDocument();

    fireEvent.click(installedBtn);

    // Vector 8 should be listed with address 0x0020
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('0x0020')).toBeInTheDocument();
    expect(screen.getByText('0000:0500')).toBeInTheDocument();
    expect(screen.getAllByText(/Installed/i).length).toBeGreaterThanOrEqual(1);
  });

  it('filters dedicated vectors (0-4)', () => {
    const memory = createMemory();
    render(<IvtViewer memory={memory} />);

    const dedicatedBtn = screen.getByRole('button', { name: /Dedicated \(0–4\)/i });
    fireEvent.click(dedicatedBtn);

    expect(screen.getByText(/Divide Error/i)).toBeInTheDocument();
    expect(screen.getByText(/Single Step/i)).toBeInTheDocument();
    expect(screen.getByText(/NMI/i)).toBeInTheDocument();
    expect(screen.getByText(/Breakpoint/i)).toBeInTheDocument();
    expect(screen.getByText(/Overflow/i)).toBeInTheDocument();
  });

  it('handles jump callbacks', () => {
    let memory = createMemory();
    writeVector(
      (addr, val) => { memory = writeByte(memory, addr, val).memory; },
      2,
      0x0200
    );

    const onSelectVector = vi.fn();
    const onJumpToHandler = vi.fn();

    render(
      <IvtViewer
        memory={memory}
        onSelectVector={onSelectVector}
        onJumpToHandler={onJumpToHandler}
      />
    );

    // Filter to dedicated
    fireEvent.click(screen.getByRole('button', { name: /Dedicated \(0–4\)/i }));

    const ivtButtons = screen.getAllByRole('button', { name: /View vector/i });
    const vector2Btn = ivtButtons[2];
    expect(vector2Btn).toBeDefined();
    if (vector2Btn) fireEvent.click(vector2Btn); // Vector 2 (NMI)
    expect(onSelectVector).toHaveBeenCalledWith(2, 8); // 2 * 4 = 8

    const handlerButtons = screen.getAllByRole('button', { name: /Jump to handler for vector 2/i });
    const jumpBtn = handlerButtons[0];
    expect(jumpBtn).toBeDefined();
    if (jumpBtn) fireEvent.click(jumpBtn);
    expect(onJumpToHandler).toHaveBeenCalledWith(0x0200);
  });
});
