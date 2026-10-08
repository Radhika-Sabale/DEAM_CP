/**
 * @file steps.ts
 * Detailed step generators for number system conversions.
 * Produces structured, machine-checkable step lists for teaching and Stage 6 student validation.
 */

import { charToDigitValue, digitValueToChar, tokenizeNumber, validateRadix } from './convert';
import type { ConvertRadixOptions, NumberSystemResult, RadixConversionResult, StepRecord } from './types';

/** Repeated division steps for converting a decimal integer to target radix. */
export function generateRepeatedDivisionSteps(
  decimalValue: bigint | number,
  targetRadix: number,
): { steps: readonly StepRecord[]; result: string } {
  validateRadix(targetRadix, 'targetRadix');
  let cur = typeof decimalValue === 'bigint' ? decimalValue : BigInt(Math.trunc(decimalValue));
  if (cur < 0n) cur = -cur;
  const bigR = BigInt(targetRadix);
  const steps: StepRecord[] = [];
  const remainders: string[] = [];

  if (cur === 0n) {
    steps.push({
      kind: 'division',
      description: `0 ÷ ${targetRadix} = 0, remainder 0`,
      inputs: { dividend: '0', divisor: targetRadix },
      output: { quotient: '0', remainder: 0, remainderDigit: '0', readOrder: 'bottom_to_top' },
    });
    return { steps, result: '0' };
  }

  let stepIdx = 1;
  while (cur > 0n) {
    const quot = cur / bigR;
    const rem = Number(cur % bigR);
    const remDigit = digitValueToChar(rem);
    remainders.push(remDigit);
    steps.push({
      kind: 'division',
      description: `Step ${stepIdx}: ${cur} ÷ ${targetRadix} = ${quot}, remainder ${remDigit}`,
      inputs: { dividend: cur.toString(), divisor: targetRadix },
      output: { quotient: quot.toString(), remainder: rem, remainderDigit: remDigit, readOrder: 'bottom_to_top' },
    });
    cur = quot;
    stepIdx++;
  }
  return { steps, result: remainders.slice().reverse().join('') };
}

/** Repeated multiplication steps for converting a fractional part to target radix. */
export function generateRepeatedMultiplicationSteps(
  fractionDigits: string,
  fromRadix: number,
  targetRadix: number,
  precision = 8,
): { steps: readonly StepRecord[]; result: string; isExact: boolean; isRepeating: boolean; repeatingCycle?: string } {
  validateRadix(fromRadix, 'fromRadix');
  validateRadix(targetRadix, 'targetRadix');
  const bigFrom = BigInt(fromRadix);
  const bigTo = BigInt(targetRadix);
  let num = 0n;
  let den = 1n;
  for (let i = 0; i < fractionDigits.length; i++) {
    num = num * bigFrom + BigInt(charToDigitValue(fractionDigits[i] ?? ''));
    den = den * bigFrom;
  }
  const steps: StepRecord[] = [];
  const seen = new Map<string, number>();
  let out = '';
  let cur = num;
  let isRepeating = false;
  let repeatingCycle: string | undefined;
  let step = 0;

  while (cur > 0n && step < precision) {
    const key = cur.toString();
    if (!isRepeating && seen.has(key)) {
      isRepeating = true;
      repeatingCycle = out.slice(seen.get(key) ?? 0);
    }
    if (!seen.has(key)) {
      seen.set(key, step);
    }
    const mult = cur * bigTo;
    const digitBig = mult / den;
    const nextCur = mult % den;
    const digitChar = digitValueToChar(Number(digitBig));
    steps.push({
      kind: 'multiplication',
      description: `Step ${step + 1}: (${cur}/${den}) × ${targetRadix} = ${mult}/${den} -> int ${digitChar}, rem ${nextCur}/${den}`,
      inputs: { fraction: `${cur}/${den}`, multiplier: targetRadix },
      output: { integerPart: Number(digitBig), digit: digitChar, newFraction: `${nextCur}/${den}` },
    });
    out += digitChar;
    cur = nextCur;
    step++;
    if (cur === 0n) break;
  }
  const result = out.length === 0 ? '0' : out;
  return { steps, result, isExact: cur === 0n, isRepeating, repeatingCycle };
}

