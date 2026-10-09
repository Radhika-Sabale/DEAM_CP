/**
 * @file prepostDataFormB.ts
 * Form B item bank for pre-test and post-test diagnostic evaluations (Stage 11B).
 * Contains 20 multiple-choice items parallel to Form A across the 6 lab modules.
 */

import type { PrePostItem } from './types';

export const FORM_B_ITEMS: readonly PrePostItem[] = [
  // --- Number Systems (4 items) ---
  {
    id: 'form-b-01',
    form: 'B',
    topic: 'number-systems',
    prompt: "What is the 8-bit two's complement representation of decimal -25?",
    options: ['11100111', '11100110', '10011001', '00011001'],
    correctAnswer: '11100111',
    distractorTags: { '11100110': 'wrong-complement', '10011001': 'wrong-complement', '00011001': 'wrong-complement' },
  },
  {
    id: 'form-b-02',
    form: 'B',
    topic: 'number-systems',
    prompt: "When adding 8-bit signed two's complement numbers 10100000 (-96) and 10110000 (-80), what occurs?",
    options: ['Arithmetic overflow because two negative numbers sum to a positive representation', 'No overflow because carry out is 1', 'The result is -176 with no overflow', 'No overflow because both inputs are negative'],
    correctAnswer: 'Arithmetic overflow because two negative numbers sum to a positive representation',
    distractorTags: { 'No overflow because carry out is 1': 'wrong-overflow-rule', 'The result is -176 with no overflow': 'wrong-overflow-rule', 'No overflow because both inputs are negative': 'wrong-overflow-rule' },
  },
  {
    id: 'form-b-03',
    form: 'B',
    topic: 'number-systems',
    prompt: 'What is decimal 43 converted to hexadecimal?',
    options: ['2B', '2A', '43', '53'],
    correctAnswer: '2B',
    distractorTags: { '2A': 'wrong-radix-weight', '43': 'wrong-radix-weight', '53': 'wrong-radix-weight' },
  },
  {
    id: 'form-b-04',
    form: 'B',
    topic: 'number-systems',
    prompt: 'Which of the following bit patterns is an invalid BCD digit code?',
    options: ['1011', '0101', '1001', '0000'],
    correctAnswer: '1011',
    distractorTags: { '0101': 'other', '1001': 'other', '0000': 'other' },
  },

  // --- Boolean Algebra (3 items) ---
  {
    id: 'form-b-05',
    form: 'B',
    topic: 'boolean-tool',
    prompt: "According to De Morgan's theorem, what is the complement of (A & B)?",
    options: ['!A + !B', '!A & !B', 'A + B', '!(A + B)'],
    correctAnswer: '!A + !B',
    distractorTags: { '!A & !B': 'demorgan-misapplied', 'A + B': 'demorgan-misapplied', '!(A + B)': 'demorgan-misapplied' },
  },
  {
    id: 'form-b-06',
    form: 'B',
    topic: 'boolean-tool',
    prompt: 'Which Boolean law states that A*(A + B) = A?',
    options: ['Absorption Law', 'Distributive Law', 'Idempotent Law', 'Commutative Law'],
    correctAnswer: 'Absorption Law',
    distractorTags: { 'Distributive Law': 'wrong-law-applied', 'Idempotent Law': 'wrong-law-applied', 'Commutative Law': 'wrong-law-applied' },
  },
  {
    id: 'form-b-07',
    form: 'B',
    topic: 'boolean-tool',
    prompt: 'What is the simplified form of A * (!A + B)?',
    options: ['A & B', 'A + B', 'A', 'B'],
    correctAnswer: 'A & B',
    distractorTags: { 'A + B': 'wrong-law-applied', A: 'wrong-law-applied', B: 'wrong-law-applied' },
  },

  // --- K-Map Solver (4 items) ---
  {
    id: 'form-b-08',
    form: 'B',
    topic: 'kmap-solver',
    prompt: 'Which of the following group sizes is NOT valid on a Karnaugh map?',
    options: ['12', '4', '8', '16'],
    correctAnswer: '12',
    distractorTags: { '4': 'grouped-non-power-of-two', '8': 'grouped-non-power-of-two', '16': 'grouped-non-power-of-two' },
  },
  {
    id: 'form-b-09',
    form: 'B',
    topic: 'kmap-solver',
    prompt: 'In a 4-variable K-map, can row 0 and row 3 cells group together?',
    options: ['Yes, the top and bottom rows are logically adjacent due to wrap-around', 'No, only side-by-side rows can group', 'Only if all column 0 cells are 1', 'No, wrap-around applies only to columns'],
    correctAnswer: 'Yes, the top and bottom rows are logically adjacent due to wrap-around',
    distractorTags: { 'No, only side-by-side rows can group': 'forgot-wraparound-grouping', 'Only if all column 0 cells are 1': 'forgot-wraparound-grouping', 'No, wrap-around applies only to columns': 'forgot-wraparound-grouping' },
  },
  {
    id: 'form-b-10',
    form: 'B',
    topic: 'kmap-solver',
    prompt: "If a don't-care cell does not help to enlarge any group of 1s, how should it be treated?",
    options: ['Leave it unselected (treat as 0)', 'Create a separate 1-cell group for it', 'Combine it with adjacent 0s', 'It must always be covered by an essential prime implicant'],
    correctAnswer: 'Leave it unselected (treat as 0)',
    distractorTags: { 'Create a separate 1-cell group for it': 'missed-dont-cares', 'Combine it with adjacent 0s': 'covered-a-zero', 'It must always be covered by an essential prime implicant': 'missed-dont-cares' },
  },
  {
    id: 'form-b-11',
    form: 'B',
    topic: 'kmap-solver',
    prompt: 'In a 4-variable K-map, a rectangular group of 4 cells eliminates how many variables?',
    options: ['2 variables', '1 variable', '3 variables', '4 variables'],
    correctAnswer: '2 variables',
    distractorTags: { '1 variable': 'grouped-non-power-of-two', '3 variables': 'grouped-non-power-of-two', '4 variables': 'grouped-non-power-of-two' },
  },

  // --- Circuit Simulator (3 items) ---
  {
    id: 'form-b-12',
    form: 'B',
    topic: 'circuit-simulator',
    prompt: 'Which gate is universally capable of implementing any Boolean function?',
    options: ['NOR', 'AND', 'OR', 'XNOR'],
    correctAnswer: 'NOR',
    distractorTags: { AND: 'other', OR: 'other', XNOR: 'other' },
  },
  {
    id: 'form-b-13',
    form: 'B',
    topic: 'circuit-simulator',
    prompt: 'How many 2-input NAND gates are needed to build a 2-input OR gate?',
    options: ['3', '1', '2', '4'],
    correctAnswer: '3',
    distractorTags: { '1': 'other', '2': 'other', '4': 'other' },
  },
  {
    id: 'form-b-14',
    form: 'B',
    topic: 'circuit-simulator',
    prompt: 'What condition creates a static hazard in a combinational logic circuit?',
    options: ['Different signal paths have differing propagation delays when an input changes', 'The clock frequency is set too low', 'Inputs are held at steady DC voltages', 'The power supply voltage fluctuates'],
    correctAnswer: 'Different signal paths have differing propagation delays when an input changes',
    distractorTags: { 'The clock frequency is set too low': 'other', 'Inputs are held at steady DC voltages': 'other', 'The power supply voltage fluctuates': 'other' },
  },

  // --- Flip-Flop Simulator (3 items) ---
  {
    id: 'form-b-15',
    form: 'B',
    topic: 'flipflop-simulator',
    prompt: 'In a D flip-flop, what is next state Q_next on the active clock edge?',
    options: ['Q_next = D', 'Q_next = !D', 'Q_next = Q', 'Q_next = D ^ Q'],
    correctAnswer: 'Q_next = D',
    distractorTags: { 'Q_next = !D': 'confused-q-and-qnext', 'Q_next = Q': 'confused-q-and-qnext', 'Q_next = D ^ Q': 'confused-q-and-qnext' },
  },
  {
    id: 'form-b-16',
    form: 'B',
    topic: 'flipflop-simulator',
    prompt: "To transition a JK flip-flop from present state Q=1 to next state Q_next=0, what must J and K be?",
    options: ["J = X (don't care), K = 1", 'J = 0, K = X', 'J = 1, K = 0', 'J = 0, K = 0'],
    correctAnswer: "J = X (don't care), K = 1",
    distractorTags: { 'J = 0, K = X': 'wrong-excitation-table', 'J = 1, K = 0': 'wrong-excitation-table', 'J = 0, K = 0': 'wrong-excitation-table' },
  },
  {
    id: 'form-b-17',
    form: 'B',
    topic: 'flipflop-simulator',
    prompt: 'In a T flip-flop, what happens to Q when T = 1 on clock pulse?',
    options: ['Q toggles (Q_next = !Q)', 'No change (Q_next = Q)', 'Q resets to 0', 'Q sets to 1'],
    correctAnswer: 'Q toggles (Q_next = !Q)',
    distractorTags: { 'No change (Q_next = Q)': 'confused-q-and-qnext', 'Q resets to 0': 'confused-q-and-qnext', 'Q sets to 1': 'confused-q-and-qnext' },
  },

  // --- Sequential Designer (3 items) ---
  {
    id: 'form-b-18',
    form: 'B',
    topic: 'sequential-designer',
    prompt: 'How many flip-flops are required to design a Mod-6 counter?',
    options: ['3', '2', '4', '6'],
    correctAnswer: '3',
    distractorTags: { '2': 'grouped-non-power-of-two', '4': 'grouped-non-power-of-two', '6': 'grouped-non-power-of-two' },
  },
  {
    id: 'form-b-19',
    form: 'B',
    topic: 'sequential-designer',
    prompt: 'How can a counter design be made self-correcting against lockout states?',
    options: ['Ensure that every unused state has transitions leading back into the valid sequence', 'Increase the clock frequency until lockout dissipates', "Remove all don't-care conditions during K-map design without checking unused states", 'Connect all flip-flop clear pins together permanently'],
    correctAnswer: 'Ensure that every unused state has transitions leading back into the valid sequence',
    distractorTags: { 'Increase the clock frequency until lockout dissipates': 'ignored-lockout-state', "Remove all don't-care conditions during K-map design without checking unused states": 'ignored-lockout-state', 'Connect all flip-flop clear pins together permanently': 'ignored-lockout-state' },
  },
  {
    id: 'form-b-20',
    form: 'B',
    topic: 'sequential-designer',
    prompt: 'In a synchronous counter compared to a ripple counter:',
    options: ['All flip-flops are triggered at the same instant by a common clock', 'Each flip-flop is triggered by the output of the preceding stage', 'Synchronous counters suffer from cumulative ripple delays', 'Synchronous counters do not require flip-flops'],
    correctAnswer: 'All flip-flops are triggered at the same instant by a common clock',
    distractorTags: { 'Each flip-flop is triggered by the output of the preceding stage': 'other', 'Synchronous counters suffer from cumulative ripple delays': 'other', 'Synchronous counters do not require flip-flops': 'other' },
  },
] as const;
