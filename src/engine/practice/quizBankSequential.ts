/**
 * @file quizBankSequential.ts
 * Question bank for circuit, flip-flop, and sequential topics:
 * - Circuit Simulator (10 sub-skills)
 * - Flip-Flop Simulator (10 sub-skills)
 * - Sequential Circuit Designer (10 sub-skills)
 */

import type { Difficulty, QuizQuestion } from './types';
import { buildMCQuestion } from './quizBankCombinational';
import { excitationInputs } from '../flipflop';

export function genCircuitQuestion(prng: () => number, difficulty: Difficulty, idx: number): QuizQuestion {
  const qId = `circ-q-${idx}`;
  const slot = idx % 10;

  switch (slot) {
    case 0:
      return buildMCQuestion(qId, difficulty, 'How many 2-input NAND gates are required to implement a NOT gate (inverter)?', 'circ-nand-not', '1', [
        { text: '2', tag: 'other' },
        { text: '3', tag: 'other' },
        { text: '4', tag: 'other' },
      ], prng);
    case 1:
      return buildMCQuestion(qId, difficulty, 'How many 2-input NAND gates are required to implement an AND gate?', 'circ-nand-and', '2', [
        { text: '1', tag: 'other' },
        { text: '3', tag: 'other' },
        { text: '4', tag: 'other' },
      ], prng);
    case 2:
      return buildMCQuestion(qId, difficulty, 'How many 2-input NAND gates are required to implement an OR gate?', 'circ-nand-or', '3', [
        { text: '2', tag: 'other' },
        { text: '4', tag: 'other' },
        { text: '1', tag: 'other' },
      ], prng);
    case 3:
      return buildMCQuestion(qId, difficulty, 'How many 2-input NOR gates are required to implement a NOT gate?', 'circ-nor-not', '1', [
        { text: '2', tag: 'other' },
        { text: '3', tag: 'other' },
        { text: '4', tag: 'other' },
      ], prng);
    case 4:
      return buildMCQuestion(qId, difficulty, 'How many 2-input NOR gates are required to implement an OR gate?', 'circ-nor-or', '2', [
        { text: '1', tag: 'other' },
        { text: '3', tag: 'other' },
        { text: '4', tag: 'other' },
      ], prng);
    case 5:
      return buildMCQuestion(qId, difficulty, 'What is the minimum number of NAND gates needed to implement a 2-input XOR gate?', 'circ-nand-xor', '4', [
        { text: '3', tag: 'other' },
        { text: '5', tag: 'other' },
        { text: '2', tag: 'other' },
      ], prng);
    case 6:
      return buildMCQuestion(qId, difficulty, 'Why are NAND and NOR classified as universal logic gates?', 'circ-universal', 'Any Boolean function can be implemented using only that gate type', [
        { text: 'They consume zero propagation delay', tag: 'other' },
        { text: 'They accept an unlimited number of inputs', tag: 'other' },
        { text: 'They are cheaper to fabricate than inverters', tag: 'other' },
      ], prng);
    case 7:
      return buildMCQuestion(qId, difficulty, 'In a combinational circuit, what is propagation delay?', 'circ-delay', 'The time required for an input transition to cause an output transition', [
        { text: 'The clock frequency divided by two', tag: 'other' },
        { text: 'The setup time before the clock edge', tag: 'other' },
        { text: 'The time to reset flip-flops', tag: 'other' },
      ], prng);
    case 8:
      return buildMCQuestion(qId, difficulty, 'A gate whose output is permanently stuck at logic 1 regardless of inputs has what fault?', 'circ-stuck-at', 'Stuck-at-1 fault', [
        { text: 'Stuck-at-0 fault', tag: 'other' },
        { text: 'Bridging fault', tag: 'other' },
        { text: 'Delay fault', tag: 'other' },
      ], prng);
    default:
      return buildMCQuestion(qId, difficulty, 'Which 2-input gate outputs logic 1 ONLY when both inputs are equal?', 'circ-xnor', 'XNOR gate', [
        { text: 'XOR gate', tag: 'other' },
        { text: 'NAND gate', tag: 'other' },
        { text: 'NOR gate', tag: 'other' },
      ], prng);
  }
}

