/**
 * @file generators/numberSystems.ts
 * Practice-problem generator for the Number Systems module (Stage 11A).
 *
 * Generates conversion, two's complement, BCD addition, and binary arithmetic
 * problems at three difficulty tiers. All answers are computed by the existing
 * numberSystems engine — never hard-coded.
 */

import type { MisconceptionTag } from '../../../types/feedback';
import {
  convertRadix,
  twosComplement,
  addBinary,
  bcdAdd,
  decimalToBcd,
  explainOverflow,
  generateRepeatedDivisionSteps,
} from '../../numberSystems';
import type { Difficulty, Problem, ProblemStep } from '../types';
import { registerGenerator } from '../generatorRegistry';
import { createPrng, intInRange, pick } from '../random';

const MODULE_ID = 'number-systems';

/**
 * Builds a deterministic problem ID.
 */
function problemId(difficulty: Difficulty, seed: number): string {
  return `${MODULE_ID}-${difficulty}-${seed}`;
}

/**
 * Generate a decimal-to-radix conversion problem (easy).
 * The student performs repeated division and writes the result.
 */
function genConversion(prng: () => number, difficulty: Difficulty, seed: number): Problem {
  const targetRadix = pick(prng, [2, 8, 16]);
  const radixName = targetRadix === 2 ? 'binary' : targetRadix === 8 ? 'octal' : 'hexadecimal';
  const maxVal = difficulty === 'easy' ? 255 : difficulty === 'medium' ? 1023 : 4095;
  const value = intInRange(prng, 2, maxVal);

  // Compute answer using the engine
  const convResult = convertRadix(String(value), 10, targetRadix);
  if (!convResult.ok) throw new Error(`Engine conversion failed: ${value} to base ${targetRadix}`);
  const answer = convResult.value.fullResult;

  const divSteps = generateRepeatedDivisionSteps(value, targetRadix);
  const intermediateWork = divSteps.steps.map(
    (s) => `${s.inputs['dividend']} ÷ ${targetRadix} = ${(s.output as { quotient?: string; remainderDigit?: string }).quotient ?? ''} R ${(s.output as { quotient?: string; remainderDigit?: string }).remainderDigit ?? ''}`
  );

  const steps: ProblemStep[] = [
    {
      key: 'conversion',
      prompt: `Convert ${value} (decimal) to ${radixName}. Show your repeated division steps.`,
      expected: {
        kind: 'number-conversion-step' as const,
        targetValue: answer,
        intermediateSteps: intermediateWork,
        finalAnswer: answer,
        sourceValue: String(value),
        sourceRadix: 10,
        targetRadix,
        intermediateWork,
      },
      kind: 'number-conversion-step',
      context: { bitWidth: 8 },
    },
  ];

  const tags: MisconceptionTag[] = ['wrong-remainder-order', 'wrong-radix-weight'];

  return {
    id: problemId(difficulty, seed),
    moduleId: MODULE_ID,
    difficulty,
    seed,
    title: `Decimal to ${radixName} conversion`,
    statement: {
      text: `Convert the decimal number ${value} to ${radixName}.`,
      data: { value, targetRadix },
    },
    parameters: { value, sourceRadix: 10, targetRadix },
    steps,
    finalAnswer: answer,
    tags,
  };
}

/**
 * Generate a two's complement problem (medium).
 */
function genTwosComplement(prng: () => number, difficulty: Difficulty, seed: number): Problem {
  const width = difficulty === 'hard' ? 16 : 8;
  const value = intInRange(prng, 1, (1 << (width - 1)) - 1);
  const posBinary = value.toString(2).padStart(width, '0');

  const tcResult = twosComplement(posBinary);
  const answer = tcResult.result;

  // Compute one's complement step (invert bits)
  const onesComp = posBinary
    .split('')
    .map((b) => (b === '0' ? '1' : '0'))
    .join('');

  const steps: ProblemStep[] = [
    {
      key: 'twos-complement',
      prompt: `Find the ${width}-bit two's complement representation of -${value}.`,
      expected: {
        kind: 'number-conversion-step' as const,
        targetValue: answer,
        finalAnswer: answer,
        sourceValue: posBinary,
        sourceRadix: 2,
        targetRadix: 2,
        intermediateWork: [
          `Positive binary: ${posBinary}`,
          `One's complement: ${onesComp}`,
          `Add 1: ${answer}`,
        ],
        intermediateSteps: [
          `Positive binary: ${posBinary}`,
          `One's complement: ${onesComp}`,
          `Add 1: ${answer}`,
        ],
      },
      kind: 'number-conversion-step',
      context: { claimedLaw: 'twos-complement', bitWidth: width },
    },
  ];

  return {
    id: problemId(difficulty, seed),
    moduleId: MODULE_ID,
    difficulty,
    seed,
    title: `Two's complement of -${value}`,
    statement: {
      text: `Find the ${width}-bit two's complement representation of -${value}.`,
      data: { value, width },
    },
    parameters: { value, width },
    steps,
    finalAnswer: answer,
    tags: ['wrong-complement'],
  };
}

