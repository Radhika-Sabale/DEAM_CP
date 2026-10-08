/**
 * @file encoding.ts
 * Core bit-encoding, variable naming conventions, row-index mapping, and variable limits
 * for sequential state machine analysis and synthesis (Stage 10A).
 *
 * ============================================================================
 * LOCKED ARCHITECTURAL CONVENTIONS:
 * 1. State Variables:
 *    For n state bits, state variable names are strictly ["Q{n-1}", ..., "Q0"].
 *    Index 0 ("Q{n-1}") is ALWAYS the MOST SIGNIFICANT BIT (MSB).
 *    Index n-1 ("Q0") is the LEAST SIGNIFICANT BIT (LSB).
 *
 * 2. Input Variables:
 *    At most ONE external input variable is supported in Stage 10:
 *    - None: []
 *    - Counter Up-Down: ["DN"] (DN = 0 counts UP, DN = 1 counts DOWN)
 *    - Sequence Detector: ["IN"]
 *
 * 3. Output Variable:
 *    Output name for sequence detectors is "Z" (Mealy/Moore).
 *
 * 4. Function Variables Order:
 *    functionVariables(n, hasInput) = [...stateNames, ...inputNames].
 *    This order is the MSB-first variable ordering for every truth-table,
 *    K-map minterm index, and excitation column. State bits occupy the high
 *    weights (2^(n), 2^(n-1), ...), and the external input occupies weight 2^0.
 *
 * 5. Flip-Flop Pin Naming:
 *    For flip-flop bit index i:
 *    - SR: ["Si", "Ri"]
 *    - JK: ["Ji", "Ki"]
 *    - D:  ["Di"]
 *    - T:  ["Ti"]
 *
 * 6. Variable Count Limit:
 *    Total variables (stateBits + externalInputs) must satisfy:
 *    n + (hasInput ? 1 : 0) <= 5.
 * ============================================================================
 */

import type { FlipFlopType } from '../../types/sequential';
import { bitsToArray, arrayToBits, toBinaryString } from '../common/bitUtils';

/** Maximum variable count supported by the downstream K-map engine (5 variables). */
export const MAX_SEQUENTIAL_VARIABLES = 5;

/** Standard output variable name for sequential detector machines. */
export const OUTPUT_VARIABLE_NAME = 'Z';

/** Discriminated result for sequential variable limit verification. */
export type VariableLimitResult =
  | { readonly ok: true; readonly totalVariables: number }
  | { readonly ok: false; readonly code: 'too-many-variables'; readonly message: string };

/**
 * Calculates the minimum number of binary state bits required to represent
 * a given number of distinct states. Always returns at least 1.
 *
 * @param stateCount Total number of distinct states (e.g. 8 states -> 3 bits)
 * @returns Minimum bit width (at least 1)
 */
export function minStateBits(stateCount: number): number {
  if (typeof stateCount !== 'number' || !Number.isFinite(stateCount) || stateCount <= 1) {
    return 1;
  }
  const count = Math.floor(stateCount);
  return Math.max(1, Math.ceil(Math.log2(count)));
}

/**
 * Returns the ordered array of state variable names for n state bits,
 * ordered MSB-first: ["Q{n-1}", "Q{n-2}", ..., "Q0"].
 *
 * @param n Number of state bits (1..4)
 * @returns Ordered array of state variable identifiers
 */
export function stateVariableNames(n: number): readonly string[] {
  const count = Math.max(1, Math.floor(n));
  const names: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    names.push(`Q${i}`);
  }
  return names;
}

/**
 * Returns the external input variable names for a machine kind.
 *
 * @param kind Input category ('none', 'counter-up-down', or 'detector')
 * @returns Array with 0 or 1 variable name
 */
export function inputVariableNames(
  kind: 'none' | 'counter-up-down' | 'detector'
): readonly string[] {
  switch (kind) {
    case 'none':
      return [];
    case 'counter-up-down':
      return ['DN'];
    case 'detector':
      return ['IN'];
  }
}

/**
 * Returns the full ordered list of variables for truth-table and excitation columns.
 * Format: [...stateNames, ...inputNames] where state bit Q{n-1} is MSB and input is LSB.
 *
 * @param n Number of state bits
 * @param hasInput Whether an external input is present
 * @param inputKind Category of input variable (defaults to 'detector')
 * @returns Ordered variable names
 */
