/**
 * @file RegisterPanel.test.tsx
 * Unit tests for RegisterPanel component: 16-bit and 8-bit views,
 * changed markers, IP instruction text, and initial register editing.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { RegisterPanel } from './RegisterPanel';
import { createCpuState } from '../../engine/cpu8086/cpu';
import { setReg } from '../../engine/cpu8086/registers';
import type { RegisterChange } from '../../engine/cpu8086/cpuTypes';

describe('RegisterPanel', () => {
  it('displays 16-bit register AX and its 8-bit halves AH and AL correctly', () => {
    let state = createCpuState();
    state = { ...state, registers: setReg(state.registers, 'AX', 0x1234) };

    render(<RegisterPanel cpuState={state} />);

    // Table caption
    expect(screen.getByText(/Values of the 8086 registers in hex/i)).toBeInTheDocument();

    // AX: 0x1234, and AH: 0x12 | AL: 0x34
    expect(screen.getByText('0x1234')).toBeInTheDocument();
    expect(screen.getByText(/AH: 0x12 \| AL: 0x34/)).toBeInTheDocument();
  });

  it('displays text changed marker when register change is reported', () => {
    let state = createCpuState();
    state = { ...state, registers: setReg(state.registers, 'BX', 0x0055) };

    const lastChanges: readonly RegisterChange[] = [
      { name: 'BX', old: 0x0000, new: 0x0055 },
    ];

    render(<RegisterPanel cpuState={state} lastChanges={lastChanges} />);

    // Visual and text changed marker
    expect(screen.getByText('changed')).toBeInTheDocument();
    expect(screen.getByText('(was 0x0000)')).toBeInTheDocument();
  });

  it('rejects out of range register edit and applies valid edit', () => {
    const onSetRegister = vi.fn();
    const state = createCpuState();

    render(<RegisterPanel cpuState={state} onSetRegister={onSetRegister} />);

    // Click "Set initial state" toggle button
    const editButton = screen.getByRole('button', { name: /Toggle set initial register state mode/i });
    fireEvent.click(editButton);

    const input = screen.getByPlaceholderText(/Hex value/i);
    const applyButton = screen.getByRole('button', { name: /^Set$/i });

    // Out of range for 16-bit: 70000
    fireEvent.change(input, { target: { value: '70000' } });
    fireEvent.click(applyButton);

    expect(screen.getByText(/Value out of range/i)).toBeInTheDocument();
    expect(onSetRegister).not.toHaveBeenCalled();

    // Valid edit: 0x55AA
    fireEvent.change(input, { target: { value: '0x55AA' } });
    fireEvent.click(applyButton);

    expect(onSetRegister).toHaveBeenCalledWith('AX', 0x55aa);
  });
});
