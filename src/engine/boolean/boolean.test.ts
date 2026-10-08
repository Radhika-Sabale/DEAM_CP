/**
 * @file boolean.test.ts
 * Comprehensive test suite for Stage 4A Boolean engine:
 * - Tokenizer
 * - Parser (40+ valid, 25+ invalid, precedence tests)
 * - Printer & Round-trip (200 seeded random expressions)
 * - Evaluator (3-valued truth tables, pessimism rules, errors)
 * - Truth Table (MSB bit ordering, 6-var limit, 7-var error, don't-cares)
 * - Canonical (SOP/POS, constants 0/1, AST conversions, partitioning)
 */

import { describe, expect, it } from 'vitest';
import type { BoolNode } from '../../types/ast';
import {
  buildTruthTable,
  canonicalForms,
  canonicalPOS,
  canonicalSOP,
  evaluate,
  evaluateBinary,
  getDontCares,
  getMaxterms,
  getMinterms,
  indicesToBinaryStrings,
  isContradiction,
  isTautology,
  maxtermListToMintermList,
  mintermListToMaxtermList,
  parse,
  posToAst,
  sopToAst,
  tableFromMinterms,
  tokenize,
  toString,
} from './index';

// Simple seeded Linear Congruential Generator (LCG) for deterministic tests
class SeededRandom {
  private state: number;
  constructor(seed = 123456789) {
    this.state = seed >>> 0;
  }
  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  choice<T>(items: readonly T[]): T {
    const idx = this.nextInt(0, items.length - 1);
    const item = items[idx];
    if (item === undefined) {
      throw new Error('Choice index out of bounds');
    }
    return item;
  }
}

