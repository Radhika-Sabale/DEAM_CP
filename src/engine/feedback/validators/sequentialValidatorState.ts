/**
 * @file sequentialValidatorState.ts
 * Validator handler for single cells in state transition tables.
 */

import type { LogicValue } from '../../../types/ast';
import type { ExpectedAnswer, GotAnswer, StepSubmission } from '../../../types/feedback';
import { designSequential } from '../../sequential/counterDesigner';
import type { StepContext, ValidationOutcome } from '../types';
import { parseCodeOrValue, type SequentialValidationContext } from './sequentialValidatorTypes';

/**
 * Validates a single cell in a sequential state transition table (next state or output).
 */
export function validateSeqStateTableCell(
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
      expected: { kind: 'state-table-row', nextState: '0' },
      got: { kind: 'state-table-row', nextState: 'X' },
      details: `Invalid sequential specification: ${dRes.errors.map((e) => e.message).join(', ')}`,
    };
  }

  const table = dRes.design.table;
  const code = ctx?.code ?? 0;
  const inputVal = ctx?.input === 1 ? 1 : 0;
  const field = ctx?.field ?? 'next';

  // Find matching row in reference table
  const refRow = table.rows.find((r) => r.code === code && (!table.hasInput || r.inputValue === inputVal));
  if (!refRow) {
    return {
      correct: false,
      errorType: 'syntax-error',
      expected: { kind: 'state-table-row', nextState: '0' },
      got: { kind: 'state-table-row', nextState: 'X' },
      details: `State code ${code} (input ${inputVal}) not found in reference machine.`,
    };
  }

  const ans = submission.studentAnswer;
  let studentVal: number | LogicValue | string = 'X';
  if (ans.kind === 'state-table-row') {
    studentVal = field === 'next' ? parseCodeOrValue(ans.nextState) : parseCodeOrValue(ans.output);
  } else if ('value' in ans) {
    studentVal = parseCodeOrValue((ans as { value: unknown }).value);
  } else if ('nextState' in ans) {
    studentVal = parseCodeOrValue((ans as { nextState: unknown }).nextState);
  }

  if (field === 'next') {
    const expNextCode = refRow.nextCode;
    const expNextStr = typeof expNextCode === 'number'
      ? (table.stateNames[expNextCode] ?? String(expNextCode))
      : String(expNextCode);

    const isMatch = typeof studentVal === 'number'
      ? studentVal === expNextCode
      : String(studentVal) === String(expNextCode) || String(studentVal) === expNextStr;

    if (isMatch) return { correct: true };

    const expected: ExpectedAnswer = { kind: 'state-table-row', nextState: expNextStr };
    const got: GotAnswer = { kind: 'state-table-row', nextState: String(studentVal) };

    const isPresentState = typeof studentVal === 'number'
      ? studentVal === code
      : String(studentVal) === String(code) || String(studentVal) === table.stateNames[code];

    if (isPresentState && expNextCode !== code) {
      return {
        correct: false,
        errorType: 'misconception',
        expected,
        got,
        misconceptionTag: 'confused-q-and-qnext',
        details: `Reported present state S${code} instead of evaluating the next state transition to S${expNextCode}.`,
      };
    }

    return {
      correct: false,
      errorType: 'incorrect-transition',
      expected,
      got,
      misconceptionTag: 'other',
      details: `Incorrect next state transition for state S${code}. Expected S${expNextCode}, but received ${studentVal}.`,
    };
  }

  // Output field evaluation
  const expOut: LogicValue = table.machineKind === 'moore' ? refRow.mooreOutput : refRow.mealyOutput;
  const isOutMatch = studentVal === expOut || (expOut === 'X' && (studentVal === 0 || studentVal === 1));

  if (isOutMatch) return { correct: true };

  const expected: ExpectedAnswer = {
    kind: 'state-table-row',
    nextState: refRow.stateName,
    output: expOut === 'X' ? '0' : String(expOut),
  };
  const got: GotAnswer = {
    kind: 'state-table-row',
    nextState: refRow.stateName,
    output: String(studentVal),
  };

  return {
    correct: false,
    errorType: 'incorrect-transition',
    expected,
    got,
    misconceptionTag: 'other',
    details: `Incorrect output value for state S${code}. Expected ${expOut}, but received ${studentVal}.`,
  };
}
