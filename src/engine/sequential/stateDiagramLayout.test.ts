/**
 * @file stateDiagramLayout.test.ts
 * Unit tests for state diagram layout engine: determinism, finite numbers, bounds, reverse-edge offsets, and loops.
 */

import { describe, expect, it } from 'vitest';
import type { StateDiagramData } from '../../types/sequential';
import { layoutStateDiagram } from './stateDiagramLayout';

describe('stateDiagramLayout.ts', () => {
  const sampleDiagram: StateDiagramData = {
    machineKind: 'mealy',
    stateBits: 2,
    initialStateCode: 0,
    nodes: [
      { id: 's0', code: 0, name: 'S0', binaryCode: '00', isInitial: true },
      { id: 's1', code: 1, name: 'S1', binaryCode: '01', isInitial: false },
      { id: 's2', code: 2, name: 'S2', binaryCode: '10', isInitial: false },
    ],
    edges: [
      // Self loop on S0
      {
        id: 'e0',
        fromCode: 0,
        toCode: 0,
        label: '0/0',
        conditions: [{ inputValue: 0, mealyOutput: 0 }],
        isSelfLoop: true,
      },
      // Bidirectional pair between S0 and S1
      {
        id: 'e1',
        fromCode: 0,
        toCode: 1,
        label: '1/0',
        conditions: [{ inputValue: 1, mealyOutput: 0 }],
        isSelfLoop: false,
      },
      {
        id: 'e2',
        fromCode: 1,
        toCode: 0,
        label: '0/0',
        conditions: [{ inputValue: 0, mealyOutput: 0 }],
        isSelfLoop: false,
      },
      // Transition S1 -> S2
      {
        id: 'e3',
        fromCode: 1,
        toCode: 2,
        label: '1/1',
        conditions: [{ inputValue: 1, mealyOutput: 1 }],
        isSelfLoop: false,
      },
    ],
  };

  it('computes layout deterministically and ensures all numbers are finite', () => {
    const layout1 = layoutStateDiagram(sampleDiagram, { width: 500, height: 400 });
    const layout2 = layoutStateDiagram(sampleDiagram, { width: 500, height: 400 });

    expect(layout1).toEqual(layout2);

    // Verify finite coordinates
    for (const node of layout1.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.x).toBeGreaterThan(0);
      expect(node.x).toBeLessThan(500);
      expect(node.y).toBeGreaterThan(0);
      expect(node.y).toBeLessThan(400);
    }

    for (const edge of layout1.edges) {
      expect(Number.isFinite(edge.arrowhead.tipX)).toBe(true);
      expect(Number.isFinite(edge.arrowhead.tipY)).toBe(true);
      expect(Number.isFinite(edge.arrowhead.angleRad)).toBe(true);
      expect(Number.isFinite(edge.labelPosition.x)).toBe(true);
      expect(Number.isFinite(edge.labelPosition.y)).toBe(true);
      expect(edge.pathD.includes('NaN')).toBe(false);
    }
  });

  it('separates bidirectional edges with curved bezier paths', () => {
    const layout = layoutStateDiagram(sampleDiagram, { width: 500, height: 400 });
    const edge01 = layout.edges.find((e) => e.fromCode === 0 && e.toCode === 1);
    const edge10 = layout.edges.find((e) => e.fromCode === 1 && e.toCode === 0);

    expect(edge01).toBeDefined();
    expect(edge10).toBeDefined();

    // Both should use quadratic bezier 'Q' curves
    expect(edge01?.pathD.startsWith('M ')).toBe(true);
    expect(edge01?.pathD.includes(' Q ')).toBe(true);
    expect(edge10?.pathD.includes(' Q ')).toBe(true);

    // Label positions should be distinctly separated
    if (edge01 && edge10) {
      const dist = Math.hypot(
        edge01.labelPosition.x - edge10.labelPosition.x,
        edge01.labelPosition.y - edge10.labelPosition.y
      );
      expect(dist).toBeGreaterThan(15);
    }
  });

  it('handles single state machine with self-loop correctly', () => {
    const singleStateDiagram: StateDiagramData = {
      machineKind: 'counter',
      stateBits: 1,
      initialStateCode: 0,
      nodes: [
        { id: 's0', code: 0, name: 'S0', binaryCode: '0', isInitial: true },
      ],
      edges: [
        {
          id: 'loop-0',
          fromCode: 0,
          toCode: 0,
          label: '',
          conditions: [{ inputValue: 0 }],
          isSelfLoop: true,
        },
      ],
    };

    const layout = layoutStateDiagram(singleStateDiagram, { width: 300, height: 300 });
    expect(layout.nodes.length).toBe(1);
    expect(layout.nodes[0]?.x).toBe(150);
    expect(layout.nodes[0]?.y).toBe(150);
    expect(layout.edges.length).toBe(1);
    expect(layout.edges[0]?.isSelfLoop).toBe(true);
  });

  it('is completely JSON-serializable (round trip equal)', () => {
    const layout = layoutStateDiagram(sampleDiagram, { width: 600, height: 600 });
    const serialized = JSON.stringify(layout);
    const deserialized = JSON.parse(serialized);
    expect(deserialized).toEqual(layout);
  });
});
