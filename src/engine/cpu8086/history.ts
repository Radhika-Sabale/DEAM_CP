/**
 * @file history.ts
 * Delta-compressed execution history for the 8086 CPU.
 * Supports step-back, step-forward, random-access state reconstruction,
 * capacity bounding with truncation flags, and trace table formatting.
 */

import { writeByte } from './memory';
import { setReg } from './registers';
import type { CpuState, StepRecord } from './cpuTypes';
import { formatTraceRow, type TraceTableRow } from './historyTrace';

export { type TraceTableRow };

export const DEFAULT_MAX_HISTORY = 10_000;

export interface ExecutionHistory {
  /** Baseline state at the start of the retained history buffer */
  readonly baseState: CpuState;
  /** Sequence of StepRecord deltas */
  readonly records: readonly StepRecord[];
  /** Current position in history (-1 = baseState, 0 = after records[0], etc.) */
  readonly currentIndex: number;
  /** Total steps executed across the CPU lifetime */
  readonly totalSteps: number;
  /** True if older history records were evicted due to the capacity cap */
  readonly truncated: boolean;
  /** Maximum capacity before evicting oldest deltas */
  readonly maxCapacity: number;
}

/**
 * Creates an empty ExecutionHistory anchored at an initial CPU state.
 */
export function createHistory(
  initialState: CpuState,
  maxCapacity = DEFAULT_MAX_HISTORY
): ExecutionHistory {
  return {
    baseState: initialState,
    records: [],
    currentIndex: -1,
    totalSteps: 0,
    truncated: false,
    maxCapacity,
  };
}

/**
 * Applies a forward delta from a StepRecord to a CPU state.
 */
export function applyForwardDelta(state: CpuState, record: StepRecord): CpuState {
  let registers = state.registers;
  for (const rc of record.registersChanged) {
    registers = setReg(registers, rc.name, rc.new);
  }
  registers = setReg(registers, 'IP', record.ipAfter);

  let flags = state.flags;
  for (const fc of record.flagsChanged) {
    if (fc.name === 'O') {
      flags = { ...flags, O: fc.new };
    } else {
      flags = { ...flags, [fc.name]: fc.new === 'undefined' ? 0 : fc.new };
    }
  }

  let memory = state.memory;
  for (const mw of record.memoryWrites) {
    memory = writeByte(memory, mw.address, mw.newByte).memory;
  }

  return {
    ...state,
    registers,
    flags,
    memory,
    halted: record.halted,
    fault: record.fault,
  };
}

/**
 * Applies an inverse (backward) delta from a StepRecord to restore previous CPU state.
 */
export function applyReverseDelta(state: CpuState, record: StepRecord): CpuState {
  let registers = state.registers;
  for (let i = record.registersChanged.length - 1; i >= 0; i--) {
    const rc = record.registersChanged[i];
    if (rc) registers = setReg(registers, rc.name, rc.old);
  }
  registers = setReg(registers, 'IP', record.address);

  let flags = state.flags;
  for (let i = record.flagsChanged.length - 1; i >= 0; i--) {
    const fc = record.flagsChanged[i];
    if (fc) {
      if (fc.name === 'O') {
        flags = { ...flags, O: fc.old };
      } else {
        flags = { ...flags, [fc.name]: fc.old === 'undefined' ? 0 : fc.old };
      }
    }
  }

  let memory = state.memory;
  for (let i = record.memoryWrites.length - 1; i >= 0; i--) {
    const mw = record.memoryWrites[i];
    if (mw) memory = writeByte(memory, mw.address, mw.oldByte).memory;
  }

  return {
    ...state,
    registers,
    flags,
    memory,
    halted: false,
    fault: undefined,
  };
}

/**
 * Reconstructs the exact CPU state at targetIndex by replaying deltas from baseState.
 */
export function reconstructState(history: ExecutionHistory, targetIndex: number): CpuState {
  if (targetIndex < 0) return history.baseState;
  const limit = Math.min(targetIndex, history.records.length - 1);
  let cur = history.baseState;
  for (let i = 0; i <= limit; i++) {
    const rec = history.records[i];
    if (rec) cur = applyForwardDelta(cur, rec);
  }
  return cur;
}

/**
 * Appends a step delta to history.
 */
export function pushRecord(
  history: ExecutionHistory,
  record: StepRecord
): ExecutionHistory {
  const truncatedPrefix =
    history.currentIndex < history.records.length - 1
      ? history.records.slice(0, history.currentIndex + 1)
      : history.records;

  const nextRecords = [...truncatedPrefix, record];
  const nextTotal = history.totalSteps + 1;

  if (nextRecords.length > history.maxCapacity) {
    const overflow = nextRecords.length - history.maxCapacity;
    let newBase = history.baseState;
    for (let i = 0; i < overflow; i++) {
      const r = nextRecords[i];
      if (r) newBase = applyForwardDelta(newBase, r);
    }
    const retained = nextRecords.slice(overflow);
    return {
      baseState: newBase,
      records: retained,
      currentIndex: retained.length - 1,
      totalSteps: nextTotal,
      truncated: true,
      maxCapacity: history.maxCapacity,
    };
  }

  return {
    baseState: history.baseState,
    records: nextRecords,
    currentIndex: nextRecords.length - 1,
    totalSteps: nextTotal,
    truncated: history.truncated,
    maxCapacity: history.maxCapacity,
  };
}

/**
 * Steps backward one instruction in execution history.
 */
export function stepBack(
  history: ExecutionHistory,
  currentState: CpuState
): { readonly history: ExecutionHistory; readonly state: CpuState } | null {
  if (history.currentIndex < 0) return null;
  const rec = history.records[history.currentIndex];
  if (!rec) return null;

  const prevState = applyReverseDelta(currentState, rec);
  const newHistory: ExecutionHistory = {
    ...history,
    currentIndex: history.currentIndex - 1,
  };
  return { history: newHistory, state: prevState };
}

/**
 * Steps forward one instruction in execution history.
 */
export function stepForward(
  history: ExecutionHistory,
  currentState: CpuState
): { readonly history: ExecutionHistory; readonly state: CpuState } | null {
  if (history.currentIndex >= history.records.length - 1) return null;
  const nextRecord = history.records[history.currentIndex + 1];
  if (!nextRecord) return null;

  const nextState = applyForwardDelta(currentState, nextRecord);
  const newHistory: ExecutionHistory = {
    ...history,
    currentIndex: history.currentIndex + 1,
  };
  return { history: newHistory, state: nextState };
}

/**
 * Navigates directly to any retained step index.
 */
export function goTo(
  history: ExecutionHistory,
  targetIndex: number
): { readonly history: ExecutionHistory; readonly state: CpuState } {
  const clamped = Math.max(-1, Math.min(targetIndex, history.records.length - 1));
  const state = reconstructState(history, clamped);
  return {
    history: { ...history, currentIndex: clamped },
    state,
  };
}

/**
 * Formats the last N steps in history as structured trace table rows.
 */
export function lastN(
  history: ExecutionHistory,
  n: number
): readonly TraceTableRow[] {
  const count = Math.max(0, Math.min(n, history.currentIndex + 1));
  const startIndex = history.currentIndex + 1 - count;
  const rows: TraceTableRow[] = [];

  for (let i = startIndex; i <= history.currentIndex; i++) {
    const rec = history.records[i];
    if (rec) {
      rows.push(formatTraceRow(rec, i + 1));
    }
  }

  return rows;
}
