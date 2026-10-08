/**
 * @file types.ts
 * Core types and interfaces for the K-map solver and visualization overlays.
 */

import type { BoolNode } from '../../types/ast';
import type { Cube, KMapOverlayRect } from './layout';
import type { QmTrace } from './quineMcCluskey';
import type { CyclicCore, PrimeImplicant, ReductionStep } from './primeImplicants';
import type { PetrickExpansionStep } from './petrick';

/**
 * Discriminated user input error for invalid variable counts, out-of-range cells,
 * or overlapping minterm and don't-care specifications.
 */
export interface KMapInputError {
  readonly code: 'INVALID_VARIABLE_COUNT' | 'OUT_OF_RANGE' | 'OVERLAPPING_DONT_CARES';
  readonly message: string;
}

/**
 * Visual group representing an implicant drawn on the K-map grid,
 * with wrapped rectangle pieces for toroidal border rendering.
 */
export interface KMapGroup {
  readonly cube: Cube;
  readonly termString: string;
  readonly cellIndices: readonly number[];
  readonly rectangles: readonly KMapOverlayRect[];
}

/**
 * A minimal sum-of-products or product-of-sums cover of prime implicants.
 */
export interface MinimalCover {
  readonly primeImplicants: readonly PrimeImplicant[];
  readonly termCount: number;
  readonly literalCount: number;
  readonly expressionString: string;
}

/**
 * Comprehensive solution returned by the K-map minimization engine.
 */
export interface KMapSolution {
  readonly form: 'SOP' | 'POS';
  readonly variableCount: number;
  readonly variableNames: readonly string[];
  readonly minterms: readonly number[];
  readonly dontCares: readonly number[];
  readonly primeImplicants: readonly PrimeImplicant[];
  readonly essentialPrimeImplicants: readonly PrimeImplicant[];
  readonly qmTrace: QmTrace;
  readonly reductionSteps: readonly ReductionStep[];
  readonly petrickSteps: readonly PetrickExpansionStep[];
  readonly cyclicCore: CyclicCore | null;
  readonly allMinimalCovers: readonly MinimalCover[];
  readonly primarySolution: MinimalCover;
  readonly expression: BoolNode;
  readonly expressionString: string;
  readonly groups: readonly KMapGroup[];
}

/**
 * Discriminated result returned by K-map solvers.
 */
export type SolverResult =
  | { readonly ok: true; readonly solution: KMapSolution }
  | { readonly ok: false; readonly error: KMapInputError };
