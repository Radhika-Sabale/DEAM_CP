/**
 * @file StackView.test.tsx
 * Unit tests for StackView: empty state, downward growth,
 * PUSH annotation "last pushed", and CALL annotation "return address (line N)".
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { StackView } from './StackView';
import { createCpuState } from '../../engine/cpu8086/cpu';
import { writeWord } from '../../engine/cpu8086/memory';
import { setReg } from '../../engine/cpu8086/registers';
import type { Program } from '../../engine/cpu8086/types';
import type { ExecutionHistory } from '../../engine/cpu8086/history';
import { createHistory } from '../../engine/cpu8086/history';

describe('StackView', () => {
  it('displays empty stack message and pedagogical caption initially', () => {
    const state = createCpuState();
    render(<StackView cpuState={state} />);

    expect(screen.getByText(/The stack grows downward from initial SP/i)).toBeInTheDocument();
    expect(screen.getByText(/Stack is empty \(SP = initial SP\)/i)).toBeInTheDocument();
  });

  it('displays pushed item with "last pushed" marker and new SP', () => {
    let state = createCpuState();
    // PUSH AX writes word 0x1234 at 0xFFFC, SP becomes 0xFFFC
    state = { ...state, memory: writeWord(state.memory, 0xfffc, 0x1234).memory };
    state = { ...state, registers: setReg(state.registers, 'SP', 0xfffc) };

    render(
      <StackView
        cpuState={state}
        lastStackChange={{
          type: 'push',
          spBefore: 0xfffe,
          spAfter: 0xfffc,
          value: 0x1234,
        }}
      />
    );

    // Displays SP = 0xFFFC
    expect(screen.getByText(/SP = 0xFFFC/i)).toBeInTheDocument();
    // Displays word 0x1234
    expect(screen.getByText('0x1234')).toBeInTheDocument();
    // Displays annotation "last pushed"
    expect(screen.getByText('last pushed')).toBeInTheDocument();
  });

  it('displays "return address (line N)" annotation for CALL instructions', () => {
    let state = createCpuState();
    // CALL from line 2 puts return IP (1) on stack at 0xFFFC
    state = { ...state, memory: writeWord(state.memory, 0xfffc, 1).memory };
    state = { ...state, registers: setReg(state.registers, 'SP', 0xfffc) };

    const mockProgram: Program = {
      instructions: [
        {
          address: 0,
          mnemonic: 'CALL',
          operands: [],
          sourceLine: 2,
          sourceText: 'CALL sub',
        },
        {
          address: 1,
          mnemonic: 'HLT',
          operands: [],
          sourceLine: 3,
          sourceText: 'HLT',
        },
      ],
      dataSegments: [],
      symbols: {},
      entryPoint: 0,
    };

    const history: ExecutionHistory = {
      ...createHistory(state),
      records: [
        {
          address: 0,
          sourceLine: 2,
          instruction: mockProgram.instructions[0]!,
          registersChanged: [{ name: 'SP', old: 0xfffe, new: 0xfffc }],
          flagsChanged: [],
          memoryWrites: [{ address: 0xfffc, oldByte: 0, newByte: 1 }],
          cycles: 1,
          ipAfter: 5,
          halted: false,
        },
      ],
    };

    render(
      <StackView
        cpuState={state}
        program={mockProgram}
        history={history}
      />
    );

    // Return address annotation pointing to line 3 (the instruction after CALL)
    expect(screen.getByText(/return address \(line 3\)/i)).toBeInTheDocument();
  });
});
