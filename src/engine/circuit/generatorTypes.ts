/**
 * @file generatorTypes.ts
 * Types and interfaces for the expression-to-circuit synthesis generator.
 */

import type { BoolNode } from '../../types/ast';
import type { CircuitGraph } from '../../types/circuit';

/**
 * Schematic synthesis style options.
 */
export type GeneratorStyle =
  | 'direct'
  | 'sop-and-or'
  | 'pos-or-and'
  | 'nand-only'
  | 'nor-only';

/**
 * Request payload for expression-to-circuit generation.
 */
export interface GenerateCircuitRequest {
  /** Complete list of circuit input variables (ordered, all instantiated as input nodes) */
  readonly variables: readonly string[];
  /** Named output expressions to synthesize */
  readonly outputs: readonly {
    readonly name: string;
    readonly expr: BoolNode;
  }[];
  /** Target architectural gate style (default: 'direct') */
  readonly style?: GeneratorStyle;
  /** Maximum gate input fan-in (2..8, default: 4) */
  readonly maxFanIn?: number;
  /** Whether to share single-variable inverters across the design (default: true) */
  readonly shareInverters?: boolean;
  /** Whether to share common subexpressions via structural canonical keys (default: true) */
  readonly shareSubexpressions?: boolean;
}

/**
 * Successful synthesis result.
 */
export interface GenerateCircuitResult {
  readonly ok: true;
  readonly graph: CircuitGraph;
  readonly gateCount: number;
  readonly styleApplied: GeneratorStyle;
  readonly notes: readonly string[];
}

/**
 * Generation failure with structured error code and message.
 */
export interface GenerateCircuitError {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

/**
 * Union response type for circuit generation.
 */
export type GenerateCircuitResponse = GenerateCircuitResult | GenerateCircuitError;
