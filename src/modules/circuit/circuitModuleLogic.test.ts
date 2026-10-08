/**
 * @file circuitModuleLogic.test.ts
 * Unit tests for circuit module business logic and project store helpers.
 */

import { describe, it, expect } from 'vitest';
import type { BoolNode } from '../../types/ast';
import { createEmptyCircuit } from '../../engine/circuit';
import { createEmptyDesignProject } from '../../types/designProject';
import {
  createCircuitStorePatch,
  getAvailableExpressionFromProject,
  getAvailableStylesForExpression,
  synthesizeAndLayoutCircuit,
} from './circuitModuleLogic';

describe('circuitModuleLogic', () => {
  it('creates clean store patch updating only circuit', () => {
    const circuit = createEmptyCircuit();
    const patch = createCircuitStorePatch(circuit);
    expect(patch).toEqual({ circuit });
    expect(Object.keys(patch)).toEqual(['circuit']);
  });

  it('retrieves minimized expression prioritizing SOP over raw expression', () => {
    const project = createEmptyDesignProject('p1', 'Test Project');
    const rawExpr: BoolNode = { type: 'variable', name: 'A' };
    const sopAst: BoolNode = {
      type: 'and',
      children: [{ type: 'variable', name: 'A' }, { type: 'variable', name: 'B' }],
    };

    project.expression = rawExpr;
    let available = getAvailableExpressionFromProject(project);
    expect(available?.expression).toBe(rawExpr);
    expect(available?.isPos).toBe(false);

    project.minimizedExpression = {
      sop: { ast: sopAst, text: 'A B' },
      pos: null,
    };

    available = getAvailableExpressionFromProject(project);
    expect(available?.expression).toBe(sopAst);
    expect(available?.label).toBe('A B');
    expect(available?.isPos).toBe(false);
  });

  it('returns valid generator styles for SOP and POS', () => {
    const sopStyles = getAvailableStylesForExpression(false);
    expect(sopStyles.map((s) => s.style)).toEqual(['sop-and-or', 'nand-only', 'direct']);
    expect(sopStyles[0]?.isRecommended).toBe(true);

    const posStyles = getAvailableStylesForExpression(true);
    expect(posStyles.map((s) => s.style)).toEqual(['pos-or-and', 'nor-only', 'direct']);
    expect(posStyles[0]?.isRecommended).toBe(true);
  });

  it('synthesizes and auto-lays out a circuit schematic', () => {
    const expr: BoolNode = {
      type: 'or',
      children: [
        {
          type: 'and',
          children: [{ type: 'variable', name: 'A' }, { type: 'variable', name: 'B' }],
        },
        {
          type: 'and',
          children: [{ type: 'variable', name: 'C' }, { type: 'variable', name: 'D' }],
        },
      ],
    };

    const result = synthesizeAndLayoutCircuit(expr, ['A', 'B', 'C', 'D'], 'sop-and-or', 'F');
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.graph.nodes.length).toBeGreaterThan(0);
    expect(result.graph.wires.length).toBeGreaterThan(0);
    expect(result.appliedStyle).toBe('sop-and-or');

    const inputs = result.graph.nodes.filter((n) => n.kind === 'input');
    expect(inputs.map((n) => n.label)).toEqual(['A', 'B', 'C', 'D']);
  });
});
