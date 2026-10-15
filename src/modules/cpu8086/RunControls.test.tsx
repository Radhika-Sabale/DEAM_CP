/**
 * @file RunControls.test.tsx
 * Unit tests for RunControls toolbar: step, step over/out, run, pause,
 * speed selector, stop reason message, and watchpoints.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { RunControls } from './RunControls';

describe('RunControls', () => {
  const defaultProps = {
    status: 'assembled' as const,
    stopReason: null,
    stopReasonMessage: null,
    totalSteps: 0,
    hasProgram: true,
    isHalted: false,
    isFaulted: false,
    speed: '5' as const,
    setSpeed: vi.fn(),
    watchpoints: [],
    onAddWatchpoint: vi.fn(),
    onRemoveWatchpoint: vi.fn(),
    currentLine: 3,
    onAssemble: vi.fn(),
    onReset: vi.fn(),
    onStep: vi.fn(),
    onStepOver: vi.fn(),
    onStepOut: vi.fn(),
    onRun: vi.fn(),
    onPause: vi.fn(),
    onRunToCursor: vi.fn(),
    canStepBack: false,
    canStepForward: false,
    onStepBack: vi.fn(),
    onStepForward: vi.fn(),
  };

  it('renders control buttons and triggers step, step over, step out, run', () => {
    const onStep = vi.fn();
    const onStepOver = vi.fn();
    const onStepOut = vi.fn();
    const onRun = vi.fn();

    render(
      <RunControls
        {...defaultProps}
        onStep={onStep}
        onStepOver={onStepOver}
        onStepOut={onStepOut}
        onRun={onRun}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Execute one instruction/i }));
    expect(onStep).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Step over subroutine call/i }));
    expect(onStepOver).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Step out of subroutine/i }));
    expect(onStepOut).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Run program to halt or breakpoint/i }));
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it('renders Pause button when running and triggers onPause', () => {
    const onPause = vi.fn();

    render(
      <RunControls
        {...defaultProps}
        status="running"
        onPause={onPause}
      />
    );

    const pauseBtn = screen.getByRole('button', { name: /Pause program execution/i });
    expect(pauseBtn).toBeInTheDocument();
    fireEvent.click(pauseBtn);
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('changes execution speed via dropdown', () => {
    const setSpeed = vi.fn();

    render(
      <RunControls
        {...defaultProps}
        setSpeed={setSpeed}
      />
    );

    const speedSelect = screen.getByLabelText(/Execution speed selector/i);
    fireEvent.change(speedSelect, { target: { value: '20' } });
    expect(setSpeed).toHaveBeenCalledWith('20');
  });

  it('displays stop reason message in an accessible banner', () => {
    render(
      <RunControls
        {...defaultProps}
        stopReason="breakpoint"
        stopReasonMessage="Stopped: breakpoint at line 4"
      />
    );

    const banner = screen.getByText(/Stopped: breakpoint at line 4/i);
    expect(banner).toBeInTheDocument();
  });

  it('opens watchpoint drawer and adds a register watchpoint', () => {
    const onAddWatchpoint = vi.fn();

    render(
      <RunControls
        {...defaultProps}
        onAddWatchpoint={onAddWatchpoint}
      />
    );

    // Open watchpoint manager
    const watchpointsBtn = screen.getByRole('button', { name: /Configure execution watchpoints/i });
    fireEvent.click(watchpointsBtn);

    expect(screen.getByText(/Stop when:/i)).toBeInTheDocument();

    // Click + Add
    const addBtn = screen.getByRole('button', { name: /\+ Add/i });
    fireEvent.click(addBtn);

    expect(onAddWatchpoint).toHaveBeenCalledWith({
      type: 'register',
      register: 'AX',
    });
  });
});
