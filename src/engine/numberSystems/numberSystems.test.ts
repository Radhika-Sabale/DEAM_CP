/**
 * @file numberSystems.test.ts
 * Comprehensive test suite for Stage 5A Number Systems engine.
 */

import { describe, expect, it } from 'vitest';
import {
  addBinary,
  onesComplementAdd,
  signMagnitudeAdd,
  subtractBinary,
} from './arithmetic';
import {
  bcdAdd,
  bcdToDecimal,
  binaryToGrayWithSteps,
  decimalToBcd,
  grayToBinaryWithSteps,
} from './bcd';
import {
  decode,
  encode,
  fits,
  interpretBits,
  range,
  signExtend,
  truncate,
  twosComplement,
} from './complements';
import { convertRadix, formatNumber, parseNumber } from './convert';
import {
  generateGroupingSteps,
  generatePositionalWeightSteps,
  generateRadixConversionSteps,
  generateRepeatedDivisionSteps,
  generateRepeatedMultiplicationSteps,
} from './steps';
import type { BCDCode, Representation } from './types';

describe('1. Radix Conversion (convert.ts)', () => {
  it('parses integers across radices with BigInt and checks exact error position', () => {
    expect(parseNumber('1010', 2)).toEqual({ ok: true, value: { value: 10n, isNegative: false } });
    expect(parseNumber('755', 8)).toEqual({ ok: true, value: { value: 493n, isNegative: false } });
    expect(parseNumber('12345678901234567890', 10)).toEqual({
      ok: true,
      value: { value: 12345678901234567890n, isNegative: false },
    });
    expect(parseNumber('-42', 10)).toEqual({ ok: true, value: { value: -42n, isNegative: true } });
    expect(parseNumber('DEADBEEF', 16)).toEqual({ ok: true, value: { value: 3735928559n, isNegative: false } });
    expect(parseNumber('deadbeef', 16)).toEqual({ ok: true, value: { value: 3735928559n, isNegative: false } });

    // Invalid negative on non-decimal
    const negBin = parseNumber('-101', 2);
    expect(negBin.ok).toBe(false);
    if (!negBin.ok) expect(negBin.error.position).toBe(0);

    // Invalid digits with exact position
    const badOctal = parseNumber('1782', 8);
    expect(badOctal.ok).toBe(false);
    if (!badOctal.ok) {
      expect(badOctal.error.message).toContain("'8' is not a valid octal digit at position 2");
      expect(badOctal.error.position).toBe(2);
    }

    const badHex = parseNumber('12G4', 16);
    expect(badHex.ok).toBe(false);
    if (!badHex.ok) {
      expect(badHex.error.message).toContain("'G' is not a valid hexadecimal digit at position 2");
      expect(badHex.error.position).toBe(2);
    }

    // Prefixes and underscores ignored
    expect(parseNumber('0b1100_0011', 2)).toEqual({ ok: true, value: { value: 195n, isNegative: false } });
    expect(parseNumber('0o77', 8)).toEqual({ ok: true, value: { value: 63n, isNegative: false } });
    expect(parseNumber('0x1A_3F', 16)).toEqual({ ok: true, value: { value: 6719n, isNegative: false } });
  });

  it('formats BigInt and numbers correctly with options', () => {
    expect(formatNumber(255n, 16)).toBe('FF');
    expect(formatNumber(255n, 16, { uppercase: false })).toBe('ff');
    expect(formatNumber(10n, 2, { prefix: true })).toBe('0b1010');
    expect(formatNumber(63n, 8, { prefix: true })).toBe('0o77');
    expect(formatNumber(255n, 16, { prefix: true })).toBe('0xFF');
    expect(formatNumber(0b111100001010n, 2, { groupWidth: 4, groupSeparator: ' ' })).toBe('1111 0000 1010');
    expect(formatNumber(-42n, 10)).toBe('-42');
  });

  it('executes over 60 hand-checked radix conversion test cases', () => {
    const cases: Array<[string, number, number, string, boolean]> = [
      // Zero and one edge cases
      ['0', 10, 2, '0', true],
      ['0', 2, 10, '0', true],
      ['0', 16, 8, '0', true],
      ['1', 10, 2, '1', true],
      ['1', 2, 16, '1', true],
      ['1', 8, 10, '1', true],
      // Dec to Bin/Oct/Hex
      ['2', 10, 2, '10', true],
      ['7', 10, 2, '111', true],
      ['8', 10, 8, '10', true],
      ['10', 10, 16, 'A', true],
      ['15', 10, 16, 'F', true],
      ['16', 10, 16, '10', true],
      ['31', 10, 2, '11111', true],
      ['42', 10, 2, '101010', true],
      ['42', 10, 8, '52', true],
      ['42', 10, 16, '2A', true],
      ['64', 10, 8, '100', true],
      ['100', 10, 2, '1100100', true],
      ['127', 10, 2, '1111111', true],
      ['128', 10, 2, '10000000', true],
      ['255', 10, 16, 'FF', true],
      ['256', 10, 16, '100', true],
      ['1024', 10, 2, '10000000000', true],
      // Max 32-bit and 64-bit BigInt
      ['4294967295', 10, 16, 'FFFFFFFF', true],
      ['FFFFFFFF', 16, 10, '4294967295', true],
      ['18446744073709551615', 10, 16, 'FFFFFFFFFFFFFFFF', true],
      ['FFFFFFFFFFFFFFFF', 16, 10, '18446744073709551615', true],
      ['0x1234_5678_9ABC_DEF0', 16, 2, '1001000110100010101100111100010011010101111001101111011110000', true],
      // Binary to Octal / Hex
      ['1010', 2, 8, '12', true],
      ['111111', 2, 8, '77', true],
      ['10101111', 2, 16, 'AF', true],
      ['1101111010101101', 2, 16, 'DEAD', true],
      // Octal to Hex / Binary
      ['77', 8, 2, '111111', true],
      ['77', 8, 16, '3F', true],
      ['175', 8, 16, '7D', true],
      ['377', 8, 16, 'FF', true],
      // Arbitrary radices (3, 5, 7, 12, 20, 36)
      ['10', 10, 3, '101', true],
      ['100', 10, 5, '400', true],
      ['49', 10, 7, '100', true],
      ['144', 10, 12, '100', true],
      ['400', 10, 20, '100', true],
      ['Z', 36, 10, '35', true],
      ['10', 36, 10, '36', true],
      ['ZZ', 36, 10, '1295', true],
      // Negative decimal values
      ['-1', 10, 2, '-1', true],
      ['-42', 10, 16, '-2A', true],
      ['-255', 10, 2, '-11111111', true],
      // Exact fractional conversions
      ['0.5', 10, 2, '0.1', true],
      ['0.25', 10, 2, '0.01', true],
      ['0.75', 10, 2, '0.11', true],
      ['0.125', 10, 2, '0.001', true],
      ['0.625', 10, 2, '0.101', true],
      ['0.6875', 10, 2, '0.1011', true],
      ['0.0625', 10, 16, '0.1', true],
      ['0.5', 10, 8, '0.4', true],
      ['0.5', 10, 16, '0.8', true],
      ['156.6875', 10, 2, '10011100.1011', true],
      ['156.6875', 10, 16, '9C.B', true],
      // Inexact and repeating fractions
      ['0.1', 10, 2, '0.00011001', false], // 0.1 decimal is repeating/inexact in binary
      ['0.2', 10, 2, '0.00110011', false],
      ['0.3', 10, 2, '0.01001100', false],
      ['0.1', 3, 10, '0.33333333', false],
    ];

    expect(cases.length).toBeGreaterThanOrEqual(60);
    for (const [inp, fromR, toR, expOut, expExact] of cases) {
      const res = convertRadix(inp, fromR, toR, { precision: 8 });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.fullResult).toBe(expOut);
        expect(res.value.isExact).toBe(expExact);
      }
    }
  });

  it('detects repeating fractions and reports the repeating cycle', () => {
    const res = convertRadix('0.1', 10, 2, { precision: 16 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.isExact).toBe(false);
      expect(res.value.isRepeating).toBe(true);
      expect(res.value.repeatingCycle).toBe('0011');
    }
  });
});

