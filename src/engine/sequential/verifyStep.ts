/**
 * @file verifyStep.ts
 * Pure, deterministic pedagogical comparators for student step submissions in the
 * Sequential Circuit Designer module (Stage 10C).
 *
 * Implements granular step verification for:
 * - State transition tables (per-cell next state and outputs, ignoring unused states)
 * - State transition diagrams (via lossless table conversion)
 * - Flip-flop excitation tables (distinguishing care errors from acceptable don't-cares)
 * - Next-state / output Boolean equations (parse check, variable scoping, care-row validation, optimality)
 * - Unused state lockout and deadlock claims
 * - Combinational schematic netlists against reference excitation matrices
 */

export type {
  CircuitVerificationResult,
  EquationVerificationResult,
  LockoutClaimVerificationResult,
  StepItemResult,
  StepStatus,
  StepVerificationResult,
  StepVerificationSummary,
} from './verifyStepTypes';

export { verifyCircuit } from './verifyStepCircuit';
export { verifyEquation } from './verifyStepEquation';
export { verifyExcitationTable } from './verifyStepExcitation';
export { verifyLockoutClaim } from './verifyStepLockout';
export { verifyDiagram, verifyStateTable } from './verifyStepTable';