describe('Boolean Engine (Stage 4A)', () => {
  describe('tokenizer', () => {
    it('tokenizes all operator spellings and symbols', () => {
      const input = "' ! ~ not NOT + | || or OR . * & && and AND ^ xor XOR nand NAND nor NOR xnor XNOR ( )";
      const res = tokenize(input);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const types = res.tokens.map((t) => t.type);
      expect(types).toEqual([
        'apostrophe',
        'not',
        'not',
        'not',
        'not',
        'or',
        'or',
        'or',
        'or',
        'or',
        'and',
        'and',
        'and',
        'and',
        'and',
        'and',
        'xor',
        'xor',
        'xor',
        'nand',
        'nand',
        'nor',
        'nor',
        'xnor',
        'xnor',
        'lparen',
        'rparen',
        'eof',
      ]);
    });

    it('records precise token start positions and lengths', () => {
      const input = "A + B'";
      const res = tokenize(input);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.tokens).toEqual([
        { type: 'variable', value: 'A', start: 0, length: 1, span: { start: 0, end: 1 } },
        { type: 'or', value: '+', start: 2, length: 1, span: { start: 2, end: 3 } },
        { type: 'variable', value: 'B', start: 4, length: 1, span: { start: 4, end: 5 } },
        { type: 'apostrophe', value: "'", start: 5, length: 1, span: { start: 5, end: 6 } },
        { type: 'eof', value: '', start: 6, length: 0, span: { start: 6, end: 6 } },
      ]);
    });

    it('identifies unknown characters with exact position and error message', () => {
      const res1 = tokenize('A @ B');
      expect(res1.ok).toBe(false);
      if (!res1.ok) {
        expect(res1.error.message).toBe("Unexpected character '@' at position 2");
        expect(res1.error.position).toBe(2);
        expect(res1.error.length).toBe(1);
      }

      const res2 = tokenize('#');
      expect(res2.ok).toBe(false);
      if (!res2.ok) {
        expect(res2.error.message).toBe("Unexpected character '#' at position 0");
        expect(res2.error.position).toBe(0);
        expect(res2.error.length).toBe(1);
      }
    });

    it('treats variables as case-sensitive single letter plus optional digits', () => {
      const res = tokenize('A a X1 y2 S0');
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      const names = res.tokens.filter((t) => t.type === 'variable').map((t) => t.value);
      expect(names).toEqual(['A', 'a', 'X1', 'y2', 'S0']);
    });
  });

  describe('parser - valid expressions', () => {
    const validCases: string[] = [
      "A'B + C(D xor E)",
      '!(A+B)',
      '~A.B',
      'A*B^C',
      '((A))',
      "A''",
      "(A+B)'C",
      'AB',
      "AB'",
      "A'B",
      '(A+B)(C+D)',
      'C(D xor E)',
      'A(B)',
      "AB'C",
      '1A',
      'A B',
      "A' B",
      "(A+B)'",
      '0',
      '1',
      'A',
      '!A',
      '~A',
      'not A',
      'NOT A',
      'A and B',
      'A AND B',
      'A or B',
      'A OR B',
      'A xor B',
      'A XOR B',
      'A nand B',
      'A NAND B',
      'A nor B',
      'A NOR B',
      'A xnor B',
      'A XNOR B',
      'A + B + C + D',
      'A . B . C . D',
      "A' + B' + C'",
      '(A ^ B) ^ C',
      'A ^ (B ^ C)',
      'A1 + B2 . C3',
      "((A + B)' (C + D)')'",
      '1 . 0 + A',
    ];

    it(`successfully parses all ${validCases.length} required valid expressions`, () => {
      for (const expr of validCases) {
        const res = parse(expr);
        expect(res.ok, `Failed to parse valid expression: "${expr}"`).toBe(true);
      }
    });

    it('attaches accurate source spans to parsed nodes', () => {
      const res = parse('A + B');
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.ast.span).toEqual({ start: 0, end: 5 });
    });

    it('flattens chained same-operator AND and OR nodes into n-ary arrays', () => {
      const andRes = parse('A . B . C');
      expect(andRes.ok).toBe(true);
      if (andRes.ok) {
        expect(andRes.ast.type).toBe('and');
        if (andRes.ast.type === 'and') {
          expect(andRes.ast.children.length).toBe(3);
        }
      }

      const orRes = parse('A + B + C + D');
      expect(orRes.ok).toBe(true);
      if (orRes.ok) {
        expect(orRes.ast.type).toBe('or');
        if (orRes.ast.type === 'or') {
          expect(orRes.ast.children.length).toBe(4);
        }
      }
    });

    it('sorts variables alphabetically by default and preserves appearance order when requested', () => {
      const expr = 'C + A . B';
      const defaultRes = parse(expr);
      expect(defaultRes.ok).toBe(true);
      if (defaultRes.ok) {
        expect(defaultRes.variables).toEqual(['A', 'B', 'C']);
      }

      const appearanceRes = parse(expr, { sortVariables: 'appearance' });
      expect(appearanceRes.ok).toBe(true);
      if (appearanceRes.ok) {
        expect(appearanceRes.variables).toEqual(['C', 'A', 'B']);
      }
    });
  });

  describe('parser - invalid expressions', () => {
    interface InvalidTestCase {
      readonly expr: string;
      readonly expectedPos: number;
      readonly category: string;
    }

    const invalidCases: readonly InvalidTestCase[] = [
      { expr: '(A+B', expectedPos: 0, category: 'Missing closing parenthesis' },
      { expr: '((A)', expectedPos: 0, category: 'Missing closing parenthesis' },
      { expr: '(A', expectedPos: 0, category: 'Missing closing parenthesis' },
      { expr: 'A+B)', expectedPos: 3, category: "Unexpected ')'" },
      { expr: ')', expectedPos: 0, category: "Unexpected ')'" },
      { expr: '()', expectedPos: 1, category: "Unexpected ')'" },
      { expr: 'A+', expectedPos: 1, category: "Expected a variable or '(' after '+'" },
      { expr: 'A*', expectedPos: 1, category: "Expected a variable or '(' after '*'" },
      { expr: 'A.', expectedPos: 1, category: "Expected a variable or '(' after '.'" },
      { expr: 'A^', expectedPos: 1, category: "Expected a variable or '(' after '^'" },
      { expr: 'A and', expectedPos: 2, category: "Expected a variable or '(' after 'and'" },
      { expr: 'A +', expectedPos: 2, category: "Expected a variable or '(' after '+'" },
      { expr: '+A', expectedPos: 0, category: "Unexpected operator '+'" },
      { expr: '*A', expectedPos: 0, category: "Unexpected operator '*'" },
      { expr: '.A', expectedPos: 0, category: "Unexpected operator '.'" },
      { expr: '^A', expectedPos: 0, category: "Unexpected operator '^'" },
      { expr: 'and A', expectedPos: 0, category: "Unexpected operator 'and'" },
      { expr: 'or A', expectedPos: 0, category: "Unexpected operator 'or'" },
      { expr: 'nand A', expectedPos: 0, category: "Unexpected operator 'nand'" },
      { expr: '(+A)', expectedPos: 1, category: "Unexpected operator '+'" },
      { expr: 'A++B', expectedPos: 2, category: "Expected a variable or '(' after '+'" },
      { expr: 'A+*B', expectedPos: 2, category: "Expected a variable or '(' after '+'" },
      { expr: 'A^^B', expectedPos: 2, category: "Expected a variable or '(' after '^'" },
      { expr: '', expectedPos: 0, category: 'Empty expression' },
      { expr: '   ', expectedPos: 0, category: 'Empty expression' },
      { expr: '@', expectedPos: 0, category: 'Unexpected character' },
      { expr: 'A $ B', expectedPos: 2, category: 'Unexpected character' },
      { expr: 'A B +', expectedPos: 4, category: "Expected a variable or '(' after '+'" },
    ];

    it(`accurately rejects all ${invalidCases.length} invalid expressions with exact positions`, () => {
      for (const tc of invalidCases) {
        const res = parse(tc.expr);
        expect(res.ok, `Expected rejection for invalid expression: "${tc.expr}"`).toBe(false);
        if (!res.ok) {
          expect(res.error.position).toBe(tc.expectedPos);
          expect(res.error.message.toLowerCase()).toContain(tc.category.toLowerCase().slice(0, 10));
        }
      }
    });
  });

  describe('parser - precedence rules', () => {
    it('A+B.C parses as A+(B.C) (AND over OR)', () => {
      const p1 = parse('A+B.C');
      const p2 = parse('A+(B.C)');
      expect(p1.ok && p2.ok).toBe(true);
      if (p1.ok && p2.ok && p1.ast.type === 'or') {
        const secondChild = p1.ast.children[1];
        expect(secondChild?.type).toBe('and');
      }
    });

    it('A^B.C parses as A^(B.C) (AND over XOR)', () => {
      const p1 = parse('A^B.C');
      const p2 = parse('A^(B.C)');
      expect(p1.ok && p2.ok).toBe(true);
      if (p1.ok && p2.ok && p1.ast.type === 'xor') {
        expect(p1.ast.right.type).toBe('and');
      }
    });

    it('A+B^C parses as A+(B^C) (XOR over OR)', () => {
      const p1 = parse('A+B^C');
      const p2 = parse('A+(B^C)');
      expect(p1.ok && p2.ok).toBe(true);
      if (p1.ok && p2.ok && p1.ast.type === 'or') {
        const secondChild = p1.ast.children[1];
        expect(secondChild?.type).toBe('xor');
      }
    });

    it('!A.B parses as (!A).B (NOT over AND)', () => {
      const p1 = parse('!A.B');
      const p2 = parse('(!A).B');
      expect(p1.ok && p2.ok).toBe(true);
      if (p1.ok && p2.ok && p1.ast.type === 'and') {
        const firstChild = p1.ast.children[0];
        expect(firstChild?.type).toBe('not');
      }
    });

    it("A'B' parses as (A')(B') (postfix complement over implicit AND)", () => {
      const p1 = parse("A'B'");
      const p2 = parse("(A')(B')");
      expect(p1.ok && p2.ok).toBe(true);
      if (p1.ok && p2.ok && p1.ast.type === 'and') {
        const firstChild = p1.ast.children[0];
        const secondChild = p1.ast.children[1];
        expect(firstChild?.type).toBe('not');
        expect(secondChild?.type).toBe('not');
      }
    });
  });

  describe('printer and round-trip verification', () => {
    function generateRandomAst(depth: number, rng: SeededRandom): BoolNode {
      const vars = ['A', 'B', 'C', 'D'];
      if (depth <= 1 || rng.next() < 0.25) {
        if (rng.next() < 0.2) {
          return { type: 'constant', value: rng.choice([0, 1]) };
        }
        return { type: 'variable', name: rng.choice(vars) };
      }

      const roll = rng.next();
      if (roll < 0.25) {
        return { type: 'not', child: generateRandomAst(depth - 1, rng) };
      }
      if (roll < 0.5) {
        return {
          type: 'and',
          children: [generateRandomAst(depth - 1, rng), generateRandomAst(depth - 1, rng)],
        };
      }
      if (roll < 0.75) {
        return {
          type: 'or',
          children: [generateRandomAst(depth - 1, rng), generateRandomAst(depth - 1, rng)],
        };
      }
      return {
        type: 'xor',
        left: generateRandomAst(depth - 1, rng),
        right: generateRandomAst(depth - 1, rng),
      };
    }

    it('round-trips 200 random expressions across apostrophe, symbolic, and words styles', () => {
      const rng = new SeededRandom(987654321);
      const styles = ['apostrophe', 'symbolic', 'words'] as const;

      for (let i = 0; i < 200; i++) {
        const originalAst = generateRandomAst(3, rng);
        const vars = ['A', 'B', 'C', 'D'];
        const originalTableRes = buildTruthTable(originalAst, vars);
        expect(originalTableRes.ok).toBe(true);
        if (!originalTableRes.ok) continue;

        for (const style of styles) {
          const printed = toString(originalAst, style);
          const parsedAgain = parse(printed);
          expect(parsedAgain.ok, `Failed to parse printed text (${style}): "${printed}"`).toBe(true);
          if (!parsedAgain.ok) continue;

          // Semantically identical truth table
          const reparsedTableRes = buildTruthTable(parsedAgain.ast, vars);
          expect(reparsedTableRes.ok).toBe(true);
          if (reparsedTableRes.ok) {
            expect(
              reparsedTableRes.table.rows.map((r) => r.output),
              `Mismatch in truth table for style ${style}: "${printed}"`
            ).toEqual(originalTableRes.table.rows.map((r) => r.output));
          }

          // Idempotent printing: printing the parsed AST again yields identical text
          const secondPrint = toString(parsedAgain.ast, style);
          expect(secondPrint).toBe(printed);
        }
      }
    });
  });

  describe('evaluator', () => {
    it('evaluates all standard 2-valued gate operations', () => {
      const vars = { A: 0 as const, B: 1 as const };
      const andAst: BoolNode = {
        type: 'and',
        children: [{ type: 'variable', name: 'A' }, { type: 'variable', name: 'B' }],
      };
      expect(evaluate(andAst, vars)).toBe(0);
      expect(evaluateBinary(andAst, vars)).toBe(0);

      const orAst: BoolNode = {
        type: 'or',
        children: [{ type: 'variable', name: 'A' }, { type: 'variable', name: 'B' }],
      };
      expect(evaluate(orAst, vars)).toBe(1);
      expect(evaluateBinary(orAst, vars)).toBe(1);

      const xorAst: BoolNode = {
        type: 'xor',
        left: { type: 'variable', name: 'A' },
        right: { type: 'variable', name: 'B' },
      };
      expect(evaluate(xorAst, vars)).toBe(1);
      expect(evaluateBinary(xorAst, vars)).toBe(1);

      const notAst: BoolNode = { type: 'not', child: { type: 'variable', name: 'A' } };
      expect(evaluate(notAst, vars)).toBe(1);
      expect(evaluateBinary(notAst, vars)).toBe(1);
    });

    it('enforces 3-valued pessimistic simulation rules for {0, 1, X}', () => {
      // 0 AND X = 0, 1 AND X = X
      const andNode: BoolNode = {
        type: 'and',
        children: [{ type: 'variable', name: 'A' }, { type: 'variable', name: 'B' }],
      };
      expect(evaluate(andNode, { A: 0, B: 'X' })).toBe(0);
      expect(evaluate(andNode, { A: 'X', B: 0 })).toBe(0);
      expect(evaluate(andNode, { A: 1, B: 'X' })).toBe('X');
      expect(evaluate(andNode, { A: 'X', B: 1 })).toBe('X');
      expect(evaluate(andNode, { A: 'X', B: 'X' })).toBe('X');

      // 1 OR X = 1, 0 OR X = X
      const orNode: BoolNode = {
        type: 'or',
        children: [{ type: 'variable', name: 'A' }, { type: 'variable', name: 'B' }],
      };
      expect(evaluate(orNode, { A: 1, B: 'X' })).toBe(1);
      expect(evaluate(orNode, { A: 'X', B: 1 })).toBe(1);
      expect(evaluate(orNode, { A: 0, B: 'X' })).toBe('X');
      expect(evaluate(orNode, { A: 'X', B: 0 })).toBe('X');

      // X XOR anything = X
      const xorNode: BoolNode = {
        type: 'xor',
        left: { type: 'variable', name: 'A' },
        right: { type: 'variable', name: 'B' },
      };
      expect(evaluate(xorNode, { A: 'X', B: 0 })).toBe('X');
      expect(evaluate(xorNode, { A: 'X', B: 1 })).toBe('X');
      expect(evaluate(xorNode, { A: 0, B: 'X' })).toBe('X');
      expect(evaluate(xorNode, { A: 1, B: 'X' })).toBe('X');
      expect(evaluate(xorNode, { A: 'X', B: 'X' })).toBe('X');

      // NOT X = X
      const notNode: BoolNode = { type: 'not', child: { type: 'variable', name: 'A' } };
      expect(evaluate(notNode, { A: 'X' })).toBe('X');
    });

    it('throws a descriptive error when a variable is missing from assignment', () => {
      const ast: BoolNode = {
        type: 'and',
        children: [{ type: 'variable', name: 'A' }, { type: 'variable', name: 'B' }],
      };
      expect(() => evaluate(ast, { A: 1 })).toThrow('Variable "B" is missing from assignment');
      expect(() => evaluateBinary(ast, { A: 1 })).toThrow('Variable "B" is missing from assignment');
    });
  });

  describe('truthTable', () => {
    it('generates truth table with strict MSB-first bit order for hand-checked 3-variable example', () => {
      // F(A, B, C) = AB + C'
      // Variable 0 is A (MSB, weight 4), Variable 1 is B (weight 2), Variable 2 is C (LSB, weight 1)
      const parseRes = parse("AB + C'");
      expect(parseRes.ok).toBe(true);
      if (!parseRes.ok) return;

      const ttRes = buildTruthTable(parseRes.ast, ['A', 'B', 'C']);
      expect(ttRes.ok).toBe(true);
      if (!ttRes.ok) return;

      const rows = ttRes.table.rows;
      expect(rows.length).toBe(8);

      // Verify row inputs and outputs:
      // m0: 000 -> 0 + 1 = 1
      expect(rows[0]).toEqual({ index: 0, inputs: [0, 0, 0], output: 1 });
      // m1: 001 -> 0 + 0 = 0
      expect(rows[1]).toEqual({ index: 1, inputs: [0, 0, 1], output: 0 });
      // m2: 010 -> 0 + 1 = 1
      expect(rows[2]).toEqual({ index: 2, inputs: [0, 1, 0], output: 1 });
      // m3: 011 -> 0 + 0 = 0
      expect(rows[3]).toEqual({ index: 3, inputs: [0, 1, 1], output: 0 });
      // m4: 100 -> 0 + 1 = 1
      expect(rows[4]).toEqual({ index: 4, inputs: [1, 0, 0], output: 1 });
      // m5: 101 -> 0 + 0 = 0
      expect(rows[5]).toEqual({ index: 5, inputs: [1, 0, 1], output: 0 });
      // m6: 110 -> 1 + 1 = 1
      expect(rows[6]).toEqual({ index: 6, inputs: [1, 1, 0], output: 1 });
      // m7: 111 -> 1 + 0 = 1
      expect(rows[7]).toEqual({ index: 7, inputs: [1, 1, 1], output: 1 });

      expect(getMinterms(ttRes.table)).toEqual([0, 2, 4, 6, 7]);
      expect(getMaxterms(ttRes.table)).toEqual([1, 3, 5]);
      expect(getDontCares(ttRes.table)).toEqual([]);
    });

    it('supports 6-variable boundary and rejects 7 variables with a clear error result', () => {
      const sixVars = ['A', 'B', 'C', 'D', 'E', 'F'];
      const sixAst: BoolNode = {
        type: 'and',
        children: sixVars.map((v) => ({ type: 'variable', name: v })),
      };
      const sixRes = buildTruthTable(sixAst, sixVars);
      expect(sixRes.ok).toBe(true);
      if (sixRes.ok) {
        expect(sixRes.table.rows.length).toBe(64);
      }

      const sevenVars = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      const sevenAst: BoolNode = {
        type: 'and',
        children: sevenVars.map((v) => ({ type: 'variable', name: v })),
      };
      const sevenRes = buildTruthTable(sevenAst, sevenVars);
      expect(sevenRes.ok).toBe(false);
      if (!sevenRes.ok) {
        expect(sevenRes.error).toContain('Truth table supports at most 6 variables');
      }
    });

    it('carries don`t-care values and correctly evaluates tautology and contradiction', () => {
      const ttWithDc = tableFromMinterms(['A', 'B'], [1], [2]);
      expect(ttWithDc.ok).toBe(true);
      if (!ttWithDc.ok) return;

      expect(getMinterms(ttWithDc.table)).toEqual([1]);
      expect(getDontCares(ttWithDc.table)).toEqual([2]);
      expect(getMaxterms(ttWithDc.table)).toEqual([0, 3]);

      const tautTable = tableFromMinterms(['A', 'B'], [0, 1, 2, 3]);
      expect(tautTable.ok && isTautology(tautTable.table)).toBe(true);
      expect(tautTable.ok && isContradiction(tautTable.table)).toBe(false);

      const contraTable = tableFromMinterms(['A', 'B'], []);
      expect(contraTable.ok && isContradiction(contraTable.table)).toBe(true);
      expect(contraTable.ok && isTautology(contraTable.table)).toBe(false);
    });
  });

  describe('canonical forms', () => {
    it('computes textbook majority function canonical forms', () => {
      // Majority function: F(A, B, C) = AB + BC + AC
      // Minterms: m3 (011), m5 (101), m6 (110), m7 (111)
      const parseRes = parse('A B + B C + A C');
      expect(parseRes.ok).toBe(true);
      if (!parseRes.ok) return;

      const ttRes = buildTruthTable(parseRes.ast, ['A', 'B', 'C']);
      expect(ttRes.ok).toBe(true);
      if (!ttRes.ok) return;

      const sop = canonicalSOP(ttRes.table);
      expect(sop.minterms).toEqual([3, 5, 6, 7]);
      expect(sop.sigmaM).toBe('Σm(3, 5, 6, 7)');
      expect(sop.expanded).toBe("A'BC + AB'C + ABC' + ABC");

      const pos = canonicalPOS(ttRes.table);
      expect(pos.maxterms).toEqual([0, 1, 2, 4]);
      expect(pos.piM).toBe('ΠM(0, 1, 2, 4)');
      expect(pos.expanded).toBe("(A + B + C)(A + B + C')(A + B' + C)(A' + B + C)");
    });

    it('correctly handles constant 0, constant 1, and don`t-cares', () => {
      // Constant 0
      const tableZero = tableFromMinterms(['A', 'B'], []);
      expect(tableZero.ok).toBe(true);
      if (tableZero.ok) {
        const sop0 = canonicalSOP(tableZero.table);
        expect(sop0.minterms).toEqual([]);
        expect(sop0.expanded).toBe('0');
        expect(sop0.expression).toEqual({ type: 'constant', value: 0 });

        const pos0 = canonicalPOS(tableZero.table);
        expect(pos0.maxterms).toEqual([0, 1, 2, 3]);
      }

      // Constant 1
      const tableOne = tableFromMinterms(['A', 'B'], [0, 1, 2, 3]);
      expect(tableOne.ok).toBe(true);
      if (tableOne.ok) {
        const pos1 = canonicalPOS(tableOne.table);
        expect(pos1.maxterms).toEqual([]);
        expect(pos1.expanded).toBe('1');
        expect(pos1.expression).toEqual({ type: 'constant', value: 1 });
      }

      // Don't-cares
      const tableDc = tableFromMinterms(['A', 'B'], [1, 3], [2]);
      expect(tableDc.ok).toBe(true);
      if (tableDc.ok) {
        const forms = canonicalForms(tableDc.table);
        expect(forms.sop.sigmaM).toBe('Σm(1, 3) + Σd(2)');
        expect(forms.pos.piM).toBe('ΠM(0) + Σd(2)');
        expect(forms.mintermBinaryStrings).toEqual(['01', '11']);
        expect(forms.maxtermBinaryStrings).toEqual(['00']);
        expect(forms.dontCareBinaryStrings).toEqual(['10']);
      }
    });

    it('round-trips sopToAst and posToAst back to identical truth tables', () => {
      const vars = ['A', 'B', 'C'];
      const origTableRes = tableFromMinterms(vars, [1, 2, 5, 7]);
      expect(origTableRes.ok).toBe(true);
      if (!origTableRes.ok) return;

      const sop = canonicalSOP(origTableRes.table);
      const sopAst = sopToAst(sop);
      const sopTableRes = buildTruthTable(sopAst, vars);
      expect(sopTableRes.ok).toBe(true);
      if (sopTableRes.ok) {
        expect(sopTableRes.table.rows.map((r) => r.output)).toEqual(
          origTableRes.table.rows.map((r) => r.output)
        );
      }

      const pos = canonicalPOS(origTableRes.table);
      const posAst = posToAst(pos);
      const posTableRes = buildTruthTable(posAst, vars);
      expect(posTableRes.ok).toBe(true);
      if (posTableRes.ok) {
        expect(posTableRes.table.rows.map((r) => r.output)).toEqual(
          origTableRes.table.rows.map((r) => r.output)
        );
      }
    });

    it('verifies that minterm and maxterm lists strictly partition all rows', () => {
      const vars = 3;
      const minterms = [1, 4, 6];
      const dontCares = [2];
      const maxterms = mintermListToMaxtermList(minterms, vars, dontCares);
      expect(maxterms).toEqual([0, 3, 5, 7]);

      const reconstructedMinterms = maxtermListToMintermList(maxterms, vars, dontCares);
      expect(reconstructedMinterms).toEqual(minterms);

      const binaryStrings = indicesToBinaryStrings(minterms, vars);
      expect(binaryStrings).toEqual(['001', '100', '110']);
    });
  });

  describe('sample verification table report', () => {
    it('computes and logs the 5 sample verification expressions', () => {
      const samples = [
        "A'B + C(D xor E)",
        '!(A + B)',
        'A*B^C',
        "AB + A'C",
        '(A + B)(A + C)',
      ];

      const reportRows: Array<{
        Input: string;
        ParsedAST: string;
        Minterms: string;
        SOP_Sigma: string;
        SOP_Expanded: string;
        POS_Pi: string;
      }> = [];

      for (const input of samples) {
        const parsed = parse(input);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) continue;

        const tt = buildTruthTable(parsed.ast, parsed.variables);
        expect(tt.ok).toBe(true);
        if (!tt.ok) continue;

        const sop = canonicalSOP(tt.table);
        const pos = canonicalPOS(tt.table);

        reportRows.push({
          Input: input,
          ParsedAST: toString(parsed.ast, 'symbolic'),
          Minterms: sop.minterms.join(','),
          SOP_Sigma: sop.sigmaM,
          SOP_Expanded: sop.expanded,
          POS_Pi: pos.piM,
        });
      }

      // eslint-disable-next-line no-console
      console.table(reportRows);
      expect(reportRows.length).toBe(5);
    });
  });
});
