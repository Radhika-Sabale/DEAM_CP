/**
 * @file convert.ts
 * Core radix parsing, formatting, and conversion functions.
 * Uses BigInt internally for arbitrary-precision integers, and exact rational BigInts for fractions.
 *
 * Negative numbers are accepted ONLY for decimal (radix 10) input and converted as sign-plus-magnitude.
 * Fixed-width signed forms live in complements.ts.
 */

import type {
  ConvertRadixOptions,
  FormatNumberOptions,
  NumberSystemResult,
  RadixConversionResult,
  StepRecord,
} from './types';

const RADIX_NAMES: Readonly<Record<number, string>> = {
  2: 'binary',
  8: 'octal',
  10: 'decimal',
  16: 'hexadecimal',
};

export function getRadixName(radix: number): string {
  return RADIX_NAMES[radix] ?? `radix-${radix}`;
}

export function validateRadix(radix: number, paramName: string): void {
  if (typeof radix !== 'number' || !Number.isInteger(radix)) {
    throw new TypeError(`${paramName} must be an integer. Received: ${radix}`);
  }
  if (radix < 2 || radix > 36) {
    throw new RangeError(`${paramName} must be between 2 and 36. Received: ${radix}`);
  }
}

export function charToDigitValue(char: string): number {
  const code = char.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 65 && code <= 90) return code - 65 + 10;
  if (code >= 97 && code <= 122) return code - 97 + 10;
  return -1;
}

export function digitValueToChar(digit: number): string {
  return digit < 10 ? String.fromCharCode(48 + digit) : String.fromCharCode(65 + digit - 10);
}

export interface ParsedTokens {
  readonly isNegative: boolean;
  readonly integerDigits: string;
  readonly fractionalDigits?: string;
}

/** Tokenizes a number string, stripping spaces, underscores, and matching prefixes. */
export function tokenizeNumber(text: string, radix: number, allowFraction = true): NumberSystemResult<ParsedTokens> {
  validateRadix(radix, 'radix');
  if (typeof text !== 'string') throw new TypeError(`Expected string, got ${typeof text}`);

  let isNegative = false;
  let seenPoint = false;
  let intDigits = '';
  let fracDigits = '';
  let i = 0;
  while (i < text.length && /\s/.test(text[i] ?? '')) i++;

  const firstChar = text[i];
  if (i < text.length && (firstChar === '-' || firstChar === '+')) {
    if (firstChar === '-') {
      if (radix !== 10) {
        return { ok: false, error: { message: 'Negative signs are only supported for decimal input.', position: i } };
      }
      isNegative = true;
    }
    i++;
  }

  if (i + 1 < text.length && text[i] === '0') {
    const next = (text[i + 1] ?? '').toLowerCase();
    if ((radix === 2 && next === 'b') || (radix === 8 && next === 'o') || (radix === 16 && next === 'x')) i += 2;
  }

  for (; i < text.length; i++) {
    const ch = text[i] ?? '';
    if (ch === ' ' || ch === '_') continue;
    if (ch === '.') {
      if (!allowFraction) return { ok: false, error: { message: `Fractions not allowed at position ${i}`, position: i } };
      if (seenPoint) return { ok: false, error: { message: `Multiple decimal points at position ${i}`, position: i } };
      seenPoint = true;
      continue;
    }
    const val = charToDigitValue(ch);
    if (val < 0 || val >= radix) {
      return { ok: false, error: { message: `'${ch}' is not a valid ${getRadixName(radix)} digit at position ${i}`, position: i } };
    }
    const upper = digitValueToChar(val);
    if (seenPoint) fracDigits += upper; else intDigits += upper;
  }

  if (intDigits.length === 0 && fracDigits.length === 0) {
    return { ok: false, error: { message: 'Number string contains no valid digits.', position: 0 } };
  }
  return { ok: true, value: { isNegative, integerDigits: intDigits.length === 0 ? '0' : intDigits, fractionalDigits: seenPoint ? fracDigits : undefined } };
}

/** Parses an integer string in radix 2..36 using arbitrary-precision BigInt. */
export function parseNumber(text: string, radix: number): NumberSystemResult<{ value: bigint; isNegative: boolean }> {
  const tok = tokenizeNumber(text, radix, false);
  if (!tok.ok) return tok;
  const bigR = BigInt(radix);
  let val = 0n;
  for (let i = 0; i < tok.value.integerDigits.length; i++) {
    val = val * bigR + BigInt(charToDigitValue(tok.value.integerDigits[i] ?? ''));
  }
  return { ok: true, value: { value: tok.value.isNegative ? -val : val, isNegative: tok.value.isNegative } };
}

