/**
 * @file parser.ts
 * Recursive-descent parser for Boolean algebra expressions.
 * Produces strongly-typed Abstract Syntax Tree (AST) nodes with exact source spans.
 *
 * ============================================================================
 * PRECEDENCE TABLE (Highest to Lowest):
 * 1. Postfix complement: "'" (highest)
 * 2. Prefix NOT: "!", "~", "not"
 * 3. AND (explicit ".", "*", "&", "and" or implicit juxtaposition), NAND ("nand")
 * 4. XOR ("^", "xor"), XNOR ("xnor")
 * 5. OR ("+", "|", "or"), NOR ("nor") (lowest)
 *
 * Associativity: All binary operators are left-associative.
 * Chained same-operator AND and OR nodes are flattened into n-ary AST arrays.
 * ============================================================================
 */

import type {
  AndNode,
  BoolNode,
  NandNode,
  NorNode,
  OrNode,
  ParseError,
  SourceSpan,
  XnorNode,
  XorNode,
} from '../../types/ast';
import { tokenize, type Token } from './tokenizer';

/**
 * Options configuring parsing behavior.
 */
export interface ParseOptions {
  /**
   * Variable ordering strategy:
   * - 'alphabetical' (default): variables are sorted alphabetically (e.g. ['A', 'B', 'C']).
   * - 'appearance': variables preserve order of first appearance.
   */
  readonly sortVariables?: 'alphabetical' | 'appearance' | boolean;
}

/**
 * Discriminated result returned by the parser.
 */
export type ParseResult =
  | { readonly ok: true; readonly ast: BoolNode; readonly variables: readonly string[] }
  | { readonly ok: false; readonly error: ParseError };

class InternalParseError extends Error {
  readonly parseError: ParseError;
  constructor(message: string, position: number, length: number) {
    super(message);
    this.parseError = { message, position, length };
  }
}

const getAndChildren = (n: BoolNode): readonly BoolNode[] => (n.type === 'and' ? n.children : [n]);
const getOrChildren = (n: BoolNode): readonly BoolNode[] => (n.type === 'or' ? n.children : [n]);

/**
 * Parses a Boolean expression string into an AST.
 * Pure function. Never throws for user syntax mistakes; returns a discriminated ParseResult.
 *
 * @param input Raw Boolean expression string
 * @param options Parsing configuration options
 * @returns Discriminated parse result with AST and variables, or diagnostic error
 * @throws TypeError if arguments are invalid (programmer error)
 */
