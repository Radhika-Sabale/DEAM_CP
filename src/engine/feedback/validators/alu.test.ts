/**
 * @file alu.test.ts
 * Comprehensive test suite for ALU feedback validators: result, flags, carry chain, and comparison.
 */

import { describe, expect, it } from 'vitest';
import type { StepSubmission } from '../../../types/feedback';
import { execute } from '../../alu/alu';
import { detectAnswerTrap } from '../answerTrap';
import { evaluateStep } from '../feedbackEngine';
import {
  validateAluChainBit,
  validateAluCompare,
  validateAluFlag,
  validateAluResult,
} from './alu';

describe('ALU Feedback Validators', () => {
  it('correctly diagnoses undefined overflow flag after shifts with count > 1', () => {
    const sub0: StepSubmission = {
      moduleId: 'alu',
      stepId: 'step-of-undefined',
      timestamp: '2026-10-14T00:00:00Z',
      studentAnswer: { kind: 'alu-flag', flag: 'O', value: 0 },
    };
    const ctx = { alu: { op: 'SHL' as const, width: 4, a: 1, b: 0, shiftCount: 2 } };

    const diagRes = validateAluFlag(sub0, ctx);
    expect(diagRes.correct).toBe(false);
    if (!diagRes.correct) {
      expect(diagRes.misconceptionTag).toBe('wrong-overflow-rule');
      expect(diagRes.expected.kind).toBe('alu-flag');
      if (diagRes.expected.kind === 'alu-flag') {
        expect(diagRes.expected.expectedValue).toBe('undefined');
      }
    }

    const subUndef: StepSubmission = {
      moduleId: 'alu',
      stepId: 'step-of-undefined',
      timestamp: '2026-10-14T00:00:00Z',
      studentAnswer: { kind: 'alu-flag', flag: 'O', value: 'undefined' },
    };
    const okRes = validateAluFlag(subUndef, ctx);
    expect(okRes.correct).toBe(true);
  });

  it('disambiguates wrong-complement vs forgot-invert-b-in-subtract deterministically', () => {
    // 7 - 3 in 4-bit: A = 7 (0111), B = 3 (0011). Expected result is 4 (0100).
    const ctx = { alu: { op: 'SUB' as const, width: 4, a: 7, b: 3 } };

    // Student calculates A + ~B = 7 + 12 = 19 -> 3 (omitted +1 carry-in)
    const subNoCarry: StepSubmission = {
      moduleId: 'alu',
      stepId: 'step-sub-res',
      timestamp: '2026-10-14T00:00:00Z',
      studentAnswer: { kind: 'alu-result', value: 3 },
    };
    const resNoCarry = validateAluResult(subNoCarry, ctx);
    expect(resNoCarry.correct).toBe(false);
    if (!resNoCarry.correct) {
      expect(resNoCarry.misconceptionTag).toBe('wrong-complement');
    }

    // Student calculates A + B = 7 + 3 = 10 (omitted ~B inversion)
    const subNoInvert: StepSubmission = {
      moduleId: 'alu',
      stepId: 'step-sub-res',
      timestamp: '2026-10-14T00:00:00Z',
      studentAnswer: { kind: 'alu-result', value: 10 },
    };
    const resNoInvert = validateAluResult(subNoInvert, ctx);
    expect(resNoInvert.correct).toBe(false);
    if (!resNoInvert.correct) {
      expect(resNoInvert.misconceptionTag).toBe('forgot-invert-b-in-subtract');
    }

    // Correct subtraction
    const subCorrect: StepSubmission = {
      moduleId: 'alu',
      stepId: 'step-sub-res',
      timestamp: '2026-10-14T00:00:00Z',
      studentAnswer: { kind: 'alu-result', value: 4 },
    };
    expect(validateAluResult(subCorrect, ctx).correct).toBe(true);
  });

  it('diagnoses 8086 borrow convention on subtraction (CF=1 when A < B)', () => {
    // 5 - 7 in 4-bit: unsigned 5 < 7 requires borrow -> CF = 1
    const ctx = { alu: { op: 'SUB' as const, width: 4, a: 5, b: 7 } };
    const subWrongBorrow: StepSubmission = {
      moduleId: 'alu',
      stepId: 'step-borrow',
      timestamp: '2026-10-14T00:00:00Z',
      studentAnswer: { kind: 'alu-flag', flag: 'C', value: 0 },
    };
    const diag = validateAluFlag(subWrongBorrow, ctx);
    expect(diag.correct).toBe(false);
    if (!diag.correct) {
      expect(diag.misconceptionTag).toBe('wrong-borrow-convention');
    }

    const subCorrectBorrow: StepSubmission = {
      moduleId: 'alu',
      stepId: 'step-borrow',
      timestamp: '2026-10-14T00:00:00Z',
      studentAnswer: { kind: 'alu-flag', flag: 'C', value: 1, reasoning: 'borrow-needed' },
    };
    expect(validateAluFlag(subCorrectBorrow, ctx).correct).toBe(true);
  });

  it('diagnoses wrong-shift-carry-out, wrong-sign-flag, wrong-zero-flag, and inc-dec-changes-carry', () => {
    // SHR 1100_2 (12) by 1: LSB (0) enters CF. Student answers 1
    const shiftRes = validateAluFlag(
      { moduleId: 'alu', stepId: 's1', timestamp: '', studentAnswer: { kind: 'alu-flag', flag: 'C', value: 1 } },
      { alu: { op: 'SHR', width: 4, a: 12, b: 0, shiftCount: 1 } }
    );
    expect(shiftRes.correct ? null : shiftRes.misconceptionTag).toBe('wrong-shift-carry-out');

    // 7 + 2 = 9 (1001_2): SF=1. Student reports SF=0
    const signRes = validateAluFlag(
      { moduleId: 'alu', stepId: 's2', timestamp: '', studentAnswer: { kind: 'alu-flag', flag: 'S', value: 0 } },
      { alu: { op: 'ADD', width: 4, a: 7, b: 2 } }
    );
    expect(signRes.correct ? null : signRes.misconceptionTag).toBe('wrong-sign-flag');

    // 5 - 5 = 0: ZF=1. Student reports ZF=0
    const zeroRes = validateAluFlag(
      { moduleId: 'alu', stepId: 's3', timestamp: '', studentAnswer: { kind: 'alu-flag', flag: 'Z', value: 0 } },
      { alu: { op: 'SUB', width: 4, a: 5, b: 5 } }
    );
    expect(zeroRes.correct ? null : zeroRes.misconceptionTag).toBe('wrong-zero-flag');

    // INC 0xFF with prev CF=0: CF preserved = 0. Student claims CF=1
    const incRes = validateAluFlag(
      { moduleId: 'alu', stepId: 's4', timestamp: '', studentAnswer: { kind: 'alu-flag', flag: 'C', value: 1 } },
      { alu: { op: 'INC', width: 8, a: 0xff, b: 0, previousC: 0 } }
    );
    expect(incRes.correct ? null : incRes.misconceptionTag).toBe('inc-dec-changes-carry');
  });

  it('diagnoses wrong-cmp-relation and validates ripple-carry chain bits', () => {
    // CMP 7 and 14 in 4-bit (unsigned 7 < 14, signed 7 > -2)
    const cmpRes = validateAluCompare(
      { moduleId: 'alu', stepId: 's5', timestamp: '', studentAnswer: { kind: 'alu-compare', relation: 'signed-less', answer: true } },
      { alu: { op: 'CMP', width: 4, a: 7, b: 14 } }
    );
    expect(cmpRes.correct ? null : cmpRes.misconceptionTag).toBe('wrong-cmp-relation');

    // Ripple carry chain stage for 5 + 3 (0101 + 0011)
    const chainOk = validateAluChainBit(
      { moduleId: 'alu', stepId: 's6', timestamp: '', studentAnswer: { kind: 'alu-chain-bit', bitIndex: 0, carryIn: 0, sumBit: 0, carryOut: 1 } },
      { alu: { op: 'ADD', width: 4, a: 5, b: 3 } }
    );
    expect(chainOk.correct).toBe(true);

    const chainErr = validateAluChainBit(
      { moduleId: 'alu', stepId: 's7', timestamp: '', studentAnswer: { kind: 'alu-chain-bit', bitIndex: 0, carryIn: 0, sumBit: 1, carryOut: 0 } },
      { alu: { op: 'ADD', width: 4, a: 5, b: 3 } }
    );
    expect(chainErr.correct ? null : chainErr.misconceptionTag).toBe('wrong-carry-propagation');
  });

  it('detects answer trap when final result is correct but prior flag step was flawed', () => {
    const flagFail = evaluateStep(
      { moduleId: 'alu', stepId: 'flag-eval', timestamp: '', studentAnswer: { kind: 'alu-flag', flag: 'C', value: 0 } },
      { alu: { op: 'SUB', width: 4, a: 5, b: 7 } }
    );
    expect(flagFail.ok).toBe(false);

    const trap = detectAnswerTrap({
      steps: [
        { moduleId: 'alu', stepId: 'flag-eval', timestamp: '', studentAnswer: { kind: 'alu-flag', flag: 'C', value: 0 } },
        { moduleId: 'alu', stepId: 'result-eval', timestamp: '', studentAnswer: { kind: 'alu-result', value: 14 } },
      ],
      outcomes: [
        { correct: false, errorType: 'misconception', expected: { kind: 'alu-flag', flag: 'C', expectedValue: 1 }, got: { kind: 'alu-flag', flag: 'C', studentValue: 0 } },
        { correct: true },
      ],
      finalAnswer: '14',
      expectedFinalAnswer: '14',
    });
    expect(trap).toBeDefined();
    expect(trap?.inconsistentSteps).toContain('step-1');
  });

  it('evaluates 500 randomized operations with zero false positives', () => {
    let seed = 987654321;
    function rand() {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    }

    const ops = ['ADD', 'SUB', 'AND', 'OR', 'XOR', 'NOT', 'INC', 'DEC'] as const;
    for (let i = 0; i < 500; i++) {
      const op = ops[Math.floor(rand() * ops.length)] as (typeof ops)[number];
      const a = Math.floor(rand() * 16);
      const b = Math.floor(rand() * 16);
      const res = execute(op, a, b, 4);
      if (!res.ok) continue;

      const sub: StepSubmission = {
        moduleId: 'alu',
        stepId: `prop-alu-${i}`,
        timestamp: '',
        studentAnswer: { kind: 'alu-result', value: res.result.unsigned },
      };
      const outcome = validateAluResult(sub, { alu: { op, width: 4, a, b } });
      expect(outcome.correct).toBe(true);
    }
  });
});
