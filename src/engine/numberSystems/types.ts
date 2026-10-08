/**
 * @file types.ts
 * Engine-local types for the Number Systems educational engine.
 *
 * Covers radix conversion, fixed-width complement representations,
 * BCD codes and addition, binary arithmetic with carry chains, and
 * machine-checkable step records for teaching and student validation.
 */

/**
 * Standard error structure for user/student input errors.
 * Includes optional zero-based index pointing to the invalid character/nibble.
 */
export interface NumberSystemError {
  readonly message: string;
  readonly position?: number;
}

/**
 * Discriminated result union for all user-facing number system operations.
 * Programmer errors (invalid function arguments) throw exceptions;
 * user errors return `{ ok: false, error: ... }`.
 */
export type NumberSystemResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: NumberSystemError };

/**
 * Machine-checkable step record for multi-step algorithmic operations.
 * Enables the UI to render intermediate states and Stage 6 Feedback Engine
 * to validate individual student calculation steps.
 */
export interface StepRecord<TInputs = Record<string, unknown>, TOutput = unknown> {
  readonly kind: string;
  readonly description: string;
  readonly inputs: TInputs;
  readonly output: TOutput;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Supported standard radixes, plus arbitrary bases 2 through 36. */
export type StandardRadix = 2 | 8 | 10 | 16;
export type Radix = number;

/** Formatting options for radix output strings. */
export interface FormatNumberOptions {
  readonly uppercase?: boolean;
  readonly prefix?: boolean;
  readonly groupWidth?: number;
  readonly groupSeparator?: string;
}

/** Configuration options for radix conversion. */
export interface ConvertRadixOptions {
  /** Maximum number of fractional digits to generate (default: 8). */
  readonly precision?: number;
}

/** Complete result of a radix conversion. */
export interface RadixConversionResult {
  readonly integerResult: string;
  readonly fractionalResult?: string;
  readonly fullResult: string;
  readonly isExact: boolean;
  readonly isRepeating?: boolean;
  readonly repeatingCycle?: string;
  readonly isNegative: boolean;
  readonly steps: readonly StepRecord[];
}

/** Supported fixed-width signed and unsigned bit representations. */
export type Representation =
  | 'unsigned'
  | 'sign-magnitude'
  | 'ones-complement'
  | 'twos-complement';

/** Value range for a given bit width and representation. */
export interface RepresentationRange {
  readonly min: number;
  readonly max: number;
}

/** Side-by-side interpretation of a bit pattern across all representations. */
export interface BitInterpretation {
  readonly bits: string;
  readonly width: number;
  readonly unsigned: number;
  readonly signMagnitude: number;
  readonly onesComplement: number;
  readonly twosComplement: number;
}

/** Supported Binary Coded Decimal (BCD) coding systems. */
export type BCDCode = '8421' | 'excess-3' | '2421' | '84-2-1';

/** Packaging format for BCD nibbles. */
export type BCDFormat = 'packed' | 'unpacked';

/** Result of converting decimal to BCD. */
export interface BcdConversionResult {
  readonly bits: string;
  readonly nibbles: readonly string[];
  readonly code: BCDCode;
  readonly format: BCDFormat;
  readonly steps: readonly StepRecord[];
}

/** Result of converting BCD to decimal string. */
export interface BcdToDecimalResult {
  readonly decimal: string;
  readonly digits: readonly number[];
  readonly steps: readonly StepRecord[];
}

/** Result of BCD addition on packed 8421 nibbles. */
export interface BcdAddResult {
  readonly sumDigits: string;
  readonly bcdBits: string;
  readonly carryOut: 0 | 1;
  readonly steps: readonly StepRecord[];
}

/**
 * Convention for the carry flag (CF) on binary subtraction:
 * - 'borrow_is_cf': 8086 convention where CF = 1 indicates a borrow occurred (CF = 1 - Cout).
 * - 'no_borrow_is_cf': ARM / 6502 convention where CF = 1 indicates no borrow (CF = Cout).
 */
export type BorrowConvention = 'borrow_is_cf' | 'no_borrow_is_cf';

/** Status flags produced by arithmetic operations. */
export interface ArithmeticFlags {
  /** Carry flag according to chosen convention. */
  readonly C: 0 | 1;
  /** Explicit borrow flag (1 if borrow occurred, 0 otherwise). */
  readonly borrow: 0 | 1;
  /** Negative flag: copy of the MSB of the result. */
  readonly N: 0 | 1;
  /** Zero flag: 1 if all result bits are 0, 0 otherwise. */
  readonly Z: 0 | 1;
  /** Signed overflow flag: 1 if operation overflowed in two's complement. */
  readonly V: 0 | 1;
}

/** Single column addition/subtraction step in a carry chain. */
export interface BitCarryStep {
  readonly position: number;
  readonly carryIn: 0 | 1;
  readonly a: 0 | 1;
  readonly b: 0 | 1;
  readonly sum: 0 | 1;
  readonly carryOut: 0 | 1;
}

/** Output of binary addition or subtraction. */
export interface BinaryArithmeticResult {
  readonly resultBits: string;
  readonly unsignedValue: number;
  readonly signedValue: number;
  readonly carryChain: readonly BitCarryStep[];
  readonly flags: ArithmeticFlags;
  readonly steps: readonly StepRecord[];
  readonly overflowExplanation?: string;
}

/** Result of one's complement addition with end-around carry. */
export interface OnesComplementAddResult {
  readonly initialSumBits: string;
  readonly endAroundCarry: 0 | 1;
  readonly finalBits: string;
  readonly finalValue: number;
  readonly steps: readonly StepRecord[];
}

/** Result of sign-magnitude addition. */
export interface SignMagnitudeAddResult {
  readonly signA: 0 | 1;
  readonly magA: number;
  readonly signB: 0 | 1;
  readonly magB: number;
  readonly resultSign: 0 | 1;
  readonly resultMag: number;
  readonly resultBits: string;
  readonly overflow: boolean;
  readonly steps: readonly StepRecord[];
}
