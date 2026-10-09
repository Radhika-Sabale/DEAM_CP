/**
 * @file prepostDataFormA.ts
 * Form A item bank for pre-test and post-test diagnostic evaluations (Stage 11B).
 * Contains 20 multiple-choice items balanced across the 6 lab modules.
 */

import type { PrePostItem } from './types';

export const FORM_A_ITEMS: readonly PrePostItem[] = [
  // --- Number Systems (4 items) ---
  {
    id: 'form-a-01',
    form: 'A',
    topic: 'number-systems',
    prompt: "What is the 8-bit two's complement representation of decimal -18?",
    options: ['11101110', '11101101', '10010010', '00010010'],
    correctAnswer: '11101110',
    distractorTags: { '11101101': 'wrong-complement', '10010010': 'wrong-complement', '00010010': 'wrong-complement' },
  },
  {
    id: 'form-a-02',
    form: 'A',
    topic: 'number-systems',
    prompt: "When adding 8-bit signed two's complement numbers 01000000 (+64) and 01000000 (+64), what occurs?",
    options: ['Arithmetic overflow because two positive numbers sum to a negative representation', 'No overflow because carry out is 0', 'The result is +128 with no overflow', 'Underflow because numbers are positive'],
    correctAnswer: 'Arithmetic overflow because two positive numbers sum to a negative representation',
    distractorTags: { 'No overflow because carry out is 0': 'wrong-overflow-rule', 'The result is +128 with no overflow': 'wrong-overflow-rule', 'Underflow because numbers are positive': 'wrong-overflow-rule' },
  },
  {
    id: 'form-a-03',
    form: 'A',
    topic: 'number-systems',
    prompt: 'What is decimal 27 converted to hexadecimal?',
    options: ['1B', '1A', '27', '33'],
    correctAnswer: '1B',
    distractorTags: { '1A': 'wrong-radix-weight', '27': 'wrong-radix-weight', '33': 'wrong-radix-weight' },
  },
  {
    id: 'form-a-04',
    form: 'A',
    topic: 'number-systems',
    prompt: 'When the sum of two BCD digits exceeds 9, what correction must be added?',
    options: ['Add 0110 (decimal 6)', 'Add 0010 (decimal 2)', 'Add 1010 (decimal 10)', 'No correction needed'],
    correctAnswer: 'Add 0110 (decimal 6)',
    distractorTags: { 'Add 0010 (decimal 2)': 'other', 'Add 1010 (decimal 10)': 'other', 'No correction needed': 'other' },
  },

  // --- Boolean Algebra (3 items) ---
  {
    id: 'form-a-05',
    form: 'A',
    topic: 'boolean-tool',
    prompt: "According to De Morgan's theorem, what is the complement of (A + B)?",
    options: ['!A & !B', '!A + !B', 'A & B', '!(A & B)'],
    correctAnswer: '!A & !B',
    distractorTags: { '!A + !B': 'demorgan-misapplied', 'A & B': 'demorgan-misapplied', '!(A & B)': 'demorgan-misapplied' },
  },
  {
    id: 'form-a-06',
    form: 'A',
    topic: 'boolean-tool',
    prompt: 'Which Boolean law states that A + A*B = A?',
    options: ['Absorption Law', 'Distributive Law', 'Idempotent Law', 'Associative Law'],
    correctAnswer: 'Absorption Law',
    distractorTags: { 'Distributive Law': 'wrong-law-applied', 'Idempotent Law': 'wrong-law-applied', 'Associative Law': 'wrong-law-applied' },
  },
  {
    id: 'form-a-07',
    form: 'A',
    topic: 'boolean-tool',
    prompt: 'What is the simplified form of A + !A*B?',
    options: ['A + B', 'A & B', 'A', 'B'],
    correctAnswer: 'A + B',
    distractorTags: { 'A & B': 'wrong-law-applied', A: 'wrong-law-applied', B: 'wrong-law-applied' },
  },

  // --- K-Map Solver (4 items) ---
  {
    id: 'form-a-08',
    form: 'A',
    topic: 'kmap-solver',
    prompt: 'Which of the following group sizes is NOT allowed in Karnaugh maps?',
    options: ['6', '2', '4', '8'],
    correctAnswer: '6',
    distractorTags: { '2': 'grouped-non-power-of-two', '4': 'grouped-non-power-of-two', '8': 'grouped-non-power-of-two' },
  },
  {
    id: 'form-a-09',
    form: 'A',
    topic: 'kmap-solver',
    prompt: 'In a 4-variable K-map, can the four corners m(0), m(2), m(8), m(10) be grouped together?',
    options: ['Yes, they form a valid group of 4 due to wrap-around adjacency', 'No, corners cannot group across rows and columns', 'Only if all center cells are 1', 'No, only 2-cell groupings are allowed on edges'],
    correctAnswer: 'Yes, they form a valid group of 4 due to wrap-around adjacency',
    distractorTags: { 'No, corners cannot group across rows and columns': 'forgot-wraparound-grouping', 'Only if all center cells are 1': 'forgot-wraparound-grouping', 'No, only 2-cell groupings are allowed on edges': 'forgot-wraparound-grouping' },
  },
  {
    id: 'form-a-10',
    form: 'A',
    topic: 'kmap-solver',
    prompt: "How must don't-care conditions (d) be used during K-map minimization?",
    options: ['Include them only if they enlarge groups of 1s', "Always group all don't-cares", "Never include don't-cares with minterms", "Treat all don't-cares as zeroes"],
    correctAnswer: 'Include them only if they enlarge groups of 1s',
    distractorTags: { "Always group all don't-cares": 'missed-dont-cares', "Never include don't-cares with minterms": 'missed-dont-cares', "Treat all don't-cares as zeroes": 'missed-dont-cares' },
  },
  {
    id: 'form-a-11',
    form: 'A',
    topic: 'kmap-solver',
    prompt: 'In a 4-variable K-map, a group of 8 adjacent cells eliminates how many variables?',
    options: ['3 variables', '1 variable', '2 variables', '4 variables'],
    correctAnswer: '3 variables',
    distractorTags: { '1 variable': 'grouped-non-power-of-two', '2 variables': 'grouped-non-power-of-two', '4 variables': 'grouped-non-power-of-two' },
  },

  // --- Circuit Simulator (3 items) ---
  {
    id: 'form-a-12',
    form: 'A',
    topic: 'circuit-simulator',
    prompt: 'Which gate is universally capable of implementing any Boolean function?',
    options: ['NAND', 'XOR', 'AND', 'OR'],
    correctAnswer: 'NAND',
    distractorTags: { XOR: 'other', AND: 'other', OR: 'other' },
  },
  {
    id: 'form-a-13',
    form: 'A',
    topic: 'circuit-simulator',
    prompt: 'How many 2-input NAND gates are needed to build a 2-input AND gate?',
    options: ['2', '1', '3', '4'],
    correctAnswer: '2',
    distractorTags: { '1': 'other', '3': 'other', '4': 'other' },
  },
  {
    id: 'form-a-14',
    form: 'A',
    topic: 'circuit-simulator',
    prompt: 'What happens when a combinational circuit contains an unclocked feedback loop?',
    options: ['It creates potential race conditions or oscillatory instability', 'It acts as an ideal delay line with no hazards', 'It functions as a standard combinational multiplexer', 'It is strictly prohibited from carrying power'],
    correctAnswer: 'It creates potential race conditions or oscillatory instability',
    distractorTags: { 'It acts as an ideal delay line with no hazards': 'other', 'It functions as a standard combinational multiplexer': 'other', 'It is strictly prohibited from carrying power': 'other' },
  },

  // --- Flip-Flop Simulator (3 items) ---
  {
    id: 'form-a-15',
    form: 'A',
    topic: 'flipflop-simulator',
    prompt: 'What occurs in a JK flip-flop when both J = 1 and K = 1 on an active clock edge?',
    options: ['Output toggles (Q_next = !Q)', 'Output resets to 0', 'Output sets to 1', 'Invalid/metastable state'],
    correctAnswer: 'Output toggles (Q_next = !Q)',
    distractorTags: { 'Output resets to 0': 'wrong-excitation-table', 'Output sets to 1': 'wrong-excitation-table', 'Invalid/metastable state': 'other' },
  },
  {
    id: 'form-a-16',
    form: 'A',
    topic: 'flipflop-simulator',
    prompt: "To transition a JK flip-flop from present state Q=0 to next state Q_next=1, what must J and K be?",
    options: ["J = 1, K = X (don't care)", 'J = 0, K = X', 'J = X, K = 0', 'J = 0, K = 1'],
    correctAnswer: "J = 1, K = X (don't care)",
    distractorTags: { 'J = 0, K = X': 'wrong-excitation-table', 'J = X, K = 0': 'wrong-excitation-table', 'J = 0, K = 1': 'wrong-excitation-table' },
  },
  {
    id: 'form-a-17',
    form: 'A',
    topic: 'flipflop-simulator',
    prompt: 'In a T flip-flop, what happens to Q when T = 0 on clock pulse?',
    options: ['No change (Q_next = Q)', 'Q toggles', 'Q resets to 0', 'Q sets to 1'],
    correctAnswer: 'No change (Q_next = Q)',
    distractorTags: { 'Q toggles': 'confused-q-and-qnext', 'Q resets to 0': 'confused-q-and-qnext', 'Q sets to 1': 'confused-q-and-qnext' },
  },

  // --- Sequential Designer (3 items) ---
  {
    id: 'form-a-18',
    form: 'A',
    topic: 'sequential-designer',
    prompt: 'How many flip-flops are required to design a Mod-12 counter?',
    options: ['4', '3', '5', '12'],
    correctAnswer: '4',
    distractorTags: { '3': 'grouped-non-power-of-two', '5': 'grouped-non-power-of-two', '12': 'grouped-non-power-of-two' },
  },
  {
    id: 'form-a-19',
    form: 'A',
    topic: 'sequential-designer',
    prompt: 'What is "lockout" in a sequential counter circuit?',
    options: ['The counter enters an unused state and cannot transition back to the main counting sequence', 'The clock frequency exceeds the propagation delay', 'The flip-flops overheat and disable switching', 'All inputs are clamped to logic low'],
    correctAnswer: 'The counter enters an unused state and cannot transition back to the main counting sequence',
    distractorTags: { 'The clock frequency exceeds the propagation delay': 'ignored-lockout-state', 'The flip-flops overheat and disable switching': 'ignored-lockout-state', 'All inputs are clamped to logic low': 'ignored-lockout-state' },
  },
  {
    id: 'form-a-20',
    form: 'A',
    topic: 'sequential-designer',
    prompt: 'In an asynchronous (ripple) counter compared to a synchronous counter:',
    options: ['Flip-flops are clocked sequentially, accumulating propagation delays', 'All flip-flops receive the clock signal simultaneously', 'The circuit contains no flip-flops', 'Ripple counters operate faster at high frequencies'],
    correctAnswer: 'Flip-flops are clocked sequentially, accumulating propagation delays',
    distractorTags: { 'All flip-flops receive the clock signal simultaneously': 'other', 'The circuit contains no flip-flops': 'other', 'Ripple counters operate faster at high frequencies': 'other' },
  },
] as const;
