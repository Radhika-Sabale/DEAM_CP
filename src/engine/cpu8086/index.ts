/**
 * @file index.ts
 * Public API for Stage 14A (Assembler & ISA), Stage 14B (CPU Core), and Stage 14C (Run Control, History, ALU Generator).
 */

// Stage 14A: Assembler and ISA metadata
export * from './types';
export * from './isa';
export { assemble } from './assembler';
export { disassemble } from './disassembler';
export { parse8086Number } from './numberParser';

// Stage 14B: 8086 CPU Core Engine
export * from './cpuTypes';
export {
  createRegisters,
  getReg,
  setReg,
  is8BitRegister,
  is16BitRegister,
  type Registers,
  type RegisterOptions,
} from './registers';
export {
  createMemory,
  readByte,
  readWord,
  writeByte,
  writeWord,
  loadImage,
  toSparseRanges,
  toSparseJson,
  fromSparseJson,
  type Memory,
  type MemoryWrite,
  type ByteWriteResult,
  type WordWriteResult,
  type SparseMemoryRange,
} from './memory';
export {
  evaluateCondition,
  type ConditionFlags,
  type ConditionResult,
} from './conditions';
export {
  computeEffectiveAddress,
  executeInstruction,
} from './instructions';
export {
  createCpuState,
  step,
} from './cpu';

// Stage 14C: Run Control, Breakpoints, History, ALU Handoff Generator
export {
  stepOnce,
  stepOver,
  stepOut,
  runUntil,
  runToHalt,
  resolveBreakpointAddresses,
  DEFAULT_STEP_CAP,
  type RunOptions,
  type RunResult,
  type StopReason,
  type Watchpoint,
} from './runner';
export {
  createHistory,
  applyForwardDelta,
  applyReverseDelta,
  DEFAULT_MAX_HISTORY,
  type ExecutionHistory,
  type TraceTableRow,
} from './history';
export {
  programFromAluOperation,
  type AluTo8086Result,
  type AluOperationSpec,
  type ExpectedProgramState,
} from './aluProgram';
