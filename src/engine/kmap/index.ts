/**
 * @file index.ts
 * Public entrypoint for the K-map engine (Stage 7A).
 *
 * Re-exports:
 * - K-map geometry, cell projections, adjacency, and visual rectangle decomposition.
 * - Tabular Quine-McCluskey prime implicant generation and step traces.
 * - Prime implicant chart construction and iterative reduction (essential PIs, dominance).
 * - Petrick's method with BigInt bitsets and intermediate term safety guards.
 * - Deterministic SOP and POS minimization with tie-breaking and self-verification.
 */

export {
  type Cube,
  type KMapPosition,
  type WrapEdge,
  type KMapOverlayRect,
  type AxisVariables,
  type CellsToCubeSuccess,
  type CellsToCubeFailure,
  type CellsToCubeResult,
  cellAt,
  positionOf,
  rowHeaderLabels,
  colHeaderLabels,
  axisVariables,
  neighbours,
  isAdjacent,
  cornerMinterms,
  cubeCells,
  cellsToCube,
  decomposeCubeToRectangles,
} from './layout';

export {
  type QmImplicant,
  type QmGroup,
  type QmColumn,
  type QmTrace,
  type QmResult,
  cubeToBinaryString,
  runQuineMcCluskey,
} from './quineMcCluskey';

export {
  type PrimeImplicant,
  type PiChart,
  type ReductionStep,
  type CyclicCore,
  type ChartReductionResult,
  cubeToProductString,
  cubeToSumString,
  extractPrimeImplicants,
  buildPiChart,
  reducePiChart,
} from './primeImplicants';

export {
  type PetrickExpansionStep,
  type PetrickSuccess,
  type PetrickTooComplex,
  type PetrickResult,
  solvePetrick,
  DEFAULT_MAX_INTERMEDIATE_TERMS,
} from './petrick';

export {
  type KMapInputError,
  type KMapGroup,
  type MinimalCover,
  type KMapSolution,
  type SolverResult,
} from './types';

export {
  solveSOP,
  solvePOS,
  solveFromTable,
  solveFromExpression,
  solveSOPVerified,
} from './solver';

export {
  type KMapMode,
  type GroupValidationContext,
  type GroupValidationErrorType,
  type GroupValidationFinding,
  type SingleGroupValidationResult,
  type GroupSetValidationResult,
  validateGroup,
  validateGroupSet,
  convertGroupsToExpression,
} from './groupValidator';

