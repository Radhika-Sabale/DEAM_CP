/**
 * @file generators/boolean.ts
 * Practice-problem generator for the Boolean Algebra module (Stage 11A).
 *
 * Generates simplification, canonical form, and NAND-only conversion problems.
 * All answers are computed by the existing boolean engine.
 *
 * For simplification problems, the generator builds an expression by applying
 * inverse laws to a known simple form, so the target and the law sequence are known.
 */

import type { BoolNode } from '../../../types/ast';
import type { MisconceptionTag } from '../../../types/feedback';
import {
  parse,
  toString,
  simplify,
  areEquivalent,
  canonicalSOP,
  canonicalPOS,
  buildTruthTable,
  toNandOnlyForm,
} from '../../boolean';
import type { Difficulty, Problem, ProblemStep } from '../types';
import { registerGenerator } from '../generatorRegistry';
import { createPrng, intInRange, pick } from '../random';

const MODULE_ID = 'boolean-tool';

function problemId(difficulty: Difficulty, seed: number): string {
  return `${MODULE_ID}-${difficulty}-${seed}`;
}

/**
 * Predefined expression templates by difficulty.
 * easy: 2-3 variables, one law step.
 * medium: 3-4 variables, multi-step.
 * hard: 4 variables, De Morgan + absorption + NAND-only.
 */
const EASY_EXPRESSIONS = [
  "A + A'B",      // Absorption → A + B
  "A(A + B)",     // Absorption → A
  "A + AB",       // Absorption → A
  "AA' + B",      // Complement → B
  "A + A",        // Idempotent → A
  "(A + B)(A + B')", // Consensus → A
  "AB + AB'",     // Complement → A
  "A + 0",        // Identity → A
  "A(A' + B)",    // Absorption → AB
];

const MEDIUM_EXPRESSIONS = [
  "AB + A'B + AB'",          // → A + B (with complement)
  "A'B + AB + BC",           // Multi-step
  "(A + B)(A' + C)",         // Distributive/simplify
  "AB + A'C + BC",           // Consensus
  "A'BC + AB'C + ABC' + ABC", // Multi-step
  "(A + B')(A' + B)",        // XOR expansion
];

const HARD_EXPRESSIONS = [
  "(A + B)'(C + D)'",          // De Morgan
  "((AB)' + (CD)')'",          // Double De Morgan
  "AB + A'C + BC + A'B'CD",    // Consensus + absorption
  "(A'B + AB')(C'D + CD')",    // Complex multi-step
  "A'BCD + AB'CD + ABC'D + ABCD'", // 4-var simplification
];

/**
 * Generates a simplification problem.
 */
function genSimplify(prng: () => number, difficulty: Difficulty, seed: number): Problem {
  const pool =
    difficulty === 'easy' ? EASY_EXPRESSIONS :
    difficulty === 'medium' ? MEDIUM_EXPRESSIONS :
    HARD_EXPRESSIONS;

  const exprText = pick(prng, pool);
  const parsed = parse(exprText);
  if (!parsed.ok || !parsed.ast) {
    throw new Error(`Failed to parse template expression: "${exprText}"`);
  }

  const result = simplify(parsed.ast);
  const simplifiedText = toString(result.simplified);
  const lawSequence = result.steps.map((s) => ({
    law: s.lawName,
    before: toString(s.before),
    after: toString(s.after),
  }));

  // Verify equivalence
  if (!areEquivalent(parsed.ast, result.simplified)) {
    throw new Error(`Equivalence check failed for "${exprText}"`);
  }

  const steps: ProblemStep[] = result.steps.map((s, i) => ({
    key: `simplify-step-${i}`,
    prompt: `Apply ${s.lawName} to simplify.`,
    expected: {
      kind: 'boolean-step' as const,
      resultingExpression: toString(s.after),
      appliedLaw: s.lawName,
      validExpressions: [toString(s.after)],
      validLaws: [s.lawName],
    },
    kind: 'boolean-step',
    context: {
      previousStepAnswer: toString(s.before),
      claimedLaw: s.lawName,
    },
  }));

  // If no steps (expression already simplified), add one identity step
  if (steps.length === 0) {
    steps.push({
      key: 'simplify-step-0',
      prompt: `Simplify the expression: ${exprText}`,
      expected: {
        kind: 'boolean-step' as const,
        resultingExpression: simplifiedText,
        appliedLaw: 'identity',
        validExpressions: [simplifiedText],
        validLaws: ['identity'],
      },
      kind: 'boolean-step',
      context: {
        previousStepAnswer: exprText,
        claimedLaw: 'identity',
      },
    });
  }

  const tags: MisconceptionTag[] = ['demorgan-misapplied', 'wrong-law-applied'];

  return {
    id: problemId(difficulty, seed),
    moduleId: MODULE_ID,
    difficulty,
    seed,
    title: `Simplify: ${exprText}`,
    statement: {
      text: `Simplify the Boolean expression: ${exprText}`,
      data: { expression: exprText, variables: extractVars(parsed.ast), lawSequence },
    },
    parameters: { expression: exprText },
    steps,
    finalAnswer: simplifiedText,
    tags,
  };
}

