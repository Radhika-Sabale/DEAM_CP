/**
 * @file generators/sequential.ts
 * Practice-problem generator for the Sequential Circuit Designer module (Stage 11A).
 *
 * Generates counter design problems across three difficulty tiers:
 * - easy: mod-4 up counter with D flip-flops (state table + excitation + equations)
 * - medium: mod-5/6/10 counter with JK flip-flops (state table + excitation + equations + lockout)
 * - hard: counter with unused states, arbitrary sequence / custom modulus and lockout analysis
 *
 * All answers are computed by the existing sequential engine (designSequential and analyzeLockout).
 */

import type { MisconceptionTag } from '../../../types/feedback';
import type { FlipFlopType, SequentialSpec } from '../../../types/sequential';
import { designSequential } from '../../sequential/counterDesigner';
import { analyzeLockout } from '../../sequential/lockout';
import type { Difficulty, Problem, ProblemStep } from '../types';
import { registerGenerator } from '../generatorRegistry';
import { createPrng, pick } from '../random';

const MODULE_ID = 'sequential-designer';

function problemId(difficulty: Difficulty, seed: number): string {
  return `${MODULE_ID}-${difficulty}-${seed}`;
}

/**
 * Builds ProblemSteps from a validated SequentialDesign and spec.
 */
function buildSequentialSteps(
  spec: SequentialSpec,
  includeLockout: boolean
): { steps: ProblemStep[]; finalAnswer: string } {
  const dRes = designSequential(spec);
  if (!dRes.ok) {
    throw new Error(`Sequential design failed: ${dRes.errors.map((e) => e.message).join(', ')}`);
  }

  const design = dRes.design;
  const steps: ProblemStep[] = [];

  // 1. State table steps: first valid state transition
  const validRows = design.table.rows.filter((r) => r.valid);
  const sampleRow = validRows[0];
  if (sampleRow) {
    steps.push({
      key: `state-${sampleRow.code}-next`,
      prompt: `From present state ${sampleRow.code}, what is the next state code?`,
      expected: {
        kind: 'state-table-row' as const,
        presentState: String(sampleRow.code),
        nextState: String(sampleRow.nextCode),
      },
      kind: 'seq-state-table-cell',
      context: {
        spec,
        code: sampleRow.code,
        input: sampleRow.inputValue,
        field: 'next',
      },
    });
  }

  // 2. Input equation steps
  for (const eq of design.equations) {
    steps.push({
      key: `eq-${eq.name}`,
      prompt: `Find the minimized Boolean equation for excitation input ${eq.name}.`,
      expected: {
        kind: 'boolean-step' as const,
        appliedLaw: '',
        resultingExpression: eq.text,
        studentExpression: eq.text,
      },
      kind: 'seq-equation',
      context: {
        spec,
        functionName: eq.name,
      },
    });
  }

  // 3. Lockout check if requested
  let finalAns = design.equations.map((e) => `${e.name} = ${e.text}`).join('; ');
  if (includeLockout) {
    const analysis = analyzeLockout({
      table: design.table,
      equations: design.equations,
      flipFlop: spec.flipFlop ?? 'D',
    });
    const trueLockout = Array.from(
      new Set([...analysis.lockedStates, ...analysis.indeterminateStates])
    ).sort((a, b) => a - b);

    steps.push({
      key: 'lockout-check',
      prompt: 'Identify any unused states that lead to a lockout or deadlock cycle (enter state codes).',
      expected: {
        kind: 'seq-lockout-claim' as const,
        lockedStates: trueLockout,
        claimedStates: trueLockout,
      },
      kind: 'seq-lockout-claim',
      context: { spec },
    });

    finalAns = `Lockout states: [${trueLockout.join(', ')}]; Equations: ${finalAns}`;
  }

  return { steps, finalAnswer: finalAns };
}

/**
 * Easy: mod-4 synchronous up-counter using D flip-flops.
 */
