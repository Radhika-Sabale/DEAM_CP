/**
 * @file sequentialValidator.ts
 * Deterministic pedagogical validator for sequential state tables, next-state / output equations,
 * and unused state lockout & deadlock claims (Stage 10C).
 *
 * Registers validators for step kinds:
 * - 'seq-state-table-cell'
 * - 'seq-equation'
 * - 'seq-lockout-claim'
 */

import { registerValidator } from '../validatorRegistry';
import { validateSeqEquation } from './sequentialValidatorEquation';
import { validateSeqLockoutClaim } from './sequentialValidatorLockout';
import { validateSeqStateTableCell } from './sequentialValidatorState';

export {
  generateSeqEquationHints,
  generateSeqLockoutHints,
  generateSeqTableCellHints,
} from './sequentialValidatorHints';

export {
  parseCodeOrValue,
  type SequentialValidationContext,
} from './sequentialValidatorTypes';

export { validateSeqStateTableCell } from './sequentialValidatorState';
export { validateSeqEquation } from './sequentialValidatorEquation';
export { validateSeqLockoutClaim } from './sequentialValidatorLockout';

// ── Auto-Registration ────────────────────────────────────────────────────────
try {
  registerValidator('seq-state-table-cell', validateSeqStateTableCell);
} catch {
  // Ignore duplicate registration
}
try {
  registerValidator('seq-equation', validateSeqEquation);
} catch {
  // Ignore duplicate registration
}
try {
  registerValidator('seq-lockout-claim', validateSeqLockoutClaim);
} catch {
  // Ignore duplicate registration
}
