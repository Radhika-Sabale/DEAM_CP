/**
 * @file sequentialValidatorEquation.ts
 * Validator handler for next-state and excitation Boolean equations.
 */

import type { ExpectedAnswer, GotAnswer, StepSubmission } from '../../../types/feedback';
import { designSequential } from '../../sequential/counterDesigner';
import { verifyEquation } from '../../sequential/verifyStep';
import type { StepContext, ValidationOutcome } from '../types';
import type { SequentialValidationContext } from './sequentialValidatorTypes';

/**
 * Validates a student Boolean equation submission for next-state or flip-flop excitation inputs.
 */
export function validateSeqEquation(
  submission: StepSubmission,
  context?: StepContext & SequentialValidationContext
): ValidationOutcome {
  const ctx = context?.sequential ?? context;
  const spec = ctx?.spec ?? { kind: 'counter', flipFlop: 'D', style: 'sync', direction: 'up', modulus: 4 };
  const dRes = designSequential(spec);
  if (!dRes.ok) {
    return {
      correct: false,
      errorType: 'syntax-error',
      expected: { kind: 'boolean-step', validExpressions: ['0'], validLaws: [] },
      got: { kind: 'boolean-step', studentExpression: '', studentLaw: '' },
      details: `Invalid sequential specification: ${dRes.errors.map((e) => e.message).join(', ')}`,
    };
  }

  const fnName = ctx?.functionName ?? dRes.design.functions[0]?.name ?? 'D0';
  const fn = dRes.design.functions.find((f) => f.name === fnName);
  const eqEntry = dRes.design.equations.find((e) => e.name === fnName);

  if (!fn || !eqEntry) {
    return {
      correct: false,
      errorType: 'syntax-error',
      expected: { kind: 'boolean-step', validExpressions: ['0'], validLaws: [] },
      got: { kind: 'boolean-step', studentExpression: '', studentLaw: '' },
      details: `Function ${fnName} not found in reference sequential design.`,
    };
  }

  const ans = submission.studentAnswer;
  let text = '';
  if (ans.kind === 'boolean-step') {
    text = ans.resultingExpression;
  } else if ('expression' in ans && typeof ans.expression === 'string') {
    text = ans.expression;
  } else if ('text' in ans && typeof ans.text === 'string') {
    text = ans.text;
  } else if ('value' in ans && typeof ans.value === 'string') {
    text = ans.value;
  } else if ('studentExpression' in ans && typeof ans.studentExpression === 'string') {
    text = ans.studentExpression;
  }

  const eqRes = verifyEquation(text, fn.column, fn.variables);
  const expected: ExpectedAnswer = {
    kind: 'boolean-step',
    validExpressions: [eqEntry.text],
    validLaws: [],
  };
  const got: GotAnswer = {
    kind: 'boolean-step',
    studentExpression: text,
    studentLaw: '',
  };

  // Priority 1: Parse error
  if (eqRes.parseError) {
    return {
      correct: false,
      errorType: 'syntax-error',
      expected,
      got,
      details: `Syntax error in Boolean expression: ${eqRes.parseError}`,
    };
  }

  // Priority 2: Unknown variable
  if (eqRes.unknownVariables.length > 0) {
    return {
      correct: false,
      errorType: 'syntax-error',
      expected,
      got,
      details: `Equation uses unrecognized variable(s): ${eqRes.unknownVariables.join(', ')}. Valid variables for ${fnName} are: [${fn.variables.join(', ')}].`,
    };
  }

  // Priority 3: Correct and minimal
  // Priority 4: Correct on care rows but non-minimal (accepted with note)
  if (eqRes.correct) {
    return { correct: true };
  }

  // Priority 5: Mismatch on care rows
  return {
    correct: false,
    errorType: 'misconception',
    expected,
    got,
    misconceptionTag: 'other',
    details: `Equation does not match function ${fnName} on ${eqRes.mismatchRows.length} care condition(s) (e.g. minterm row ${eqRes.mismatchRows[0]}).`,
  };
}
