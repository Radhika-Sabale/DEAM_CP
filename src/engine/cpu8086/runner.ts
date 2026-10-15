/**
 * @file runner.ts
 * Run control engine for the 8086 CPU: single-step, step-over, step-out,
 * breakpoint handling, watchpoint triggers, scenario event feeding, and bounded execution.
 */

import { canEverWake } from '../interrupts';
import { step } from './cpu';
import type { CpuState, StepRecord, StepResult } from './cpuTypes';
import {
  checkWatchpoints,
  DEFAULT_STEP_CAP,
  resolveBreakpointAddresses,
  type RunOptions,
  type RunResult,
  type StopReason,
  TRACE_BUFFER_SIZE,
  type Watchpoint,
} from './runnerTypes';
import type { Instruction, Program } from './types';

export {
  DEFAULT_STEP_CAP,
  resolveBreakpointAddresses,
  type RunOptions,
  type RunResult,
  type StopReason,
  type Watchpoint,
};

/**
 * Executes a single instruction step.
 */
export function stepOnce(
  state: CpuState,
  program: Program,
  options: RunOptions = {}
): StepResult {
  return step(state, program, options);
}

/**
 * Runs the CPU until a stop condition is met.
 */
export function runUntil(
  initialState: CpuState,
  program: Program,
  options: RunOptions = {}
): RunResult {
  const maxSteps = options.maxSteps ?? DEFAULT_STEP_CAP;
  const stopOnFault = options.stopOnFault ?? true;
  const bpAddrs = resolveBreakpointAddresses(
    program,
    options.breakpoints,
    options.breakpointLines
  );

  let state = initialState;
  let stepsExecuted = 0;
  let lastRecord: StepRecord | undefined;
  const recentTrace: StepRecord[] = [];

  while (stepsExecuted < maxSteps) {
    if (stopOnFault && state.fault) {
      return { state, stepsExecuted, stopReason: 'fault', lastRecord, recentTrace };
    }

    if (state.halted) {
      if (options.scenario) {
        if (!canEverWake(options.scenario, state.ticks, state.flags.I)) {
          return {
            state,
            stepsExecuted,
            stopReason: 'halted-waiting-forever',
            lastRecord,
            recentTrace,
            explanation:
              'CPU is halted with interrupts disabled or no wake-capable events scheduled in the scenario.',
          };
        }
      } else {
        return { state, stepsExecuted, stopReason: 'halted', lastRecord, recentTrace };
      }
    }

    // Stop before executing if current instruction IP is a breakpoint
    if (stepsExecuted > 0 && bpAddrs.has(state.registers.IP)) {
      return { state, stepsExecuted, stopReason: 'breakpoint', lastRecord, recentTrace };
    }

    const res = step(state, program, options);
    state = res.state;
    lastRecord = res.record;
    stepsExecuted++;

    recentTrace.push(lastRecord);
    if (recentTrace.length > TRACE_BUFFER_SIZE) {
      recentTrace.shift();
    }

    if (checkWatchpoints(lastRecord, options.watchpoints)) {
      return { state, stepsExecuted, stopReason: 'watch-triggered', lastRecord, recentTrace };
    }

    if (stopOnFault && state.fault) {
      return { state, stepsExecuted, stopReason: 'fault', lastRecord, recentTrace };
    }

    if (state.halted && !options.scenario) {
      return { state, stepsExecuted, stopReason: 'halted', lastRecord, recentTrace };
    }

    if (bpAddrs.has(state.registers.IP)) {
      return { state, stepsExecuted, stopReason: 'breakpoint', lastRecord, recentTrace };
    }
  }

  return {
    state,
    stepsExecuted,
    stopReason: 'step-cap',
    lastRecord,
    recentTrace,
    explanation: `Execution reached step cap of ${maxSteps} steps without halting.`,
  };
}

/**
 * Runs execution until the CPU halts.
 */
export function runToHalt(
  initialState: CpuState,
  program: Program,
  options: Omit<RunOptions, 'breakpoints' | 'breakpointLines'> = {}
): RunResult {
  return runUntil(initialState, program, {
    ...options,
    breakpoints: undefined,
    breakpointLines: undefined,
  });
}

/**
 * Step over the current instruction (treats CALL and INT like subroutines).
 */
