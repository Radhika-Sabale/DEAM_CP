/**
 * @file generator.test.ts
 * Comprehensive test suite for expression-to-circuit synthesis, style purity,
 * fan-in decomposition, subexpression sharing, and truth-table verification.
 */

import { describe, it, expect } from 'vitest';
import type { BoolNode } from '../../types/ast';
import { solvePOS, solveSOP } from '../kmap/solver';
import { extractTruthTable } from './extractTruthTable';
import { generateCircuit } from './generator';
import { validateCircuit } from './validate';

// Simple deterministic PRNG for seeded property tests
function makePrng(seed = 123456789) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('generateCircuit synthesizer', () => {
  it('exhaustive verification of all 256 three-variable functions across all 5 styles', () => {
    const vars = ['A', 'B', 'C'];
    const styles = ['direct', 'sop-and-or', 'pos-or-and', 'nand-only', 'nor-only'] as const;

    for (let mask = 0; mask < 256; mask++) {
      const minterms: number[] = [];
      for (let m = 0; m < 8; m++) {
        if ((mask & (1 << m)) !== 0) {
          minterms.push(m);
        }
      }

      const sopSol = solveSOP(3, minterms, [], vars);
      expect(sopSol.ok).toBe(true);
      if (!sopSol.ok) continue;

      for (const style of styles) {
        const res = generateCircuit({
          variables: vars,
          outputs: [{ name: 'F', expr: sopSol.solution.expression }],
          style,
          maxFanIn: 3,
        });

        expect(res.ok).toBe(true);
        if (!res.ok) continue;

        const val = validateCircuit(res.graph);
        expect(val.hasBlockingErrors).toBe(false);

        const extracted = extractTruthTable(res.graph, {
          inputOrder: vars,
          outputOrder: ['F'],
        });
        expect(extracted.ok).toBe(true);
        if (!extracted.ok) continue;

        for (let m = 0; m < 8; m++) {
          const expectedBit = (mask & (1 << m)) !== 0 ? 1 : 0;
          expect(extracted.table.rows[m]?.outputs[0]).toBe(expectedBit);
        }
      }
    }
  });

  it('seeded verification of 1,000 4-variable, 200 5-variable, and 50 6-variable functions with K-Map solver', () => {
    const prng = makePrng(987654321);

    // 1000 4-variable tests
    const vars4 = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < 1000; i++) {
      const minterms: number[] = [];
      const dontCares: number[] = [];
      for (let m = 0; m < 16; m++) {
        const r = prng();
        if (r < 0.35) minterms.push(m);
        else if (r < 0.45) dontCares.push(m);
      }

      const sop = solveSOP(4, minterms, dontCares, vars4);
      expect(sop.ok).toBe(true);
      if (!sop.ok) continue;

      const res = generateCircuit({
        variables: vars4,
        outputs: [{ name: 'F', expr: sop.solution.expression }],
        style: i % 2 === 0 ? 'sop-and-or' : 'nand-only',
        maxFanIn: 2 + (i % 3),
      });

      expect(res.ok).toBe(true);
      if (!res.ok) continue;

      const extracted = extractTruthTable(res.graph, { inputOrder: vars4, outputOrder: ['F'] });
      expect(extracted.ok).toBe(true);
      if (!extracted.ok) continue;

      for (const m of minterms) {
        expect(extracted.table.rows[m]?.outputs[0]).toBe(1);
      }
      for (let m = 0; m < 16; m++) {
        if (!minterms.includes(m) && !dontCares.includes(m)) {
          expect(extracted.table.rows[m]?.outputs[0]).toBe(0);
        }
      }
    }

    // 200 5-variable tests (mix of SOP and POS)
    const vars5 = ['A', 'B', 'C', 'D', 'E'];
    for (let i = 0; i < 200; i++) {
      const minterms: number[] = [];
      for (let m = 0; m < 32; m++) {
        if (prng() < 0.25) minterms.push(m);
      }

      const isPos = i % 2 === 1;
      const sol = isPos ? solvePOS(5, minterms, [], vars5) : solveSOP(5, minterms, [], vars5);
      expect(sol.ok).toBe(true);
      if (!sol.ok) continue;

      const res = generateCircuit({
        variables: vars5,
        outputs: [{ name: 'F', expr: sol.solution.expression }],
        style: isPos ? 'pos-or-and' : 'nor-only',
        maxFanIn: 4,
      });

      expect(res.ok).toBe(true);
      if (!res.ok) continue;

      const extracted = extractTruthTable(res.graph, { inputOrder: vars5, outputOrder: ['F'] });
      expect(extracted.ok).toBe(true);
      if (!extracted.ok) continue;

      for (let m = 0; m < 32; m++) {
        const expBit = minterms.includes(m) ? 1 : 0;
        expect(extracted.table.rows[m]?.outputs[0]).toBe(expBit);
      }
    }

    // 50 6-variable tests
    const vars6 = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (let i = 0; i < 50; i++) {
      const minterms: number[] = [];
      for (let m = 0; m < 64; m++) {
        if (prng() < 0.15) minterms.push(m);
      }

      if (minterms.length === 0) minterms.push(0);

      // Construct a direct SOP AST for the 6-variable function
      const productTerms: BoolNode[] = minterms.map((m) => {
        const lits: BoolNode[] = [];
        for (let b = 0; b < 6; b++) {
          const bitVal = (m >> (5 - b)) & 1;
          const varNode: BoolNode = { type: 'variable', name: vars6[b]! };
          lits.push(bitVal === 1 ? varNode : { type: 'not', child: varNode });
        }
        return { type: 'and', children: lits };
      });

      const exprNode: BoolNode = productTerms.length === 1
        ? productTerms[0]!
        : { type: 'or', children: productTerms };

      const res = generateCircuit({
        variables: vars6,
        outputs: [{ name: 'Y', expr: exprNode }],
        style: 'direct',
        maxFanIn: 4,
      });

      expect(res.ok).toBe(true);
      if (!res.ok) continue;

      const extracted = extractTruthTable(res.graph, { inputOrder: vars6, outputOrder: ['Y'] });
      expect(extracted.ok).toBe(true);
      if (!extracted.ok) continue;

      for (let m = 0; m < 64; m++) {
        const expBit = minterms.includes(m) ? 1 : 0;
        expect(extracted.table.rows[m]?.outputs[0]).toBe(expBit);
      }
    }
  });

  it('guarantees style purity and fan-in limits for universal NAND/NOR styles', () => {
    const expr: BoolNode = {
      type: 'or',
      children: [
        { type: 'and', children: [{ type: 'variable', name: 'A' }, { type: 'variable', name: 'B' }] },
        { type: 'and', children: [{ type: 'variable', name: 'C' }, { type: 'variable', name: 'D' }] },
      ],
    };

    for (const maxFanIn of [2, 3, 4]) {
      const nandRes = generateCircuit({
        variables: ['A', 'B', 'C', 'D'],
        outputs: [{ name: 'OutNand', expr }],
        style: 'nand-only',
        maxFanIn,
      });
      expect(nandRes.ok).toBe(true);
      if (nandRes.ok) {
        for (const n of nandRes.graph.nodes) {
          if (n.kind === 'gate') {
            expect(n.gateType).toBe('NAND');
            expect(n.inputCount).toBeLessThanOrEqual(maxFanIn);
          }
        }
      }

      const norRes = generateCircuit({
        variables: ['A', 'B', 'C', 'D'],
        outputs: [{ name: 'OutNor', expr }],
        style: 'nor-only',
        maxFanIn,
      });
      expect(norRes.ok).toBe(true);
      if (norRes.ok) {
        for (const n of norRes.graph.nodes) {
          if (n.kind === 'gate') {
            expect(n.gateType).toBe('NOR');
            expect(n.inputCount).toBeLessThanOrEqual(maxFanIn);
          }
        }
      }
    }
  });

  it('handles constant outputs F = 0 and F = 1 via const nodes', () => {
    const res0 = generateCircuit({
      variables: ['A'],
      outputs: [{ name: 'F', expr: { type: 'constant', value: 0 } }],
    });
    expect(res0.ok).toBe(true);
    if (res0.ok) {
      const c0 = res0.graph.nodes.find((n) => n.kind === 'const' && n.value === 0);
      expect(c0).toBeDefined();
      expect(res0.gateCount).toBe(0);
    }

    const res1 = generateCircuit({
      variables: ['A'],
      outputs: [{ name: 'F', expr: { type: 'constant', value: 1 } }],
    });
    expect(res1.ok).toBe(true);
    if (res1.ok) {
      const c1 = res1.graph.nodes.find((n) => n.kind === 'const' && n.value === 1);
      expect(c1).toBeDefined();
    }
  });

  it('handles bare literal outputs', () => {
    const res = generateCircuit({
      variables: ['A', 'B'],
      outputs: [
        { name: 'F1', expr: { type: 'variable', name: 'A' } },
        { name: 'F2', expr: { type: 'not', child: { type: 'variable', name: 'B' } } },
      ],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      const wireF1 = res.graph.wires.find((w) => w.to.nodeId === 'out_F1');
      expect(wireF1?.from.nodeId).toBe('in_A');
    }
  });

  it('shares common subexpressions across multiple outputs when enabled', () => {
    const commonTerm: BoolNode = {
      type: 'and',
      children: [{ type: 'variable', name: 'A' }, { type: 'variable', name: 'B' }],
    };

    const expr1: BoolNode = {
      type: 'or',
      children: [commonTerm, { type: 'variable', name: 'C' }],
    };

    const expr2: BoolNode = {
      type: 'or',
      children: [commonTerm, { type: 'variable', name: 'D' }],
    };

    const sharedRes = generateCircuit({
      variables: ['A', 'B', 'C', 'D'],
      outputs: [
        { name: 'Y1', expr: expr1 },
        { name: 'Y2', expr: expr2 },
      ],
      shareSubexpressions: true,
    });

    const unsharedRes = generateCircuit({
      variables: ['A', 'B', 'C', 'D'],
      outputs: [
        { name: 'Y1', expr: expr1 },
        { name: 'Y2', expr: expr2 },
      ],
      shareSubexpressions: false,
    });

    expect(sharedRes.ok).toBe(true);
    expect(unsharedRes.ok).toBe(true);
    if (sharedRes.ok && unsharedRes.ok) {
      expect(sharedRes.gateCount).toBeLessThan(unsharedRes.gateCount);
    }
  });

  it('generation is deterministic and JSON-serializable', () => {
    const expr: BoolNode = {
      type: 'xor',
      left: { type: 'variable', name: 'A' },
      right: { type: 'variable', name: 'B' },
    };

    const req = {
      variables: ['A', 'B'],
      outputs: [{ name: 'Sum', expr }],
    };

    const res1 = generateCircuit(req);
    const res2 = generateCircuit(req);

    expect(res1).toEqual(res2);
    if (res1.ok) {
      const json = JSON.stringify(res1.graph);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(res1.graph);
    }
  });
});
