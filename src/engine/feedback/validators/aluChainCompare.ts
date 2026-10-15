/**
 * @file aluChainCompare.ts
 * Feedback validators for ripple-carry chain stages and relational comparisons derived from ALU flags.
 */

import type {
  AluChainBitAnswer,
  AluCompareAnswer,
  StepSubmission,
} from '../../../types/feedback';
import { execute } from '../../alu/alu';
import { buildCarryChain } from '../../alu/carryChain';
import type { StepContext, ValidationOutcome } from '../types';

/**
 * Validates ripple-carry chain bit stage.
 */
export function validateAluChainBit(
  submission: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (submission.studentAnswer.kind !== 'alu-chain-bit') {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: { kind: 'alu-chain-bit', bitIndex: 0, expectedCarryIn: 0, expectedSumBit: 0, expectedCarryOut: 0 },
      got: { kind: 'alu-chain-bit', bitIndex: 0, studentCarryIn: 0, studentSumBit: 0, studentCarryOut: 0 },
      details: 'Invalid answer kind for alu-chain-bit.',
    };
  }

  const ans = submission.studentAnswer as AluChainBitAnswer;
  const cfg = context?.alu ?? { op: 'ADD', width: 4, a: 0, b: 0 };
  const chain = buildCarryChain(cfg.a, cfg.b, cfg.width, cfg.op === 'SUB' || cfg.op === 'CMP');
  const expectedBit = chain.bits[ans.bitIndex];

  if (!expectedBit) {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: { kind: 'alu-chain-bit', bitIndex: ans.bitIndex, expectedCarryIn: 0, expectedSumBit: 0, expectedCarryOut: 0 },
      got: { kind: 'alu-chain-bit', bitIndex: ans.bitIndex, studentCarryIn: ans.carryIn, studentSumBit: ans.sumBit, studentCarryOut: ans.carryOut },
      details: `Bit index ${ans.bitIndex} out of range for width ${cfg.width}.`,
    };
  }

  const cinOk = ans.carryIn === expectedBit.carryIn;
  const sumOk = ans.sumBit === expectedBit.sum;
  const coutOk = ans.carryOut === expectedBit.carryOut;

  if (cinOk && sumOk && coutOk) {
    return { correct: true };
  }

  return {
    correct: false,
    errorType: 'misconception',
    expected: {
      kind: 'alu-chain-bit',
      bitIndex: ans.bitIndex,
      expectedCarryIn: expectedBit.carryIn,
      expectedSumBit: expectedBit.sum,
      expectedCarryOut: expectedBit.carryOut,
    },
    got: {
      kind: 'alu-chain-bit',
      bitIndex: ans.bitIndex,
      studentCarryIn: ans.carryIn,
      studentSumBit: ans.sumBit,
      studentCarryOut: ans.carryOut,
    },
    misconceptionTag: 'wrong-carry-propagation',
    details: `Bit ${ans.bitIndex} calculation error: expected Cin=${expectedBit.carryIn}, Sum=${expectedBit.sum}, Cout=${expectedBit.carryOut}.`,
  };
}

/**
 * Validates relational comparison derived from ALU flags.
 */
export function validateAluCompare(
  submission: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (submission.studentAnswer.kind !== 'alu-compare') {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: { kind: 'alu-compare', relation: 'equal', expectedAnswer: false },
      got: { kind: 'alu-compare', relation: 'equal', studentAnswer: false },
      details: 'Invalid answer kind for alu-compare.',
    };
  }

  const ans = submission.studentAnswer as AluCompareAnswer;
  const cfg = context?.alu ?? { op: 'CMP', width: 4, a: 0, b: 0 };
  const subRes = execute('CMP', cfg.a, cfg.b, cfg.width);
  if (!subRes.ok) throw new Error(subRes.error.message);

  let expectedAnswer = false;
  if (ans.relation === 'equal') {
    expectedAnswer = cfg.a === cfg.b;
  } else if (ans.relation === 'unsigned-less') {
    expectedAnswer = cfg.a < cfg.b;
  } else if (ans.relation === 'unsigned-greater') {
    expectedAnswer = cfg.a > cfg.b;
  } else {
    const toSigned = (val: number) => {
      const msb = 1 << (cfg.width - 1);
      return (val & msb) !== 0 ? val - (1 << cfg.width) : val;
    };
    const sA = toSigned(cfg.a);
    const sB = toSigned(cfg.b);
    expectedAnswer = ans.relation === 'signed-less' ? sA < sB : sA > sB;
  }

  if (ans.answer === expectedAnswer) {
    return { correct: true };
  }

  return {
    correct: false,
    errorType: 'misconception',
    expected: { kind: 'alu-compare', relation: ans.relation, expectedAnswer },
    got: { kind: 'alu-compare', relation: ans.relation, studentAnswer: ans.answer },
    misconceptionTag: 'wrong-cmp-relation',
    details: `Relational comparison "${ans.relation}" evaluated incorrectly based on ALU status flags.`,
  };
}
