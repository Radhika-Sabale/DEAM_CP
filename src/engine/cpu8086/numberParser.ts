/**
 * @file numberParser.ts
 * Parser for 8086 immediate numbers: decimal, hex (0x and h-suffix), binary (b-suffix),
 * and character literals.
 */

export interface ParsedNumber {
  readonly value: number;
  readonly isNegative: boolean;
  readonly originalText: string;
}

export type NumberParseResult =
  | { readonly ok: true; readonly result: ParsedNumber }
  | { readonly ok: false; readonly code: 'bad-number-syntax' | 'bad-character-literal'; readonly message: string };

/**
 * Parses an 8086 number literal or character literal.
 *
 * Supported formats:
 * - Hex prefix: 0x1F, 0X1F
 * - Hex suffix: 1Fh, 0FFh (must start with digit 0..9)
 * - Binary suffix: 1010b, 1100b
 * - Decimal: 123, 0
 * - Character literal: 'A' (evaluates to ASCII code 65)
 * - Optional leading minus for decimal or hex: -5, -0x10, -10h
 */
export function parse8086Number(text: string): NumberParseResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, code: 'bad-number-syntax', message: 'Empty number literal' };
  }

  // Character literal: 'x'
  if (trimmed.startsWith("'")) {
    if (!trimmed.endsWith("'") || trimmed.length < 3) {
      return { ok: false, code: 'bad-character-literal', message: `Unterminated or empty character literal: ${text}` };
    }
    // Handle escape sequences if any: '\n', '\t', '\\', '\''
    const inner = trimmed.slice(1, -1);
    if (inner.length === 1) {
      return { ok: true, result: { value: inner.charCodeAt(0), isNegative: false, originalText: text } };
    }
    if (inner.length === 2 && inner[0] === '\\') {
      const esc = inner[1];
      const code = esc === 'n' ? 10 : esc === 't' ? 9 : esc === 'r' ? 13 : esc === '0' ? 0 : esc?.charCodeAt(0) ?? 0;
      return { ok: true, result: { value: code, isNegative: false, originalText: text } };
    }
    return { ok: false, code: 'bad-character-literal', message: `Character literal must contain exactly one character: ${text}` };
  }

  let isNegative = false;
  let body = trimmed;
  if (body.startsWith('-')) {
    isNegative = true;
    body = body.slice(1).trim();
  } else if (body.startsWith('+')) {
    body = body.slice(1).trim();
  }

  if (body.length === 0) {
    return { ok: false, code: 'bad-number-syntax', message: `Invalid number syntax: "${text}"` };
  }

  // 1. Hex 0x...
  if (/^0x[0-9a-fA-F]+$/i.test(body)) {
    const parsed = parseInt(body.slice(2), 16);
    return { ok: true, result: { value: isNegative ? -parsed : parsed, isNegative, originalText: text } };
  }
  if (/^0x/i.test(body)) {
    return { ok: false, code: 'bad-number-syntax', message: `Invalid hexadecimal digits in "${text}"` };
  }

  // 2. Binary ...b / ...B (check before hex suffix because 'b' is also a hex digit)
  // Binary must consist entirely of 0s and 1s before the 'b' suffix.
  if (/^[01]+[bB]$/.test(body)) {
    const parsed = parseInt(body.slice(0, -1), 2);
    return { ok: true, result: { value: isNegative ? -parsed : parsed, isNegative, originalText: text } };
  }

  // 3. Hex ...h / ...H suffix (e.g. 0FFh, 1Fh)
  // Must start with decimal digit 0..9 per Intel 8086 convention
  if (/[hH]$/.test(body)) {
    const rawDigits = body.slice(0, -1);
    if (!/^[0-9]/.test(rawDigits)) {
      return {
        ok: false,
        code: 'bad-number-syntax',
        message: `Hexadecimal literal ending in 'h' must start with a decimal digit (0-9): "${text}" (use 0${body})`,
      };
    }
    if (!/^[0-9a-fA-F]+$/.test(rawDigits)) {
      return { ok: false, code: 'bad-number-syntax', message: `Invalid hexadecimal digits in "${text}"` };
    }
    const parsed = parseInt(rawDigits, 16);
    return { ok: true, result: { value: isNegative ? -parsed : parsed, isNegative, originalText: text } };
  }

  // 4. Decimal
  if (/^[0-9]+$/.test(body)) {
    const parsed = parseInt(body, 10);
    return { ok: true, result: { value: isNegative ? -parsed : parsed, isNegative, originalText: text } };
  }

  return { ok: false, code: 'bad-number-syntax', message: `Invalid number syntax: "${text}"` };
}

/**
 * Converts a signed or unsigned number into an unsigned bit pattern of the target size (8 or 16).
 * Returns the clamped unsigned value and whether truncation occurred.
 */
export function fitImmediateToSize(
  val: number,
  size: 8 | 16
): { value: number; truncated: boolean } {
  const maxUnsigned = size === 8 ? 0xff : 0xffff;
  const minSigned = size === 8 ? -128 : -32768;

  let truncated = false;
  let unsignedVal: number;

  if (val < 0) {
    if (val < minSigned) {
      truncated = true;
    }
    unsignedVal = (val & maxUnsigned) >>> 0;
  } else {
    if (val > maxUnsigned) {
      truncated = true;
    }
    unsignedVal = (val & maxUnsigned) >>> 0;
  }

  return { value: unsignedVal, truncated };
}
