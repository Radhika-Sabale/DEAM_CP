/**
 * @file generators/flipflop.ts
 * Practice-problem generator for the Flip-Flop Simulator module (Stage 11A).
 *
 * Generates characteristic table, clock pulse prediction, and excitation table problems.
 * All answers are computed by the existing flip-flop engine models and table generators.
 */

import type { LogicValue } from '../../../types/ast';
import type { MisconceptionTag } from '../../../types/feedback';
import type { FlipFlopType } from '../../../types/sequential';
import {
  inputNames,
  nextState,
  excitationInputs,
  characteristicTable,
} from '../../flipflop';
import type { Difficulty, Problem, ProblemStep } from '../types';
import { registerGenerator } from '../generatorRegistry';
import { createPrng, pick } from '../random';

const MODULE_ID = 'flipflop-simulator';

function problemId(difficulty: Difficulty, seed: number): string {
  return `${MODULE_ID}-${difficulty}-${seed}`;
}

const ALL_TYPES: readonly FlipFlopType[] = ['SR', 'JK', 'D', 'T'];

/**
 * Easy: determine Q(t+1) for a single row of a flip-flop characteristic table.
 */
function genCharacteristic(prng: () => number, difficulty: Difficulty, seed: number): Problem {
  const type = pick(prng, ALL_TYPES);
  const names = inputNames(type);
  const rows = characteristicTable(type).filter((r) => !r.invalid);
  const row = pick(prng, rows);

  const expQNext = row.qNext;
  const inputStr = names.map((name, i) => `${name}=${row.inputs[i]}`).join(', ');

  const steps: ProblemStep[] = [
    {
      key: 'char-row',
      prompt: `Given a ${type} flip-flop with present state Q = ${row.q} and inputs ${inputStr}, determine the next state Q(t+1).`,
      expected: {
        kind: 'state-table-row' as const,
        presentState: String(row.q),
        nextState: String(expQNext),
      },
      kind: 'ff-characteristic-row',
      context: {
        type,
        inputs: row.inputs,
        q: row.q,
      },
    },
  ];

  return {
    id: problemId(difficulty, seed),
    moduleId: MODULE_ID,
    difficulty,
    seed,
    title: `${type} Flip-Flop Next State`,
    statement: {
      text: `For a ${type} flip-flop with inputs ${inputStr} and current output Q = ${row.q}, find Q(t+1).`,
      data: { type, inputs: row.inputs, inputNames: names, q: row.q },
    },
    parameters: { type, inputs: row.inputs, q: row.q },
    steps,
    finalAnswer: String(expQNext),
    tags: ['confused-q-and-qnext'],
  };
}

/**
 * Medium: trace output Q across a sequence of 2 clock pulses.
 */
function genPulseSequence(prng: () => number, difficulty: Difficulty, seed: number): Problem {
  const type = pick(prng, ['JK', 'T', 'D'] as const);
  const names = inputNames(type);
  const q0: LogicValue = pick(prng, [0, 1] as const);

  // Pulse 1
  const in1: LogicValue[] = names.map(() => pick(prng, [0, 1] as const));
  const q1 = nextState(type, in1, q0);

  // Pulse 2
  const in2: LogicValue[] = names.map(() => pick(prng, [0, 1] as const));
  const q2 = nextState(type, in2, q1);

  const in1Str = names.map((name, i) => `${name}=${in1[i]}`).join(', ');
  const in2Str = names.map((name, i) => `${name}=${in2[i]}`).join(', ');

  const steps: ProblemStep[] = [
    {
      key: 'pulse-1',
      prompt: `Pulse 1: inputs ${in1Str} starting from Q = ${q0}. Determine Q after pulse 1.`,
      expected: {
        kind: 'state-table-row' as const,
        presentState: String(q0),
        nextState: String(q1),
      },
      kind: 'ff-characteristic-row',
      context: { type, inputs: in1, q: q0 },
    },
    {
      key: 'pulse-2',
      prompt: `Pulse 2: inputs ${in2Str} starting from Q = ${q1}. Determine Q after pulse 2.`,
      expected: {
        kind: 'state-table-row' as const,
        presentState: String(q1),
        nextState: String(q2),
      },
      kind: 'ff-characteristic-row',
      context: { type, inputs: in2, q: q1 },
    },
  ];

  return {
    id: problemId(difficulty, seed),
    moduleId: MODULE_ID,
    difficulty,
    seed,
    title: `${type} Flip-Flop Clock Pulse Sequence`,
    statement: {
      text: `A ${type} flip-flop starts at Q = ${q0}. Pulse 1 applies ${in1Str}, and Pulse 2 applies ${in2Str}. Determine the state after each clock pulse.`,
      data: { type, q0, pulse1: in1, pulse2: in2 },
    },
    parameters: { type, q0, in1, in2 },
    steps,
    finalAnswer: String(q2),
    tags: ['confused-q-and-qnext'],
  };
}

/**
 * Hard: determine excitation table input values for a given transition Q -> Q(t+1),
 * or identify invalid input conditions.
 */
function genExcitation(prng: () => number, difficulty: Difficulty, seed: number): Problem {
  const type = pick(prng, ALL_TYPES);
  const q: LogicValue = pick(prng, [0, 1] as const);
  const qNext: LogicValue = pick(prng, [0, 1] as const);

  const expInputs = excitationInputs(type, q, qNext);
  const names = inputNames(type);
  const primaryInput = names[0] ?? 'J';

  const steps: ProblemStep[] = [
    {
      key: 'excitation-row',
      prompt: `For a ${type} flip-flop transitioning from Q = ${q} to Q(t+1) = ${qNext}, determine the required excitation input values (${names.join(', ')}). Use 'X' for don't-care.`,
      expected: {
        kind: 'excitation-entry' as const,
        flipFlop: type,
        presentState: String(q),
        nextState: String(qNext),
        inputValues: expInputs,
      },
      kind: 'ff-excitation-row',
      context: {
        type,
        q,
        qNext,
        inputName: primaryInput,
      },
    },
  ];

  const answerSummary = names.map((n) => `${n}=${expInputs[n]}`).join(', ');

  const tags: MisconceptionTag[] = ['wrong-excitation-table', 'confused-q-and-qnext'];
  if (type === 'SR') tags.push('other');

  return {
    id: problemId(difficulty, seed),
    moduleId: MODULE_ID,
    difficulty,
    seed,
    title: `${type} Flip-Flop Excitation Requirements`,
    statement: {
      text: `A ${type} flip-flop must transition from state Q = ${q} to Q(t+1) = ${qNext}. Determine the required inputs (${names.join(', ')}).`,
      data: { type, q, qNext, names, expectedInputs: expInputs },
    },
    parameters: { type, q, qNext },
    steps,
    finalAnswer: answerSummary,
    tags,
  };
}

/**
 * Generates a practice problem for the flip-flop module.
 */
function generate(difficulty: Difficulty, seed: number): Problem {
  const prng = createPrng(seed);
  switch (difficulty) {
    case 'easy':
      return genCharacteristic(prng, difficulty, seed);
    case 'medium':
      return genPulseSequence(prng, difficulty, seed);
    case 'hard':
      return genExcitation(prng, difficulty, seed);
  }
}

registerGenerator(MODULE_ID, generate);

export { generate };
