import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FrameStackView } from './FrameStackView';
import { createCpuState } from '../../engine/cpu8086/cpu';
import { assemble } from '../../engine/cpu8086/assembler';
import { writeWord } from '../../engine/cpu8086/memory';
import type { InterruptLogEntry } from './useInterruptSession';

describe('FrameStackView', () => {
  it('renders empty stack state', () => {
    const asm = assemble('MOV AX, 1\nHLT');
    if (!asm.ok) throw new Error('Assembly failed');
    const state = createCpuState(asm.program);

    render(<FrameStackView cpuState={state} />);

    expect(screen.getByText(/Stack is empty/i)).toBeInTheDocument();
  });

  it('renders labeled interrupt frame on the stack', () => {
    const asm = assemble('MOV AX, 1\nHLT');
    if (!asm.ok) throw new Error('Assembly failed');
    let state = createCpuState(asm.program);

    // Push an interrupt frame at initialSp (0xFFFE down to 0xFFF8)
    // TOS (SP = 0xFFF8): Return IP = 0x0102
    // SP + 2 (0xFFFA): Return CS = 0x0000
    // SP + 4 (0xFFFC): Saved FLAGS = 0x0202 (IF=1, TF=0)
    let mem = state.memory;
    mem = writeWord(mem, 0xfff8, 0x0102).memory;
    mem = writeWord(mem, 0xfffa, 0x0000).memory;
    mem = writeWord(mem, 0xfffc, 0x0202).memory;

    state = {
      ...state,
      memory: mem,
      registers: {
        ...state.registers,
        SP: 0xfff8,
      },
    };

    const mockLog: InterruptLogEntry[] = [
      {
        id: 'int-1',
        tick: 10,
        kind: 'software',
        source: 'software-int',
        vector: 0x20,
        recognizedAtInstructionIp: 0x0102,
        handlerIp: 0x0500,
        returnIp: 0x0102,
        returnCs: 0x0000,
        nestingDepth: 1,
        latencyTicks: 0,
      },
    ];

    render(
      <FrameStackView
        cpuState={state}
        interruptLog={mockLog}
        program={asm.program}
      />
    );

    expect(screen.getByText(/Active Frames: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Interrupt Return IP: 0x0102/i)).toBeInTheDocument();
    expect(screen.getByText(/Interrupt Return CS: 0x0000/i)).toBeInTheDocument();
    expect(screen.getByText(/Saved FLAGS: 0x0202 \(IF=1, TF=0\)/i)).toBeInTheDocument();
  });
});
