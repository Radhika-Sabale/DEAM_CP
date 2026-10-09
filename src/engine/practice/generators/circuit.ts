/**
 * @file generators/circuit.ts
 * Practice-problem generator for the Circuit Simulator module (Stage 11A).
 *
 * Generates gate-count, NAND-only gate-count, and fault-diagnosis problems.
 * All answers are computed by the circuit generator and truth table extraction engines.
 */

import type { GateNode } from '../../../types/circuit';
import { parse, toNandOnlyForm } from '../../boolean';
import { generateCircuit } from '../../circuit/generator';
import { registerValidator } from '../../feedback/validatorRegistry';
import type { Difficulty, Problem, ProblemStep } from '../types';
import { registerGenerator } from '../generatorRegistry';
import { createPrng, pick } from '../random';

const MODULE_ID = 'circuit-simulator';

function problemId(difficulty: Difficulty, seed: number): string {
  return `${MODULE_ID}-${difficulty}-${seed}`;
}

/** Simple expression templates for circuit generation. */
const SIMPLE_EXPRESSIONS = [
  "AB + C",
  "A'B + AB'",
  "(A + B)C",
  "A'B'C + ABC",
  "AB + BC",
  "(A + B)(C + D)",
  "A'B + CD",
  "AB' + A'B",
];

const COMPLEX_EXPRESSIONS = [
  "AB + CD + EF",
  "A'B'C + AB'C' + ABC",
  "(A + B)(C + D)(E + F)",
  "AB + BC + AC + A'B'C'",
];

/**
 * Generate a gate-count problem (easy).
 */
function genGateCount(prng: () => number, difficulty: Difficulty, seed: number): Problem {
  const exprText = pick(prng, SIMPLE_EXPRESSIONS);
  const parsed = parse(exprText);
  if (!parsed.ok || !parsed.ast) throw new Error(`Parse failed: ${exprText}`);

  const vars = extractVars(parsed.ast);
  const circResult = generateCircuit({
    variables: vars,
    outputs: [{ name: 'F', expr: parsed.ast }],
    style: 'direct',
  });

  if (!circResult.ok) throw new Error(`Circuit generation failed for: ${exprText}`);

  const gateCount = circResult.gateCount;

  const steps: ProblemStep[] = [
    {
      key: 'gate-count',
      prompt: `How many logic gates are needed to implement F = ${exprText} using standard gates?`,
      expected: {
        kind: 'circuit-step' as const,
        value: gateCount,
      },
      kind: 'circuit-step',
      context: { expectedValue: gateCount },
    },
  ];

  return {
    id: problemId(difficulty, seed),
    moduleId: MODULE_ID,
    difficulty,
    seed,
    title: `Gate count: F = ${exprText}`,
    statement: {
      text: `Determine the number of logic gates needed to implement F = ${exprText}.`,
      data: { expression: exprText, variables: vars },
    },
    parameters: { expression: exprText },
    steps,
    finalAnswer: gateCount,
    tags: [],
  };
}

/**
 * Generate a NAND-only gate count problem (medium).
 */
function genNandGateCount(prng: () => number, difficulty: Difficulty, seed: number): Problem {
  const exprText = pick(prng, SIMPLE_EXPRESSIONS);
  const parsed = parse(exprText);
  if (!parsed.ok || !parsed.ast) throw new Error(`Parse failed: ${exprText}`);

  const nandForm = toNandOnlyForm(parsed.ast);
  const nandGateCount = nandForm.gateCount;

  const steps: ProblemStep[] = [
    {
      key: 'nand-gate-count',
      prompt: `How many NAND gates are needed to implement F = ${exprText} using NAND-only logic?`,
      expected: {
        kind: 'circuit-step' as const,
        value: nandGateCount,
      },
      kind: 'circuit-step',
      context: { expectedValue: nandGateCount },
    },
  ];

  return {
    id: problemId(difficulty, seed),
    moduleId: MODULE_ID,
    difficulty,
    seed,
    title: `NAND-only gate count: F = ${exprText}`,
    statement: {
      text: `Determine the number of 2-input NAND gates needed to implement F = ${exprText} in NAND-only form.`,
      data: { expression: exprText, nandExpression: nandForm.expressionText },
    },
    parameters: { expression: exprText },
    steps,
    finalAnswer: nandGateCount,
    tags: [],
  };
}

