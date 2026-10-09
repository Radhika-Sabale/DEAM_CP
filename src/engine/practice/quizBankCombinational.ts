/**
 * @file quizBankCombinational.ts
 * Question bank for combinational and foundational topics:
 * - Number Systems (10 sub-skills)
 * - Boolean Algebra (10 sub-skills)
 * - K-Map Solver (10 sub-skills)
 */

import type { MisconceptionTag } from '../../types/feedback';
import type { Difficulty, QuizQuestion } from './types';
import { intInRange, shuffle } from './random';
import { twosComplement } from '../numberSystems';

export interface DistractorItem {
  readonly text: string;
  readonly tag?: MisconceptionTag;
}

export function buildMCQuestion(
  id: string,
  difficulty: Difficulty,
  prompt: string,
  subSkill: string,
  correct: string,
  distractors: readonly DistractorItem[],
  prng: () => number
): QuizQuestion {
  const seen = new Set<string>([correct]);
  const validDistractors: DistractorItem[] = [];

  for (const d of distractors) {
    if (!seen.has(d.text)) {
      seen.add(d.text);
      validDistractors.push(d);
    }
  }

  let fallbackCounter = 1;
  while (validDistractors.length < 3) {
    const fallbackText = `${correct}_alt${fallbackCounter++}`;
    if (!seen.has(fallbackText)) {
      seen.add(fallbackText);
      validDistractors.push({ text: fallbackText, tag: 'other' });
    }
  }

  const chosenDistractors = validDistractors.slice(0, 3);
  const rawOptions: { text: string; tag?: MisconceptionTag; isCorrect: boolean }[] = [
    { text: correct, isCorrect: true },
    ...chosenDistractors.map((d) => ({ text: d.text, tag: d.tag, isCorrect: false })),
  ];

  const shuffled = shuffle(prng, rawOptions);
  const correctIndex = shuffled.findIndex((o) => o.isCorrect);

  return {
    id,
    type: 'multiple-choice',
    difficulty,
    prompt,
    subSkill,
    correctAnswer: correct,
    options: shuffled.map((o) => o.text),
    correctOptionIndex: correctIndex,
    optionMisconceptionTags: shuffled.map((o) => o.tag),
  };
}