/** Positional weight expansion steps for converting any radix integer to decimal. */
export function generatePositionalWeightSteps(
  text: string,
  radix: number,
): NumberSystemResult<{ steps: readonly StepRecord[]; decimalSum: bigint; resultString: string }> {
  validateRadix(radix, 'radix');
  const tok = tokenizeNumber(text, radix, false);
  if (!tok.ok) return tok;
  const { isNegative, integerDigits } = tok.value;
  const bigRadix = BigInt(radix);
  const steps: StepRecord[] = [];
  let runningSum = 0n;
  const len = integerDigits.length;

  for (let i = 0; i < len; i++) {
    const pos = len - 1 - i;
    const ch = integerDigits[i] ?? '';
    const digitVal = charToDigitValue(ch);
    const weight = bigRadix ** BigInt(pos);
    const product = BigInt(digitVal) * weight;
    runningSum += product;
    steps.push({
      kind: 'positional_weight',
      description: `'${ch}' × ${radix}^${pos} (${weight}) = ${product} (running sum: ${runningSum})`,
      inputs: { digit: ch, position: pos, radix, weight: weight.toString() },
      output: { product: product.toString(), runningSum: runningSum.toString() },
    });
  }
  const finalSum = isNegative ? -runningSum : runningSum;
  return { ok: true, value: { steps, decimalSum: finalSum, resultString: finalSum.toString(10) } };
}

/** Grouping shortcut steps between power-of-two radices (2, 8, 16). */
export function generateGroupingSteps(
  text: string,
  fromRadix: 2 | 8 | 16,
  toRadix: 2 | 8 | 16,
): NumberSystemResult<{ steps: readonly StepRecord[]; result: string; paddingCount: number }> {
  validateRadix(fromRadix, 'fromRadix');
  validateRadix(toRadix, 'toRadix');
  const tok = tokenizeNumber(text, fromRadix, false);
  if (!tok.ok) return tok;
  const { isNegative, integerDigits } = tok.value;
  const steps: StepRecord[] = [];

  const groupBinary = (binStr: string, targetRadix: 8 | 16) => {
    const gSize = targetRadix === 8 ? 3 : 4;
    const rem = binStr.length % gSize;
    const paddingCount = rem === 0 ? 0 : gSize - rem;
    const padded = '0'.repeat(paddingCount) + binStr;
    let out = '';
    const groupCount = padded.length / gSize;
    for (let g = 0; g < groupCount; g++) {
      const chunk = padded.slice(g * gSize, (g + 1) * gSize);
      const digitChar = digitValueToChar(parseInt(chunk, 2));
      out += digitChar;
      steps.push({
        kind: 'grouping',
        description: `Group ${g + 1} (${chunk}) in base 2 -> '${digitChar}' in base ${targetRadix}`,
        inputs: { groupBits: chunk, groupIndex: g, targetRadix, padded: g === 0 && paddingCount > 0 },
        output: { digit: digitChar, bits: chunk },
      });
    }
    const cleanOut = out.replace(/^0+/, '') || '0';
    return { result: `${isNegative ? '-' : ''}${cleanOut}`, paddingCount };
  };

  if (fromRadix === 2 && (toRadix === 8 || toRadix === 16)) {
    const res = groupBinary(integerDigits, toRadix);
    return { ok: true, value: { steps, result: res.result, paddingCount: res.paddingCount } };
  }
  if ((fromRadix === 8 || fromRadix === 16) && toRadix === 2) {
    const gSize = fromRadix === 8 ? 3 : 4;
    let out = '';
    for (let i = 0; i < integerDigits.length; i++) {
      const ch = integerDigits[i] ?? '';
      const bits = charToDigitValue(ch).toString(2).padStart(gSize, '0');
      out += bits;
      steps.push({
        kind: 'grouping',
        description: `'${ch}' in base ${fromRadix} -> ${bits} (${gSize} bits)`,
        inputs: { digit: ch, digitIndex: i, fromRadix },
        output: { bits, digit: ch },
      });
    }
    const cleanOut = out.replace(/^0+/, '') || '0';
    return { ok: true, value: { steps, result: `${isNegative ? '-' : ''}${cleanOut}`, paddingCount: 0 } };
  }
  if ((fromRadix === 8 && toRadix === 16) || (fromRadix === 16 && toRadix === 8)) {
    const gSize1 = fromRadix === 8 ? 3 : 4;
    let binIntermediate = '';
    for (let i = 0; i < integerDigits.length; i++) {
      const bits = charToDigitValue(integerDigits[i] ?? '').toString(2).padStart(gSize1, '0');
      binIntermediate += bits;
    }
    const res = groupBinary(binIntermediate, toRadix);
    return { ok: true, value: { steps, result: res.result, paddingCount: res.paddingCount } };
  }
  return { ok: true, value: { steps: [], result: `${isNegative ? '-' : ''}${integerDigits}`, paddingCount: 0 } };
}

