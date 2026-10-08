/**
 * @file numberConversion.ts
 * Deterministic validator and cognitive misconception matcher for number system
 * conversions, positional radix arithmetic, bit grouping, and complement operations.
 */

import type {
  ExpectedAnswer,
  GotAnswer,
  StepSubmission,
} from '../../../types/feedback';
import {
  generateRepeatedDivisionSteps,
  generatePositionalWeightSteps,
  generateGroupingSteps,
} from '../../numberSystems/steps';
import { twosComplement, onesComplement } from '../../numberSystems/complements';
import { addBinary } from '../../numberSystems/arithmetic';
import type { StepContext, ValidationOutcome } from '../types';

/**
 * Validates a number system conversion step or operation against authoritative engine logic.
 *
 * @param submission The student's submitted step payload
 * @param context Additional problem context (e.g. bit width, signed flag)
 */
export function validateNumberConversion(
  submission: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (submission.studentAnswer.kind !== 'number-conversion-step') {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: { kind: 'number-conversion-step', targetValue: '', intermediateSteps: [] },
      got: { kind: 'number-conversion-step', studentValue: '', intermediateWork: [] },
      details: `Invalid answer kind: "${submission.studentAnswer.kind}"`,
    };
  }

  const ans = submission.studentAnswer;
  const srcVal = ans.sourceValue.trim();
  const srcRadix = ans.sourceRadix;
  const tgtRadix = ans.targetRadix;
  const studentFinal = ans.finalAnswer.trim().toLowerCase();
  const intermediate = ans.intermediateWork;
  const width = context?.bitWidth ?? 8;
  const isSigned = context?.isSigned ?? false;

  if (context?.claimedLaw === 'binary-addition') {
    return checkAddition(srcVal, studentFinal, width, isSigned, context);
  }
  if (context?.claimedLaw === 'twos-complement' || (srcRadix === 2 && tgtRadix === 2 && isSigned)) {
    return checkTwosComplement(srcVal, studentFinal, width);
  }
  if (srcRadix === 10 && tgtRadix !== 10) {
    return checkRepeatedDivision(srcVal, tgtRadix, studentFinal, intermediate);
  }
  if (srcRadix !== 10 && tgtRadix === 10) {
    return checkPositionalWeight(srcVal, srcRadix, studentFinal);
  }
  if ([2, 8, 16].includes(srcRadix) && [2, 8, 16].includes(tgtRadix)) {
    return checkGrouping(srcVal, srcRadix as 2 | 8 | 16, tgtRadix as 2 | 8 | 16, studentFinal);
  }

  const num = parseInt(srcVal, srcRadix);
  if (Number.isNaN(num)) {
    return makeFailure('arithmetic-error', '', studentFinal, 'other', 'Malformed source value');
  }
  const expected = num.toString(tgtRadix);
  return studentFinal === expected ? { correct: true } : makeFailure('arithmetic-error', expected, studentFinal, 'other');
}

function checkTwosComplement(
  binaryStr: string,
  studentFinal: string,
  width: number
): ValidationOutcome {
  const clean = binaryStr.replace(/[\s_]/g, '').padStart(width, '0');
  const correctTwos = twosComplement(clean);
  const correctOnes = onesComplement(clean);
  const expectedVal = correctTwos.result;

  if (studentFinal === expectedVal) {
    return { correct: true };
  }

  if (studentFinal === correctOnes.result) {
    return makeFailure(
      'misconception',
      expectedVal,
      studentFinal,
      'wrong-complement',
      'Forgot to add 1 to the least significant bit after inverting bits'
    );
  }

  return makeFailure('arithmetic-error', expectedVal, studentFinal, 'wrong-complement');
}

function checkAddition(
  operandsStr: string,
  studentFinal: string,
  width: number,
  isSigned: boolean,
  context?: StepContext
): ValidationOutcome {
  const parts = operandsStr.split(/[+,]/).map((s) => s.trim());
  if (parts.length < 2) {
    return makeFailure('arithmetic-error', '', studentFinal, 'other', 'Requires two addition operands');
  }
  const [aStr, bStr] = parts;
  const result = addBinary(aStr ?? '0', bStr ?? '0', width, isSigned ? 'signed' : 'unsigned');
  if (!result.ok) {
    return makeFailure('arithmetic-error', '', studentFinal, 'other', result.error.message);
  }

  const expectedSum = result.value.resultBits;
  const flags = result.value.flags;

  if (context?.detail === 'check-overflow') {
    const studentOverflowClaim =
      (studentFinal.includes('overflow') && !studentFinal.includes('no')) ||
      studentFinal === '1' ||
      studentFinal === 'true';
    const trueOverflow = isSigned ? flags.V === 1 : flags.C === 1;
    if (studentOverflowClaim !== trueOverflow) {
      return makeFailure(
        'misconception',
        trueOverflow ? 'overflow' : 'no-overflow',
        studentFinal,
        'wrong-overflow-rule',
        isSigned
          ? 'Confused unsigned carry-out with signed two\'s complement overflow'
          : 'Confused signed overflow condition with unsigned carry-out'
      );
    }
  }

  if (studentFinal === expectedSum) {
    return { correct: true };
  }

  const aNum = parseInt(aStr ?? '0', 2);
  const bNum = parseInt(bStr ?? '0', 2);
  const mask = (1 << width) - 1;
  const droppedCarrySum = ((aNum ^ bNum) & mask).toString(2).padStart(width, '0');
  if (studentFinal === droppedCarrySum) {
    return makeFailure(
      'misconception',
      expectedSum,
      studentFinal,
      'wrong-carry-propagation',
      'Summed individual bit columns without propagating carry to the next column'
    );
  }

  return makeFailure('arithmetic-error', expectedSum, studentFinal, undefined);
}