export function genNumberSystemsQuestion(prng: () => number, difficulty: Difficulty, idx: number): QuizQuestion {
  const qId = `ns-q-${idx}`;
  const slot = idx % 10;

  switch (slot) {
    case 0: {
      const val = intInRange(prng, 10, 50);
      const correct = val.toString(2);
      const reversed = correct.split('').reverse().join('');
      return buildMCQuestion(qId, difficulty, `Convert decimal ${val} to binary.`, 'dec-to-bin', correct, [
        { text: reversed, tag: 'wrong-remainder-order' },
        { text: (val + 1).toString(2), tag: 'wrong-radix-weight' },
        { text: correct.split('').map((b) => (b === '0' ? '1' : '0')).join(''), tag: 'wrong-complement' },
      ], prng);
    }
    case 1: {
      const val = intInRange(prng, 1, 15);
      const bin8 = val.toString(2).padStart(8, '0');
      const correct = twosComplement(bin8).result;
      const ones = bin8.split('').map((b) => (b === '0' ? '1' : '0')).join('');
      return buildMCQuestion(qId, difficulty, `Find the 8-bit two's complement of decimal -${val} (positive: ${bin8}).`, 'twos-comp', correct, [
        { text: ones, tag: 'wrong-complement' },
        { text: (val + 1).toString(2).padStart(8, '0'), tag: 'wrong-complement' },
        { text: (128 + val).toString(2).padStart(8, '0'), tag: 'wrong-complement' },
      ], prng);
    }
    case 2: {
      const a = intInRange(prng, 2, 7);
      const b = intInRange(prng, 2, 7);
      const correct = (a + b).toString(2).padStart(4, '0');
      const dropped = ((a + b) & 0b0111).toString(2).padStart(4, '0');
      return buildMCQuestion(qId, difficulty, `Add binary ${a.toString(2)} and ${b.toString(2)} (4-bit result).`, 'bin-add', correct, [
        { text: dropped, tag: 'wrong-carry-propagation' },
        { text: (a ^ b).toString(2).padStart(4, '0'), tag: 'wrong-carry-propagation' },
        { text: (a + b + 2).toString(2).padStart(4, '0'), tag: 'other' },
      ], prng);
    }
    case 3: {
      const val = intInRange(prng, 16, 255);
      const correct = val.toString(16).toUpperCase();
      return buildMCQuestion(qId, difficulty, `Convert decimal ${val} to hexadecimal.`, 'dec-to-hex', correct, [
        { text: (val + 1).toString(16).toUpperCase(), tag: 'wrong-radix-weight' },
        { text: val.toString(8), tag: 'wrong-radix-weight' },
        { text: (val - 1).toString(16).toUpperCase(), tag: 'other' },
      ], prng);
    }
    case 4: {
      return buildMCQuestion(qId, difficulty, 'How many binary bits represent exactly one octal digit?', 'octal-bits', '3', [
        { text: '4', tag: 'wrong-radix-weight' },
        { text: '2', tag: 'wrong-radix-weight' },
        { text: '8', tag: 'other' },
      ], prng);
    }
    case 5: {
      const digit = intInRange(prng, 2, 9);
      const correct = digit.toString(2).padStart(4, '0');
      return buildMCQuestion(qId, difficulty, `What is the 8421 BCD code for single decimal digit ${digit}?`, 'bcd-encode', correct, [
        { text: (digit + 3).toString(2).padStart(4, '0'), tag: 'wrong-radix-weight' },
        { text: (digit - 1).toString(2).padStart(4, '0'), tag: 'other' },
        { text: (15 - digit).toString(2).padStart(4, '0'), tag: 'wrong-complement' },
      ], prng);
    }
    case 6: {
      const bin = '0110';
      return buildMCQuestion(qId, difficulty, `What is the 1's complement of 4-bit binary ${bin}?`, 'ones-comp', '1001', [
        { text: '1010', tag: 'wrong-complement' },
        { text: '0111', tag: 'wrong-complement' },
        { text: '0110', tag: 'other' },
      ], prng);
    }
    case 7: {
      return buildMCQuestion(qId, difficulty, 'In 8-bit two\'s complement, what is the valid signed integer range?', 'twos-comp-range', '-128 to +127', [
        { text: '-127 to +127', tag: 'wrong-complement' },
        { text: '0 to 255', tag: 'wrong-overflow-rule' },
        { text: '-128 to +128', tag: 'other' },
      ], prng);
    }
    case 8: {
      return buildMCQuestion(qId, difficulty, 'When adding two positive numbers in two\'s complement, overflow occurs if:', 'overflow-rule', 'The sum has a 1 in the sign bit (negative)', [
        { text: 'A carry-out of the MSB occurs', tag: 'wrong-overflow-rule' },
        { text: 'The result equals zero', tag: 'other' },
        { text: 'Both operands are odd', tag: 'other' },
      ], prng);
    }
    default: {
      return buildMCQuestion(qId, difficulty, 'In BCD addition, when a 4-bit sum exceeds 9, what correction must be added?', 'bcd-correction', '0110 (+6)', [
        { text: '0011 (+3)', tag: 'wrong-carry-propagation' },
        { text: '1000 (+8)', tag: 'other' },
        { text: '0001 (+1)', tag: 'other' },
      ], prng);
    }
  }
}

