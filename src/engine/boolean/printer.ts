/**
 * @file printer.ts
 * Serializes Boolean Abstract Syntax Tree (AST) nodes into human-readable, re-parseable strings.
 *
 * Supported formatting styles:
 * - "apostrophe" (default): Textbook engineering notation using postfix primes (e.g. A'B + C)
 * - "symbolic": Programming/logic notation using symbols (e.g. !A & B | C)
 * - "words": Explicit English keywords (e.g. NOT A AND B OR C)
 *
 * Guarantees:
 * - Minimal necessary parentheses preserving operator precedence and left-associativity.
 * - Strict idempotence: toString(ast, style) === toString(parse(toString(ast, style)).ast, style).
 */

import type { BoolNode } from '../../types/ast';

/**
 * Supported Boolean string formatting styles.
 */
export type PrintStyle = 'apostrophe' | 'symbolic' | 'words';

/**
 * Precedence rank constants used for selective minimal parenthesization.
 */
const PRECEDENCE = {
  OR: 1,
  XOR: 2,
  AND: 3,
  NOT: 4,
  PRIMARY: 5,
} as const;

/**
 * Determines the precedence level of an AST node.
 *
 * @param node Boolean AST node
 * @returns Numeric precedence rank (1..5)
 */
function getNodePrecedence(node: BoolNode): number {
  switch (node.type) {
    case 'or':
    case 'nor':
      return PRECEDENCE.OR;
    case 'xor':
    case 'xnor':
      return PRECEDENCE.XOR;
    case 'and':
    case 'nand':
      return PRECEDENCE.AND;
    case 'not':
      return PRECEDENCE.NOT;
    case 'variable':
    case 'constant':
      return PRECEDENCE.PRIMARY;
  }
}

/**
 * Converts a Boolean AST into a formatted string.
 * Pure function. Re-parseable by the parser in all three styles.
 *
 * @param ast Boolean AST node to serialize
 * @param style Target string representation style (defaults to 'apostrophe')
 * @returns Re-parseable expression string
 * @throws TypeError if ast is missing or not a valid object (programmer error)
 */
export function toString(ast: BoolNode, style: PrintStyle = 'apostrophe'): string {
  if (!ast || typeof ast !== 'object' || typeof ast.type !== 'string') {
    throw new TypeError(`Expected ast to be a valid BoolNode. Received: ${typeof ast}`);
  }

  switch (ast.type) {
    case 'constant':
      return String(ast.value);

    case 'variable':
      return ast.name;

    case 'not': {
      const child = ast.child;
      if (style === 'apostrophe') {
        if (child.type === 'variable' || child.type === 'constant' || child.type === 'not') {
          return `${toString(child, style)}'`;
        }
        return `(${toString(child, style)})'`;
      }
      if (style === 'symbolic') {
        if (child.type === 'variable' || child.type === 'constant' || child.type === 'not') {
          return `!${toString(child, style)}`;
        }
        return `!(${toString(child, style)})`;
      }
      // 'words'
      if (child.type === 'variable' || child.type === 'constant' || child.type === 'not') {
        return `NOT ${toString(child, style)}`;
      }
      return `NOT (${toString(child, style)})`;
    }

    case 'and': {
      const parts = ast.children.map((child) => {
        const prec = getNodePrecedence(child);
        const childStr = toString(child, style);
        return prec < PRECEDENCE.AND ? `(${childStr})` : childStr;
      });

      if (style === 'apostrophe') {
        let result = '';
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i] ?? '';
          if (i > 0) {
            const prev = parts[i - 1] ?? '';
            if (prev.length > 0 && part.length > 0) {
              const prevLastChar = prev[prev.length - 1] ?? '';
              const nextFirstChar = part[0] ?? '';
              const isPrevAlphanumeric = /[A-Za-z0-9]/.test(prevLastChar);
              const isNextDigit = /[0-9]/.test(nextFirstChar);
              if (isPrevAlphanumeric && isNextDigit) {
                result += ' ';
              }
            }
          }
          result += part;
        }
        return result;
      }

      if (style === 'symbolic') {
        return parts.join(' & ');
      }
      return parts.join(' AND ');
    }

    case 'nand': {
      const leftPrec = getNodePrecedence(ast.left);
      const rightPrec = getNodePrecedence(ast.right);
      const leftStr = leftPrec < PRECEDENCE.AND ? `(${toString(ast.left, style)})` : toString(ast.left, style);
      const rightStr = rightPrec <= PRECEDENCE.AND ? `(${toString(ast.right, style)})` : toString(ast.right, style);
      const op = style === 'words' ? 'NAND' : 'nand';
      return `${leftStr} ${op} ${rightStr}`;
    }

    case 'xor': {
      const leftPrec = getNodePrecedence(ast.left);
      const rightPrec = getNodePrecedence(ast.right);
      const leftStr = leftPrec < PRECEDENCE.XOR ? `(${toString(ast.left, style)})` : toString(ast.left, style);
      const rightStr = rightPrec <= PRECEDENCE.XOR ? `(${toString(ast.right, style)})` : toString(ast.right, style);
      const op = style === 'words' ? 'XOR' : '^';
      return `${leftStr} ${op} ${rightStr}`;
    }

    case 'xnor': {
      const leftPrec = getNodePrecedence(ast.left);
      const rightPrec = getNodePrecedence(ast.right);
      const leftStr = leftPrec < PRECEDENCE.XOR ? `(${toString(ast.left, style)})` : toString(ast.left, style);
      const rightStr = rightPrec <= PRECEDENCE.XOR ? `(${toString(ast.right, style)})` : toString(ast.right, style);
      const op = style === 'words' ? 'XNOR' : 'xnor';
      return `${leftStr} ${op} ${rightStr}`;
    }

    case 'or': {
      const parts = ast.children.map((child) => {
        const prec = getNodePrecedence(child);
        const childStr = toString(child, style);
        return child.type === 'nor' || prec < PRECEDENCE.OR ? `(${childStr})` : childStr;
      });

      if (style === 'apostrophe') {
        return parts.join(' + ');
      }
      if (style === 'symbolic') {
        return parts.join(' | ');
      }
      return parts.join(' OR ');
    }

    case 'nor': {
      const leftPrec = getNodePrecedence(ast.left);
      const rightPrec = getNodePrecedence(ast.right);
      const leftStr = leftPrec < PRECEDENCE.OR ? `(${toString(ast.left, style)})` : toString(ast.left, style);
      const rightStr = rightPrec <= PRECEDENCE.OR ? `(${toString(ast.right, style)})` : toString(ast.right, style);
      const op = style === 'words' ? 'NOR' : 'nor';
      return `${leftStr} ${op} ${rightStr}`;
    }
  }
}