function checkRepeatedDivision(
  srcVal: string,
  targetRadix: number,
  studentFinal: string,
  intermediate: readonly string[]
): ValidationOutcome {
  const decVal = parseInt(srcVal, 10);
  if (Number.isNaN(decVal)) {
    return makeFailure('arithmetic-error', '', studentFinal, 'other', 'Invalid decimal integer');
  }

  const divResult = generateRepeatedDivisionSteps(decVal, targetRadix);
  const correct = divResult.result.toLowerCase();

  if (studentFinal === correct) {
    return { correct: true };
  }

  // Check if student read remainders top-to-bottom (reversed order)
  const topToBottom = divResult.steps
    .filter((s) => s.kind === 'division')
    .map((s) => (s.kind === 'division' && typeof s.output === 'object' && s.output !== null && 'remainderDigit' in s.output ? (s.output as { remainderDigit: string }).remainderDigit : ''))
    .join('')
    .toLowerCase();

  if (studentFinal === topToBottom && topToBottom !== correct) {
    return makeFailure(
      'misconception',
      correct,
      studentFinal,
      'wrong-remainder-order',
      'Remainders read from top to bottom instead of bottom to top'
    );
  }

  return makeFailure('arithmetic-error', correct, studentFinal, undefined, undefined, intermediate);
}

function checkPositionalWeight(
  srcVal: string,
  srcRadix: number,
  studentFinal: string
): ValidationOutcome {
  const weightResult = generatePositionalWeightSteps(srcVal, srcRadix);
  if (!weightResult.ok) {
    return makeFailure('arithmetic-error', '', studentFinal, 'other', weightResult.error.message);
  }

  const expectedDec = weightResult.value.resultString;
  if (studentFinal === expectedDec) {
    return { correct: true };
  }

  // Check if student numbered weights from 1 instead of 0 (offset by radix^1)
  const offsetSum = (BigInt(expectedDec) * BigInt(srcRadix)).toString();
  if (studentFinal === offsetSum) {
    return makeFailure(
      'misconception',
      expectedDec,
      studentFinal,
      'wrong-radix-weight',
      'Indexed bit weights starting at position 1 instead of 0'
    );
  }

  return makeFailure('arithmetic-error', expectedDec, studentFinal, 'wrong-radix-weight');
}

function checkGrouping(
  srcVal: string,
  fromRadix: 2 | 8 | 16,
  toRadix: 2 | 8 | 16,
  studentFinal: string
): ValidationOutcome {
  const groupResult = generateGroupingSteps(srcVal, fromRadix, toRadix);
  if (!groupResult.ok) {
    return makeFailure('arithmetic-error', '', studentFinal, 'other', groupResult.error.message);
  }

  const expectedVal = groupResult.value.result.toLowerCase();
  if (studentFinal === expectedVal) {
    return { correct: true };
  }

  // Check reversed bit/digit order
  const reversed = studentFinal.split('').reverse().join('');
  if (reversed === expectedVal) {
    return makeFailure(
      'misconception',
      expectedVal,
      studentFinal,
      'wrong-bit-order',
      'Grouped or assembled digits in reverse order (MSB vs LSB)'
    );
  }

  return makeFailure('arithmetic-error', expectedVal, studentFinal, 'wrong-bit-order');
}

function makeFailure(
  errorType: 'misconception' | 'arithmetic-error',
  expected: string,
  got: string,
  misconceptionTag?: import('../../../types/feedback').MisconceptionTag,
  details?: string,
  intermediate?: readonly string[]
): ValidationOutcome {
  const expectedPayload: ExpectedAnswer = {
    kind: 'number-conversion-step',
    targetValue: expected,
    intermediateSteps: [expected],
  };
  const gotPayload: GotAnswer = {
    kind: 'number-conversion-step',
    studentValue: got,
    intermediateWork: intermediate ?? [got],
  };

  return {
    correct: false,
    errorType,
    expected: expectedPayload,
    got: gotPayload,
    misconceptionTag,
    details,
  };
}
