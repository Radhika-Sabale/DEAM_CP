/**
 * @file runnerTypes.ts
 * Type definitions and breakpoint/watchpoint resolution for 8086 CPU execution.
 */

import type {
  CpuFlags,
  CpuState,
  StepRecord,
} from './cpuTypes';
import type { Program, RegisterName } from './types';
import type { InterruptScenario } from '../interrupts';

export type StopReason =
  | 'halted'
  | 'breakpoint'
  | 'fault'
  | 'step-cap'
  | 'watch-triggered'
  | 'halted-waiting-forever';

export type Watchpoint =
  | { readonly type: 'register'; readonly register: RegisterName }
  | { readonly type: 'flag'; readonly flag: keyof CpuFlags }
  | { readonly type: 'memory'; readonly address: number }
  | { readonly type: 'interrupt' };

export interface RunOptions {
  /** Target instruction addresses (0-indexed IP) */
  readonly breakpoints?: ReadonlySet<number> | readonly number[];
  /** 1-based source lines to stop at */
  readonly breakpointLines?: ReadonlySet<number> | readonly number[];
  /** Watchpoints triggering execution halt on modification */
  readonly watchpoints?: readonly Watchpoint[];
  /** Maximum instruction steps before halting with 'step-cap' (default: 100,000) */
  readonly maxSteps?: number;
  /** Whether to stop execution immediately when a fault occurs (default: true) */
  readonly stopOnFault?: boolean;
  /** Single-instruction STI shadow option (default: true) */
  readonly stiShadow?: boolean;
  /** External interrupt event scenario */
  readonly scenario?: InterruptScenario;
}

export interface RunResult {
  readonly state: CpuState;
  readonly stepsExecuted: number;
  readonly stopReason: StopReason;
  readonly lastRecord?: StepRecord;
  readonly recentTrace?: readonly StepRecord[];
  readonly explanation?: string;
}

export const DEFAULT_STEP_CAP = 100_000;
export const TRACE_BUFFER_SIZE = 20;

/**
 * Normalizes breakpoints from addresses and source lines into a set of instruction addresses.
 */
export function resolveBreakpointAddresses(
  program: Program,
  breakpoints?: ReadonlySet<number> | readonly number[],
  breakpointLines?: ReadonlySet<number> | readonly number[]
): Set<number> {
  const addrs = new Set<number>(breakpoints ? Array.from(breakpoints) : []);
  if (breakpointLines) {
    const lines = new Set<number>(breakpointLines);
    for (const instr of program.instructions) {
      if (lines.has(instr.sourceLine)) {
        addrs.add(instr.address);
      }
    }
  }
  return addrs;
}

/**
 * Checks if a step record triggered any active watchpoints.
 */
export function checkWatchpoints(
  record: StepRecord,
  watchpoints?: readonly Watchpoint[]
): boolean {
  if (!watchpoints || watchpoints.length === 0) return false;
  for (const wp of watchpoints) {
    if (wp.type === 'register') {
      if (record.registersChanged.some((rc) => rc.name === wp.register)) return true;
    } else if (wp.type === 'flag') {
      if (record.flagsChanged.some((fc) => fc.name === wp.flag)) return true;
    } else if (wp.type === 'memory') {
      if (record.memoryWrites.some((mw) => mw.address === wp.address)) return true;
    } else if (wp.type === 'interrupt') {
      if (record.interruptRecord !== undefined) return true;
    }
  }
  return false;
}
