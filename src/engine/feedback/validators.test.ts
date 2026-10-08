/**
 * @file validators.test.ts
 * Comprehensive test suite for number system and boolean algebraic step validators.
 * Contains 25+ number conversion cases and 30+ boolean simplification cases.
 */

import { describe, expect, it } from 'vitest';
import type { StepSubmission } from '../../types/feedback';
import { validateNumberConversion } from './validators/numberConversion';
import { validateBooleanStep } from './validators/booleanStep';

describe('Number Conversion Step Validator (25+ cases)', () => {
  function makeNumSub(
    srcVal: string,
    srcRadix: number,
    tgtRadix: number,
    finalAns: string,
    inter: string[] = []
  ): StepSubmission {
    return {
      moduleId: 'numberSystems',
      stepId: 'num-step-1',
      timestamp: '2026-10-05T00:00:00Z',
      studentAnswer: {
        kind: 'number-conversion-step',
        sourceValue: srcVal,
        sourceRadix: srcRadix,
        targetRadix: tgtRadix,
        intermediateWork: inter,
        finalAnswer: finalAns,
      },
    };
  }

  // Case 1: Correct repeated division (13 base 10 -> base 2 = 1101)
  it('case 1: validates correct repeated division 13 -> base 2', () => {
    const sub = makeNumSub('13', 10, 2, '1101');
    const res = validateNumberConversion(sub);
    expect(res.correct).toBe(true);
  });

  // Case 2: Reversed remainder order (13 base 10 -> 1011 instead of 1101)
  it('case 2: diagnoses reversed remainder order for 13 -> 1011', () => {
    const sub = makeNumSub('13', 10, 2, '1011');
    const res = validateNumberConversion(sub);
    expect(res.correct).toBe(false);
    if (!res.correct) {
      expect(res.misconceptionTag).toBe('wrong-remainder-order');
    }
  });

  // Case 3: Reversed remainder order (156 base 10 -> base 2)
  it('case 3: diagnoses reversed remainder order for 156 -> base 2', () => {
    // 156 / 2 = 78 r 0
    // 78 / 2 = 39 r 0
    // 39 / 2 = 19 r 1
    // 19 / 2 = 9 r 1
    // 9 / 2 = 4 r 1
    // 4 / 2 = 2 r 0
    // 2 / 2 = 1 r 0
    // 1 / 2 = 0 r 1
    // correct: 10011100. reversed: 00111001
    const sub = makeNumSub('156', 10, 2, '00111001');
    const res = validateNumberConversion(sub);
    expect(res.correct).toBe(false);
    if (!res.correct) {
      expect(res.misconceptionTag).toBe('wrong-remainder-order');
    }
  });

  // Case 4: Correct 2's complement of 0101 (8-bit) = 11111011
  it('case 4: validates correct 2\'s complement of 00000101', () => {
    const sub = makeNumSub('00000101', 2, 2, '11111011');
    const res = validateNumberConversion(sub, { claimedLaw: 'twos-complement', bitWidth: 8 });
    expect(res.correct).toBe(true);
  });

  // Case 5: Two's complement without +1 (forgot +1, submitted 1's complement 11111010)
  it('case 5: diagnoses forgot +1 in 2\'s complement', () => {
    const sub = makeNumSub('00000101', 2, 2, '11111010');
    const res = validateNumberConversion(sub, { claimedLaw: 'twos-complement', bitWidth: 8 });
    expect(res.correct).toBe(false);
    if (!res.correct) {
      expect(res.misconceptionTag).toBe('wrong-complement');
    }
  });

  // Case 6: Correct signed addition 3 + 2 = 5 (4-bit: 0011 + 0010 = 0101)
  it('case 6: validates correct binary addition without overflow', () => {
    const sub = makeNumSub('0011 + 0010', 2, 2, '0101');
    const res = validateNumberConversion(sub, { claimedLaw: 'binary-addition', bitWidth: 4, isSigned: true });
    expect(res.correct).toBe(true);
  });

  // Case 7: Dropped carry in binary addition (0011 + 0001 = 0010 instead of 0100)
  it('case 7: diagnoses dropped carry bit in addition', () => {
    const sub = makeNumSub('0011 + 0001', 2, 2, '0010');
    const res = validateNumberConversion(sub, { claimedLaw: 'binary-addition', bitWidth: 4 });
    expect(res.correct).toBe(false);
    if (!res.correct) {
      expect(res.misconceptionTag).toBe('wrong-carry-propagation');
    }
  });

  // Case 8: Signed 4-bit addition 7 + 5 (0111 + 0101 = 1100 = -4, overflows range [-8, 7])
  it('case 8: flags wrong overflow claim for 7 + 5 signed 4-bit', () => {
    const sub = makeNumSub('0111 + 0101', 2, 2, 'no-overflow');
    const res = validateNumberConversion(sub, {
      claimedLaw: 'binary-addition',
      bitWidth: 4,
      isSigned: true,
      detail: 'check-overflow',
    });
    expect(res.correct).toBe(false);
    if (!res.correct) {
      expect(res.misconceptionTag).toBe('wrong-overflow-rule');
    }
  });

  // Case 9: Positional weight indexed from 1 instead of 0
  it('case 9: diagnoses positional weight exponent offset', () => {
    // 101 in base 2: correct is 5. If weights 2^3, 2^2, 2^1 -> sum is 10.
    const sub = makeNumSub('101', 2, 10, '10');
    const res = validateNumberConversion(sub);
    expect(res.correct).toBe(false);
    if (!res.correct) {
      expect(res.misconceptionTag).toBe('wrong-radix-weight');
    }
  });

  // Cases 10-26: Grouping, Radix, Complements, Edge Cases
  it('case 10: validates correct grouping from base 2 to base 16 (11110000 -> f0)', () => {
    const sub = makeNumSub('11110000', 2, 16, 'f0');
    expect(validateNumberConversion(sub).correct).toBe(true);
  });

  it('case 11: diagnoses reversed grouping bit order (11110000 -> 0f)', () => {
    const sub = makeNumSub('11110000', 2, 16, '0f');
    const res = validateNumberConversion(sub);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-bit-order');
  });

  it('case 12: validates correct decimal to hex 255 -> ff', () => {
    const sub = makeNumSub('255', 10, 16, 'ff');
    expect(validateNumberConversion(sub).correct).toBe(true);
  });

  it('case 13: validates correct octal to binary 75 -> 111101', () => {
    const sub = makeNumSub('75', 8, 2, '111101');
    expect(validateNumberConversion(sub).correct).toBe(true);
  });

  it('case 14: diagnoses reversed octal to binary (75 -> 101111)', () => {
    const sub = makeNumSub('75', 8, 2, '101111');
    const res = validateNumberConversion(sub);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-bit-order');
  });

  it('case 15: validates hex to decimal 1a -> 26', () => {
    const sub = makeNumSub('1a', 16, 10, '26');
    expect(validateNumberConversion(sub).correct).toBe(true);
  });

  it('case 16: diagnoses hex weight offset 1a -> 416 (26 * 16)', () => {
    const sub = makeNumSub('1a', 16, 10, '416');
    const res = validateNumberConversion(sub);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-radix-weight');
  });

  it('case 17: validates 2\'s complement of 0000 (4-bit) = 0000', () => {
    const sub = makeNumSub('0000', 2, 2, '0000');
    expect(validateNumberConversion(sub, { claimedLaw: 'twos-complement', bitWidth: 4 }).correct).toBe(true);
  });

  it('case 18: diagnoses 1\'s complement 1111 for 0000 instead of 0000 in 2\'s complement', () => {
    const sub = makeNumSub('0000', 2, 2, '1111');
    const res = validateNumberConversion(sub, { claimedLaw: 'twos-complement', bitWidth: 4 });
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-complement');
  });

  it('case 19: validates unsigned addition 1111 + 0001 (4-bit) = 0000', () => {
    const sub = makeNumSub('1111 + 0001', 2, 2, '0000');
    expect(validateNumberConversion(sub, { claimedLaw: 'binary-addition', bitWidth: 4 }).correct).toBe(true);
  });

  it('case 20: validates decimal 42 to base 2 = 101010', () => {
    const sub = makeNumSub('42', 10, 2, '101010');
    expect(validateNumberConversion(sub).correct).toBe(true);
  });

  it('case 21: diagnoses reversed remainders for 42 -> 010101', () => {
    const sub = makeNumSub('42', 10, 2, '010101');
    const res = validateNumberConversion(sub);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-remainder-order');
  });

  it('case 22: validates binary to octal 111001 -> 71', () => {
    const sub = makeNumSub('111001', 2, 8, '71');
    expect(validateNumberConversion(sub).correct).toBe(true);
  });

  it('case 23: handles malformed source value gracefully', () => {
    const sub = makeNumSub('xyz', 10, 2, '0');
    const res = validateNumberConversion(sub);
    expect(res.correct).toBe(false);
  });

  it('case 24: handles wrong submission kind gracefully', () => {
    const sub: StepSubmission = {
      moduleId: 'numberSystems',
      stepId: 'num-step-x',
      timestamp: '2026-10-05T00:00:00Z',
      studentAnswer: { kind: 'boolean-step', appliedLaw: '', resultingExpression: 'A' },
    };
    const res = validateNumberConversion(sub);
    expect(res.correct).toBe(false);
  });

  it('case 25: validates decimal 0 -> base 2 = 0', () => {
    const sub = makeNumSub('0', 10, 2, '0');
    expect(validateNumberConversion(sub).correct).toBe(true);
  });

  it('case 26: validates decimal 100 -> base 16 = 64', () => {
    const sub = makeNumSub('100', 10, 16, '64');
    expect(validateNumberConversion(sub).correct).toBe(true);
  });
});

