/**
 * @file tokenizer.ts
 * Lexical analyzer for Boolean algebra expressions.
 * Converts input strings into a sequence of strongly-typed tokens with exact source spans.
 *
 * Variable naming convention:
 * Variable identifiers are CASE-SENSITIVE and consist of a single ASCII letter (A-Z or a-z)
 * followed by zero or more decimal digits (e.g., "A", "b", "X1", "S0").
 * Distinct casing represents distinct variables ("A" !== "a").
 */

import type { ParseError, SourceSpan } from '../../types/ast';

/**
 * Token category recognized by the Boolean expression tokenizer.
 */
export type TokenType =
  | 'variable'
  | 'constant'
  | 'apostrophe'
  | 'not'
  | 'and'
  | 'or'
  | 'xor'
  | 'nand'
  | 'nor'
  | 'xnor'
  | 'lparen'
  | 'rparen'
  | 'eof';

/**
 * Lexical token with precise character span within the source string.
 */
export interface Token {
  /** Discriminant category of the token */
  readonly type: TokenType;
  /** Matched literal text from the source expression */
  readonly value: string;
  /** 0-based character offset where token starts */
  readonly start: number;
  /** Length of the token in characters */
  readonly length: number;
  /** Inclusive-start, exclusive-end source span */
  readonly span: SourceSpan;
}

/**
 * Discriminated result returned by the tokenizer.
 */
export type TokenizerResult =
  | {
      readonly ok: true;
      readonly tokens: readonly Token[];
    }
  | {
      readonly ok: false;
      readonly error: ParseError;
    };

/** Keyword map for multi-character word operators (all case-insensitive) */
const KEYWORD_OPERATORS: Readonly<Record<string, TokenType>> = {
  and: 'and',
  or: 'or',
  not: 'not',
  xor: 'xor',
  nand: 'nand',
  nor: 'nor',
  xnor: 'xnor',
};

/**
 * Determines whether a character is ASCII whitespace.
 *
 * @param ch Single character to test
 * @returns True if character is whitespace
 */
function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

/**
 * Determines whether a character is an ASCII letter.
 *
 * @param ch Single character to test
 * @returns True if character is in [A-Za-z]
 */
function isLetter(ch: string): boolean {
  return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z');
}

/**
 * Determines whether a character is an ASCII digit.
 *
 * @param ch Single character to test
 * @returns True if character is in [0-9]
 */
function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

/**
 * Tokenizes a Boolean expression string into an array of lexical tokens.
 * Never throws for malformed user inputs; returns a discriminated failure object with exact position.
 *
 * @param input Raw Boolean expression string to tokenize
 * @returns Discriminated result containing token sequence or first lexical error
 * @throws TypeError if argument is not a string (programmer error)
 */
export function tokenize(input: string): TokenizerResult {
  if (typeof input !== 'string') {
    throw new TypeError(`Expected input to be a string. Received: ${typeof input}`);
  }

  const tokens: Token[] = [];
  const len = input.length;
  let pos = 0;

  while (pos < len) {
    const ch = input[pos];
    if (ch === undefined) break;

    if (isWhitespace(ch)) {
      pos++;
      continue;
    }

    if (ch === "'") {
      tokens.push({ type: 'apostrophe', value: "'", start: pos, length: 1, span: { start: pos, end: pos + 1 } });
      pos++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(', start: pos, length: 1, span: { start: pos, end: pos + 1 } });
      pos++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')', start: pos, length: 1, span: { start: pos, end: pos + 1 } });
      pos++;
      continue;
    }

    if (ch === '+') {
      tokens.push({ type: 'or', value: '+', start: pos, length: 1, span: { start: pos, end: pos + 1 } });
      pos++;
      continue;
    }

    if (ch === '|') {
      const isDouble = pos + 1 < len && input[pos + 1] === '|';
      const tokenLen = isDouble ? 2 : 1;
      tokens.push({
        type: 'or',
        value: isDouble ? '||' : '|',
        start: pos,
        length: tokenLen,
        span: { start: pos, end: pos + tokenLen },
      });
      pos += tokenLen;
      continue;
    }

    if (ch === '.' || ch === '*') {
      tokens.push({ type: 'and', value: ch, start: pos, length: 1, span: { start: pos, end: pos + 1 } });
      pos++;
      continue;
    }

    if (ch === '&') {
      const isDouble = pos + 1 < len && input[pos + 1] === '&';
      const tokenLen = isDouble ? 2 : 1;
      tokens.push({
        type: 'and',
        value: isDouble ? '&&' : '&',
        start: pos,
        length: tokenLen,
        span: { start: pos, end: pos + tokenLen },
      });
      pos += tokenLen;
      continue;
    }

    if (ch === '^') {
      tokens.push({ type: 'xor', value: '^', start: pos, length: 1, span: { start: pos, end: pos + 1 } });
      pos++;
      continue;
    }

    if (ch === '!' || ch === '~') {
      tokens.push({ type: 'not', value: ch, start: pos, length: 1, span: { start: pos, end: pos + 1 } });
      pos++;
      continue;
    }

    if (ch === '0' || ch === '1') {
      tokens.push({
        type: 'constant',
        value: ch,
        start: pos,
        length: 1,
        span: { start: pos, end: pos + 1 },
      });
      pos++;
      continue;
    }

    if (isLetter(ch)) {
      let wordEnd = pos;
      while (wordEnd < len) {
        const nextC = input[wordEnd];
        if (nextC === undefined || !isLetter(nextC)) break;
        wordEnd++;
      }
      const fullWord = input.slice(pos, wordEnd);
      const lowerWord = fullWord.toLowerCase();

      const trailingChar = input[wordEnd];
      const isFollowedByDigit = trailingChar !== undefined && isDigit(trailingChar);
      const matchedKeywordType = KEYWORD_OPERATORS[lowerWord];

      if (matchedKeywordType !== undefined && !isFollowedByDigit) {
        tokens.push({
          type: matchedKeywordType,
          value: fullWord,
          start: pos,
          length: fullWord.length,
          span: { start: pos, end: wordEnd },
        });
        pos = wordEnd;
        continue;
      }

      let varEnd = pos + 1;
      while (varEnd < len) {
        const digitChar = input[varEnd];
        if (digitChar === undefined || !isDigit(digitChar)) break;
        varEnd++;
      }
      const varName = input.slice(pos, varEnd);
      tokens.push({
        type: 'variable',
        value: varName,
        start: pos,
        length: varName.length,
        span: { start: pos, end: varEnd },
      });
      pos = varEnd;
      continue;
    }

    return {
      ok: false,
      error: {
        message: `Unexpected character '${ch}' at position ${pos}`,
        position: pos,
        length: 1,
      },
    };
  }

  tokens.push({
    type: 'eof',
    value: '',
    start: pos,
    length: 0,
    span: { start: pos, end: pos },
  });

  return { ok: true, tokens };
}
