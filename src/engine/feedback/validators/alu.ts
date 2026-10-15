/**
 * @file alu.ts
 * Deterministic feedback validators and misconception matchers for the Arithmetic Logic Unit (ALU).
 *
 * Validates:
 * - 'alu-result': arithmetic/logic output and deterministic subtract/carry diagnostic
 * - 'alu-flag': Z, C, S, O flag correctness, 8086 borrow convention, and undefined OF
 * - 'alu-chain-bit': ripple-carry adder/subtractor stage bits (via aluChainCompare)
 * - 'alu-compare': signed and unsigned relational comparisons derived from flags (via aluChainCompare)
 */

import type {
  AluFlagAnswer,
  AluFlagReasoningOption,
  AluResultAnswer,
  StepSubmission,
} from '../../../types/feedback';
import { execute } from '../../alu/alu';
import { registerValidator } from '../validatorRegistry';
import type { StepContext, ValidationOutcome } from '../types';
import { validateAluChainBit, validateAluCompare } from './aluChainCompare';

export { validateAluChainBit, validateAluCompare };

/**
 * Validates ALU result calculation.
 */
export function validateAluResult(
  submission: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (submission.studentAnswer.kind !== 'alu-result') {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: { kind: 'alu-result', expectedValue: 0 },
      got: { kind: 'alu-result', studentValue: 0 },
      details: 'Invalid answer kind for alu-result.',
    };
  }

  const ans = submission.studentAnswer as AluResultAnswer;
  const cfg = context?.alu ?? { op: 'ADD', width: 4, a: 0, b: 0 };
  const res = execute(cfg.op, cfg.a, cfg.b, cfg.width, {
    shiftCount: cfg.shiftCount,
    previousC: cfg.previousC,
  });

  if (!res.ok) {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: { kind: 'alu-result', expectedValue: 0 },
      got: { kind: 'alu-result', studentValue: ans.value },
      details: res.error.message,
    };
  }

  const expectedVal = res.result.unsigned;
  if (ans.value === expectedVal) {
    return { correct: true };
  }

  const mask = ((1 << cfg.width) - 1) >>> 0;
  // Deterministic subtract misconception disambiguation
  if (cfg.op === 'SUB' || cfg.op === 'CMP') {
    const invertedBWithoutCarryIn = (cfg.a + ((~cfg.b >>> 0) & mask)) & mask;
    if (ans.value === invertedBWithoutCarryIn) {
      return {
        correct: false,
        errorType: 'misconception',
        expected: { kind: 'alu-result', expectedValue: expectedVal },
        got: { kind: 'alu-result', studentValue: ans.value },
        misconceptionTag: 'wrong-complement',
        details: 'You calculated A + NOT(B) but omitted the carry-in +1 required for two\'s complement subtraction.',
      };
    }

    const addedB = (cfg.a + cfg.b) & mask;
    const addedBPlusOne = (cfg.a + cfg.b + 1) & mask;
    if (ans.value === addedB || ans.value === addedBPlusOne) {
      return {
        correct: false,
        errorType: 'misconception',
        expected: { kind: 'alu-result', expectedValue: expectedVal },
        got: { kind: 'alu-result', studentValue: ans.value },
        misconceptionTag: 'forgot-invert-b-in-subtract',
        details: 'You omitted operand B inversion, performing addition instead of two\'s complement subtraction (A + NOT(B) + 1).',
      };
    }
  }

  if (cfg.op === 'ADD' && ans.value === (cfg.a ^ cfg.b)) {
    return {
      correct: false,
      errorType: 'misconception',
      expected: { kind: 'alu-result', expectedValue: expectedVal },
      got: { kind: 'alu-result', studentValue: ans.value },
      misconceptionTag: 'wrong-carry-propagation',
      details: 'You computed bitwise XOR without propagating addition carry bits.',
    };
  }

  return {
    correct: false,
    errorType: 'arithmetic-error',
    expected: { kind: 'alu-result', expectedValue: expectedVal },
    got: { kind: 'alu-result', studentValue: ans.value },
    misconceptionTag: 'other',
    details: `Expected result ${expectedVal}, received ${ans.value}.`,
  };
}

function getExpectedFlagReasonings(
  flag: 'Z' | 'C' | 'S' | 'O',
  value: 0 | 1 | 'undefined',
  op: string
): readonly AluFlagReasoningOption[] {
  if (flag === 'Z') return value === 1 ? ['all-bits-zero'] : ['nonzero-result'];
  if (flag === 'S') return value === 1 ? ['msb-of-result'] : ['msb-is-zero'];
  if (flag === 'O') {
    if (value === 'undefined') return ['shift-count-greater-than-one'];
    return value === 1 ? ['overflow-rule'] : ['no-overflow'];
  }
  // Carry flag
  if (op === 'SUB' || op === 'CMP') return value === 1 ? ['borrow-needed'] : ['no-borrow-needed'];
  if (op === 'ADD') return value === 1 ? ['carry-out'] : ['no-carry-out'];
  if (['SHL', 'SHR', 'SAR', 'ROL', 'ROR'].includes(op)) return ['shifted-out-bit'];
  if (op === 'INC' || op === 'DEC') return ['inc-dec-preserves-carry'];
  return ['none'];
}

