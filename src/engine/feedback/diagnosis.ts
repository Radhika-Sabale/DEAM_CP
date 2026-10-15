/**
 * @file diagnosis.ts
 * Assembles rich pedagogical Diagnosis objects from validation outcomes,
 * maps misconception catalog hints, and provides deterministic error prioritization.
 *
 * ERROR PRIORITY ORDER (DETERMINISTIC RANKING):
 * When multiple diagnostic discrepancies occur across steps or within an attempt,
 * they are ordered by:
 * 1. Step order (earliest chronological step index first).
 * 2. Fundamental error category priority:
 *    - syntax-error (Rank 1: prevents symbolic interpretation entirely)
 *    - misconception (Rank 2: flawed conceptual mental model)
 *    - invalid-law-application (Rank 3: deductive misattribution)
 *    - arithmetic-error (Rank 4: arithmetic or bit calculation slip)
 *    - parity-error / suboptimal-group / uncovered-minterm (Rank 5)
 * 3. Misconception tag alphabetical tie-breaker (ensures 100% deterministic output).
 */

import type {
  Diagnosis,
  ErrorType,
  ExpectedAnswer,
  GotAnswer,
} from '../../types/feedback';
import { getMisconception } from './misconceptions';
import type { DiagnosisContext, StepContext, ValidationOutcome } from './types';

/**
 * Priority rank mapping for deterministic error sorting.
 */
const ERROR_TYPE_PRIORITY: Record<ErrorType, number> = {
  'syntax-error': 1,
  'misconception': 2,
  'invalid-law-application': 3,
  'arithmetic-error': 4,
  'invalid-group': 5,
  'suboptimal-group': 5,
  'uncovered-minterm': 5,
  'incorrect-excitation': 5,
  'incorrect-transition': 5,
  'parity-error': 5,
};

/**
 * Builds a complete Diagnosis record from a validation failure outcome.
 *
 * @param outcome The validation failure outcome
 * @param stepId Identifier of the step under evaluation
 * @param context Contextual problem metadata
 */
export function buildDiagnosis(
  outcome: Extract<ValidationOutcome, { correct: false }>,
  stepId: string,
  context?: StepContext
): Diagnosis {
  const expectedStr = stringifyExpected(outcome.expected);
  const gotStr = stringifyGot(outcome.got);

  const diagCtx: DiagnosisContext = {
    expected: expectedStr,
    got: gotStr,
    target: context?.claimedLaw,
    detail: outcome.details,
  };

  let hint = 'Review your current step calculation carefully.';
  let explanation = outcome.details || `Expected "${expectedStr}", but received "${gotStr}".`;

  if (outcome.misconceptionTag) {
    try {
      const entry = getMisconception(outcome.misconceptionTag);
      hint = entry.hints.level1(diagCtx);
      explanation = `${entry.description} ${outcome.details ?? ''}`.trim();
    } catch {
      // If tag is not in catalog, fallback gracefully
      hint = outcome.details || `Check your step against expected value: ${expectedStr}`;
    }
  }

  return {
    step: stepId,
    errorType: outcome.errorType,
    expected: outcome.expected,
    got: outcome.got,
    misconceptionTag: outcome.misconceptionTag,
    hint,
    fullExplanation: explanation,
  };
}

/**
 * Deterministically compares two Diagnosis records by earliest step,
 * then fundamental error severity, then misconception tag.
 */
export function compareDiagnoses(a: Diagnosis, b: Diagnosis): number {
  // 1. Earliest step first
  const stepCmp = a.step.localeCompare(b.step, undefined, { numeric: true });
  if (stepCmp !== 0) return stepCmp;

  // 2. Fundamental error category priority
  const rankA = ERROR_TYPE_PRIORITY[a.errorType] ?? 99;
  const rankB = ERROR_TYPE_PRIORITY[b.errorType] ?? 99;
  if (rankA !== rankB) return rankA - rankB;

  // 3. Misconception tag tie-breaker
  const tagA = a.misconceptionTag ?? '';
  const tagB = b.misconceptionTag ?? '';
  return tagA.localeCompare(tagB);
}