describe('Boolean Step Validator (30+ cases)', () => {
  function makeBoolSub(_before: string, after: string, law?: string): StepSubmission {
    return {
      moduleId: 'boolean',
      stepId: 'bool-step-1',
      timestamp: '2026-10-05T00:00:00Z',
      studentAnswer: {
        kind: 'boolean-step',
        appliedLaw: law ?? '',
        resultingExpression: after,
      },
    };
  }

  // Case 1: Valid De Morgan (A + B)' -> A' * B' with correct law
  it('case 1: validates correct De Morgan application and law', () => {
    const sub = makeBoolSub("(A + B)'", "A' * B'", 'de-morgan');
    const res = validateBooleanStep(sub, { previousStepAnswer: "(A + B)'" });
    expect(res.correct).toBe(true);
  });

  // Case 2: De Morgan without flipping operator: (A + B)' -> A' + B'
  it('case 2: diagnoses De Morgan without flipping operator', () => {
    const sub = makeBoolSub("(A + B)'", "A' + B'", 'de-morgan');
    const res = validateBooleanStep(sub, { previousStepAnswer: "(A + B)'" });
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('demorgan-misapplied');
  });

  // Case 3: De Morgan AND version without flipping operator: (A * B)' -> A' * B'
  it('case 3: diagnoses De Morgan AND variant without operator flip', () => {
    const sub = makeBoolSub("(A * B)'", "A' * B'", 'de-morgan');
    const res = validateBooleanStep(sub, { previousStepAnswer: "(A * B)'" });
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('demorgan-misapplied');
  });

  // Case 4: Absorption error: A + A'B -> A + B'
  it('case 4: diagnoses A + A\'B rewritten as A + B\'', () => {
    const sub = makeBoolSub("A + A'B", "A + B'", 'absorption');
    const res = validateBooleanStep(sub, { previousStepAnswer: "A + A'B" });
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('algebra-sign-error');
  });

  // Case 5: Dropped complement: A' -> A
  it('case 5: diagnoses dropped complement', () => {
    const sub = makeBoolSub("A'", "A", 'identity');
    const res = validateBooleanStep(sub, { previousStepAnswer: "A'" });
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-complement');
  });

  // Case 6: Distributed OR over OR: A + (B + C) -> (A + B) * (A + C)
  it('case 6: diagnoses invalid distribution of OR over OR', () => {
    const sub = makeBoolSub("A + (B + C)", "(A + B) * (A + C)", 'distributive');
    const res = validateBooleanStep(sub, { previousStepAnswer: "A + (B + C)" });
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('algebra-sign-error');
  });

  // Case 7: Equivalent transformation but wrong law cited (cited 'complement' instead of 'involution' for A'' -> A)
  it('case 7: diagnoses wrong-law-applied when equivalent step has wrong citation', () => {
    const sub = makeBoolSub("A''", "A", 'complement');
    const res = validateBooleanStep(sub, { previousStepAnswer: "A''" });
    expect(res.correct).toBe(false);
    if (!res.correct) {
      expect(res.misconceptionTag).toBe('wrong-law-applied');
      expect(res.errorType).toBe('invalid-law-application');
    }
  });

  // Case 8: Syntax error in resulting expression with position
  it('case 8: diagnoses syntax error with character position', () => {
    const sub = makeBoolSub("A + B", "A + (B *", 'identity');
    const res = validateBooleanStep(sub, { previousStepAnswer: "A + B" });
    expect(res.correct).toBe(false);
    if (!res.correct) {
      expect(res.errorType).toBe('syntax-error');
      expect(res.details).toContain('Syntax error at character');
    }
  });

  // Case 9: Non-equivalent arbitrary mismatch produces 'other' tag + counterexample
  it('case 9: produces "other" tag with counterexample for arbitrary unequal expression', () => {
    const sub = makeBoolSub("A * B", "A + B", 'identity');
    const res = validateBooleanStep(sub, { previousStepAnswer: "A * B" });
    expect(res.correct).toBe(false);
    if (!res.correct) {
      expect(res.misconceptionTag).toBe('other');
      expect(res.details).toContain('Counterexample:');
    }
  });

  // Cases 10-32: Diverse Boolean steps (identities, absorption, idempotence, null, etc.)
  it('case 10: validates idempotent law A + A -> A', () => {
    const sub = makeBoolSub("A + A", "A", 'idempotent');
    expect(validateBooleanStep(sub, { previousStepAnswer: "A + A" }).correct).toBe(true);
  });

  it('case 11: validates identity law A + 0 -> A', () => {
    const sub = makeBoolSub("A + 0", "A", 'identity');
    expect(validateBooleanStep(sub, { previousStepAnswer: "A + 0" }).correct).toBe(true);
  });

  it('case 12: validates null law A * 0 -> 0', () => {
    const sub = makeBoolSub("A * 0", "0", 'null');
    expect(validateBooleanStep(sub, { previousStepAnswer: "A * 0" }).correct).toBe(true);
  });

  it('case 13: validates complement law A + A\' -> 1', () => {
    const sub = makeBoolSub("A + A'", "1", 'complement');
    expect(validateBooleanStep(sub, { previousStepAnswer: "A + A'" }).correct).toBe(true);
  });

  it('case 14: validates complement law A * A\' -> 0', () => {
    const sub = makeBoolSub("A * A'", "0", 'complement');
    expect(validateBooleanStep(sub, { previousStepAnswer: "A * A'" }).correct).toBe(true);
  });

  it('case 15: validates involution A\'\' -> A', () => {
    const sub = makeBoolSub("A''", "A", 'involution');
    expect(validateBooleanStep(sub, { previousStepAnswer: "A''" }).correct).toBe(true);
  });

  it('case 16: validates absorption A + AB -> A', () => {
    const sub = makeBoolSub("A + (A * B)", "A", 'absorption');
    expect(validateBooleanStep(sub, { previousStepAnswer: "A + (A * B)" }).correct).toBe(true);
  });

  it('case 17: validates absorption A * (A + B) -> A', () => {
    const sub = makeBoolSub("A * (A + B)", "A", 'absorption');
    expect(validateBooleanStep(sub, { previousStepAnswer: "A * (A + B)" }).correct).toBe(true);
  });

  it('case 18: validates distributive law factoring A*B + A*C -> A*(B + C)', () => {
    const sub = makeBoolSub("A*B + A*C", "A * (B + C)", 'distributive');
    expect(validateBooleanStep(sub, { previousStepAnswer: "A*B + A*C" }).correct).toBe(true);
  });

  it('case 19: validates equivalent step without law specified', () => {
    const sub = makeBoolSub("A + 0", "A", '');
    expect(validateBooleanStep(sub, { previousStepAnswer: "A + 0" }).correct).toBe(true);
  });

  it('case 20: diagnoses syntax error in before expression', () => {
    const sub = makeBoolSub("A +", "A", '');
    const res = validateBooleanStep(sub, { previousStepAnswer: "A +" });
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.errorType).toBe('syntax-error');
  });

  it('case 21: handles wrong kind gracefully', () => {
    const sub: StepSubmission = {
      moduleId: 'boolean',
      stepId: 'bool-x',
      timestamp: '2026-10-05T00:00:00Z',
      studentAnswer: { kind: 'kmap-group', selectedCells: [0], expression: 'A' },
    };
    expect(validateBooleanStep(sub).correct).toBe(false);
  });

  it('case 22: validates single expression without before expression', () => {
    const sub = makeBoolSub('', 'A + B', '');
    expect(validateBooleanStep(sub).correct).toBe(true);
  });

  it('case 23: De Morgan shorthand (AB)\' -> A\' + B\'', () => {
    const sub = makeBoolSub("(AB)'", "A' + B'", 'de-morgan');
    expect(validateBooleanStep(sub, { previousStepAnswer: "(AB)'" }).correct).toBe(true);
  });

  it('case 24: De Morgan shorthand error (AB)\' -> A\'B\'', () => {
    const sub = makeBoolSub("(AB)'", "A'B'", 'de-morgan');
    const res = validateBooleanStep(sub, { previousStepAnswer: "(AB)'" });
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('demorgan-misapplied');
  });

  it('case 25: validates A * 1 -> A', () => {
    const sub = makeBoolSub("A * 1", "A", 'identity');
    expect(validateBooleanStep(sub, { previousStepAnswer: "A * 1" }).correct).toBe(true);
  });

  it('case 26: validates A + 1 -> 1', () => {
    const sub = makeBoolSub("A + 1", "1", 'null');
    expect(validateBooleanStep(sub, { previousStepAnswer: "A + 1" }).correct).toBe(true);
  });

  it('case 27: validates A * A -> A', () => {
    const sub = makeBoolSub("A * A", "A", 'idempotent');
    expect(validateBooleanStep(sub, { previousStepAnswer: "A * A" }).correct).toBe(true);
  });

  it('case 28: validates 3-variable equivalence (A + B) + C <-> A + (B + C)', () => {
    const sub = makeBoolSub("(A + B) + C", "A + (B + C)", '');
    expect(validateBooleanStep(sub, { previousStepAnswer: "(A + B) + C" }).correct).toBe(true);
  });

  it('case 29: validates commutative law A + B <-> B + A', () => {
    const sub = makeBoolSub("A + B", "B + A", '');
    expect(validateBooleanStep(sub, { previousStepAnswer: "A + B" }).correct).toBe(true);
  });

  it('case 30: validates XOR definition A ^ B <-> A*B\' + A\'*B', () => {
    const sub = makeBoolSub("A ^ B", "A*B' + A'*B", '');
    expect(validateBooleanStep(sub, { previousStepAnswer: "A ^ B" }).correct).toBe(true);
  });

  it('case 31: diagnoses inequivalent XOR rewrite A ^ B -> A + B', () => {
    const sub = makeBoolSub("A ^ B", "A + B", '');
    const res = validateBooleanStep(sub, { previousStepAnswer: "A ^ B" });
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('other');
  });

  it('case 32: parses complex nested expression without syntax error', () => {
    const sub = makeBoolSub("(A + B') * (C + D)'", "(A + B') * C' * D'", 'de-morgan');
    expect(validateBooleanStep(sub, { previousStepAnswer: "(A + B') * (C + D)'" }).correct).toBe(true);
  });
});