export function genFlipFlopQuestion(prng: () => number, difficulty: Difficulty, idx: number): QuizQuestion {
  const qId = `ff-q-${idx}`;
  const slot = idx % 10;

  switch (slot) {
    case 0:
      return buildMCQuestion(qId, difficulty, 'What happens when S = 1 and R = 1 are applied to an active-high SR flip-flop?', 'ff-sr-forbidden', 'Forbidden / indeterminate state (invalid input)', [
        { text: 'Outputs hold prior state Q', tag: 'confused-q-and-qnext' },
        { text: 'Outputs toggle state (Q+ = Q\')', tag: 'confused-q-and-qnext' },
        { text: 'Outputs reset to Q = 0', tag: 'other' },
      ], prng);
    case 1:
      return buildMCQuestion(qId, difficulty, 'When S = 1 and R = 0 are applied to an SR flip-flop, what is the next state Q+?', 'ff-sr-set', '1 (Set)', [
        { text: '0 (Reset)', tag: 'confused-q-and-qnext' },
        { text: 'Q (Hold)', tag: 'confused-q-and-qnext' },
        { text: 'X (Indeterminate)', tag: 'other' },
      ], prng);
    case 2:
      return buildMCQuestion(qId, difficulty, 'When J = 1 and K = 1 are applied to a JK flip-flop at a clock edge, what happens?', 'ff-jk-toggle', 'Toggle (Q+ = Q\')', [
        { text: 'Hold (Q+ = Q)', tag: 'confused-q-and-qnext' },
        { text: 'Reset (Q+ = 0)', tag: 'confused-q-and-qnext' },
        { text: 'Forbidden state', tag: 'other' },
      ], prng);
    case 3: {
      const exp = excitationInputs('JK', 0, 1);
      return buildMCQuestion(qId, difficulty, 'For a JK flip-flop to transition from Q = 0 to Q+ = 1, what are the required inputs?', 'ff-jk-exc-01', `J = ${exp['J']}, K = ${exp['K']}`, [
        { text: 'J = X, K = 1', tag: 'confused-q-and-qnext' },
        { text: 'J = 0, K = X', tag: 'wrong-excitation-table' },
        { text: 'J = 1, K = 0', tag: 'wrong-excitation-table' },
      ], prng);
    }
    case 4: {
      const exp = excitationInputs('JK', 1, 0);
      return buildMCQuestion(qId, difficulty, 'For a JK flip-flop to transition from Q = 1 to Q+ = 0, what are the required inputs?', 'ff-jk-exc-10', `J = ${exp['J']}, K = ${exp['K']}`, [
        { text: 'J = 1, K = X', tag: 'confused-q-and-qnext' },
        { text: 'J = 0, K = 1', tag: 'wrong-excitation-table' },
        { text: 'J = X, K = 0', tag: 'wrong-excitation-table' },
      ], prng);
    }
    case 5:
      return buildMCQuestion(qId, difficulty, 'What is the characteristic next-state equation for a D flip-flop?', 'ff-d-eqn', 'Q+ = D', [
        { text: "Q+ = D'", tag: 'confused-q-and-qnext' },
        { text: 'Q+ = Q', tag: 'confused-q-and-qnext' },
        { text: 'Q+ = D ⊕ Q', tag: 'other' },
      ], prng);
    case 6:
      return buildMCQuestion(qId, difficulty, 'What is the characteristic next-state equation for a T flip-flop?', 'ff-t-eqn', 'Q+ = T ⊕ Q', [
        { text: 'Q+ = T', tag: 'confused-q-and-qnext' },
        { text: 'Q+ = TQ', tag: 'other' },
        { text: 'Q+ = T + Q', tag: 'other' },
      ], prng);
    case 7:
      return buildMCQuestion(qId, difficulty, 'For a D flip-flop to transition from Q = 0 to Q+ = 1, what must input D be?', 'ff-d-exc', 'D = 1', [
        { text: 'D = 0', tag: 'confused-q-and-qnext' },
        { text: 'D = X', tag: 'wrong-excitation-table' },
        { text: 'D = Q', tag: 'other' },
      ], prng);
    case 8:
      return buildMCQuestion(qId, difficulty, 'For a T flip-flop to hold its state (Q+ = Q), what must input T be?', 'ff-t-hold', 'T = 0', [
        { text: 'T = 1', tag: 'confused-q-and-qnext' },
        { text: 'T = X', tag: 'wrong-excitation-table' },
        { text: 'T = Q', tag: 'other' },
      ], prng);
    default:
      return buildMCQuestion(qId, difficulty, 'What is the primary operational difference between a latch and a flip-flop?', 'ff-latch-diff', 'Latches are level-sensitive; flip-flops are edge-triggered', [
        { text: 'Latches use clock signals; flip-flops do not', tag: 'other' },
        { text: 'Flip-flops have only one output Q', tag: 'other' },
        { text: 'Latches store 2 bits; flip-flops store 1 bit', tag: 'other' },
      ], prng);
  }
}