/**
 * Extracts a concise string representation of an ExpectedAnswer.
 */
export function stringifyExpected(expected: ExpectedAnswer): string {
  switch (expected.kind) {
    case 'number-conversion-step':
      return expected.targetValue;
    case 'boolean-step':
      return expected.validExpressions.length > 0
        ? expected.validExpressions.join(' or ')
        : expected.validLaws.join(', ');
    case 'kmap-group':
      return expected.minimalExpression;
    case 'kmap-group-set':
      return expected.minimalExpression;
    case 'excitation-entry':
      return JSON.stringify(expected.inputValues);
    case 'state-table-row':
      return expected.nextState;
    case 'alu-result':
      return String(expected.expectedValue);
    case 'alu-flag':
      return `${expected.flag} = ${expected.expectedValue}`;
    case 'alu-chain-bit':
      return `bit ${expected.bitIndex}: Cin=${expected.expectedCarryIn}, S=${expected.expectedSumBit}, Cout=${expected.expectedCarryOut}`;
    case 'alu-compare':
      return `${expected.relation}: ${expected.expectedAnswer}`;
    case 'cpu-register':
      return `${expected.register} = 0x${expected.expectedValue.toString(16).toUpperCase()}`;
    case 'cpu-flag':
      return `${expected.flag} = ${expected.expectedValue}`;
    case 'cpu-memory':
      return `[0x${expected.address.toString(16).toUpperCase().padStart(4, '0')}] = 0x${expected.expectedValue.toString(16).toUpperCase()}`;
    case 'cpu-stack':
      return `SP=0x${expected.expectedSp.toString(16).toUpperCase().padStart(4, '0')}, addr=0x${expected.expectedAddress.toString(16).toUpperCase().padStart(4, '0')}, val=0x${expected.expectedValue.toString(16).toUpperCase()}`;
    case 'cpu-next-ip':
      return `IP = 0x${expected.expectedIp.toString(16).toUpperCase().padStart(4, '0')}`;
    default:
      return '';
  }
}

/**
 * Extracts a concise string representation of a GotAnswer.
 */
export function stringifyGot(got: GotAnswer): string {
  switch (got.kind) {
    case 'number-conversion-step':
      return got.studentValue;
    case 'boolean-step':
      return got.studentExpression || got.studentLaw;
    case 'kmap-group':
      return got.studentExpression;
    case 'kmap-group-set':
      return (
        got.studentExpression ||
        got.studentGroups.map((g) => `(${g.join(',')})`).join(' + ')
      );
    case 'excitation-entry':
      return JSON.stringify(got.inputValues);
    case 'state-table-row':
      return got.nextState;
    case 'alu-result':
      return String(got.studentValue);
    case 'alu-flag':
      return `${got.flag} = ${got.studentValue}`;
    case 'alu-chain-bit':
      return `bit ${got.bitIndex}: Cin=${got.studentCarryIn}, S=${got.studentSumBit}, Cout=${got.studentCarryOut}`;
    case 'alu-compare':
      return `${got.relation}: ${got.studentAnswer}`;
    case 'cpu-register':
      return `${got.register} = 0x${got.studentValue.toString(16).toUpperCase()}`;
    case 'cpu-flag':
      return `${got.flag} = ${got.studentValue}`;
    case 'cpu-memory':
      return `[0x${got.address.toString(16).toUpperCase().padStart(4, '0')}] = 0x${got.studentValue.toString(16).toUpperCase()}`;
    case 'cpu-stack':
      return `SP=0x${got.studentSp.toString(16).toUpperCase().padStart(4, '0')}, addr=0x${got.studentAddress.toString(16).toUpperCase().padStart(4, '0')}, val=0x${got.studentValue.toString(16).toUpperCase()}`;
    case 'cpu-next-ip':
      return `IP = 0x${got.studentNextIp.toString(16).toUpperCase().padStart(4, '0')}`;
    default:
      return '';
  }
}