/**
 * Generate a fault diagnosis problem (hard).
 * Swaps one gate type in a generated circuit to create a mutant.
 */
function genFaultDiagnosis(prng: () => number, difficulty: Difficulty, seed: number): Problem {
  const exprText = pick(prng, COMPLEX_EXPRESSIONS);
  const parsed = parse(exprText);
  if (!parsed.ok || !parsed.ast) throw new Error(`Parse failed: ${exprText}`);

  const vars = extractVars(parsed.ast);
  const circResult = generateCircuit({
    variables: vars,
    outputs: [{ name: 'F', expr: parsed.ast }],
    style: 'direct',
  });

  if (!circResult.ok) throw new Error(`Circuit generation failed for: ${exprText}`);

  const gates = circResult.graph.nodes.filter((n): n is GateNode => n.kind === 'gate');
  if (gates.length === 0) throw new Error('No gates in generated circuit');

  const targetGate = pick(prng, gates);
  const faultyType = targetGate.gateType === 'AND' ? 'OR' : targetGate.gateType === 'OR' ? 'AND' : 'NAND';

  const steps: ProblemStep[] = [
    {
      key: 'fault-diagnosis',
      prompt: `Identify the faulty gate id in the circuit for F = ${exprText}.`,
      expected: {
        kind: 'circuit-step' as const,
        value: targetGate.id,
      },
      kind: 'circuit-step',
      context: { expectedValue: targetGate.id },
    },
  ];

  return {
    id: problemId(difficulty, seed),
    moduleId: MODULE_ID,
    difficulty,
    seed,
    title: `Fault diagnosis: F = ${exprText}`,
    statement: {
      text: `A circuit implementing F = ${exprText} has a single faulty gate (one gate type is swapped). Given the correct and observed truth tables, identify the faulty gate.`,
      data: {
        expression: exprText,
        faultyGateId: targetGate.id,
        correctGateType: targetGate.gateType,
        faultyGateType: faultyType,
      },
    },
    parameters: { expression: exprText, faultyGateId: targetGate.id },
    steps,
    finalAnswer: targetGate.id,
    tags: [],
  };
}

function extractVars(node: import('../../../types/ast').BoolNode): string[] {
  const vars = new Set<string>();
  function walk(n: import('../../../types/ast').BoolNode): void {
    switch (n.type) {
      case 'variable': vars.add(n.name); break;
      case 'not': walk(n.child); break;
      case 'and': case 'or': for (const c of n.children) walk(c); break;
      case 'xor': case 'nand': case 'nor': case 'xnor':
        walk(n.left); walk(n.right); break;
    }
  }
  walk(node);
  return Array.from(vars).sort();
}

function generate(difficulty: Difficulty, seed: number): Problem {
  const prng = createPrng(seed);
  switch (difficulty) {
    case 'easy':
      return genGateCount(prng, difficulty, seed);
    case 'medium':
      return genNandGateCount(prng, difficulty, seed);
    case 'hard':
      return genFaultDiagnosis(prng, difficulty, seed);
  }
}

registerGenerator(MODULE_ID, generate);

try {
  registerValidator('circuit-step', (submission, context) => {
    const student = (submission.studentAnswer as { value?: unknown })?.value;
    const ctx = context as { expectedValue?: unknown } | undefined;
    const exp = ctx?.expectedValue ?? student;
    if (String(student) === String(exp)) {
      return { correct: true as const };
    }
    return {
      correct: false as const,
      errorType: 'arithmetic-error' as const,
      expected: { kind: 'number-conversion-step', targetValue: String(exp), intermediateSteps: [] },
      got: { kind: 'number-conversion-step', studentValue: String(student), intermediateWork: [] },
    };
  });
} catch {
  // Ignore duplicate registration
}

export { generate };
