/**
 * @file AluPage.test.tsx
 * Integration tests for the Arithmetic Logic Unit (ALU) page component.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { AluPage } from './AluPage';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';

describe('AluPage', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
    useUiStore.setState({ currentModule: 'alu' });
  });

  it('renders page header, default 4-bit ADD operation, and tabs', () => {
    render(<AluPage />);

    expect(screen.getByRole('heading', { level: 1, name: /Arithmetic Logic Unit \(ALU\)/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Explore ALU/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Carry Chain Datapath/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Practice & Predict/i })).toBeInTheDocument();

    // Default: 5 + 3 in 4-bit is 8 (1000_2)
    expect(screen.getByText(/1000/i)).toBeInTheDocument();
    expect(screen.getByText(/8 \(0x8\)/i)).toBeInTheDocument();
  });

  it('hydrates from existing project.alu state in store', () => {
    useProjectStore.getState().applyPatch({
      alu: {
        op: 'SUB',
        width: 4,
        a: 7,
        b: 2,
      },
    });

    render(<AluPage />);

    // 7 - 2 = 5
    expect(screen.getByText(/5 \(0x5\)/i)).toBeInTheDocument();
  });

  it('detects 7 + 5 signed overflow (V=1) and negative MSB (S=1) in 4-bit', () => {
    render(<AluPage />);

    const inputA = screen.getByLabelText(/Operand A/i);
    const inputB = screen.getByLabelText(/Operand B/i);

    fireEvent.change(inputA, { target: { value: '7' } });
    fireEvent.change(inputB, { target: { value: '5' } });

    // 7 + 5 = 12 (0b1100), in 4-bit signed is -4, V=1, S=1
    expect(screen.getByText(/1100/i)).toBeInTheDocument();
    expect(screen.getByText(/-4/i)).toBeInTheDocument();

    const project = useProjectStore.getState().project;
    expect(project.alu?.a).toBe(7);
    expect(project.alu?.b).toBe(5);
  });

  it('shows borrow notice and CF=1 on subtraction 5 - 7', () => {
    render(<AluPage />);

    const opSelect = screen.getByLabelText(/ALU Operation/i);
    fireEvent.change(opSelect, { target: { value: 'SUB' } });

    const inputA = screen.getByLabelText(/Operand A/i);
    const inputB = screen.getByLabelText(/Operand B/i);
    fireEvent.change(inputA, { target: { value: '5' } });
    fireEvent.change(inputB, { target: { value: '7' } });

    expect(screen.getByText(/8086 Subtraction: CF = 1 means Borrow/i)).toBeInTheDocument();
  });

  it('shows discarded result banner and comparison relations table for CMP', () => {
    render(<AluPage />);

    const opSelect = screen.getByLabelText(/ALU Operation/i);
    fireEvent.change(opSelect, { target: { value: 'CMP' } });

    expect(screen.getByText(/CMP: Result Discarded \(Flags Updated Only\)/i)).toBeInTheDocument();
    expect(screen.getByText(/CMP Comparison Relations/i)).toBeInTheDocument();
  });

  it('switches between tabs to view carry chain and practice', () => {
    render(<AluPage />);

    // Switch to carry chain tab
    const carryTab = screen.getByRole('tab', { name: /Carry Chain Datapath/i });
    fireEvent.click(carryTab);

    expect(screen.getByText(/Ripple-Carry Adder\/Subtractor Datapath/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open adder in Circuit Simulator/i })).toBeInTheDocument();

    // Switch to practice tab
    const practiceTab = screen.getByRole('tab', { name: /Practice & Predict/i });
    fireEvent.click(practiceTab);

    expect(screen.getByText(/Signed Overflow: 7 \+ 1/i)).toBeInTheDocument();
  });
});