export function parse(input: string, options?: ParseOptions): ParseResult {
  if (typeof input !== 'string') throw new TypeError(`Expected input string. Received: ${typeof input}`);

  const tokResult = tokenize(input);
  if (!tokResult.ok) return { ok: false, error: tokResult.error };

  const tokens = tokResult.tokens;
  let cursor = 0;
  const appearanceVars: string[] = [];
  const varSet = new Set<string>();

  const eofFallback: Token = tokens[tokens.length - 1] ?? {
    type: 'eof',
    value: '',
    start: input.length,
    length: 0,
    span: { start: input.length, end: input.length },
  };

  const peek = (): Token => tokens[cursor] ?? eofFallback;
  const advance = (): Token => {
    const t = peek();
    if (cursor < tokens.length - 1) cursor++;
    return t;
  };
  const span = (start: number, end: number): SourceSpan => ({ start, end });

  function parsePrimary(prevOp?: Token): BoolNode {
    const t = peek();
    if (t.type === 'variable') {
      advance();
      if (!varSet.has(t.value)) {
        varSet.add(t.value);
        appearanceVars.push(t.value);
      }
      return { type: 'variable', name: t.value, span: t.span };
    }
    if (t.type === 'constant') {
      advance();
      return { type: 'constant', value: t.value === '1' ? 1 : 0, span: t.span };
    }
    if (t.type === 'lparen') {
      const open = advance();
      const expr = parseOr();
      if (peek().type !== 'rparen') {
        throw new InternalParseError(`Missing closing parenthesis for the one opened at position ${open.start}`, open.start, 1);
      }
      return { ...expr, span: span(open.start, advance().span.end) };
    }
    if (t.type === 'eof') {
      if (prevOp) throw new InternalParseError(`Expected a variable or '(' after '${prevOp.value}' at position ${prevOp.start}`, prevOp.start, prevOp.length);
      throw new InternalParseError('Empty expression', 0, 0);
    }
    if (t.type === 'rparen') throw new InternalParseError(`Unexpected ')' at position ${t.start}`, t.start, 1);
    if (prevOp) throw new InternalParseError(`Expected a variable or '(' after '${prevOp.value}' at position ${prevOp.start}`, t.start, t.length);
    throw new InternalParseError(`Unexpected operator '${t.value}' at position ${t.start}. Expected a variable, constant, or '('`, t.start, t.length);
  }

  function parsePostfix(prevOp?: Token): BoolNode {
    let node = parsePrimary(prevOp);
    while (peek().type === 'apostrophe' || (peek().type === 'not' && peek().value === '!')) {
      const apos = advance();
      node = { type: 'not', child: node, span: span(node.span ? node.span.start : apos.start, apos.span.end) };
    }
    return node;
  }

  function parsePrefix(prevOp?: Token): BoolNode {
    if (peek().type === 'not') {
      const notTok = advance();
      const child = parsePrefix(notTok);
      return { type: 'not', child, span: span(notTok.start, child.span ? child.span.end : notTok.span.end) };
    }
    return parsePostfix(prevOp);
  }

  const canStartPrefix = (t: Token): boolean =>
    t.type === 'variable' || t.type === 'constant' || t.type === 'lparen' || t.type === 'not';

  function parseAnd(prevOp?: Token): BoolNode {
    let left = parsePrefix(prevOp);
    let continueAnd = true;
    while (continueAnd) {
      const t = peek();
      if (t.type === 'and') {
        const op = advance();
        const right = parsePrefix(op);
        left = {
          type: 'and',
          children: [...getAndChildren(left), ...getAndChildren(right)],
          span: span(left.span ? left.span.start : op.start, right.span ? right.span.end : op.span.end),
        } as AndNode;
      } else if (t.type === 'nand') {
        const op = advance();
        const right = parsePrefix(op);
        left = {
          type: 'nand',
          left,
          right,
          span: span(left.span ? left.span.start : op.start, right.span ? right.span.end : op.span.end),
        } as NandNode;
      } else if (canStartPrefix(t)) {
        const right = parsePrefix();
        left = {
          type: 'and',
          children: [...getAndChildren(left), ...getAndChildren(right)],
          span: span(left.span ? left.span.start : 0, right.span ? right.span.end : 0),
        } as AndNode;
      } else {
        continueAnd = false;
      }
    }
    return left;
  }

  function parseXor(prevOp?: Token): BoolNode {
    let left = parseAnd(prevOp);
    while (peek().type === 'xor' || peek().type === 'xnor') {
      const op = advance();
      const right = parseAnd(op);
      const nodeSpan = span(left.span ? left.span.start : op.start, right.span ? right.span.end : op.span.end);
      left = op.type === 'xor'
        ? ({ type: 'xor', left, right, span: nodeSpan } as XorNode)
        : ({ type: 'xnor', left, right, span: nodeSpan } as XnorNode);
    }
    return left;
  }

  function parseOr(prevOp?: Token): BoolNode {
    let left = parseXor(prevOp);
    while (peek().type === 'or' || peek().type === 'nor') {
      const op = advance();
      const right = parseXor(op);
      const nodeSpan = span(left.span ? left.span.start : op.start, right.span ? right.span.end : op.span.end);
      left = op.type === 'nor'
        ? ({ type: 'nor', left, right, span: nodeSpan } as NorNode)
        : ({ type: 'or', children: [...getOrChildren(left), ...getOrChildren(right)], span: nodeSpan } as OrNode);
    }
    return left;
  }

  try {
    const first = tokens[0];
    if (tokens.length === 1 && first !== undefined && first.type === 'eof') {
      return { ok: false, error: { message: 'Empty expression', position: 0, length: 0 } };
    }
    const ast = parseOr();
    const trailing = peek();
    if (trailing.type !== 'eof') {
      if (trailing.type === 'rparen') {
        return { ok: false, error: { message: `Unexpected ')' at position ${trailing.start}`, position: trailing.start, length: 1 } };
      }
      return {
        ok: false,
        error: { message: `Unexpected token '${trailing.value}' at position ${trailing.start}`, position: trailing.start, length: trailing.length },
      };
    }
    const sortOpt = options?.sortVariables;
    const shouldSort = sortOpt === undefined || sortOpt === 'alphabetical' || sortOpt === true;
    return { ok: true, ast, variables: shouldSort ? [...appearanceVars].sort() : appearanceVars };
  } catch (err) {
    if (err instanceof InternalParseError) return { ok: false, error: err.parseError };
    throw err;
  }
}
