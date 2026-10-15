import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { InterruptPractice } from './InterruptPractice';
import { createCpuState } from '../../engine/cpu8086/cpu';
import { assemble } from '../../engine/cpu8086/assembler';
import type { InterruptSession } from './useInterruptSession';

describe('InterruptPractice', () => {
  const asm = assemble('MOV AX, 1\nHLT');
  if (!asm.ok) throw new Error('Assembly failed');
  const cpuState = createCpuState(asm.program);

  const mockSession = {
    source: 'MOV AX, 1\nHLT',
    setSource: () => {},
    assemblerResult: asm,
    program: asm.program,
    cpuState,
    status: 'idle' as const,
    stopReason: null,
    stopReasonMessage: null,
    totalSteps: 0,
    currentLine: 1,
    breakpoints: new Set<number>(),
    toggleBreakpoint: () => {},
    watchpoints: [],
    addWatchpoint: () => {},
    removeWatchpoint: () => {},
    speed: '1' as const,
    setSpeed: () => {},
    assembleAndReset: () => {},
    reset: () => {},
    stepSingle: () => {},
    stepOverFn: () => {},
    stepOutFn: () => {},
    run: () => {},
    pause: () => {},
    runToCursor: () => {},
    canStep: true,
    canStepBack: false,
    canStepForward: false,
    historyStepBack: () => {},
    historyStepForward: () => {},
    historyGoTo: () => {},
    lastRecord: null,
    historyLength: 0,
    historyIndex: -1,
    historyTruncated: false,
    traceRows: [],
    setInitialRegister: () => {},
    editMemoryByte: () => {},
    isModified: false,
    activeLine: 1,
    assemblyErrors: [],
    assemblyWarnings: [],
    scenario: { events: [] },
    setScenario: () => {},
    addScenarioEvent: () => {},
    removeScenarioEvent: () => {},
    updateScenarioEvent: () => {},
    importScenarioJson: () => ({ ok: true as const }),
    exportScenarioJson: () => '{}',
    interruptLog: [],
    lastInterruptRecord: null,
    microStepIndex: -1,
    currentMicroStep: null,
    stepIntoMicroStep: () => {},
    prevMicroStep: () => {},
    showAllMicroSteps: () => {},
    resetMicroSteps: () => {},
    currentTick: 0,
    pendingLines: {
      nmi: false,
      intr: null,
      ifFlag: 1 as const,
      tfFlag: 0 as const,
      stiShadow: false,
    },
    pendingList: [],
    hasInterruptWatchpoint: false,
    toggleInterruptWatchpoint: () => {},
  } as unknown as InterruptSession;

  it('renders prediction topics and switches between them', () => {
    render(<InterruptPractice session={mockSession} />);

    expect(screen.getByText(/Interrupt Adaptive Practice Workbench/i)).toBeInTheDocument();

    const frameTopicBtn = screen.getByRole('button', { name: /Interrupt Frame \(Stack\)/i });
    fireEvent.click(frameTopicBtn);
    expect(screen.getByText(/Top of Stack \[SP \+ 0\]:/i)).toBeInTheDocument();

    const flagsTopicBtn = screen.getByRole('button', { name: /IF & TF Behavior/i });
    fireEvent.click(flagsTopicBtn);
    expect(screen.getByText(/IF on Entry:/i)).toBeInTheDocument();

    const prioTopicBtn = screen.getByRole('button', { name: /Priority Arbitration/i });
    fireEvent.click(prioTopicBtn);
    expect(screen.getByText(/Next Recognized Interrupt:/i)).toBeInTheDocument();

    const trapTopicBtn = screen.getByRole('button', { name: /TF Trap Timing/i });
    fireEvent.click(trapTopicBtn);
    expect(screen.getByText(/Fires on Next Instruction:/i)).toBeInTheDocument();
  });

  it('shows answer when Show Answer is clicked', () => {
    render(<InterruptPractice session={mockSession} />);

    const showAnswerBtn = screen.getByRole('button', { name: /Show Answer/i });
    fireEvent.click(showAnswerBtn);

    expect(screen.getByText(/Expected address:/i)).toBeInTheDocument();
  });
});