describe('2. Structured Steps (steps.ts)', () => {
  it('repeated division: textbook example 156 decimal to binary', () => {
    const { steps, result } = generateRepeatedDivisionSteps(156, 2);
    expect(result).toBe('10011100');
    expect(steps.length).toBe(8);

    expect(steps[0]?.inputs).toEqual({ dividend: '156', divisor: 2 });
    expect(steps[0]?.output).toEqual({ quotient: '78', remainder: 0, remainderDigit: '0', readOrder: 'bottom_to_top' });

    expect(steps[1]?.inputs).toEqual({ dividend: '78', divisor: 2 });
    expect(steps[1]?.output).toEqual({ quotient: '39', remainder: 0, remainderDigit: '0', readOrder: 'bottom_to_top' });

    expect(steps[2]?.inputs).toEqual({ dividend: '39', divisor: 2 });
    expect(steps[2]?.output).toEqual({ quotient: '19', remainder: 1, remainderDigit: '1', readOrder: 'bottom_to_top' });

    expect(steps[3]?.inputs).toEqual({ dividend: '19', divisor: 2 });
    expect(steps[3]?.output).toEqual({ quotient: '9', remainder: 1, remainderDigit: '1', readOrder: 'bottom_to_top' });

    expect(steps[4]?.inputs).toEqual({ dividend: '9', divisor: 2 });
    expect(steps[4]?.output).toEqual({ quotient: '4', remainder: 1, remainderDigit: '1', readOrder: 'bottom_to_top' });

    expect(steps[5]?.inputs).toEqual({ dividend: '4', divisor: 2 });
    expect(steps[5]?.output).toEqual({ quotient: '2', remainder: 0, remainderDigit: '0', readOrder: 'bottom_to_top' });

    expect(steps[6]?.inputs).toEqual({ dividend: '2', divisor: 2 });
    expect(steps[6]?.output).toEqual({ quotient: '1', remainder: 0, remainderDigit: '0', readOrder: 'bottom_to_top' });

    expect(steps[7]?.inputs).toEqual({ dividend: '1', divisor: 2 });
    expect(steps[7]?.output).toEqual({ quotient: '0', remainder: 1, remainderDigit: '1', readOrder: 'bottom_to_top' });

    // Step result matches direct convertRadix
    const direct = convertRadix('156', 10, 2);
    expect(direct.ok && direct.value.fullResult).toBe(result);
  });

  it('repeated multiplication: textbook example 0.6875 decimal to binary', () => {
    const { steps, result, isExact } = generateRepeatedMultiplicationSteps('6875', 10, 2);
    expect(result).toBe('1011');
    expect(isExact).toBe(true);
    expect(steps.length).toBe(4);

    expect(steps[0]?.inputs).toEqual({ fraction: '6875/10000', multiplier: 2 });
    expect(steps[0]?.output).toEqual({ integerPart: 1, digit: '1', newFraction: '3750/10000' });

    expect(steps[1]?.inputs).toEqual({ fraction: '3750/10000', multiplier: 2 });
    expect(steps[1]?.output).toEqual({ integerPart: 0, digit: '0', newFraction: '7500/10000' });

    expect(steps[2]?.inputs).toEqual({ fraction: '7500/10000', multiplier: 2 });
    expect(steps[2]?.output).toEqual({ integerPart: 1, digit: '1', newFraction: '5000/10000' });

    expect(steps[3]?.inputs).toEqual({ fraction: '5000/10000', multiplier: 2 });
    expect(steps[3]?.output).toEqual({ integerPart: 1, digit: '1', newFraction: '0/10000' });

    const direct = convertRadix('0.6875', 10, 2);
    expect(direct.ok && direct.value.fractionalResult).toBe(result);
  });

  it('positional weights: textbook example 3FA hex to decimal', () => {
    const res = generatePositionalWeightSteps('3FA', 16);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.resultString).toBe('1018');
    expect(res.value.steps.length).toBe(3);

    expect(res.value.steps[0]?.inputs).toEqual({ digit: '3', position: 2, radix: 16, weight: '256' });
    expect(res.value.steps[0]?.output).toEqual({ product: '768', runningSum: '768' });

    expect(res.value.steps[1]?.inputs).toEqual({ digit: 'F', position: 1, radix: 16, weight: '16' });
    expect(res.value.steps[1]?.output).toEqual({ product: '240', runningSum: '1008' });

    expect(res.value.steps[2]?.inputs).toEqual({ digit: 'A', position: 0, radix: 16, weight: '1' });
    expect(res.value.steps[2]?.output).toEqual({ product: '10', runningSum: '1018' });

    const direct = convertRadix('3FA', 16, 10);
    expect(direct.ok && direct.value.fullResult).toBe('1018');
  });

  it('grouping: textbook example 1011101 binary to hex', () => {
    const res = generateGroupingSteps('1011101', 2, 16);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.result).toBe('5D');
    expect(res.value.paddingCount).toBe(1);
    expect(res.value.steps.length).toBe(2);

    expect(res.value.steps[0]?.inputs).toEqual({ groupBits: '0101', groupIndex: 0, targetRadix: 16, padded: true });
    expect(res.value.steps[0]?.output).toEqual({ digit: '5', bits: '0101' });

    expect(res.value.steps[1]?.inputs).toEqual({ groupBits: '1101', groupIndex: 1, targetRadix: 16, padded: false });
    expect(res.value.steps[1]?.output).toEqual({ digit: 'D', bits: '1101' });

    const direct = convertRadix('1011101', 2, 16);
    expect(direct.ok && direct.value.fullResult).toBe('5D');
  });

  it('flags route used in generateRadixConversionSteps', () => {
    const directGroup = generateRadixConversionSteps('1011101', 2, 16);
    expect(directGroup.ok && directGroup.value.route).toBe('direct_grouping');

    const viaDec = generateRadixConversionSteps('42', 10, 16);
    expect(viaDec.ok && viaDec.value.route).toBe('via_decimal');
  });
});