export function functionVariables(
  n: number,
  hasInput: boolean,
  inputKind: 'none' | 'counter-up-down' | 'detector' = 'detector'
): readonly string[] {
  const states = stateVariableNames(n);
  if (!hasInput || inputKind === 'none') {
    return states;
  }
  const inputs = inputVariableNames(inputKind);
  return [...states, ...inputs];
}

/**
 * Converts an integer state code into an MSB-first array of binary bits of length n.
 *
 * @param code Integer state code (0 to 2^n - 1)
 * @param n Bit width
 * @returns MSB-first array of 0 or 1 values
 */
export function codeToBits(code: number, n: number): readonly (0 | 1)[] {
  const width = Math.max(1, Math.floor(n));
  const cleanCode = Math.max(0, Math.floor(code));
  return bitsToArray(cleanCode, width);
}

/**
 * Converts an MSB-first array of binary bits to an unsigned integer code.
 *
 * @param bits MSB-first array of 0 or 1 values
 * @returns Unsigned integer code
 */
export function bitsToCode(bits: readonly (0 | 1)[]): number {
  return arrayToBits(bits);
}

/**
 * Formats an integer state code as a zero-padded binary string of fixed width n.
 *
 * @param code Integer state code (e.g. 5)
 * @param n Bit width (e.g. 3)
 * @returns Binary string (e.g. "101")
 */
export function formatCode(code: number, n: number): string {
  const width = Math.max(1, Math.floor(n));
  const cleanCode = Math.max(0, Math.floor(code));
  return toBinaryString(cleanCode, width);
}

/**
 * Returns the flip-flop input terminal names for a specific bit index.
 *
 * @param type Flip-flop architecture ('SR', 'JK', 'D', 'T')
 * @param bitIndex Integer index of the flip-flop (e.g. 1 -> J1, K1)
 * @returns Array of pin names (e.g. ['J1', 'K1'])
 */
export function flipFlopInputNames(type: FlipFlopType, bitIndex: number): readonly string[] {
  const idx = Math.max(0, Math.floor(bitIndex));
  switch (type) {
    case 'SR':
      return [`S${idx}`, `R${idx}`];
    case 'JK':
      return [`J${idx}`, `K${idx}`];
    case 'D':
      return [`D${idx}`];
    case 'T':
      return [`T${idx}`];
  }
}

/**
 * Maps a state code and optional external input value to a canonical row index.
 *
 * @param code Integer state code
 * @param inputValue External binary input value (0 or 1)
 * @param hasInput Whether the machine has an external input
 * @returns Truth-table row index
 */
export function rowIndex(code: number, inputValue: number, hasInput: boolean): number {
  const cleanCode = Math.max(0, Math.floor(code));
  if (!hasInput) {
    return cleanCode;
  }
  const cleanInput = (inputValue === 1 ? 1 : 0) as 0 | 1;
  return ((cleanCode << 1) | cleanInput) >>> 0;
}

/**
 * Inverse mapping of a canonical row index back to state code and input value.
 *
 * @param index Truth-table row index
 * @param hasInput Whether the machine has an external input
 * @returns Object with code and inputValue
 */
export function inverseRowIndex(
  index: number,
  hasInput: boolean
): { readonly code: number; readonly inputValue: number } {
  const cleanIndex = Math.max(0, Math.floor(index));
  if (!hasInput) {
    return { code: cleanIndex, inputValue: 0 };
  }
  return {
    code: cleanIndex >>> 1,
    inputValue: cleanIndex & 1,
  };
}

/**
 * Checks whether the total variable count fits within the K-map solver limit (<= 5).
 *
 * @param n Number of state bits
 * @param hasInput Whether an external input is present
 * @returns Discriminated result object
 */
export function checkVariableLimit(n: number, hasInput: boolean): VariableLimitResult {
  const total = n + (hasInput ? 1 : 0);
  if (total > MAX_SEQUENTIAL_VARIABLES) {
    return {
      ok: false,
      code: 'too-many-variables',
      message: 'The K-map solver handles at most 5 variables',
    };
  }
  return {
    ok: true,
    totalVariables: total,
  };
}
