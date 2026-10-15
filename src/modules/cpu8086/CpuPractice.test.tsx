/**
 * @file CpuPractice.test.tsx
 * Unit tests for CpuPractice workbench: misconception diagnosis (wrong-push-order),
 * progressive hint ladder, answer-trap detection, and test mode gating.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { CpuPractice } from './CpuPractice';
import { assemble } from '../../engine/cpu8086/assembler';
import { createCpuState, step } from '../../engine/cpu8086/cpu';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useStudyStore } from '../../store/studyStore';
import { useLogStore } from '../../store/logStore';
import type { CpuSession } from './useCpuSession';

describe('CpuPractice', () => {
  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
    useStudyStore.setState({ pretestUnlocked: false, posttestUnlocked: false });
    useLogStore.getState().clearLog();
  });

  const createMockSession = (source: string): CpuSession => {
    const res = assemble(source);
    if (!res.ok) throw new Error('Assemble failed in test helper');
    let state = createCpuState(res.program);
    // Execute first instruction if needed so IP is at instruction under test
    state = step(state, res.program).state;

    return {
      source,
      setSource: vi.fn(),
      assemblerResult: res,
      program: res.program,
      cpuState: state,
      status: 'paused',
      stopReason: null,
      stopReasonMessage: null,
      totalSteps: 1,
      currentLine: 2,
      breakpoints: new Set(),
      toggleBreakpoint: vi.fn(),
      watchpoints: [],
      addWatchpoint: vi.fn(),
      removeWatchpoint: vi.fn(),
      speed: 'max',
      setSpeed: vi.fn(),
      assembleAndReset: vi.fn(),
      reset: vi.fn(),
      stepSingle: vi.fn(),
      stepOverFn: vi.fn(),
      stepOutFn: vi.fn(),
      run: vi.fn(),
      pause: vi.fn(),
      runToCursor: vi.fn(),
      setInitialRegister: vi.fn(),
      editMemoryByte: vi.fn(),
      memoryEditCount: 0,
      canStepBack: false,
      canStepForward: false,
      historyStepBack: vi.fn(),
      historyStepForward: vi.fn(),
      historyGoTo: vi.fn(),
      traceRows: [],
      historyLength: 1,
      historyIndex: 0,
      historyTruncated: false,
      lastRecord: null,
    };
  };

  it('diagnoses wrong-push-order when predicting write at old SP before decrement', async () => {
    // Instruction 1: MOV AX, 0x1111; Instruction 2 (at IP): PUSH AX
    const session = createMockSession('MOV AX, 0x1111\nPUSH AX\nHLT');

    render(<CpuPractice session={session} />);

    // Switch to Stack prediction mode
    const stackBtn = screen.getByRole('button', { name: /Stack \(PUSH\)/i });
    fireEvent.click(stackBtn);

    // Predict wrong push order: wrote at 0xFFFE instead of 0xFFFC
    const spInput = screen.getByLabelText(/Predicted SP:/i);
    const addrInput = screen.getByLabelText(/Write Address:/i);
    const valInput = screen.getByLabelText(/Pushed Word:/i);

    fireEvent.change(spInput, { target: { value: '0xFFFC' } });
    fireEvent.change(addrInput, { target: { value: '0xFFFE' } });
    fireEvent.change(valInput, { target: { value: '0x1111' } });

    // Submit prediction via StepChecker Check My Step button
    const checkBtn = screen.getByRole('button', { name: /Check My Step/i });
    fireEvent.click(checkBtn);

    // Diagnosis card appears with wrong-push-order misconception title
    expect(await screen.findByText(/Incorrect PUSH\/POP Stack Pointer Operation Sequence/i)).toBeInTheDocument();

    // Request Hint 1
    const hintBtn = screen.getByRole('button', { name: /Unlock hint level 1/i });
    fireEvent.click(hintBtn);
    expect(await screen.findByText(/Level 1: Nudge/i)).toBeInTheDocument();
  });

  it('disables Show Answer during study test sessions and enables outside tests', () => {
    const session = createMockSession('MOV AX, 0x1234\nHLT');

    const { rerender } = render(<CpuPractice session={session} />);

    // Outside test: Show Answer is enabled
    const showAnswerBtn = screen.getByRole('button', { name: /Reveal step answer/i });
    expect(showAnswerBtn).not.toBeDisabled();

    // Now unlock pretest
    act(() => {
      useStudyStore.setState({ pretestUnlocked: true });
    });
    rerender(<CpuPractice session={session} />);

    expect(screen.getByRole('button', { name: /Reveal step answer/i })).toBeDisabled();
    expect(screen.getByText(/Show answer \(disabled in test\)/i)).toBeInTheDocument();
  });

  it('clicking Show Answer logs assisted event and shows expected value', () => {
    const session = createMockSession('MOV AX, 0x55\nHLT');

    render(<CpuPractice session={session} />);

    const showAnswerBtn = screen.getByRole('button', { name: /Reveal step answer/i });
    fireEvent.click(showAnswerBtn);

    // Shows revealed answer
    expect(screen.getByText(/Expected AX:/i)).toBeInTheDocument();

    // Event logged in logStore
    const logs = useLogStore.getState().events;
    const hintLog = logs.find((l) => l.eventType === 'hint-used');
    expect(hintLog).toBeDefined();
    expect(hintLog?.level).toBe(3);
  });
});