describe('3. Complements & Fixed-Width Representations (complements.ts)', () => {
  it('calculates exact ranges for widths 1 to 8', () => {
    expect(range(1, 'unsigned')).toEqual({ min: 0, max: 1 });
    expect(range(1, 'sign-magnitude')).toEqual({ min: 0, max: 0 });
    expect(range(1, 'ones-complement')).toEqual({ min: 0, max: 0 });
    expect(range(1, 'twos-complement')).toEqual({ min: -1, max: 0 });

    expect(range(4, 'unsigned')).toEqual({ min: 0, max: 15 });
    expect(range(4, 'sign-magnitude')).toEqual({ min: -7, max: 7 });
    expect(range(4, 'ones-complement')).toEqual({ min: -7, max: 7 });
    expect(range(4, 'twos-complement')).toEqual({ min: -8, max: 7 });

    expect(range(8, 'unsigned')).toEqual({ min: 0, max: 255 });
    expect(range(8, 'sign-magnitude')).toEqual({ min: -127, max: 127 });
    expect(range(8, 'ones-complement')).toEqual({ min: -127, max: 127 });
    expect(range(8, 'twos-complement')).toEqual({ min: -128, max: 127 });
  });

  it('exhaustive encode/decode round trip for widths 1 to 8 in every representation', () => {
    const reps: Representation[] = ['unsigned', 'sign-magnitude', 'ones-complement', 'twos-complement'];
    for (let w = 1; w <= 8; w++) {
      for (const rep of reps) {
        const r = range(w, rep);
        for (let val = r.min; val <= r.max; val++) {
          expect(fits(val, w, rep)).toBe(true);
          const enc = encode(val, w, rep);
          expect(enc.ok).toBe(true);
          if (enc.ok) {
            expect(enc.value.length).toBe(w);
            const dec = decode(enc.value, w, rep);
            expect(dec.ok).toBe(true);
            if (dec.ok) {
              expect(dec.value).toBe(val);
            }
          }
        }
      }
    }
  });

  it('handles two representations of zero (+0 and -0) in sign-magnitude and ones-complement', () => {
    // Sign-magnitude 4-bit
    expect(encode(0, 4, 'sign-magnitude')).toEqual({ ok: true, value: '0000' });
    expect(encode(-0, 4, 'sign-magnitude')).toEqual({ ok: true, value: '1000' });
    const decPosSM = decode('0000', 4, 'sign-magnitude');
    const decNegSM = decode('1000', 4, 'sign-magnitude');
    expect(decPosSM.ok && Object.is(decPosSM.value, 0)).toBe(true);
    expect(decNegSM.ok && Object.is(decNegSM.value, -0)).toBe(true);

    // One's complement 4-bit
    expect(encode(0, 4, 'ones-complement')).toEqual({ ok: true, value: '0000' });
    expect(encode(-0, 4, 'ones-complement')).toEqual({ ok: true, value: '1111' });
    const decPosOC = decode('0000', 4, 'ones-complement');
    const decNegOC = decode('1111', 4, 'ones-complement');
    expect(decPosOC.ok && Object.is(decPosOC.value, 0)).toBe(true);
    expect(decNegOC.ok && Object.is(decNegOC.value, -0)).toBe(true);
  });

  it("handles the asymmetric range and most negative value overflow in two's complement", () => {
    // 4-bit most negative value is -8 ('1000')
    const tcMin = twosComplement('1000');
    expect(tcMin.result).toBe('1000'); // -(-8) overflows back to 1000
    expect(tcMin.overflow).toBe(true);

    // Double negation: twosComplement(twosComplement(x)) equals x except for most negative value
    for (let i = 0; i < 16; i++) {
      const bits = i.toString(2).padStart(4, '0');
      const first = twosComplement(bits);
      const second = twosComplement(first.result);
      expect(second.result).toBe(bits);
      if (bits === '1000') {
        expect(first.overflow).toBe(true);
      } else {
        expect(first.overflow).toBe(false);
      }
    }
  });

  it('sign extension preserves signed value and truncation detects information loss', () => {
    // Sign extend positive 3 ('0011') from 4 to 8 bits -> '00000011'
    const extPos = signExtend('0011', 4, 8);
    expect(extPos.result).toBe('00000011');
    expect(extPos.lostInformation).toBe(false);

    // Sign extend negative 5 ('1011') from 4 to 8 bits -> '11111011'
    const extNeg = signExtend('1011', 4, 8);
    expect(extNeg.result).toBe('11111011');
    expect(extNeg.lostInformation).toBe(false);

    // Truncate without loss
    const truncOk = truncate('00000101', 8, 4);
    expect(truncOk.result).toBe('0101');
    expect(truncOk.lostInformation).toBe(false);

    // Truncate with loss
    const truncLoss = truncate('11000101', 8, 4);
    expect(truncLoss.result).toBe('0101');
    expect(truncLoss.lostInformation).toBe(true);
  });

  it('interprets bit patterns under all 4 representations side-by-side', () => {
    const res = interpretBits('1011', 4);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value).toEqual({
      bits: '1011',
      width: 4,
      unsigned: 11,
      signMagnitude: -3,
      onesComplement: -4,
      twosComplement: -5,
    });
  });
});