export function genBooleanQuestion(prng: () => number, difficulty: Difficulty, idx: number): QuizQuestion {
  const qId = `bool-q-${idx}`;
  const slot = idx % 10;

  switch (slot) {
    case 0:
      return buildMCQuestion(qId, difficulty, "Apply De Morgan's theorem to: (A + B)'", 'demorgan-or', "A'B'", [
        { text: "A' + B'", tag: 'demorgan-misapplied' },
        { text: "A'B", tag: 'demorgan-misapplied' },
        { text: "AB", tag: 'other' },
      ], prng);
    case 1:
      return buildMCQuestion(qId, difficulty, "Apply De Morgan's theorem to: (A · B)'", 'demorgan-and', "A' + B'", [
        { text: "A'B'", tag: 'demorgan-misapplied' },
        { text: "A + B'", tag: 'demorgan-misapplied' },
        { text: "A + B", tag: 'other' },
      ], prng);
    case 2:
      return buildMCQuestion(qId, difficulty, 'Simplify using the absorption law: A + AB', 'absorption-1', 'A', [
        { text: 'A + B', tag: 'wrong-law-applied' },
        { text: 'B', tag: 'wrong-law-applied' },
        { text: 'AB', tag: 'other' },
      ], prng);
    case 3:
      return buildMCQuestion(qId, difficulty, 'Simplify using the absorption law: A(A + B)', 'absorption-2', 'A', [
        { text: 'AB', tag: 'wrong-law-applied' },
        { text: 'A + B', tag: 'wrong-law-applied' },
        { text: 'B', tag: 'other' },
      ], prng);
    case 4:
      return buildMCQuestion(qId, difficulty, "Evaluate the complement law: A + A'", 'complement-or', '1', [
        { text: '0', tag: 'wrong-law-applied' },
        { text: 'A', tag: 'wrong-law-applied' },
        { text: "A'", tag: 'other' },
      ], prng);
    case 5:
      return buildMCQuestion(qId, difficulty, "Evaluate the complement law: A · A'", 'complement-and', '0', [
        { text: '1', tag: 'wrong-law-applied' },
        { text: 'A', tag: 'wrong-law-applied' },
        { text: "A'", tag: 'other' },
      ], prng);
    case 6:
      return buildMCQuestion(qId, difficulty, 'Evaluate the idempotent law: A + A', 'idempotent', 'A', [
        { text: '2A', tag: 'wrong-law-applied' },
        { text: '1', tag: 'wrong-law-applied' },
        { text: '0', tag: 'other' },
      ], prng);
    case 7:
      return buildMCQuestion(qId, difficulty, "Simplify using consensus theorem: AB + A'C + BC", 'consensus', "AB + A'C", [
        { text: 'BC', tag: 'wrong-law-applied' },
        { text: "A'B + AC", tag: 'demorgan-misapplied' },
        { text: 'A + B + C', tag: 'other' },
      ], prng);
    case 8:
      return buildMCQuestion(qId, difficulty, "Evaluate the involution (double negation) law: (A')'", 'involution', 'A', [
        { text: "A'", tag: 'wrong-law-applied' },
        { text: '1', tag: 'other' },
        { text: '0', tag: 'other' },
      ], prng);
    default:
      return buildMCQuestion(qId, difficulty, 'Expand using the distributive law: A + BC', 'distributive', '(A + B)(A + C)', [
        { text: 'AB + AC', tag: 'wrong-law-applied' },
        { text: '(A + B)C', tag: 'wrong-law-applied' },
        { text: 'A + B + C', tag: 'other' },
      ], prng);
  }
}

