/**
 * @file lexer.ts
 * Tokenizer for 8086 assembly source code with accurate 1-based line/column position tracking.
 */

import type { AssemblerError } from './types';
import { parse8086Number } from './numberParser';

export type TokenKind =
  | 'IDENT' | 'NUMBER' | 'STRING' | 'CHAR' | 'COMMA' | 'COLON'
  | 'LBRACKET' | 'RBRACKET' | 'PLUS' | 'MINUS' | 'LPAREN' | 'RPAREN' | 'DOT_IDENT';

export interface Token {
  readonly kind: TokenKind;
  readonly text: string;
  readonly line: number;
  readonly column: number;
  readonly length: number;
  readonly numValue?: number;
  readonly strValue?: string;
}

export interface LineTokenResult {
  readonly tokens: readonly Token[];
  readonly errors: readonly AssemblerError[];
}

/**
 * Tokenizes a single line of 8086 assembly source text.
 * Strips comments starting with ';'.
 */
export function tokenizeLine(lineText: string, lineNumber: number): LineTokenResult {
  const tokens: Token[] = [];
  const errors: AssemblerError[] = [];
  const len = lineText.length;
  let col = 1; // 1-based column

  while (col <= len) {
    const idx = col - 1;
    const ch = lineText[idx] ?? '';

    // 1. Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      col++;
      continue;
    }

    // 2. Comments (; ...)
    if (ch === ';') {
      break; // Rest of line is comment
    }

    // 3. Single-character delimiters
    const delimMap: Record<string, TokenKind> = {
      ',': 'COMMA', ':': 'COLON', '[': 'LBRACKET', ']': 'RBRACKET', '+': 'PLUS', '-': 'MINUS',
      '(': 'LPAREN', ')': 'RPAREN',
    };
    const delimKind = delimMap[ch];
    if (delimKind) {
      tokens.push({ kind: delimKind, text: ch, line: lineNumber, column: col, length: 1 });
      col++;
      continue;
    }

    // 4. Dot identifiers (.data, .code)
    if (ch === '.') {
      let end = idx + 1;
      while (end < len && /[a-zA-Z0-9_]/.test(lineText[end] ?? '')) {
        end++;
      }
      const text = lineText.slice(idx, end);
      tokens.push({ kind: 'DOT_IDENT', text, line: lineNumber, column: col, length: text.length });
      col += text.length;
      continue;
    }

    // 5. String literals ("...")
    if (ch === '"') {
      let end = idx + 1;
      let closed = false;
      while (end < len) {
        if (lineText[end] === '"') {
          closed = true;
          end++;
          break;
        }
        end++;
      }
      if (!closed) {
        errors.push({
          line: lineNumber,
          column: col,
          length: len - idx,
          code: 'unterminated-string',
          message: `Unterminated string literal on line ${lineNumber}`,
        });
        break;
      }
      const rawText = lineText.slice(idx, end);
      const strValue = rawText.slice(1, -1);
      tokens.push({ kind: 'STRING', text: rawText, line: lineNumber, column: col, length: rawText.length, strValue });
      col += rawText.length;
      continue;
    }

    // 6. Character literals ('...')
    if (ch === "'") {
      let end = idx + 1;
      let closed = false;
      while (end < len) {
        if (lineText[end] === "'") {
          closed = true;
          end++;
          break;
        }
        end++;
      }
      const rawText = lineText.slice(idx, end);
      if (!closed) {
        errors.push({
          line: lineNumber,
          column: col,
          length: rawText.length,
          code: 'bad-character-literal',
          message: `Unterminated character literal: ${rawText}`,
        });
        col += rawText.length;
        continue;
      }
      const numRes = parse8086Number(rawText);
      if (!numRes.ok) {
        errors.push({
          line: lineNumber,
          column: col,
          length: rawText.length,
          code: numRes.code,
          message: numRes.message,
        });
      } else {
        tokens.push({
          kind: 'CHAR',
          text: rawText,
          line: lineNumber,
          column: col,
          length: rawText.length,
          numValue: numRes.result.value,
        });
      }
      col += rawText.length;
      continue;
    }

    // 7. Numbers starting with digit (0..9)
    if (/[0-9]/.test(ch)) {
      let end = idx + 1;
      while (end < len && /[0-9a-zA-Z_]/.test(lineText[end] ?? '')) {
        end++;
      }
      const rawText = lineText.slice(idx, end);
      const parsed = parse8086Number(rawText);
      if (parsed.ok) {
        tokens.push({
          kind: 'NUMBER',
          text: rawText,
          line: lineNumber,
          column: col,
          length: rawText.length,
          numValue: parsed.result.value,
        });
      } else {
        errors.push({
          line: lineNumber,
          column: col,
          length: rawText.length,
          code: parsed.code,
          message: parsed.message,
        });
      }
      col += rawText.length;
      continue;
    }

    // 8. Identifiers (labels, registers, mnemonics, directives)
    if (/[a-zA-Z_]/.test(ch)) {
      let end = idx + 1;
      while (end < len && /[a-zA-Z0-9_]/.test(lineText[end] ?? '')) {
        end++;
      }
      const rawText = lineText.slice(idx, end);
      const upper = rawText.toUpperCase();
      if (/^[A-F0-9]+H$/i.test(rawText) && !['AH', 'BH', 'CH', 'DH'].includes(upper)) {
        errors.push({
          line: lineNumber, column: col, length: rawText.length, code: 'bad-number-syntax',
          message: `Hexadecimal literal ending in 'h' must start with a decimal digit (0-9): "${rawText}" (use 0${rawText})`,
        });
        col += rawText.length;
        continue;
      }
      tokens.push({
        kind: 'IDENT', text: rawText, line: lineNumber, column: col, length: rawText.length,
      });
      col += rawText.length;
      continue;
    }

    // Unknown character
    errors.push({
      line: lineNumber,
      column: col,
      length: 1,
      code: 'bad-character',
      message: `Unexpected character '${ch}' at line ${lineNumber}, column ${col}`,
    });
    col++;
  }

  // Check for unterminated brackets on this line
  let bracketDepth = 0;
  let openBracketCol = 0;
  for (const t of tokens) {
    if (t.kind === 'LBRACKET') {
      bracketDepth++;
      openBracketCol = t.column;
    } else if (t.kind === 'RBRACKET') {
      bracketDepth--;
    }
  }
  if (bracketDepth > 0) {
    errors.push({
      line: lineNumber,
      column: openBracketCol,
      length: 1,
      code: 'unterminated-bracket',
      message: `Unterminated bracket '[' on line ${lineNumber}`,
    });
  }

  return { tokens, errors };
}