/** Formats a BigInt or number to a string in radix 2..36. */
export function formatNumber(value: bigint | number, radix: number, options: FormatNumberOptions = {}): string {
  validateRadix(radix, 'radix');
  let bVal = typeof value === 'bigint' ? value : BigInt(Math.trunc(value));
  const isNeg = bVal < 0n;
  if (isNeg) bVal = -bVal;
  let raw = bVal.toString(radix);
  if (options.uppercase !== false) raw = raw.toUpperCase();

  if (options.groupWidth && options.groupWidth > 0) {
    const sep = options.groupSeparator ?? ' ';
    const parts: string[] = [];
    let rem = raw;
    while (rem.length > options.groupWidth) {
      parts.unshift(rem.slice(-options.groupWidth));
      rem = rem.slice(0, -options.groupWidth);
    }
    if (rem.length > 0) parts.unshift(rem);
    raw = parts.join(sep);
  }

  const prefixStr = options.prefix ? (radix === 2 ? '0b' : radix === 8 ? '0o' : radix === 16 ? '0x' : '') : '';
  return `${isNeg ? '-' : ''}${prefixStr}${raw}`;
}

/** Rational fraction conversion using BigInt numerator/denominator. */
function convertFraction(fractionDigits: string, fromRadix: number, toRadix: number, precision = 8) {
  const bigFrom = BigInt(fromRadix);
  const bigTo = BigInt(toRadix);
  let num = 0n;
  let den = 1n;
  for (let i = 0; i < fractionDigits.length; i++) {
    num = num * bigFrom + BigInt(charToDigitValue(fractionDigits[i] ?? ''));
    den = den * bigFrom;
  }
  const steps: StepRecord[] = [];
  const seen = new Map<string, number>();
  let out = '';
  let isRepeating = false;
  let repeatingCycle: string | undefined;
  let cur = num;
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
    const digitChar = digitValueToChar(Number(mult / den));
    const nextCur = mult % den;
    steps.push({
      kind: 'multiplication',
      description: `Step ${step + 1}: (${cur}/${den}) × ${toRadix} = ${mult}/${den} -> integer '${digitChar}', remainder ${nextCur}/${den}`,
      inputs: { fraction: `${cur}/${den}`, multiplier: toRadix },
      output: { integerPart: digitChar, newFraction: `${nextCur}/${den}` },
    });
    out += digitChar;
    cur = nextCur;
    step++;
    if (cur === 0n) break;
  }
  return { digits: out.length === 0 ? '0' : out, isExact: cur === 0n, isRepeating, repeatingCycle, steps };
}

/** Converts integer and fractional strings across radices 2..36. */
export function convertRadix(
  text: string,
  fromRadix: number,
  toRadix: number,
  options: ConvertRadixOptions = {},
): NumberSystemResult<RadixConversionResult> {
  validateRadix(fromRadix, 'fromRadix');
  validateRadix(toRadix, 'toRadix');
  const tok = tokenizeNumber(text, fromRadix, true);
  if (!tok.ok) return tok;
  const { isNegative, integerDigits, fractionalDigits } = tok.value;
  const precision = options.precision ?? 8;

  const bigFrom = BigInt(fromRadix);
  let intVal = 0n;
  for (let i = 0; i < integerDigits.length; i++) {
    intVal = intVal * bigFrom + BigInt(charToDigitValue(integerDigits[i] ?? ''));
  }
  const intResultStr = intVal === 0n ? '0' : formatNumber(intVal, toRadix);
  const steps: StepRecord[] = [{
    kind: 'integer_conversion',
    description: `Integer part ${integerDigits} (base ${fromRadix}) -> ${intResultStr} (base ${toRadix})`,
    inputs: { text: integerDigits, fromRadix, toRadix, decimalValue: intVal.toString() },
    output: { integerResult: intResultStr },
  }];

  let fracResultStr: string | undefined;
  let isExact = true;
  let isRepeating = false;
  let repeatingCycle: string | undefined;

  if (fractionalDigits !== undefined && fractionalDigits.length > 0) {
    const fracConv = convertFraction(fractionalDigits, fromRadix, toRadix, precision);
    fracResultStr = fracConv.digits;
    isExact = fracConv.isExact;
    isRepeating = fracConv.isRepeating;
    repeatingCycle = fracConv.repeatingCycle;
    steps.push(...fracConv.steps);
  }

  const fullResult = `${isNegative ? '-' : ''}${intResultStr}${fracResultStr !== undefined ? '.' + fracResultStr : ''}`;
  return {
    ok: true,
    value: {
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