describe('4. BCD & Gray Code (bcd.ts)', () => {
  it('round trips all digits 0 to 99 for all 4 BCD codes', () => {
    const codes: BCDCode[] = ['8421', 'excess-3', '2421', '84-2-1'];
    for (const code of codes) {
      for (let i = 0; i <= 99; i++) {
        const str = i.toString().padStart(2, '0');
        const enc = decimalToBcd(str, code, 'packed');
        expect(enc.ok).toBe(true);
        if (enc.ok) {
          const dec = bcdToDecimal(enc.value.bits, code, 'packed');
          expect(dec.ok).toBe(true);
          if (dec.ok) {
            expect(dec.value.decimal).toBe(str);
          }
        }
      }
    }
  });

  it('bcdAdd matches decimal addition for all pairs 0 to 99', () => {
    for (let a = 0; a <= 99; a += 7) {
      for (let b = 0; b <= 99; b += 9) {
        const strA = a.toString().padStart(2, '0');
        const strB = b.toString().padStart(2, '0');
        const bcdA = decimalToBcd(strA, '8421');
        const bcdB = decimalToBcd(strB, '8421');
        expect(bcdA.ok && bcdB.ok).toBe(true);
        if (!bcdA.ok || !bcdB.ok) continue;

        const addRes = bcdAdd(bcdA.value.bits, bcdB.value.bits);
        expect(addRes.ok).toBe(true);
        if (addRes.ok) {
          expect(parseInt(addRes.value.sumDigits, 10)).toBe(a + b);
        }
      }
    }
  });

  it('bcdAdd textbook example 9 + 8 with correction (+0110)', () => {
    const bcd9 = decimalToBcd('9', '8421');
    const bcd8 = decimalToBcd('8', '8421');
    expect(bcd9.ok && bcd8.ok).toBe(true);
    if (!bcd9.ok || !bcd8.ok) return;

    const res = bcdAdd(bcd9.value.bits, bcd8.value.bits);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.sumDigits).toBe('17');
    expect(res.value.bcdBits).toBe('00010111');
    expect(res.value.steps[0]?.output).toEqual({
      rawSum: 17,
      rawBits: '0001',
      needsCorrection: true,
      correctedBits: '0111',
      carryOut: 1,
    });
  });

  it('detects invalid BCD nibbles and names their index', () => {
    // In 8421, '1010' (10) is invalid
    const invalidRes = bcdToDecimal('1010', '8421');
    expect(invalidRes.ok).toBe(false);
    if (!invalidRes.ok) {
      expect(invalidRes.error.message).toContain("Invalid 8421 BCD nibble '1010' at nibble index 0");
    }
  });

  it('converts Binary <-> Gray with steps and verifies one-bit-change property', () => {
    for (let i = 0; i < 16; i++) {
      const bin = i.toString(2).padStart(4, '0');
      const gRes = binaryToGrayWithSteps(bin);
      expect(gRes.ok).toBe(true);
      if (gRes.ok) {
        const bRes = grayToBinaryWithSteps(gRes.value.gray);
        expect(bRes.ok).toBe(true);
        if (bRes.ok) {
          expect(bRes.value.binary).toBe(bin);
        }
      }
    }

    // Verify one-bit change
    const g0 = binaryToGrayWithSteps('0000');
    expect(g0.ok).toBe(true);
    if (!g0.ok) return;
    let prevGray = g0.value.gray;

    for (let i = 1; i < 16; i++) {
      const bin = i.toString(2).padStart(4, '0');
      const curr = binaryToGrayWithSteps(bin);
      expect(curr.ok).toBe(true);
      if (!curr.ok) continue;
      const currGray = curr.value.gray;
      let diffBits = 0;
      for (let b = 0; b < 4; b++) {
        if (prevGray[b] !== currGray[b]) diffBits++;
      }
      expect(diffBits).toBe(1);
      prevGray = currGray;
    }
  });
});