/** Complete conversion with route selection (direct grouping shortcut or via decimal). */
export function generateRadixConversionSteps(
  text: string,
  fromRadix: number,
  toRadix: number,
  options: ConvertRadixOptions = {},
): NumberSystemResult<RadixConversionResult & { route: 'direct_grouping' | 'via_decimal' }> {
  validateRadix(fromRadix, 'fromRadix');
  validateRadix(toRadix, 'toRadix');
  const tok = tokenizeNumber(text, fromRadix, true);
  if (!tok.ok) return tok;
  const { isNegative, integerDigits, fractionalDigits } = tok.value;
  const isP2 = (r: number): r is 2 | 8 | 16 => r === 2 || r === 8 || r === 16;

  if (fractionalDigits === undefined && isP2(fromRadix) && isP2(toRadix)) {
    const groupRes = generateGroupingSteps(integerDigits, fromRadix, toRadix);
    if (!groupRes.ok) return groupRes;
    const finalInt = `${isNegative ? '-' : ''}${groupRes.value.result}`;
    return {
      ok: true,
      value: { route: 'direct_grouping', integerResult: finalInt, fullResult: finalInt, isExact: true, isNegative, steps: groupRes.value.steps },
    };
  }

  const steps: StepRecord[] = [];
  const posSteps = generatePositionalWeightSteps(integerDigits, fromRadix);
  if (!posSteps.ok) return posSteps;
  steps.push(...posSteps.value.steps);

  const divSteps = generateRepeatedDivisionSteps(posSteps.value.decimalSum, toRadix);
  steps.push(...divSteps.steps);
  const intResultStr = divSteps.result;

  let fracResultStr: string | undefined;
  let isExact = true;
  let isRepeating = false;
  let repeatingCycle: string | undefined;

  if (fractionalDigits !== undefined && fractionalDigits.length > 0) {
    const fracConv = generateRepeatedMultiplicationSteps(fractionalDigits, fromRadix, toRadix, options.precision ?? 8);
    fracResultStr = fracConv.result;
    isExact = fracConv.isExact;
    isRepeating = fracConv.isRepeating;
    repeatingCycle = fracConv.repeatingCycle;
    steps.push(...fracConv.steps);
  }

  const fullResult = `${isNegative ? '-' : ''}${intResultStr}${fracResultStr !== undefined ? '.' + fracResultStr : ''}`;
  return {
    ok: true,
    value: {
      route: 'via_decimal',
      integerResult: `${isNegative ? '-' : ''}${intResultStr}`,
      fractionalResult: fracResultStr,
      fullResult,
      isExact,
      isRepeating,
      repeatingCycle,
      isNegative,
      steps,
    },
  };
}