/**
 * Generates a canonical SOP/POS problem from a truth table (medium+).
 */
function genCanonical(prng: () => number, difficulty: Difficulty, seed: number): Problem {
  const vars = difficulty === 'medium' ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];
  const n = vars.length;
  const total = 1 << n;

  // Generate random minterms
  const mintermCount = intInRange(prng, Math.max(1, total >> 2), (total * 3) >> 2);
  const minterms = new Set<number>();
  while (minterms.size < mintermCount) {
    minterms.add(intInRange(prng, 0, total - 1));
  }

  // Build truth table and compute canonical forms
  const sopExpr = pick(prng, [true, false]); // SOP or POS?
  const mintermArr = Array.from(minterms).sort((a, b) => a - b);

  // Build a minimal expression from minterms to get a truth table
  const ttExpression = mintermArr.map((m) => {
    const bits = m.toString(2).padStart(n, '0');
    return vars.map((v, i) => (bits[i] === '1' ? v : `${v}'`)).join('');
  }).join(' + ');

  const parsed = parse(ttExpression);
  if (!parsed.ok || !parsed.ast) {
    throw new Error(`Failed to parse canonical expression`);
  }

  const ttResult = buildTruthTable(parsed.ast, vars);
  if (!ttResult.ok) {
    throw new Error('Failed to build truth table');
  }
  const sop = canonicalSOP(ttResult.table);
  const pos = canonicalPOS(ttResult.table);

  const answer = sopExpr ? sop.expanded : pos.expanded;
  const form = sopExpr ? 'SOP' : 'POS';

  const steps: ProblemStep[] = [
    {
      key: 'canonical-form',
      prompt: `Write the canonical ${form} expression from the truth table.`,
      expected: {
        kind: 'boolean-step' as const,
        resultingExpression: answer,
        appliedLaw: 'canonical',
        validExpressions: [answer],
        validLaws: ['canonical'],
      },
      kind: 'boolean-step',
    },
  ];

  return {
    id: problemId(difficulty, seed),
    moduleId: MODULE_ID,
    difficulty,
    seed,
    title: `Canonical ${form} from truth table`,
    statement: {
      text: `Given the truth table with minterms {${mintermArr.join(', ')}}, write the canonical ${form} expression.`,
      data: { variables: vars, minterms: mintermArr, form },
    },
    parameters: { variables: vars, minterms: mintermArr, form },
    steps,
    finalAnswer: answer,
    tags: ['wrong-law-applied'],
  };
}

/**
 * Generates a NAND-only conversion problem (hard).
 */
function genNandOnly(prng: () => number, difficulty: Difficulty, seed: number): Problem {
  const expressions = ["AB + CD", "A'B + C", "(A + B)C'", "AB' + BC"];
  const exprText = pick(prng, expressions);
  const parsed = parse(exprText);
  if (!parsed.ok || !parsed.ast) {
    throw new Error(`Failed to parse: "${exprText}"`);
  }

  const nandForm = toNandOnlyForm(parsed.ast);

  const steps: ProblemStep[] = [
    {
      key: 'nand-conversion',
      prompt: `Convert ${exprText} to a NAND-only implementation.`,
      expected: {
        kind: 'boolean-step' as const,
        resultingExpression: nandForm.expressionText,
        appliedLaw: 'de-morgan',
        validExpressions: [nandForm.expressionText],
        validLaws: ['de-morgan'],
      },
      kind: 'boolean-step',
    },
  ];

  return {
    id: problemId(difficulty, seed),
    moduleId: MODULE_ID,
    difficulty,
    seed,
    title: `NAND-only: ${exprText}`,
    statement: {
      text: `Convert the expression ${exprText} to NAND-only form. How many NAND gates are needed?`,
      data: { expression: exprText },
    },
    parameters: { expression: exprText },
    steps,
    finalAnswer: nandForm.expressionText,
    tags: ['demorgan-misapplied'],
  };
}

/** Extract variable names from a BoolNode. */
function extractVars(node: BoolNode): string[] {
  const vars = new Set<string>();
  function walk(n: BoolNode): void {
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
      return genSimplify(prng, difficulty, seed);
    case 'medium': {
      const choice = intInRange(prng, 0, 1);
      return choice === 0
        ? genSimplify(prng, difficulty, seed)
        : genCanonical(prng, difficulty, seed);
    }
    case 'hard': {
      const choice = intInRange(prng, 0, 1);
      return choice === 0
        ? genSimplify(prng, difficulty, seed)
        : genNandOnly(prng, difficulty, seed);
    }
  }
}

registerGenerator(MODULE_ID, generate);

export { generate };