export function genSequentialQuestion(prng: () => number, difficulty: Difficulty, idx: number): QuizQuestion {
  const qId = `seq-q-${idx}`;
  const slot = idx % 10;

  switch (slot) {
    case 0:
      return buildMCQuestion(qId, difficulty, 'What is the minimum number of flip-flops required to construct a Mod-5 counter?', 'seq-mod5-ffs', '3 flip-flops (2^3 = 8 >= 5)', [
        { text: '2 flip-flops', tag: 'other' },
        { text: '4 flip-flops', tag: 'other' },
        { text: '5 flip-flops', tag: 'other' },
      ], prng);
    case 1:
      return buildMCQuestion(qId, difficulty, 'In a Mod-6 counter constructed with 3 flip-flops (8 total states), how many states are unused?', 'seq-unused-count', '2 unused states', [
        { text: '0 unused states', tag: 'ignored-lockout-state' },
        { text: '3 unused states', tag: 'other' },
        { text: '1 unused state', tag: 'other' },
      ], prng);
    case 2:
      return buildMCQuestion(qId, difficulty, 'What is a self-starting counter?', 'seq-self-starting', 'A counter that eventually enters its valid cycle from any unused starting state', [
        { text: 'A counter that starts without an external clock', tag: 'other' },
        { text: 'A counter with no unused states', tag: 'ignored-lockout-state' },
        { text: 'A counter that counts in Gray code', tag: 'other' },
      ], prng);
    case 3:
      return buildMCQuestion(qId, difficulty, 'What constitutes a lockout condition in sequential machine design?', 'seq-lockout-def', 'Unused states form an isolated cycle that never returns to the valid sequence', [
        { text: 'The reset line is pulled high continuously', tag: 'other' },
        { text: 'Two flip-flops toggle at the same instant', tag: 'other' },
        { text: 'The clock pulse width is too narrow', tag: 'other' },
      ], prng);
    case 4:
      return buildMCQuestion(qId, difficulty, 'In a Moore state machine, the output signals depend on:', 'seq-moore-dep', 'Present state only', [
        { text: 'Both present state and external inputs', tag: 'other' },
        { text: 'External inputs only', tag: 'other' },
        { text: 'Clock frequency only', tag: 'other' },
      ], prng);
    case 5:
      return buildMCQuestion(qId, difficulty, 'In a Mealy state machine, the output signals depend on:', 'seq-mealy-dep', 'Both present state and external inputs', [
        { text: 'Present state only', tag: 'other' },
        { text: 'External inputs only', tag: 'other' },
        { text: 'Prior state only', tag: 'confused-q-and-qnext' },
      ], prng);
    case 6:
      return buildMCQuestion(qId, difficulty, 'In a synchronous counter, how is the clock connected to each flip-flop?', 'seq-sync-clk', 'The clock is connected simultaneously in parallel to all flip-flops', [
        { text: 'The output of each flip-flop clocks the next flip-flop', tag: 'other' },
        { text: 'Only the MSB flip-flop receives the clock', tag: 'other' },
        { text: 'Flip-flops are clocked in alternating phases', tag: 'other' },
      ], prng);
    case 7:
      return buildMCQuestion(qId, difficulty, 'What do directed arrows between circles in a state diagram represent?', 'seq-state-trans', 'State transitions triggered by active clock edges', [
        { text: 'Wiring buses in the layout', tag: 'other' },
        { text: 'Power rails', tag: 'other' },
        { text: 'Propagation delays', tag: 'other' },
      ], prng);
    case 8:
      return buildMCQuestion(qId, difficulty, 'What role does an excitation table play in counter synthesis?', 'seq-exc-role', 'Determines required flip-flop inputs for desired present-to-next state transitions', [
        { text: 'Verifies power dissipation of gates', tag: 'other' },
        { text: 'Measures clock skew across tracks', tag: 'other' },
        { text: 'Calculates the fan-out limit of output pins', tag: 'other' },
      ], prng);
    default:
      return buildMCQuestion(qId, difficulty, 'What is the maximum modulus of a counter constructed with 4 flip-flops?', 'seq-max-mod', '16', [
        { text: '8', tag: 'other' },
        { text: '15', tag: 'other' },
        { text: '32', tag: 'other' },
      ], prng);
  }
}
