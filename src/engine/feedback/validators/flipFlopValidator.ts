/**
 * @file flipFlopValidator.ts
 * Deterministic pedagogical validator for flip-flop characteristic rows,
 * excitation table derivations, and clock pulse waveform predictions.
 *
 * Registers validators for step kinds:
 * - 'ff-characteristic-row'
 * - 'ff-excitation-row'
 * - 'ff-pulse-prediction'
 * - 'excitation-entry'
 */

import type { LogicValue } from '../../../types/ast';
import type {
  ExpectedAnswer,
  GotAnswer,
  StepSubmission,
} from '../../../types/feedback';
import type { FlipFlopType } from '../../../types/sequential';
import {
  excitationInputs,
  nextState,
  simulateTimeline,
  type FlipFlopConfig,
  type FlipFlopScript,
} from '../../flipflop';
import type { StepContext, ValidationOutcome } from '../types';
import { registerValidator } from '../validatorRegistry';

/** Context payload for flip-flop domain step validation. */
export interface FlipFlopValidationContext {
  readonly type?: FlipFlopType;
  readonly inputs?: readonly LogicValue[];
  readonly q?: LogicValue;
  readonly qNext?: LogicValue;
  readonly inputName?: string;
  readonly config?: FlipFlopConfig;
  readonly script?: FlipFlopScript;
  readonly pulseIndex?: number;
  readonly flipflop?: FlipFlopValidationContext;
}

function toLogicValue(val: unknown): LogicValue {
  if (val === 1 || val === '1') return 1;
  if (val === 0 || val === '0') return 0;
  return 'X';
}

/**
 * Validates a single student row in a flip-flop characteristic table.
 */
export function validateFlipFlopCharacteristicRow(
  submission: StepSubmission,
  context?: StepContext & FlipFlopValidationContext
): ValidationOutcome {
  const ctx = context?.flipflop ?? context;
  const type: FlipFlopType = ctx?.type ?? 'D';
  const inputs: readonly LogicValue[] = ctx?.inputs ?? [0];
  const q: LogicValue = ctx?.q ?? 0;

  let studentQNext: LogicValue = 'X';
  const ans = submission.studentAnswer;
  if (ans.kind === 'state-table-row') studentQNext = toLogicValue(ans.nextState);
  else if ('nextState' in ans) studentQNext = toLogicValue((ans as { nextState: unknown }).nextState);
  else if ('value' in ans) studentQNext = toLogicValue((ans as { value: unknown }).value);

  const expectedQNext = nextState(type, inputs, q);
  if (studentQNext === expectedQNext) return { correct: true };

  const expected: ExpectedAnswer = { kind: 'state-table-row', nextState: String(expectedQNext) };
  const got: GotAnswer = { kind: 'state-table-row', nextState: String(studentQNext) };

  if (type === 'SR' && inputs[0] === 1 && inputs[1] === 1 && studentQNext !== 'X') {
    return {
      correct: false,
      errorType: 'misconception',
      expected,
      got,
      details: 'In an SR flip-flop, the input condition S = 1 and R = 1 is forbidden. It forces both outputs to 0 (or 1) and causes metastability upon release, making the next state indeterminate (X).',
    };
  }

  if (studentQNext === q && expectedQNext !== q) {
    return {
      correct: false,
      errorType: 'misconception',
      expected,
      got,
      misconceptionTag: 'confused-q-and-qnext',
      details: `Submitted present state Q = ${q} instead of evaluating the next state Q+ = ${expectedQNext}.`,
    };
  }

  return {
    correct: false,
    errorType: 'misconception',
    expected,
    got,
    misconceptionTag: 'other',
    details: `Incorrect next state. Expected Q+ = ${expectedQNext}, but received ${studentQNext}.`,
  };
}

/**
 * Validates a single student cell entry in a flip-flop excitation table.
 */
