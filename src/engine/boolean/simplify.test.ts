/**
 * @file simplify.test.ts
 * Tests for Stage 4B: algebraic simplification, equivalence checking,
 * and universal-gate (NAND/NOR-only) conversion.
 *
 * All tests use the public API only (via index.ts re-exports).
 * Truth-table equivalence is the ground truth for every assertion.
 */

import { describe, expect, it } from 'vitest';
import type { BoolNode } from '../../types/ast';
import { parse } from './parser';
import { areEquivalent } from './equivalence';
import { simplify, simplifiedAst } from './simplify';
import { toNandOnlyForm, toNorOnlyForm } from './universalGates';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse an expression; throw if it fails. */
function p(expr: string): BoolNode {
  const result = parse(expr);
  if (!result.ok) {
    throw new Error(`Parse failed for "${expr}": ${result.error.message}`);
  }
  return result.ast!;
}

// ---------------------------------------------------------------------------
// 1. areEquivalent
// ---------------------------------------------------------------------------

describe('areEquivalent', () => {
  it('identical variables are equivalent', () => {
    expect(areEquivalent(p('A'), p('A'))).toBe(true);
  });

  it('tautology detected: A + A\' ≡ 1', () => {
    expect(areEquivalent(p("A + A'"), p('1'))).toBe(true);
  });

  it('contradiction detected: A * A\' ≡ 0', () => {
    expect(areEquivalent(p("AA'"), p('0'))).toBe(true);
  });

  it('De Morgan equivalence: (AB)\' ≡ A\' + B\'', () => {
    expect(areEquivalent(p("(AB)'"), p("A' + B'"))).toBe(true);
  });

  it('De Morgan equivalence: (A + B)\' ≡ A\'B\'', () => {
    expect(areEquivalent(p("(A + B)'"), p("A'B'"))).toBe(true);
  });

  it('non-equivalent expressions return false', () => {
    expect(areEquivalent(p('A'), p('B'))).toBe(false);
    expect(areEquivalent(p('AB'), p('A + B'))).toBe(false);
  });

  it('XOR vs canonical SOP equivalent', () => {
    // A XOR B = A'B + AB'
    expect(areEquivalent(p('A ^ B'), p("A'B + AB'"))).toBe(true);
  });

  it('XNOR vs canonical equivalent', () => {
    // A XNOR B = AB + A'B'
    expect(areEquivalent(p('A xnor B'), p("AB + A'B'"))).toBe(true);
  });

  it('distributive equivalence: A(B + C) ≡ AB + AC', () => {
    expect(areEquivalent(p('A(B + C)'), p('AB + AC'))).toBe(true);
  });

  it('consensus theorem: AB + A\'C + BC ≡ AB + A\'C', () => {
    expect(areEquivalent(p("AB + A'C + BC"), p("AB + A'C"))).toBe(true);
  });

  it('3-variable expression equivalence', () => {
    // A\'B + AB\' + AB ≡ A + B
    expect(areEquivalent(p("A'B + AB' + AB"), p('A + B'))).toBe(true);
  });

  it('throws RangeError for more than 12 variables', () => {
    // Build a 13-variable constant-0 expression: a AND a' AND b AND ... (13 vars)
    const vars = 'ABCDEFGHIJKLM'; // 13 chars
    const expr = [...vars].map((v) => `${v}`).join(' + '); // 13 variables, all OR'd
    const ast = p(expr);
    // ast has 13 variables
    expect(() => areEquivalent(ast, ast)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// 2. simplify
// ---------------------------------------------------------------------------

describe('simplify', () => {
  describe('identity law', () => {
    it('A AND 1 → A', () => {
      const result = simplify(p('A * 1'));
      expect(areEquivalent(result.simplified, p('A'))).toBe(true);
      expect(result.changed).toBe(true);
      expect(result.steps.some((s) => s.lawName === 'identity')).toBe(true);
    });

    it('A OR 0 → A', () => {
      const result = simplify(p('A + 0'));
      expect(areEquivalent(result.simplified, p('A'))).toBe(true);
      expect(result.steps.some((s) => s.lawName === 'identity')).toBe(true);
    });
  });

  describe('null law', () => {
    it('A AND 0 → 0', () => {
      const result = simplify(p('A * 0'));
      expect(result.simplified).toEqual({ type: 'constant', value: 0 });
      expect(result.steps.some((s) => s.lawName === 'null')).toBe(true);
    });

    it('A OR 1 → 1', () => {
      const result = simplify(p('A + 1'));
      expect(result.simplified).toEqual({ type: 'constant', value: 1 });
      expect(result.steps.some((s) => s.lawName === 'null')).toBe(true);
    });
  });

  describe('idempotent law', () => {
    it('A AND A → A', () => {
      const result = simplify(p('AA'));
      expect(areEquivalent(result.simplified, p('A'))).toBe(true);
      expect(result.steps.some((s) => s.lawName === 'idempotent')).toBe(true);
    });

    it('A OR A → A', () => {
      const result = simplify(p('A + A'));
      expect(areEquivalent(result.simplified, p('A'))).toBe(true);
      expect(result.steps.some((s) => s.lawName === 'idempotent')).toBe(true);
    });
  });

  describe('complement law', () => {
    it("AA' → 0", () => {
      const result = simplify(p("AA'"));
      expect(result.simplified).toEqual({ type: 'constant', value: 0 });
      expect(result.steps.some((s) => s.lawName === 'complement')).toBe(true);
    });

    it("A + A' → 1", () => {
      const result = simplify(p("A + A'"));
      expect(result.simplified).toEqual({ type: 'constant', value: 1 });
      expect(result.steps.some((s) => s.lawName === 'complement')).toBe(true);
    });
  });

  describe('involution law', () => {
    it("A'' → A", () => {
      const result = simplify(p("A''"));
      expect(areEquivalent(result.simplified, p('A'))).toBe(true);
      expect(result.steps.some((s) => s.lawName === 'involution')).toBe(true);
    });
  });

  describe('absorption law', () => {
    it('A(A + B) → A', () => {
      const result = simplify(p('A(A + B)'));
      expect(areEquivalent(result.simplified, p('A'))).toBe(true);
      expect(result.steps.some((s) => s.lawName === 'absorption')).toBe(true);
    });

    it('A + AB → A', () => {
      const result = simplify(p('A + AB'));
      expect(areEquivalent(result.simplified, p('A'))).toBe(true);
      expect(result.steps.some((s) => s.lawName === 'absorption')).toBe(true);
    });
  });

  describe('de morgan law', () => {
    it("(AB)' simplifies via De Morgan to A' + B'", () => {
      const result = simplify(p("(AB)'"));
      expect(areEquivalent(result.simplified, p("A' + B'"))).toBe(true);
      expect(result.steps.some((s) => s.lawName === 'de-morgan')).toBe(true);
    });

    it("(A + B)' simplifies via De Morgan to A'B'", () => {
      const result = simplify(p("(A + B)'"));
      expect(areEquivalent(result.simplified, p("A'B'"))).toBe(true);
      expect(result.steps.some((s) => s.lawName === 'de-morgan')).toBe(true);
    });
  });

  describe('step-by-step trace properties', () => {
    it('each step records before and after', () => {
      const result = simplify(p('AA'));
      for (const step of result.steps) {
        expect(step.before).toBeDefined();
        expect(step.after).toBeDefined();
        expect(step.explanation.length).toBeGreaterThan(0);
        expect(typeof step.lawName).toBe('string');
      }
    });

    it('each step is individually equivalent to the expression', () => {
      // All steps must be equivalence-preserving
      const result = simplify(p("A + A' + AB"));
      for (const step of result.steps) {
        expect(areEquivalent(step.before, step.after)).toBe(true);
      }
    });

    it('already-minimal expression returns changed=false', () => {
      const result = simplify(p('A'));
      expect(result.changed).toBe(false);
      expect(result.steps.length).toBe(0);
    });
  });

  describe('compound simplifications', () => {
    it('simplifies A + A\'B to A + B (consensus-like)', () => {
      // A + A'B = (A + A')(A + B) = A + B via absorption, but reachable via complement+identity too
      const result = simplify(p("A + A'B"));
      // The result must be equivalent to A + B
      expect(areEquivalent(result.simplified, p('A + B'))).toBe(true);
    });

    it('simplifies AB + A\'C + BC (consensus) equivalent to AB + A\'C', () => {
      const result = simplify(p("AB + A'C + BC"));
      // After simplification should be equivalent to AB + A'C (consensus theorem drops BC)
      expect(areEquivalent(result.simplified, p("AB + A'C"))).toBe(true);
    });
  });

  describe('simplifiedAst convenience wrapper', () => {
    it('returns equivalent result to simplify().simplified', () => {
      const ast = p("AA'");
      const a = simplifiedAst(ast);
      const b = simplify(ast).simplified;
      expect(areEquivalent(a, b)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// 3. toNandOnlyForm
// ---------------------------------------------------------------------------

describe('toNandOnlyForm', () => {
  const expressions = [
    'A',
    "A'",
    'AB',
    'A + B',
    "A'B + AB'",       // XOR canonical
    "AB + A'B'",       // XNOR canonical
    "A'B + AC",
    'A(B + C)',
  ];

  it.each(expressions)('"%s" NAND-only is logically equivalent', (expr) => {
    const ast = p(expr);
    const form = toNandOnlyForm(ast);
    expect(areEquivalent(ast, form.root)).toBe(true);
  });

  it('result AST contains only nand / variable / constant nodes', () => {
    const ast = p('A + B');
    const form = toNandOnlyForm(ast);
    function assertNandOnly(node: BoolNode): void {
      expect(['nand', 'variable', 'constant']).toContain(node.type);
      if (node.type === 'nand') {
        assertNandOnly(node.left);
        assertNandOnly(node.right);
      }
    }
    assertNandOnly(form.root);
  });

  it('gateCount matches actual NAND gate count in the tree', () => {
    const ast = p('AB');
    const form = toNandOnlyForm(ast);
    function countNands(n: BoolNode): number {
      if (n.type === 'nand') return 1 + countNands(n.left) + countNands(n.right);
      if (n.type === 'variable' || n.type === 'constant') return 0;
      return 0;
    }
    expect(form.gateCount).toBe(countNands(form.root));
  });

  it('expressionText is a non-empty string', () => {
    const form = toNandOnlyForm(p('AB'));
    expect(typeof form.expressionText).toBe('string');
    expect(form.expressionText.length).toBeGreaterThan(0);
  });

  it('XOR converted to NAND-only is equivalent', () => {
    const xorAst = p('A ^ B');
    const form = toNandOnlyForm(xorAst);
    expect(areEquivalent(xorAst, form.root)).toBe(true);
  });

  it('XNOR converted to NAND-only is equivalent', () => {
    const xnorAst = p('A xnor B');
    const form = toNandOnlyForm(xnorAst);
    expect(areEquivalent(xnorAst, form.root)).toBe(true);
  });

  it('3-variable expression NAND-only is equivalent', () => {
    const ast = p("A'B + AC");
    const form = toNandOnlyForm(ast);
    expect(areEquivalent(ast, form.root)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. toNorOnlyForm
// ---------------------------------------------------------------------------

describe('toNorOnlyForm', () => {
  const expressions = [
    'A',
    "A'",
    'AB',
    'A + B',
    "A'B + AB'",
    "AB + A'B'",
    "A'B + AC",
    'A(B + C)',
  ];

  it.each(expressions)('"%s" NOR-only is logically equivalent', (expr) => {
    const ast = p(expr);
    const form = toNorOnlyForm(ast);
    expect(areEquivalent(ast, form.root)).toBe(true);
  });

  it('result AST contains only nor / variable / constant nodes', () => {
    const ast = p('AB');
    const form = toNorOnlyForm(ast);
    function assertNorOnly(node: BoolNode): void {
      expect(['nor', 'variable', 'constant']).toContain(node.type);
      if (node.type === 'nor') {
        assertNorOnly(node.left);
        assertNorOnly(node.right);
      }
    }
    assertNorOnly(form.root);
  });

  it('gateCount matches actual NOR gate count in the tree', () => {
    const ast = p('A + B');
    const form = toNorOnlyForm(ast);
    function countNors(n: BoolNode): number {
      if (n.type === 'nor') return 1 + countNors(n.left) + countNors(n.right);
      if (n.type === 'variable' || n.type === 'constant') return 0;
      return 0;
    }
    expect(form.gateCount).toBe(countNors(form.root));
  });

  it('expressionText is a non-empty string', () => {
    const form = toNorOnlyForm(p('A + B'));
    expect(typeof form.expressionText).toBe('string');
    expect(form.expressionText.length).toBeGreaterThan(0);
  });

  it('XOR converted to NOR-only is equivalent', () => {
    const xorAst = p('A ^ B');
    const form = toNorOnlyForm(xorAst);
    expect(areEquivalent(xorAst, form.root)).toBe(true);
  });

  it('XNOR converted to NOR-only is equivalent', () => {
    const xnorAst = p('A xnor B');
    const form = toNorOnlyForm(xnorAst);
    expect(areEquivalent(xnorAst, form.root)).toBe(true);
  });

  it('3-variable expression NOR-only is equivalent', () => {
    const ast = p("A'B + AC");
    const form = toNorOnlyForm(ast);
    expect(areEquivalent(ast, form.root)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Sample verification table (stdout for manual review)
// ---------------------------------------------------------------------------

describe('sample verification table report', () => {
  it('simplify + NAND/NOR equivalence on 5 representative expressions', () => {
    const cases = [
      "A + A'",
      "AA'",
      'A(A + B)',
      "A + A'B",
      "AB + A'C + BC",
    ];

    const rows = cases.map((expr) => {
      const ast = p(expr);
      const { steps } = simplify(ast);
      const nandEq = areEquivalent(ast, toNandOnlyForm(ast).root);
      const norEq = areEquivalent(ast, toNorOnlyForm(ast).root);
      return { expr, steps: steps.length, nandEq, norEq };
    });

    // eslint-disable-next-line no-console
    console.table(rows);

    for (const row of rows) {
      expect(row.nandEq).toBe(true);
      expect(row.norEq).toBe(true);
    }
  });
});
