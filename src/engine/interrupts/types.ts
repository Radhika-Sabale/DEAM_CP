/**
 * @file types.ts
 * Core types and data contracts for the 8086 Interrupt Engine (Stage 15A).
 *
 * DESIGN DECISIONS:
 * 1. Teaching model: Flat 64 KB memory with IVT at 0x0000-0x03FF (256 vectors x 4 bytes).
 * 2. Interrupt entry: 5-step micro-sequence: push FLAGS, clear IF/TF, push CS, push IP, load vector.
 * 3. IRET pops IP, CS (must be 0), FLAGS (restoring CF, ZF, SF, OF, IF, TF).
 * 4. Micro-steps provide ordered data for UI step animation.
 */

/** Category of interrupt triggering execution */
export type InterruptKind = 'nmi' | 'intr' | 'single-step' | 'software';

/** Specific hardware/software source initiating the interrupt */
export type InterruptSource =
  | 'hardware-nmi'
  | 'hardware-intr'
  | 'single-step-trap'
  | 'software-int';

/** Micro-step sequence phase in 8086 interrupt entry */
export type InterruptMicroStepKind =
  | 'push-flags'
  | 'clear-if-tf'
  | 'push-cs'
  | 'push-ip'
  | 'read-vector';

/** Structured record of register changes within a micro-step */
export interface MicroStepRegisterChange {
  readonly name: string;
  readonly old: number;
  readonly new: number;
}

/** Structured record of flag modifications within a micro-step */
export interface MicroStepFlagChange {
  readonly name: 'Z' | 'C' | 'S' | 'O' | 'I' | 'T';
  readonly old: 0 | 1 | 'undefined';
  readonly new: 0 | 1 | 'undefined';
}

/** Structured record of memory byte writes within a micro-step */
export interface MicroStepMemoryWrite {
  readonly address: number;
  readonly oldByte: number;
  readonly newByte: number;
}

/** Detailed micro-step representation for pedagogical inspection and UI animation */
export interface InterruptMicroStep {
  readonly stepNumber: number;
  readonly kind: InterruptMicroStepKind;
  readonly description: string;
  readonly registersChanged: readonly MicroStepRegisterChange[];
  readonly flagsChanged: readonly MicroStepFlagChange[];
  readonly memoryWrites: readonly MicroStepMemoryWrite[];
}

/** Complete audit record of an entered interrupt */
export interface InterruptRecord {
  readonly kind: InterruptKind;
  readonly vector: number;
  readonly source: InterruptSource;
  readonly flagsBefore: number;
  readonly flagsAfter: number;
  readonly returnIp: number;
  readonly returnCs: number;
  readonly vectorAddress: number;
  readonly handlerIp: number;
  readonly microSteps: readonly InterruptMicroStep[];
}

/** Audit record of an IRET instruction execution */
export interface IretRecord {
  readonly poppedIp: number;
  readonly poppedCs: number;
  readonly poppedFlags: number;
  readonly flagsRestored: {
    readonly Z: 0 | 1;
    readonly C: 0 | 1;
    readonly S: 0 | 1;
    readonly O: 0 | 1 | 'undefined';
    readonly I: 0 | 1;
    readonly T: 0 | 1;
  };
}

/** Status of pending hardware interrupt lines */
export interface PendingInterruptState {
  readonly nmi: boolean;
  readonly intr: { readonly vector: number } | null;
}

/** Discrete external interrupt event scheduled at a given CPU tick */
export interface InterruptEvent {
  readonly atTick: number;
  readonly kind: 'nmi' | 'intr';
  readonly vector?: number;
}

/** Time-ordered collection of scheduled external interrupt events */
export interface InterruptScenario {
  readonly events: readonly InterruptEvent[];
}

/** Error codes for scenario validation */
export type ScenarioErrorCode =
  | 'too-many-events'
  | 'tick-out-of-range'
  | 'intr-missing-vector'
  | 'intr-invalid-vector'
  | 'nmi-has-vector';

/** Result of validating an InterruptScenario */
export type ScenarioValidationResult =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly code: ScenarioErrorCode;
      readonly message: string;
      readonly eventIndex?: number;
    };

/** Runtime execution faults specific to the interrupt subsystem */
export type InterruptFaultType =
  | 'unset-vector'
  | 'invalid-vector-target'
  | 'corrupted-interrupt-frame'
  | 'iret-on-empty-stack';