export function genKMapQuestion(prng: () => number, difficulty: Difficulty, idx: number): QuizQuestion {
  const qId = `kmap-q-${idx}`;
  const slot = idx % 10;

  switch (slot) {
    case 0:
      return buildMCQuestion(qId, difficulty, 'Which of the following is NOT a valid group size on a K-map?', 'kmap-size', '3', [
        { text: '2', tag: 'grouped-non-power-of-two' },
        { text: '4', tag: 'grouped-non-power-of-two' },
        { text: '8', tag: 'grouped-non-power-of-two' },
      ], prng);
    case 1:
      return buildMCQuestion(qId, difficulty, 'Can cells in column 0 and column 3 of a 4-variable K-map group together?', 'kmap-col-wrap', 'Yes, opposite edges are logically adjacent', [
        { text: 'No, only contiguous side-by-side cells can group', tag: 'forgot-wraparound-grouping' },
        { text: 'No, opposite columns have distance 2', tag: 'forgot-wraparound-grouping' },
        { text: 'Only if row 0 is also all ones', tag: 'other' },
      ], prng);
    case 2:
      return buildMCQuestion(qId, difficulty, 'Can the 4 corner cells of a 4-variable K-map form a single group?', 'kmap-corners', 'Yes, they form a valid group of 4', [
        { text: 'No, diagonal groupings are never allowed', tag: 'forgot-wraparound-grouping' },
        { text: 'No, corners cannot be adjacent', tag: 'forgot-wraparound-grouping' },
        { text: 'Only in 5-variable maps', tag: 'other' },
      ], prng);
    case 3:
      return buildMCQuestion(qId, difficulty, "How should don't-care conditions (d) be treated in K-map grouping?", 'kmap-dont-care', "Include only if they enlarge groups or reduce terms", [
        { text: "Always group every don't-care cell", tag: 'missed-dont-cares' },
        { text: "Never combine don't-cares with minterms", tag: 'missed-dont-cares' },
        { text: "Treat all don't-cares as zeros unconditionally", tag: 'missed-dont-cares' },
      ], prng);
    case 4:
      return buildMCQuestion(qId, difficulty, 'What defines an Essential Prime Implicant (EPI)?', 'kmap-epi', 'A prime implicant covering at least one minterm covered by no other PI', [
        { text: 'The largest group on the map', tag: 'redundant-group' },
        { text: 'Any group containing at least 4 cells', tag: 'other' },
        { text: 'A group that covers only don\'t-cares', tag: 'missed-dont-cares' },
      ], prng);
    case 5:
      return buildMCQuestion(qId, difficulty, 'What sequence ordering is used for K-map cell coordinates?', 'kmap-gray-code', 'Gray code (00, 01, 11, 10)', [
        { text: 'Binary counting order (00, 01, 10, 11)', tag: 'wrong-bit-order' },
        { text: 'One-hot encoding', tag: 'other' },
        { text: 'Arbitrary ordering', tag: 'other' },
      ], prng);
    case 6:
      return buildMCQuestion(qId, difficulty, 'In a 4-variable K-map, a rectangular group of 4 cells eliminates how many variables?', 'kmap-var-elim', '2 variables', [
        { text: '1 variable', tag: 'group-not-maximal' },
        { text: '4 variables', tag: 'other' },
        { text: '3 variables', tag: 'other' },
      ], prng);
    case 7:
      return buildMCQuestion(qId, difficulty, 'In a 4-variable K-map, a group of 8 cells eliminates how many variables?', 'kmap-group-8', '3 variables', [
        { text: '2 variables', tag: 'group-not-maximal' },
        { text: '1 variable', tag: 'group-not-maximal' },
        { text: '4 variables', tag: 'other' },
      ], prng);
    case 8:
      return buildMCQuestion(qId, difficulty, 'What is a redundant prime implicant?', 'kmap-redundant', 'An implicant whose minterms are all covered by other selected implicants', [
        { text: 'An implicant with an odd number of cells', tag: 'grouped-non-power-of-two' },
        { text: 'An implicant that covers only zeroes', tag: 'covered-a-zero' },
        { text: 'An implicant with no variables eliminated', tag: 'other' },
      ], prng);
    default:
      return buildMCQuestion(qId, difficulty, 'To obtain a Product of Sums (POS) expression using a K-map, what must be grouped?', 'kmap-pos-grouping', 'Group the 0s and invert the resulting product terms', [
        { text: 'Group the 1s and take the complement', tag: 'wrong-law-applied' },
        { text: 'Group only don\'t-care cells', tag: 'missed-dont-cares' },
        { text: 'Group all diagonal cells', tag: 'group-not-rectangle' },
      ], prng);
  }
}