function genEasy(difficulty: Difficulty, seed: number): Problem {
  const spec: SequentialSpec = {
    kind: 'counter',
    direction: 'up',
    modulus: 4,
    flipFlop: 'D',
    style: 'sync',
  };

  const { steps, finalAnswer } = buildSequentialSteps(spec, false);

  return {
    id: problemId(difficulty, seed),
    moduleId: MODULE_ID,
    difficulty,
    seed,
    title: 'Synchronous Mod-4 Up Counter with D Flip-Flops',
    statement: {
      text: 'Design a 2-bit synchronous Mod-4 up counter using D flip-flops. Complete the state transitions and determine the flip-flop input equations.',
      data: { modulus: 4, flipFlop: 'D', direction: 'up', style: 'sync' },
    },
    parameters: { modulus: 4, flipFlop: 'D', direction: 'up' },
    steps,
    finalAnswer,
    tags: ['confused-q-and-qnext'] as MisconceptionTag[],
  };
}

/**
 * Medium: mod-5 or mod-6 or mod-10 synchronous counter using JK or D flip-flops.
 */
function genMedium(prng: () => number, difficulty: Difficulty, seed: number): Problem {
  const modulus = pick(prng, [5, 6, 8, 10]);
  const flipFlop: FlipFlopType = pick(prng, ['JK', 'D'] as const);
  const direction = pick(prng, ['up', 'down'] as const);

  const spec: SequentialSpec = {
    kind: 'counter',
    direction,
    modulus,
    flipFlop,
    style: 'sync',
  };

  const { steps, finalAnswer } = buildSequentialSteps(spec, true);

  return {
    id: problemId(difficulty, seed),
    moduleId: MODULE_ID,
    difficulty,
    seed,
    title: `Synchronous Mod-${modulus} ${direction === 'up' ? 'Up' : 'Down'} Counter (${flipFlop} FFs)`,
    statement: {
      text: `Design a synchronous Mod-${modulus} ${direction} counter using ${flipFlop} flip-flops. Derive the state table, input equations, and check for unused state lockout.`,
      data: { modulus, flipFlop, direction, style: 'sync' },
    },
    parameters: { modulus, flipFlop, direction },
    steps,
    finalAnswer,
    tags: ['confused-q-and-qnext', 'ignored-lockout-state'] as MisconceptionTag[],
  };
}

/**
 * Hard: custom counter with unused states and lockout check.
 */
function genHard(prng: () => number, difficulty: Difficulty, seed: number): Problem {
  const modulus = pick(prng, [5, 7, 9, 11]);
  const flipFlop: FlipFlopType = pick(prng, ['JK', 'T', 'SR'] as const);
  const direction = pick(prng, ['up', 'down', 'up-down'] as const);

  const spec: SequentialSpec = {
    kind: 'counter',
    direction,
    modulus,
    flipFlop,
    style: 'sync',
  };

  const { steps, finalAnswer } = buildSequentialSteps(spec, true);

  return {
    id: problemId(difficulty, seed),
    moduleId: MODULE_ID,
    difficulty,
    seed,
    title: `Mod-${modulus} ${direction} Counter with ${flipFlop} Flip-Flops & Lockout Analysis`,
    statement: {
      text: `Design a Mod-${modulus} ${direction} counter using ${flipFlop} flip-flops. Check for self-starting capability and identify any lockout conditions in the unused states.`,
      data: { modulus, flipFlop, direction, style: 'sync' },
    },
    parameters: { modulus, flipFlop, direction },
    steps,
    finalAnswer,
    tags: ['confused-q-and-qnext', 'ignored-lockout-state', 'wrong-excitation-table'] as MisconceptionTag[],
  };
}

/**
 * Generates a practice problem for the sequential designer module.
 */
function generate(difficulty: Difficulty, seed: number): Problem {
  const prng = createPrng(seed);
  switch (difficulty) {
    case 'easy':
      return genEasy(difficulty, seed);
    case 'medium':
      return genMedium(prng, difficulty, seed);
    case 'hard':
      return genHard(prng, difficulty, seed);
  }
}

registerGenerator(MODULE_ID, generate);

export { generate };
