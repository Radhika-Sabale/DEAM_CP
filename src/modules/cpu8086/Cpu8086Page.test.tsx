/**
 * @file Cpu8086Page.test.tsx
 * Integration tests for the Intel 8086 Microprocessor simulator page:
 * - Header rendering and simulator layout
 * - Rebuilding ephemeral machine state from project store on mount with notice
 * - Navigation between Simulate and Practice modes
 * - Inspector panel tab switching (Registers, Flags, Memory, Stack, Trace)
 * - Automatic and confirmational ALU handoff workflows
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Cpu8086Page } from './Cpu8086Page';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';

describe('Cpu8086Page', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
    useUiStore.setState({ currentModule: '8086-cpu' });
  });

  it('renders page header, mode switchers, and default simulation workbench', () => {
    render(<Cpu8086Page />);

    expect(
      screen.getByRole('heading', { level: 1, name: /Intel 8086 Microprocessor Simulator/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Simulate$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Practice$/i })).toBeInTheDocument();

    // Default inspector tabs
    expect(screen.getByRole('tab', { name: /Registers/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Flags/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Memory/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Stack/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Trace/i })).toBeInTheDocument();
  });

  it('restores stored source on mount, rebuilds machine state, and displays rebuilt notice', () => {
    useProjectStore.getState().applyPatch({
      cpu8086: {
        source: 'MOV AX, 0x1234\nHLT',
        breakpoints: [2],
      },
    });

    render(<Cpu8086Page />);

    // Ephemeral notice is displayed
    expect(
      screen.getByText(/Machine state is rebuilt from your source; run again\./i)
    ).toBeInTheDocument();

    // Editor displays the source
    const textarea = screen.getByLabelText(/8086 Assembly Source Code/i);
    expect(textarea).toHaveValue('MOV AX, 0x1234\nHLT');

    // Dismiss notice
    const dismissBtn = screen.getByRole('button', { name: /Dismiss/i });
    fireEvent.click(dismissBtn);
    expect(
      screen.queryByText(/Machine state is rebuilt from your source; run again\./i)
    ).not.toBeInTheDocument();
  });

  it('switches between Simulate and Practice workbench tabs', () => {
    render(<Cpu8086Page />);

    // Click Practice
    const practiceBtn = screen.getByRole('button', { name: /^Practice$/i });
    fireEvent.click(practiceBtn);

    expect(screen.getByText(/Adaptive Practice Workbench/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Switch to multi-step trace table mode/i })).toBeInTheDocument();

    // Switch back to Simulate
    const simulateBtn = screen.getByRole('button', { name: /^Simulate$/i });
    fireEvent.click(simulateBtn);

    expect(screen.getByRole('button', { name: /Assemble source code/i })).toBeInTheDocument();
  });

  it('switches inspector tabs to display Flags, Memory, Stack, and Trace', () => {
    useProjectStore.getState().applyPatch({
      cpu8086: {
        source: 'MOV AX, 5\nHLT',
        breakpoints: [],
      },
    });

    render(<Cpu8086Page />);

    // Switch to Flags tab
    fireEvent.click(screen.getByRole('tab', { name: /Flags/i }));
    expect(screen.getByRole('heading', { name: /Status Flags/i })).toBeInTheDocument();
    expect(screen.getByText(/CF = borrow on subtraction \(8086\)/i)).toBeInTheDocument();

    // Switch to Memory tab
    fireEvent.click(screen.getByRole('tab', { name: /Memory/i }));
    expect(screen.getByLabelText(/64 KB memory hex dump viewer/i)).toBeInTheDocument();

    // Switch to Stack tab
    fireEvent.click(screen.getByRole('tab', { name: /Stack/i }));
    expect(screen.getByRole('table', { name: /8086 CPU stack table/i })).toBeInTheDocument();

    // Switch to Trace tab
    fireEvent.click(screen.getByRole('tab', { name: /Trace/i }));
    expect(screen.getByRole('heading', { name: /Execution Trace/i })).toBeInTheDocument();
  });

  it('automatically accepts ALU handoff when source is empty', () => {
    // Set incoming ALU handoff
    useProjectStore.getState().applyPatch({
      alu: {
        op: 'ADD',
        width: 16,
        a: 10,
        b: 25,
      },
      lastHandoff: {
        from: 'alu',
        to: '8086-cpu',
        timestamp: new Date().toISOString(),
      },
    });

    render(<Cpu8086Page />);

    const textarea = screen.getByLabelText(/8086 Assembly Source Code/i);
    expect(textarea.getAttribute('value') || (textarea as HTMLTextAreaElement).value).toContain('MOV AX, 10');
    expect(textarea.getAttribute('value') || (textarea as HTMLTextAreaElement).value).toContain('ADD AX, BX');
  });

  it('shows confirmation dialog on ALU handoff when user has existing code', () => {
    useProjectStore.getState().applyPatch({
      cpu8086: {
        source: 'MOV CX, 0x9999\nHLT',
        breakpoints: [],
      },
    });

    const { rerender } = render(<Cpu8086Page />);

    // Now trigger an ALU handoff
    act(() => {
      useProjectStore.getState().applyPatch({
        alu: {
          op: 'SUB',
          width: 16,
          a: 50,
          b: 20,
        },
        lastHandoff: {
          from: 'alu',
          to: '8086-cpu',
          timestamp: new Date().toISOString(),
        },
      });
    });

    rerender(<Cpu8086Page />);

    // Dialog appears
    expect(screen.getByText(/Replace 8086 Program from ALU\?/i)).toBeInTheDocument();

    // Clicking Cancel preserves existing code
    const cancelBtn = screen.getByRole('button', { name: /^Cancel$/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByText(/Replace 8086 Program from ALU\?/i)).not.toBeInTheDocument();

    const textarea = screen.getByLabelText(/8086 Assembly Source Code/i);
    expect(textarea).toHaveValue('MOV CX, 0x9999\nHLT');
  });

  it('replaces code when confirmation dialog Replace button is clicked', () => {
    useProjectStore.getState().applyPatch({
      cpu8086: {
        source: 'MOV DX, 0x1111\nHLT',
        breakpoints: [],
      },
    });

    const { rerender } = render(<Cpu8086Page />);

    act(() => {
      useProjectStore.getState().applyPatch({
        alu: {
          op: 'ADD',
          width: 16,
          a: 100,
          b: 200,
        },
        lastHandoff: {
          from: 'alu',
          to: '8086-cpu',
          timestamp: new Date().toISOString(),
        },
      });
    });

    rerender(<Cpu8086Page />);

    const replaceBtn = screen.getByRole('button', { name: /^Replace$/i });
    fireEvent.click(replaceBtn);

    const textarea = screen.getByLabelText(/8086 Assembly Source Code/i);
    expect(textarea.getAttribute('value') || (textarea as HTMLTextAreaElement).value).toContain('MOV AX, 100');
  });

  it('triggers handoff to interrupt-controller when Open in Interrupt Simulator is clicked', () => {
    useProjectStore.getState().applyPatch({
      cpu8086: {
        source: 'MOV AX, 0x1234\nINT 0x20\nHLT',
        breakpoints: [],
      },
    });

    render(<Cpu8086Page />);

    const handoffBtn = screen.getByRole('button', { name: /Open in Interrupt Simulator/i });
    expect(handoffBtn).toBeEnabled();

    fireEvent.click(handoffBtn);

    const project = useProjectStore.getState().project;
    expect(project.lastHandoff?.from).toBe('8086-cpu');
    expect(project.lastHandoff?.to).toBe('interrupt-controller');
  });
});