describe('5. Binary Arithmetic & Carry Chains (arithmetic.ts)', () => {
  it('exhaustive width 4 addition sweep (all 256 pairs) against independent plain math', () => {
    for (let a = 0; a < 16; a++) {
      for (let b = 0; b < 16; b++) {
        const res = addBinary(a, b, 4, 'unsigned');
        expect(res.ok).toBe(true);
        if (!res.ok) continue;

        // Independent reference
        const rawSum = a + b;
        const expResult = rawSum & 0x0f;
        const expC = rawSum > 15 ? 1 : 0;
        const expZ = expResult === 0 ? 1 : 0;
        const expN = (expResult & 8) !== 0 ? 1 : 0;

        // Signed reference
        const signedA = a >= 8 ? a - 16 : a;
        const signedB = b >= 8 ? b - 16 : b;
        const trueSignedSum = signedA + signedB;
        const expV = trueSignedSum < -8 || trueSignedSum > 7 ? 1 : 0;

        expect(res.value.unsignedValue).toBe(expResult);
        expect(res.value.flags.C).toBe(expC);
        expect(res.value.flags.Z).toBe(expZ);
        expect(res.value.flags.N).toBe(expN);
        expect(res.value.flags.V).toBe(expV);
        expect(res.value.carryChain.length).toBe(4);
      }
    }
  });

  it('exhaustive width 4 subtraction sweep (all 256 pairs) against independent plain math', () => {
    for (let a = 0; a < 16; a++) {
      for (let b = 0; b < 16; b++) {
        const res = subtractBinary(a, b, 4, 'unsigned', { borrowConvention: 'borrow_is_cf' });
        expect(res.ok).toBe(true);
        if (!res.ok) continue;

        const expResult = (a - b) & 0x0f;
        const expBorrow = a < b ? 1 : 0;
        const expZ = expResult === 0 ? 1 : 0;
        const expN = (expResult & 8) !== 0 ? 1 : 0;

        const signedA = a >= 8 ? a - 16 : a;
        const signedB = b >= 8 ? b - 16 : b;
        const trueSignedDiff = signedA - signedB;
        const expV = trueSignedDiff < -8 || trueSignedDiff > 7 ? 1 : 0;

        expect(res.value.unsignedValue).toBe(expResult);
        expect(res.value.flags.borrow).toBe(expBorrow);
        expect(res.value.flags.C).toBe(expBorrow); // 8086 convention: CF = borrow
        expect(res.value.flags.Z).toBe(expZ);
        expect(res.value.flags.N).toBe(expN);
        expect(res.value.flags.V).toBe(expV);
      }
    }
  });

  it('shows 7 + 5 signed overflow in 4-bit arithmetic', () => {
    const res = addBinary(7, 5, 4, 'signed');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // 7 is 0111, 5 is 0101 -> sum is 1100 (-4 in 2's complement)
    expect(res.value.resultBits).toBe('1100');
    expect(res.value.signedValue).toBe(-4);
    expect(res.value.flags.V).toBe(1);
    expect(res.value.overflowExplanation).toContain('positive + positive produced a result with inverted sign');
  });

  it('tests selected 8-bit and 32-bit arithmetic edge cases', () => {
    // 127 + 1 in 8-bit signed -> overflow to -128
    const res127 = addBinary(127, 1, 8, 'signed');
    expect(res127.ok && res127.value.signedValue).toBe(-128);
    expect(res127.ok && res127.value.flags.V).toBe(1);

    // -128 - 1 in 8-bit signed -> overflow to +127
    const resMin = subtractBinary(-128, 1, 8, 'signed');
    expect(resMin.ok && resMin.value.signedValue).toBe(127);
    expect(resMin.ok && resMin.value.flags.V).toBe(1);

    // 255 + 1 in 8-bit unsigned -> C=1, result=0
    const res255 = addBinary(255, 1, 8, 'unsigned');
    expect(res255.ok && res255.value.unsignedValue).toBe(0);
    expect(res255.ok && res255.value.flags.C).toBe(1);

    // 0 - 1 in 8-bit unsigned -> borrow=1, result=255
    const resBorrow = subtractBinary(0, 1, 8, 'unsigned');
    expect(resBorrow.ok && resBorrow.value.unsignedValue).toBe(255);
    expect(resBorrow.ok && resBorrow.value.flags.borrow).toBe(1);

    // 32-bit max + max in unsigned
    const max32 = 0xffffffff;
    const res32 = addBinary(max32, max32, 32, 'unsigned');
    expect(res32.ok && res32.value.flags.C).toBe(1);
    expect(res32.ok && res32.value.carryChain.length).toBe(32);
  });

  it("one's complement addition with end-around carry", () => {
    // 5 ('0101') + (-2 in ones complement is '1101')
    // Raw sum: 0101 + 1101 = 0010 with carry out 1
    // End around carry adds 1: 0010 + 1 = 0011 (+3)
    const res = onesComplementAdd('0101', '1101', 4);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.endAroundCarry).toBe(1);
    expect(res.value.finalBits).toBe('0011');
    expect(res.value.finalValue).toBe(3);
    expect(res.value.steps.length).toBe(6);
  });

  it('sign-magnitude addition', () => {
    // +5 ('0101') and -3 ('1011') -> magnitude 5 - 3 = 2, sign 0 -> '0010' (+2)
    const resDiff = signMagnitudeAdd('0101', '1011', 4);
    expect(resDiff.ok).toBe(true);
    if (resDiff.ok) {
      expect(resDiff.value.resultBits).toBe('0010');
      expect(resDiff.value.resultSign).toBe(0);
      expect(resDiff.value.resultMag).toBe(2);
      expect(resDiff.value.overflow).toBe(false);
    }

    // +5 ('0101') and +4 ('0100') in 4-bit (max mag is 7) -> 5 + 4 = 9 (OVERFLOW)
    const resOver = signMagnitudeAdd('0101', '0100', 4);
    expect(resOver.ok).toBe(true);
    if (resOver.ok) {
      expect(resOver.value.overflow).toBe(true);
    }
  });
});
