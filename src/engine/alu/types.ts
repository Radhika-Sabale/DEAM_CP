/**
 * @file types.ts
 * Domain contracts, types, and discriminated unions for the Arithmetic Logic Unit (ALU) Engine.
 *
 * Supported widths: 4-bit and 8-bit standard slices (accepts any integer width from 2 to 16).
 * Subtraction carry/borrow convention: CF = 1 means BORROW on subtraction (8086 convention).
 */

import type { AluOpId } from '../../types/designProject';

/**
 * Standard ALU operation code, aliased to master AluOpId union.
 */
export type AluOp = AluOpId;

/**
 * Shift and rotate operation identifiers.
 */
export type ShiftKind = 'SHL' | 'SHR' | 'SAR' | 'ROL' | 'ROR';

/**
 * Supported bit-width. Primary standard widths are 4 and 8 bits;
 * any integer width from 2 to 16 is supported by the engine.
 */
export type AluWidth = number;

/**
 * Standard binary flag logic value (0 or 1).
 */
export type FlagValue = 0 | 1;

/**
 * Overflow flag value. Shifts/rotates with count > 1 report 'undefined' per 8086 specification.
 */
export type OverflowFlagValue = FlagValue | 'undefined';

/**
 * Four-flag status record computed by the ALU datapath.
 */
export interface AluFlags {
  /** Zero flag: 1 if arithmetic/logic result is all zeros */
  readonly Z: FlagValue;
  /** Carry/borrow flag: 1 if carry out on add or borrow on sub */
  readonly C: FlagValue;
  /** Sign flag: MSB of the result */
  readonly S: FlagValue;
  /** Signed overflow flag: 1 if signed overflow occurred, or 'undefined' for shifts count > 1 */
  readonly O: OverflowFlagValue;
}

/**
 * Structured explanation of an individual flag valuation.
 */
export interface FlagExplanation {
  /** Flag identifier */
  readonly flag: 'Z' | 'C' | 'S' | 'O';
  /** Flag result value */
  readonly value: OverflowFlagValue;
  /** Canonical rule identifier */
  readonly rule: string;
  /** Human-readable explanation */
  readonly description: string;
  /** Machine-readable facts triggering the rule */
  readonly facts: Readonly<Record<string, string | number | boolean>>;
}

/**
 * Context payload passed to flag explanation generators.
 */
export interface FlagExplanationContext {
  readonly op: AluOp;
  readonly width: number;
  readonly a: number;
  readonly b: number;
  readonly result: number;
  readonly carryOut?: FlagValue;
  readonly carryInMsb?: FlagValue;
  readonly hardwareCarryOut?: FlagValue;
  readonly shiftCount?: number;
  readonly previousC?: FlagValue;
}

/**
 * Gate-level execution step recorded in the ripple-carry chain.
 */
export interface GateTraceStep {
  readonly id: string;
  readonly gate: 'XOR' | 'AND' | 'OR' | 'NOT';
  readonly inputs: readonly { readonly name: string; readonly value: 0 | 1 }[];
  readonly output: { readonly name: string; readonly value: 0 | 1 };
}

/**
 * Summary record for a single bit-position inside the ripple-carry adder/subtractor.
 */
export interface CarryChainBit {
  readonly bitIndex: number;
  readonly a: 0 | 1;
  readonly b: 0 | 1;
  readonly carryIn: 0 | 1;
  readonly sum: 0 | 1;
  readonly carryOut: 0 | 1;
  readonly role: 'generate' | 'propagate' | 'kill';
}

/**
 * Full structural and gate-trace model of a ripple-carry adder/subtractor datapath.
 */
export interface CarryChainModel {
  readonly bits: readonly CarryChainBit[];
  readonly gates: readonly GateTraceStep[];
  readonly carryVector: readonly (0 | 1)[];
  readonly sumBits: readonly (0 | 1)[];
  readonly delayLevels: number;
}

/**
 * Inconsistency diagnostic emitted if a gate trace verification fails.
 */
export interface ChainVerificationFailure {
  readonly valid: false;
  readonly failedGateId: string;
  readonly expected: 0 | 1;
  readonly actual: 0 | 1;
  readonly message: string;
}

/**
 * Result of validating a carry chain gate trace.
 */
export type ChainVerificationResult = { readonly valid: true } | ChainVerificationFailure;

/**
 * Optional execution flags and parameters for the ALU engine.
 */
export interface AluExecuteOptions {
  /** Preserved carry value for INC and DEC operations (defaults to 0) */
  readonly previousC?: FlagValue;
  /** Shift/rotate bit count (defaults to 1; must be 1..width) */
  readonly shiftCount?: number;
}

/**
 * Standard Jcc condition relations derived from flags (A relative to B).
 */
export interface AluComparisonRelations {
  readonly equal: boolean;
  readonly notEqual: boolean;
  readonly below: boolean;
  readonly belowOrEqual: boolean;
  readonly above: boolean;
  readonly aboveOrEqual: boolean;
  readonly less: boolean;
  readonly lessOrEqual: boolean;
  readonly greater: boolean;
  readonly greaterOrEqual: boolean;
}

/**
 * Structured pedagogical step trace for display.
 */
export interface AluStepTrace {
  readonly aBits: string;
  readonly bBits: string;
  readonly intermediateValues: Readonly<Record<string, string | number>>;
  readonly notes: readonly string[];
}

/**
 * Successful result of executing an ALU operation.
 */
export interface AluSuccess {
  readonly ok: true;
  readonly op: AluOp;
  readonly width: number;
  readonly a: number;
  readonly b: number;
  readonly aBits: string;
  readonly bBits: string;
  readonly result: {
    readonly unsigned: number;
    readonly signed: number;
    readonly bits: string;
    readonly isDiscarded: boolean;
  };
  readonly flags: AluFlags;
  readonly flagExplanations: readonly FlagExplanation[];
  readonly gateTrace?: readonly GateTraceStep[];
  readonly carryChain?: CarryChainModel;
  readonly borrowConvention: 'cf-is-borrow';
  readonly trace: AluStepTrace;
  readonly notes: readonly string[];
}

/**
 * Error codes emitted when invalid inputs are provided to the ALU.
 */
export type AluErrorCode =
  | 'INVALID_WIDTH'
  | 'OPERAND_OUT_OF_RANGE'
  | 'UNKNOWN_OP'
  | 'INVALID_SHIFT_COUNT';

/**
 * Discriminated failure result when user inputs are invalid.
 */
export interface AluError {
  readonly ok: false;
  readonly error: {
    readonly code: AluErrorCode;
    readonly message: string;
  };
}

/**
 * Discriminated result type returned by ALU execution.
 */
export type AluResult = AluSuccess | AluError;
