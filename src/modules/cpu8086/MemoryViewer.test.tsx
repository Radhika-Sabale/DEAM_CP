/**
 * @file MemoryViewer.test.tsx
 * Unit tests for virtualized MemoryViewer: row count bounding, go-to navigation,
 * written byte markers, word view toggle, and inline byte editing.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MemoryViewer } from './MemoryViewer';
import { createMemory, writeByte } from '../../engine/cpu8086/memory';
import { createCpuState } from '../../engine/cpu8086/cpu';
import type { Program } from '../../engine/cpu8086/types';

describe('MemoryViewer', () => {
  it('renders only 16 virtualized rows for the 64 KB memory space', () => {
    const memory = createMemory();
    const { container } = render(<MemoryViewer memory={memory} />);

    // Table should contain exactly 16 rendered rows in tbody
    const tbody = container.querySelector('tbody');
    expect(tbody).not.toBeNull();
    const rows = tbody!.querySelectorAll('tr');
    expect(rows).toHaveLength(16);
  });

  it('navigates via Go to input (hex address, SP button, label name)', () => {
    const memory = createMemory();
    const cpuState = createCpuState();
    const mockProgram: Program = {
      instructions: [],
      dataSegments: [],
      symbols: {
        my_var: { name: 'my_var', kind: 'data', address: 0x0200 },
      },
      entryPoint: 0,
    };

    render(
      <MemoryViewer
        memory={memory}
        cpuState={cpuState}
        program={mockProgram}
      />
    );

    // Initial view: 0x0000 - 0x00FF
    expect(screen.getByText(/0x0000 - 0x00FF/i)).toBeInTheDocument();

    // 1. Jump via Go to hex
    const gotoInput = screen.getByLabelText(/Go to:/i);
    fireEvent.change(gotoInput, { target: { value: '0x0500' } });
    fireEvent.click(screen.getByRole('button', { name: /Go/i }));
    expect(screen.getByText(/0x0500 - 0x05FF/i)).toBeInTheDocument();

    // 2. Jump via SP button (SP is 0xFFFE)
    const spBtn = screen.getByRole('button', { name: /^SP$/i });
    fireEvent.click(spBtn);
    expect(screen.getByText(/0xFF00 - 0xFFFF/i)).toBeInTheDocument();

    // 3. Jump via symbol label
    fireEvent.change(gotoInput, { target: { value: 'my_var' } });
    fireEvent.click(screen.getByRole('button', { name: /Go/i }));
    expect(screen.getByText(/0x0200 - 0x02FF/i)).toBeInTheDocument();
  });

  it('marks written bytes with text marker "written"', () => {
    let memory = createMemory();
    memory = writeByte(memory, 0x0005, 0x77).memory;

    render(
      <MemoryViewer
        memory={memory}
        lastWrites={[{ address: 0x0005, oldByte: 0, newByte: 0x77 }]}
      />
    );

    expect(screen.getByText('77')).toBeInTheDocument();
    expect(screen.getByText('written')).toBeInTheDocument();
  });

  it('toggles between byte view and little-endian word view', () => {
    let memory = createMemory();
    // Little-endian word at 0x0000: low=0x34, high=0x12 -> word=0x1234
    memory = writeByte(memory, 0x0000, 0x34).memory;
    memory = writeByte(memory, 0x0001, 0x12).memory;

    render(<MemoryViewer memory={memory} />);

    // In byte view, displays 34 and 12
    expect(screen.getByText('34')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    // Toggle word view
    const toggleBtn = screen.getByRole('button', { name: /Toggle between byte view and little-endian word view/i });
    fireEvent.click(toggleBtn);

    // Displays little-endian word 1234
    expect(screen.getByText('1234')).toBeInTheDocument();
  });

  it('allows inline byte editing with validation and save', () => {
    const onEditByte = vi.fn();
    let memory = createMemory();
    memory = writeByte(memory, 0x0002, 0x42).memory;

    render(<MemoryViewer memory={memory} onEditByte={onEditByte} />);

    // Click on cell 42
    const cell42 = screen.getByText('42').closest('td');
    expect(cell42).not.toBeNull();
    fireEvent.click(cell42!);

    // Dialog appears with edit input
    expect(screen.getByText(/Edit byte at 0x0002:/i)).toBeInTheDocument();
    const editInput = screen.getByPlaceholderText(/Hex byte/i);
    const saveBtn = screen.getByRole('button', { name: /^Save$/i });

    // Invalid hex: "ZZ"
    fireEvent.change(editInput, { target: { value: 'ZZ' } });
    fireEvent.click(saveBtn);
    expect(screen.getByText(/Must be a hex byte between 0x00 and 0xFF/i)).toBeInTheDocument();
    expect(onEditByte).not.toHaveBeenCalled();

    // Out of range: "1FF"
    fireEvent.change(editInput, { target: { value: '1FF' } });
    fireEvent.click(saveBtn);
    expect(screen.getByText(/Must be a hex byte between 0x00 and 0xFF/i)).toBeInTheDocument();
    expect(onEditByte).not.toHaveBeenCalled();

    // Valid edit: "9A"
    fireEvent.change(editInput, { target: { value: '9A' } });
    fireEvent.click(saveBtn);
    expect(onEditByte).toHaveBeenCalledWith(0x0002, 0x9a);
  });

  it('navigates pages using Next and Previous page buttons', () => {
    const memory = createMemory();
    render(<MemoryViewer memory={memory} />);

    expect(screen.getByText(/0x0000 - 0x00FF/i)).toBeInTheDocument();

    const nextBtn = screen.getByRole('button', { name: /Next memory page/i });
    fireEvent.click(nextBtn);
    expect(screen.getByText(/0x0100 - 0x01FF/i)).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: /Previous memory page/i });
    fireEvent.click(prevBtn);
    expect(screen.getByText(/0x0000 - 0x00FF/i)).toBeInTheDocument();
  });
});
