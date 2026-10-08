/**
 * @file verifyStepTypes.ts
 * Types and interfaces for sequential step verification (Stage 10C).
 */

import type { LogicValue } from '../../types/ast';

/** Verification status for individual table cells or claims. */
export type StepStatus = 'correct' | 'incorrect' | 'dont-care-ok' | 'missing';

/** Granular result for an individual evaluated item. */
export interface StepItemResult {
  readonly id: string;
  readonly status: StepStatus;
  readonly expected?: string | number | LogicValue;
  readonly got?: string | number | LogicValue;
  readonly message?: string;
}

/** Quantitative summary metrics for a verified step submission. */
export interface StepVerificationSummary {
  readonly allCorrect: boolean;
  readonly correctCount: number;
  readonly total: number;
}

/** Full result object emitted by table and diagram step validators. */
export interface StepVerificationResult {
  readonly items: readonly StepItemResult[];
  readonly summary: StepVerificationSummary;
}

/** Detailed result for equation step verification. */
export interface EquationVerificationResult {
  readonly correct: boolean;
  readonly isMinimal: boolean;
  readonly cost: { readonly terms: number; readonly literals: number };
  readonly solverCost: { readonly terms: number; readonly literals: number };
  readonly mismatchRows: readonly number[];
  readonly unknownVariables: readonly string[];
  readonly parseError?: string;
  readonly message?: string;
}

/** Granular result for lockout claim verification. */
export interface LockoutClaimVerificationResult {
  readonly correct: boolean;
  readonly missing: readonly number[];
  readonly extra: readonly number[];
  readonly items: readonly StepItemResult[];
  readonly summary: StepVerificationSummary;
}

/** Result for netlist circuit schematic verification. */
export interface CircuitVerificationResult {
  readonly correct: boolean;
  readonly missingInputs: readonly string[];
  readonly missingOutputs: readonly string[];
  readonly mismatches: readonly {
    readonly output: string;
    readonly row: number;
    readonly expected: LogicValue;
    readonly got: LogicValue;
  }[];
  readonly message?: string;
}
