/**
 * @file cpuTypes.ts
 * Architectural contracts and execution state definitions for the 8086 CPU core (Stage 14B).
 */

import type { Memory, MemoryWrite } from './memory';
import type { Registers } from './registers';
import type { Instruction, RegisterName } from './types';
import type {
  InterruptFaultType,
  InterruptRecord,
  InterruptScenario,
  IretRecord,
} from '../interrupts';

/**
 * 8086 Status flags modeled in the CPU core.
 */
export interface CpuFlags {
  /** Zero Flag: set if result is zero */
  readonly Z: 0 | 1;
  /** Carry / Borrow Flag: set if arithmetic carry or borrow occurred */
  readonly C: 0 | 1;
  /** Sign Flag: copy of the result's MSB */
  readonly S: 0 | 1;
  /** Overflow Flag: set on signed overflow; 'undefined' after multi-bit shift */
  readonly O: 0 | 1 | 'undefined';
  /** Interrupt Flag (Stage 15A interrupt enable) */
  readonly I: 0 | 1;
  /** Trap Flag (Stage 15A single-step trap) */
  readonly T: 0 | 1;
}

/**
 * Categorization of runtime execution faults.
 */
export type CpuFaultType =
  | 'branch-on-undefined-flag'
  | 'ip-out-of-program'
  | 'return-to-empty-stack'
  | 'stack-overflow'
  | 'invalid-register-operand'
  | 'invalid-shift-count'
  | InterruptFaultType;

/**
 * Structured diagnostic record emitted when execution encounters a fatal condition.
 */
export interface CpuFault {
  /** Fault category */
  readonly type: CpuFaultType;
  /** Instruction address (IP) at which the fault occurred */
  readonly address: number;
  /** Source line number in assembly program (-1 if out-of-program) */
  readonly sourceLine: number;
  /** Machine-readable message describing the fault */
  readonly message: string;
  /** One-line educational explanation for students */
  readonly explanation: string;
}

/**
 * Record of a register value modification.
 */
export interface RegisterChange {
  readonly name: RegisterName;
  readonly old: number;
  readonly new: number;
}

/**
 * Record of a status flag modification.
 */
export interface FlagChange {
  readonly name: 'Z' | 'C' | 'S' | 'O' | 'I' | 'T';
  readonly old: 0 | 1 | 'undefined';
  readonly new: 0 | 1 | 'undefined';
}

/**
 * Record of stack operation details.
 */
export interface StackChange {
  readonly type: 'push' | 'pop';
  readonly value: number;
  readonly spBefore: number;
  readonly spAfter: number;
}

/**
 * Complete immutable CPU state snapshot.
 */
export interface CpuState {
  readonly registers: Registers;
  readonly flags: CpuFlags;
  readonly memory: Memory;
  readonly halted: boolean;
  readonly initialSp: number;
  readonly lowWaterMark: number;
  readonly fault?: CpuFault;
  /** Cumulative executed/idle tick count (Stage 15A) */
  readonly ticks: number;
  /** Latched edge-triggered non-maskable interrupt line */
  readonly pendingNmi: boolean;
  /** Asserted level-triggered maskable interrupt line with device vector */
  readonly pendingIntr: { readonly vector: number } | null;
  /** Whether a single-step debug trap is pending after instruction completion */
  readonly singleStepPending: boolean;
  /** Single-instruction interrupt shadow following STI */
  readonly stiShadowActive: boolean;
  /** Trap Flag value sampled at start of instruction */
  readonly tfAtInstructionStart: 0 | 1;
}

/**
 * Detailed trace record emitted by single-step execution.
 */
export interface StepRecord {
  /** IP before instruction execution */
  readonly address: number;
  /** The instruction executed */
  readonly instruction: Instruction;
  /** Source code line number */
  readonly sourceLine: number;
  /** Registers modified during the step */
  readonly registersChanged: readonly RegisterChange[];
  /** Flags modified during the step */
  readonly flagsChanged: readonly FlagChange[];
  /** Memory writes performed during the step */
  readonly memoryWrites: readonly MemoryWrite[];
  /** Stack push/pop change if applicable */
  readonly stackChange?: StackChange;
  /** IP after instruction execution */
  readonly ipAfter: number;
  /** Runtime fault if one occurred */
  readonly fault?: CpuFault;
  /** Whether the CPU is halted */
  readonly halted: boolean;
  /** Instruction cycle count (fixed to 1; cycle counting is NOT modeled) */
  readonly cycles: 1;
  /** Audit record of entered interrupt (Stage 15A) */
  readonly interruptRecord?: InterruptRecord;
  /** Audit record of executed IRET instruction (Stage 15A) */
  readonly iretRecord?: IretRecord;
}

/**
 * Configuration options for initializing a new CPU state.
 */
export interface CpuOptions {
  /** Initial stack pointer (default: 0xFFFE) */
  readonly initialSp?: number;
  /** Stack low-water mark boundary (default: 0x0100, or 0x0400 if interrupts used) */
  readonly lowWaterMark?: number;
  /** Initial entry point address (default: program entryPoint or 0) */
  readonly entryPoint?: number;
  /** STI single-instruction interrupt shadow option (default: true) */
  readonly stiShadow?: boolean;
  /** Timed external hardware interrupt events */
  readonly scenario?: InterruptScenario;
}

/**
 * Result returned by the single-step execution function.
 */
export interface StepResult {
  readonly state: CpuState;
  readonly record: StepRecord;
}

/**
 * Output of instruction execution dispatcher.
 */
export interface InstructionOutcome {
  readonly nextRegisters: Registers;
  readonly nextFlags: CpuFlags;
  readonly nextMemory: Memory;
  readonly registersChanged: readonly RegisterChange[];
  readonly flagsChanged: readonly FlagChange[];
  readonly memoryWrites: readonly MemoryWrite[];
  readonly stackChange?: StackChange;
  readonly ipAfter: number;
  readonly halted: boolean;
  readonly fault?: CpuFault;
  readonly interruptRecord?: InterruptRecord;
  readonly iretRecord?: IretRecord;
  readonly nextStiShadowActive?: boolean;
}