/**
 * Validates ALU flag evaluation.
 */
export function validateAluFlag(
  submission: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (submission.studentAnswer.kind !== 'alu-flag') {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: { kind: 'alu-flag', flag: 'Z', expectedValue: 0 },
      got: { kind: 'alu-flag', flag: 'Z', studentValue: 0 },
      details: 'Invalid answer kind for alu-flag.',
    };
  }

  const ans = submission.studentAnswer as AluFlagAnswer;
  const cfg = context?.alu ?? { op: 'ADD', width: 4, a: 0, b: 0 };
  const res = execute(cfg.op, cfg.a, cfg.b, cfg.width, {
    shiftCount: cfg.shiftCount,
    previousC: cfg.previousC,
  });

  if (!res.ok) {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: { kind: 'alu-flag', flag: ans.flag, expectedValue: 0 },
      got: { kind: 'alu-flag', flag: ans.flag, studentValue: ans.value },
      details: res.error.message,
    };
  }

  const expectedVal = res.flags[ans.flag];
  const validReasonings = getExpectedFlagReasonings(ans.flag, expectedVal, cfg.op);

  // Check flag value first
  if (ans.value !== expectedVal) {
    let tag: import('../../../types/feedback').MisconceptionTag = 'other';
    let msg = `Expected ${ans.flag} = ${expectedVal}, received ${ans.value}.`;

    if (ans.flag === 'O') {
      tag = 'wrong-overflow-rule';
      if (expectedVal === 'undefined') {
        msg = 'For shift/rotate operations with count > 1, the Overflow Flag is undefined in 8086 architecture.';
      } else {
        msg = 'Signed overflow occurs when two operands of matching sign produce an opposing sign result.';
      }
    } else if (ans.flag === 'C') {
      if (cfg.op === 'SUB' || cfg.op === 'CMP') {
        tag = 'wrong-borrow-convention';
        msg = 'In 8086 architecture, CF = 1 indicates that an unsigned borrow occurred on subtraction (A < B).';
      } else if (cfg.op === 'INC' || cfg.op === 'DEC') {
        tag = 'inc-dec-changes-carry';
        msg = 'In 8086 architecture, INC and DEC instructions preserve the Carry Flag.';
      } else if (['SHL', 'SHR', 'SAR', 'ROL', 'ROR'].includes(cfg.op)) {
        tag = 'wrong-shift-carry-out';
        msg = 'The Carry Flag receives the last bit shifted completely out of the register.';
      } else if (cfg.op === 'ADD') {
        tag = 'wrong-overflow-rule';
        msg = 'Carry indicates unsigned overflow from the MSB, distinct from signed two\'s complement overflow.';
      }
    } else if (ans.flag === 'S') {
      tag = 'wrong-sign-flag';
      msg = 'The Sign Flag strictly mirrors the Most Significant Bit (MSB) of the result.';
    } else if (ans.flag === 'Z') {
      tag = 'wrong-zero-flag';
      msg = 'The Zero Flag asserts (1) if and only if all bits of the result are zero.';
    }

    return {
      correct: false,
      errorType: 'misconception',
      expected: { kind: 'alu-flag', flag: ans.flag, expectedValue: expectedVal, validReasonings },
      got: { kind: 'alu-flag', flag: ans.flag, studentValue: ans.value, studentReasoning: ans.reasoning },
      misconceptionTag: tag,
      details: msg,
    };
  }

  // Value matches: if student provided reasoning dropdown, verify it
  if (ans.reasoning && ans.reasoning !== 'none' && !validReasonings.includes(ans.reasoning)) {
    return {
      correct: false,
      errorType: 'misconception',
      expected: { kind: 'alu-flag', flag: ans.flag, expectedValue: expectedVal, validReasonings },
      got: { kind: 'alu-flag', flag: ans.flag, studentValue: ans.value, studentReasoning: ans.reasoning },
      misconceptionTag: ans.flag === 'O' ? 'wrong-overflow-rule' : 'wrong-borrow-convention',
      details: `Your flag value is correct, but the selected reasoning "${ans.reasoning}" is flawed.`,
    };
  }

  return { correct: true };
}

// Automatic Import-Time Validator Registrations
const ALU_VALIDATORS = [
  ['alu-result', validateAluResult],
  ['alu-flag', validateAluFlag],
  ['alu-chain-bit', validateAluChainBit],
  ['alu-compare', validateAluCompare],
] as const;

for (const [id, fn] of ALU_VALIDATORS) {
  try {
    registerValidator(id, fn);
  } catch {
    // Ignore in case of re-import
  }
}