export function stepOver(
  initialState: CpuState,
  program: Program,
  options: RunOptions = {}
): RunResult {
  if (initialState.halted) {
    return { state: initialState, stepsExecuted: 0, stopReason: 'halted' };
  }

  const currentInstr: Instruction | undefined = program.instructions[initialState.registers.IP];
  if (!currentInstr || (currentInstr.mnemonic !== 'CALL' && currentInstr.mnemonic !== 'INT')) {
    const single = step(initialState, program, options);
    const stopReason: StopReason = single.state.halted
      ? 'halted'
      : single.state.fault
        ? 'fault'
        : checkWatchpoints(single.record, options.watchpoints)
          ? 'watch-triggered'
          : 'halted';
    return {
      state: single.state,
      stepsExecuted: 1,
      stopReason,
      lastRecord: single.record,
      recentTrace: [single.record],
    };
  }

  const maxSteps = options.maxSteps ?? DEFAULT_STEP_CAP;
  const stopOnFault = options.stopOnFault ?? true;
  const bpAddrs = resolveBreakpointAddresses(
    program,
    options.breakpoints,
    options.breakpointLines
  );

  let state = initialState;
  let stepsExecuted = 0;
  let lastRecord: StepRecord | undefined;
  const recentTrace: StepRecord[] = [];
  let callDepth = 0;

  while (stepsExecuted < maxSteps) {
    const nextIp = state.registers.IP;
    const nextInstr = program.instructions[nextIp];

    if (stepsExecuted > 0 && bpAddrs.has(nextIp)) {
      return { state, stepsExecuted, stopReason: 'breakpoint', lastRecord, recentTrace };
    }

    const res = step(state, program, options);
    state = res.state;
    lastRecord = res.record;
    stepsExecuted++;

    recentTrace.push(lastRecord);
    if (recentTrace.length > TRACE_BUFFER_SIZE) {
      recentTrace.shift();
    }

    if (nextInstr?.mnemonic === 'CALL' || nextInstr?.mnemonic === 'INT') {
      callDepth++;
    } else if (nextInstr?.mnemonic === 'RET' || nextInstr?.mnemonic === 'IRET') {
      callDepth--;
    }

    if (checkWatchpoints(lastRecord, options.watchpoints)) {
      return { state, stepsExecuted, stopReason: 'watch-triggered', lastRecord, recentTrace };
    }

    if (stopOnFault && state.fault) {
      return { state, stepsExecuted, stopReason: 'fault', lastRecord, recentTrace };
    }

    if (state.halted) {
      return { state, stepsExecuted, stopReason: 'halted', lastRecord, recentTrace };
    }

    if (callDepth <= 0) {
      return { state, stepsExecuted, stopReason: 'halted', lastRecord, recentTrace };
    }
  }

  return {
    state,
    stepsExecuted,
    stopReason: 'step-cap',
    lastRecord,
    recentTrace,
    explanation: `Step-over reached step cap of ${maxSteps} instructions.`,
  };
}

/**
 * Step out of the current function call or interrupt handler.
 */
export function stepOut(
  initialState: CpuState,
  program: Program,
  options: RunOptions = {}
): RunResult {
  if (initialState.halted) {
    return { state: initialState, stepsExecuted: 0, stopReason: 'halted' };
  }

  const maxSteps = options.maxSteps ?? DEFAULT_STEP_CAP;
  const stopOnFault = options.stopOnFault ?? true;
  const bpAddrs = resolveBreakpointAddresses(
    program,
    options.breakpoints,
    options.breakpointLines
  );

  let state = initialState;
  let stepsExecuted = 0;
  let lastRecord: StepRecord | undefined;
  const recentTrace: StepRecord[] = [];
  let depth = 1;

  while (stepsExecuted < maxSteps) {
    const nextIp = state.registers.IP;
    const nextInstr = program.instructions[nextIp];

    if (stepsExecuted > 0 && bpAddrs.has(nextIp)) {
      return { state, stepsExecuted, stopReason: 'breakpoint', lastRecord, recentTrace };
    }

    const res = step(state, program, options);
    state = res.state;
    lastRecord = res.record;
    stepsExecuted++;

    recentTrace.push(lastRecord);
    if (recentTrace.length > TRACE_BUFFER_SIZE) {
      recentTrace.shift();
    }

    if (nextInstr?.mnemonic === 'CALL' || nextInstr?.mnemonic === 'INT') {
      depth++;
    } else if (nextInstr?.mnemonic === 'RET' || nextInstr?.mnemonic === 'IRET') {
      depth--;
    }

    if (checkWatchpoints(lastRecord, options.watchpoints)) {
      return { state, stepsExecuted, stopReason: 'watch-triggered', lastRecord, recentTrace };
    }

    if (stopOnFault && state.fault) {
      return { state, stepsExecuted, stopReason: 'fault', lastRecord, recentTrace };
    }

    if (state.halted) {
      return { state, stepsExecuted, stopReason: 'halted', lastRecord, recentTrace };
    }

    if (depth <= 0) {
      return { state, stepsExecuted, stopReason: 'halted', lastRecord, recentTrace };
    }
  }

  return {
    state,
    stepsExecuted,
    stopReason: 'step-cap',
    lastRecord,
    recentTrace,
    explanation: `Step-out reached step cap of ${maxSteps} instructions.`,
  };
}
