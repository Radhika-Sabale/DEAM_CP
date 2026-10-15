/**
 * @file dataParser.ts
 * Parser for 8086 .data section directives: ORG, DB, and DW.
 * Handles little-endian word layout, ASCII strings, and 64 KB boundary enforcement.
 */

import type { AssemblerError } from './types';
import type { Token } from './lexer';

export interface DataDirectiveResult {
  readonly bytes: readonly number[];
  readonly elementSize: 8 | 16;
}

export type ParseDataResult =
  | { readonly ok: true; readonly result: DataDirectiveResult }
  | { readonly ok: false; readonly error: AssemblerError };

/**
 * Parses comma-separated arguments for DB (byte) or DW (word) directives.
 */
export function parseDataDefinition(
  directive: 'DB' | 'DW',
  tokens: readonly Token[],
  currentAddress: number
): ParseDataResult {
  if (tokens.length === 0) {
    return {
      ok: false,
      error: { line: 1, column: 1, length: 2, code: 'wrong-operand-count', message: `${directive} requires at least one value` },
    };
  }

  // Split tokens by COMMA
  const argTokenGroups: Token[][] = [];
  let currentGroup: Token[] = [];

  for (const tok of tokens) {
    if (tok.kind === 'COMMA') {
      if (currentGroup.length === 0) {
        return {
          ok: false,
          error: { line: tok.line, column: tok.column, length: 1, code: 'invalid-operand-form', message: 'Unexpected comma in data directive' },
        };
      }
      argTokenGroups.push(currentGroup);
      currentGroup = [];
    } else {
      currentGroup.push(tok);
    }
  }

  if (currentGroup.length > 0) {
    argTokenGroups.push(currentGroup);
  } else if (tokens[tokens.length - 1]?.kind === 'COMMA') {
    const last = tokens[tokens.length - 1];
    return {
      ok: false,
      error: { line: last?.line ?? 1, column: last?.column ?? 1, length: 1, code: 'invalid-operand-form', message: 'Trailing comma in data directive' },
    };
  }

  const bytes: number[] = [];
  const elementSize: 8 | 16 = directive === 'DB' ? 8 : 16;

  for (const group of argTokenGroups) {
    const first = group[0];
    if (!first) continue;

    // Reject DUP syntax
    for (const t of group) {
      if (t.kind === 'IDENT' && t.text.toUpperCase() === 'DUP') {
        return {
          ok: false,
          error: { line: t.line, column: t.column, length: t.length, code: 'invalid-operand-form', message: 'DUP syntax is not supported' },
        };
      }
    }

    // String literal: only valid in DB
    if (group.length === 1 && first.kind === 'STRING') {
      if (directive === 'DW') {
        return {
          ok: false,
          error: { line: first.line, column: first.column, length: first.length, code: 'invalid-operand-form', message: 'String literals are only allowed in DB, not DW' },
        };
      }
      const str = first.strValue ?? '';
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) & 0xff);
      }
      continue;
    }

    // Number or character literal, with optional leading sign (+/-)
    let sign = 1;
    let numTok: Token | undefined;

    if (group.length === 1 && (first.kind === 'NUMBER' || first.kind === 'CHAR')) {
      numTok = first;
    } else if (group.length === 2 && (first.kind === 'MINUS' || first.kind === 'PLUS') && (group[1]?.kind === 'NUMBER' || group[1]?.kind === 'CHAR')) {
      sign = first.kind === 'MINUS' ? -1 : 1;
      numTok = group[1];
    } else {
      return {
        ok: false,
        error: {
          line: first.line,
          column: first.column,
          length: first.length,
          code: 'invalid-operand-form',
          message: `Invalid value in ${directive} directive: "${group.map((t) => t.text).join(' ')}"`,
        },
      };
    }

    const rawVal = (numTok.numValue ?? 0) * sign;

    if (directive === 'DB') {
      if (rawVal < -128 || rawVal > 255) {
        return {
          ok: false,
          error: {
            line: numTok.line,
            column: numTok.column,
            length: numTok.length,
            code: 'immediate-out-of-range',
            message: `Byte value ${rawVal} out of range (-128..255)`,
          },
        };
      }
      const b = (rawVal < 0 ? rawVal + 256 : rawVal) & 0xff;
      bytes.push(b);
    } else {
      // DW (Word)
      if (rawVal < -32768 || rawVal > 65535) {
        return {
          ok: false,
          error: {
            line: numTok.line,
            column: numTok.column,
            length: numTok.length,
            code: 'immediate-out-of-range',
            message: `Word value ${rawVal} out of range (-32768..65535)`,
          },
        };
      }
      const w = (rawVal < 0 ? rawVal + 65536 : rawVal) & 0xffff;
      // Little-endian: low byte first, high byte second
      bytes.push(w & 0xff);
      bytes.push((w >>> 8) & 0xff);
    }
  }

  if (currentAddress + bytes.length > 0x10000) {
    return {
      ok: false,
      error: {
        line: tokens[0]?.line ?? 1,
        column: tokens[0]?.column ?? 1,
        length: tokens[0]?.length ?? 2,
        code: 'data-overflow',
        message: 'Data section exceeds 64 KB memory limit (0x0000 - 0xFFFF)',
      },
    };
  }

  return { ok: true, result: { bytes, elementSize } };
}

/**
 * Validates and extracts the address argument for ORG directive.
 */
export function parseOrgDirective(tokens: readonly Token[]): { readonly ok: true; readonly address: number } | { readonly ok: false; readonly error: AssemblerError } {
  if (tokens.length !== 1 || !tokens[0] || (tokens[0].kind !== 'NUMBER' && tokens[0].kind !== 'CHAR')) {
    const t = tokens[0] ?? { line: 1, column: 1, length: 3 };
    return {
      ok: false,
      error: { line: t.line, column: t.column, length: t.length, code: 'invalid-operand-form', message: 'ORG requires a single numeric address' },
    };
  }

  const tok = tokens[0];
  const addr = tok.numValue ?? 0;
  if (addr < 0 || addr > 0xffff) {
    return {
      ok: false,
      error: { line: tok.line, column: tok.column, length: tok.length, code: 'immediate-out-of-range', message: `ORG address ${addr} out of 16-bit range (0x0000 - 0xFFFF)` },
    };
  }

  return { ok: true, address: addr };
}