export function validateFlipFlopExcitationRow(
  submission: StepSubmission,
  context?: StepContext & FlipFlopValidationContext
): ValidationOutcome {
  const ctx = context?.flipflop ?? context;
  const type: FlipFlopType = ctx?.type ?? 'JK';
  const q: LogicValue = ctx?.q ?? 0;
  const qNext: LogicValue = ctx?.qNext ?? 0;
  const inputName: string = ctx?.inputName ?? 'J';

  let studentVal: LogicValue = 'X';
  const ans = submission.studentAnswer;
  if (ans.kind === 'excitation-entry') studentVal = ans.inputValues[inputName] ?? 'X';
  else if ('inputValues' in ans) studentVal = (ans as { inputValues: Record<string, LogicValue> }).inputValues[inputName] ?? 'X';
  else if ('value' in ans) studentVal = toLogicValue((ans as { value: unknown }).value);

  const expectedInputs = excitationInputs(type, q, qNext);
  const expectedVal = expectedInputs[inputName] ?? 'X';

  // 1. Exact match -> correct
  if (studentVal === expectedVal) return { correct: true };

  // 2. Accepted with a note: Expected is 'X' and student entered concrete 0 or 1
  if (expectedVal === 'X' && (studentVal === 0 || studentVal === 1)) return { correct: true };

  const expected: ExpectedAnswer = { kind: 'excitation-entry', inputValues: expectedInputs };
  const got: GotAnswer = { kind: 'excitation-entry', inputValues: { [inputName]: studentVal } };

  // 3. Check reversed transition (Q_next -> Q)
  const reversedInputs = excitationInputs(type, qNext, q);
  const reversedVal = reversedInputs[inputName] ?? 'X';
  if (studentVal === reversedVal && studentVal !== expectedVal) {
    return {
      correct: false,
      errorType: 'misconception',
      expected,
      got,
      misconceptionTag: 'confused-q-and-qnext',
      details: `Evaluated the reverse transition (${qNext} -> ${q}) instead of the desired forward transition (${q} -> ${qNext}).`,
    };
  }

  // 4. General excitation error
  return {
    correct: false,
    errorType: 'incorrect-excitation',
    expected,
    got,
    misconceptionTag: 'wrong-excitation-table',
    details: `Incorrect excitation value for input ${inputName} during transition ${q} -> ${qNext}. Expected ${expectedVal}, but got ${studentVal}.`,
  };
}

/**
 * Validates a student prediction of Q output after a specific clock pulse edge.
 */
export function validateFlipFlopPulsePrediction(
  submission: StepSubmission,
  context?: StepContext & FlipFlopValidationContext
): ValidationOutcome {
  const ctx = context?.flipflop ?? context;
  if (!ctx?.config || !ctx?.script) {
    return {
      correct: false,
      errorType: 'syntax-error',
      expected: { kind: 'state-table-row', nextState: 'X' },
      got: { kind: 'state-table-row', nextState: 'X' },
      details: 'Missing simulator config or script in step context.',
    };
  }

  const pulseIndex = ctx.pulseIndex ?? 1;
  const simRes = simulateTimeline(ctx.config, ctx.script);
  if (!simRes.ok) {
    return {
      correct: false,
      errorType: 'syntax-error',
      expected: { kind: 'state-table-row', nextState: 'X' },
      got: { kind: 'state-table-row', nextState: 'X' },
      details: `Simulation failed: ${simRes.error.message}`,
    };
  }

  const edgeEvents = simRes.events.filter((e) => e.kind === 'active-edge');
  const targetEdge = edgeEvents[pulseIndex - 1];

  let expectedQ: LogicValue = simRes.finalState.q;
  let qBefore: LogicValue = simRes.finalState.q;
  if (targetEdge && targetEdge.kind === 'active-edge') {
    expectedQ = targetEdge.qAfter;
    qBefore = targetEdge.qBefore;
  }

  let studentAnswer: LogicValue = 'X';
  const ans = submission.studentAnswer;
  if (ans.kind === 'state-table-row') studentAnswer = toLogicValue(ans.nextState);
  else if ('nextState' in ans) studentAnswer = toLogicValue((ans as { nextState: unknown }).nextState);
  else if ('value' in ans) studentAnswer = toLogicValue((ans as { value: unknown }).value);

  if (studentAnswer === expectedQ) return { correct: true };

  const expected: ExpectedAnswer = { kind: 'state-table-row', nextState: String(expectedQ) };
  const got: GotAnswer = { kind: 'state-table-row', nextState: String(studentAnswer) };

  if (studentAnswer === qBefore && expectedQ !== qBefore) {
    return {
      correct: false,
      errorType: 'misconception',
      expected,
      got,
      misconceptionTag: 'confused-q-and-qnext',
      details: `Reported Q before pulse #${pulseIndex} instead of evaluating the resulting state Q after the clock edge.`,
    };
  }

  return {
    correct: false,
    errorType: 'misconception',
    expected,
    got,
    misconceptionTag: 'other',
    details: `Incorrect pulse prediction for pulse #${pulseIndex}. Expected Q = ${expectedQ}, but received ${studentAnswer}.`,
  };
}

// ── Auto-Registration ────────────────────────────────────────────────────────
try {
  registerValidator('ff-characteristic-row', validateFlipFlopCharacteristicRow);
} catch {
  // Ignore duplicate registration
}
try {
  registerValidator('ff-excitation-row', validateFlipFlopExcitationRow);
} catch {
  // Ignore duplicate registration
}
try {
  registerValidator('excitation-entry', validateFlipFlopExcitationRow);
} catch {
  // Ignore duplicate registration
}
try {
  registerValidator('ff-pulse-prediction', validateFlipFlopPulsePrediction);
} catch {
  // Ignore duplicate registration
}