/**
 * Generate a binary addition with flags problem (hard).
 */
function genBinaryAddition(prng: () => number, difficulty: Difficulty, seed: number): Problem {
  const width = 8;
  const a = intInRange(prng, 1, 255);
  const b = intInRange(prng, 1, 255);
  const aBits = a.toString(2).padStart(width, '0');
  const bBits = b.toString(2).padStart(width, '0');

  const addRes = addBinary(aBits, bBits, width, 'unsigned');
  if (!addRes.ok) throw new Error('addBinary failed');
  const result = addRes.value;

  const overflowExpl = explainOverflow(
    result.flags,
    aBits,
    bBits,
    'add',
    'unsigned',
    width
  );

  const steps: ProblemStep[] = [
    {
      key: 'binary-add',
      prompt: `Add ${aBits} + ${bBits} in binary (${width}-bit). State the result and all flags (C, N, Z, V).`,
      expected: {
        kind: 'number-conversion-step' as const,
        targetValue: result.resultBits,
        finalAnswer: result.resultBits,
        sourceValue: `${aBits} + ${bBits}`,
        sourceRadix: 2,
        targetRadix: 2,
        intermediateWork: [
          `Result: ${result.resultBits}`,
          `C=${result.flags.C} N=${result.flags.N} Z=${result.flags.Z} V=${result.flags.V}`,
        ],
        intermediateSteps: [
          `Result: ${result.resultBits}`,
          `C=${result.flags.C} N=${result.flags.N} Z=${result.flags.Z} V=${result.flags.V}`,
        ],
      },
      kind: 'number-conversion-step',
      context: { claimedLaw: 'binary-addition', bitWidth: width },
    },
  ];

  return {
    id: problemId(difficulty, seed),
    moduleId: MODULE_ID,
    difficulty,
    seed,
    title: 'Binary addition with flags',
    statement: {
      text: `Add ${aBits} + ${bBits} (${width}-bit). Determine the result and all arithmetic flags.`,
      data: { a, b, width, aBinary: aBits, bBinary: bBits },
    },
    parameters: { a, b, width },
    steps,
    finalAnswer: {
      result: result.resultBits,
      flags: result.flags,
      overflow: overflowExpl,
    },
    tags: ['wrong-carry-propagation', 'wrong-overflow-rule'],
  };
}

/**
 * Generate a BCD addition problem (medium).
 */
function genBcdAddition(prng: () => number, difficulty: Difficulty, seed: number): Problem {
  const a = intInRange(prng, 10, 99);
  const b = intInRange(prng, 10, 99);

  const bcdARes = decimalToBcd(String(a));
  const bcdBRes = decimalToBcd(String(b));
  if (!bcdARes.ok || !bcdBRes.ok) throw new Error('decimalToBcd failed');
  const bcdA = bcdARes.value;
  const bcdB = bcdBRes.value;

  const addRes = bcdAdd(bcdA.bits, bcdB.bits);
  if (!addRes.ok) throw new Error('bcdAdd failed');
  const addResult = addRes.value;

  const steps: ProblemStep[] = [
    {
      key: 'bcd-add',
      prompt: `Perform BCD addition of ${a} + ${b}. Show the BCD encoding and correction steps.`,
      expected: {
        kind: 'number-conversion-step' as const,
        targetValue: addResult.sumDigits,
        finalAnswer: addResult.sumDigits,
        sourceValue: String(a + b),
        sourceRadix: 10,
        targetRadix: 10,
        intermediateWork: [
          `BCD(${a}) = ${bcdA.bits}`,
          `BCD(${b}) = ${bcdB.bits}`,
          `Sum digits: ${addResult.sumDigits}`,
        ],
        intermediateSteps: [
          `BCD(${a}) = ${bcdA.bits}`,
          `BCD(${b}) = ${bcdB.bits}`,
          `Sum digits: ${addResult.sumDigits}`,
        ],
      },
      kind: 'number-conversion-step',
      context: { bitWidth: 8 },
    },
  ];

  return {
    id: problemId(difficulty, seed),
    moduleId: MODULE_ID,
    difficulty,
    seed,
    title: `BCD addition: ${a} + ${b}`,
    statement: {
      text: `Perform BCD (8421) addition of ${a} + ${b}. Show encoding and correction.`,
      data: { a, b },
    },
    parameters: { a, b },
    steps,
    finalAnswer: addResult.sumDigits,
    tags: ['wrong-carry-propagation'],
  };
}

/**
 * Main generator dispatching by difficulty.
 */
function generate(difficulty: Difficulty, seed: number): Problem {
  const prng = createPrng(seed);

  switch (difficulty) {
    case 'easy':
      return genConversion(prng, difficulty, seed);
    case 'medium': {
      const choice = intInRange(prng, 0, 1);
      return choice === 0
        ? genTwosComplement(prng, difficulty, seed)
        : genBcdAddition(prng, difficulty, seed);
    }
    case 'hard':
      return genBinaryAddition(prng, difficulty, seed);
  }
}

// Self-register
registerGenerator(MODULE_ID, generate);

export { generate };
