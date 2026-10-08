/**
 * @file graph.test.ts
 * Comprehensive test suite for circuit graph model operations and topological analysis.
 *
 * Covers:
 * - Immutability and structural sharing preservation.
 * - Deterministic ID generation.
 * - Node addition, removal cascading, batch move, and property updates.
 * - Gate input count adjustments and wire trimming.
 * - Wire addition validations and error reasons.
 * - Indexing, fan-in/fan-out cone analysis, and structural signatures.
 * - Iterative Tarjan SCC on self-loops, 2-gate, 3-gate, disjoint loops, DAGs, and a 5,000-gate chain.
 */

import { describe, expect, it } from 'vitest';
import type { CircuitGraph, CircuitNode, GateNode, InputNode, OutputNode } from '../../types/circuit';
import {
  addNode,
  addWire,
  createEmptyCircuit,
  moveNodes,
  nextNodeId,
  nextWireId,
  removeNode,
  removeWire,
  setGateInputCount,
  updateNode,
} from './graph';
import {
  buildIndex,
  faninCone,
  fanoutCone,
  stronglyConnectedComponents,
  structuralSignature,
  topologicalLevels,
} from './graphAnalysis';

describe('graph and graphAnalysis (>= 25 tests)', () => {
  it('1. creates an empty circuit with empty arrays', () => {
    const g = createEmptyCircuit();
    expect(g.nodes).toEqual([]);
    expect(g.wires).toEqual([]);
  });

  it('2. generates deterministic node IDs per kind', () => {
    let g = createEmptyCircuit();
    expect(nextNodeId(g, 'input')).toBe('in1');
    expect(nextNodeId(g, 'output')).toBe('out1');
    expect(nextNodeId(g, 'clock')).toBe('clk1');
    expect(nextNodeId(g, 'const')).toBe('const1');
    expect(nextNodeId(g, 'gate')).toBe('g1');

    g = addNode(g, { kind: 'gate', id: 'g1', x: 0, y: 0, gateType: 'AND', inputCount: 2 });
    g = addNode(g, { kind: 'gate', id: 'g5', x: 0, y: 0, gateType: 'OR', inputCount: 2 });
    expect(nextNodeId(g, 'gate')).toBe('g6');
  });

  it('3. generates deterministic wire IDs', () => {
    let g = createEmptyCircuit();
    expect(nextWireId(g)).toBe('w1');
    g = {
      ...g,
      wires: [
        { id: 'w1', from: { nodeId: 'in1', pin: 0 }, to: { nodeId: 'g1', pin: 0 } },
        { id: 'w9', from: { nodeId: 'in2', pin: 0 }, to: { nodeId: 'g1', pin: 1 } },
      ],
    };
    expect(nextWireId(g)).toBe('w10');
  });

  it('4. addNode preserves frozen graph immutability', () => {
    const g = Object.freeze(createEmptyCircuit());
    const n1: InputNode = { kind: 'input', id: 'in1', x: 10, y: 20, label: 'A', value: 0 };
    const g2 = addNode(g, n1);

    expect(g2.nodes).toHaveLength(1);
    expect(g2.nodes[0]).toBe(n1);
    expect(g.nodes).toHaveLength(0);
  });

  it('5. addNode ignores duplicate node IDs', () => {
    let g = createEmptyCircuit();
    const n1: InputNode = { kind: 'input', id: 'in1', x: 10, y: 20, label: 'A', value: 0 };
    g = addNode(g, n1);
    const g2 = addNode(g, { kind: 'input', id: 'in1', x: 50, y: 50, label: 'A2', value: 1 });
    expect(g2).toBe(g);
  });

  it('6. removeNode cascades removal to attached wires', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { kind: 'input', id: 'in1', x: 0, y: 0, label: 'A', value: 1 });
    g = addNode(g, { kind: 'gate', id: 'g1', x: 100, y: 0, gateType: 'AND', inputCount: 2 });
    g = addNode(g, { kind: 'output', id: 'out1', x: 200, y: 0, label: 'Y' });

    const w1 = addWire(g, { from: { nodeId: 'in1', pin: 0 }, to: { nodeId: 'g1', pin: 0 } });
    if (!w1.ok) throw new Error('addWire failed');
    g = w1.graph;

    const w2 = addWire(g, { from: { nodeId: 'g1', pin: 0 }, to: { nodeId: 'out1', pin: 0 } });
    if (!w2.ok) throw new Error('addWire failed');
    g = w2.graph;

    expect(g.wires).toHaveLength(2);

    // Remove middle gate g1
    const gRemoved = removeNode(g, 'g1');
    expect(gRemoved.nodes.map((n) => n.id)).toEqual(['in1', 'out1']);
    expect(gRemoved.wires).toHaveLength(0); // both wires cascaded away
  });

  it('7. moveNodes preserves reference identity for untouched nodes', () => {
    let g = createEmptyCircuit();
    const n1: InputNode = { kind: 'input', id: 'in1', x: 0, y: 0, label: 'A', value: 0 };
    const n2: OutputNode = { kind: 'output', id: 'out1', x: 100, y: 100, label: 'Y' };
    g = addNode(addNode(g, n1), n2);

    const gMoved = moveNodes(g, [{ id: 'in1', x: 50, y: 60 }]);
    expect(gMoved.nodes[0]).toEqual({ ...n1, x: 50, y: 60 });
    expect(gMoved.nodes[1]).toBe(n2); // Structural sharing
  });

  it('8. updateNode updates node properties with structural sharing', () => {
    let g = createEmptyCircuit();
    const gNode: GateNode = { kind: 'gate', id: 'g1', x: 0, y: 0, gateType: 'AND', inputCount: 2 };
    g = addNode(g, gNode);

    const gUpdated = updateNode(g, 'g1', { label: 'U1', delay: 3, gateType: 'NAND' });
    const target = gUpdated.nodes[0] as GateNode;
    expect(target.label).toBe('U1');
    expect(target.delay).toBe(3);
    expect(target.gateType).toBe('NAND');
  });

  it('9. setGateInputCount drops wires connecting to removed pins', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { kind: 'input', id: 'in1', x: 0, y: 0, label: 'A', value: 0 });
    g = addNode(g, { kind: 'input', id: 'in2', x: 0, y: 20, label: 'B', value: 0 });
    g = addNode(g, { kind: 'input', id: 'in3', x: 0, y: 40, label: 'C', value: 0 });
    g = addNode(g, { kind: 'gate', id: 'g1', x: 100, y: 0, gateType: 'AND', inputCount: 3 });

    const w1 = addWire(g, { from: { nodeId: 'in1', pin: 0 }, to: { nodeId: 'g1', pin: 0 } });
    const w2 = addWire(w1.ok ? w1.graph : g, { from: { nodeId: 'in2', pin: 0 }, to: { nodeId: 'g1', pin: 1 } });
    const w3 = addWire(w2.ok ? w2.graph : g, { from: { nodeId: 'in3', pin: 0 }, to: { nodeId: 'g1', pin: 2 } });
    g = w3.ok ? w3.graph : g;

    expect(g.wires).toHaveLength(3);

    // Reduce inputs to 2 -> pin 2 wire dropped
    const res = setGateInputCount(g, 'g1', 2);
    expect(res.removedWireIds).toHaveLength(1);
    expect(res.graph.wires).toHaveLength(2);
    expect((res.graph.nodes.find((n) => n.id === 'g1') as GateNode).inputCount).toBe(2);
  });

  it('10. setGateInputCount keeps NOT gate at arity 1', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { kind: 'gate', id: 'g1', x: 0, y: 0, gateType: 'NOT', inputCount: 1 });
    const res = setGateInputCount(g, 'g1', 4);
    expect((res.graph.nodes[0] as GateNode).inputCount).toBe(1);
  });

  it('11. addWire rejects missing source or target node', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { kind: 'input', id: 'in1', x: 0, y: 0, label: 'A', value: 0 });

    const res = addWire(g, { from: { nodeId: 'in1', pin: 0 }, to: { nodeId: 'missing', pin: 0 } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('missing-node');
  });

  it('12. addWire rejects wrong-direction connections', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { kind: 'output', id: 'out1', x: 0, y: 0, label: 'Y' });
    g = addNode(g, { kind: 'input', id: 'in1', x: 100, y: 0, label: 'A', value: 0 });

    // Output node as source
    const res1 = addWire(g, { from: { nodeId: 'out1', pin: 0 }, to: { nodeId: 'in1', pin: 0 } });
    expect(res1.ok).toBe(false);
    if (!res1.ok) expect(res1.reason).toBe('wrong-direction');
  });

  it('13. addWire rejects bad target pin index', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { kind: 'input', id: 'in1', x: 0, y: 0, label: 'A', value: 0 });
    g = addNode(g, { kind: 'gate', id: 'g1', x: 100, y: 0, gateType: 'AND', inputCount: 2 });

    const res = addWire(g, { from: { nodeId: 'in1', pin: 0 }, to: { nodeId: 'g1', pin: 5 } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('bad-pin');
  });

  it('14. addWire rejects duplicate wires', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { kind: 'input', id: 'in1', x: 0, y: 0, label: 'A', value: 0 });
    g = addNode(g, { kind: 'gate', id: 'g1', x: 100, y: 0, gateType: 'AND', inputCount: 2 });

    const res1 = addWire(g, { from: { nodeId: 'in1', pin: 0 }, to: { nodeId: 'g1', pin: 0 } });
    expect(res1.ok).toBe(true);
    if (!res1.ok) return;

    const res2 = addWire(res1.graph, { from: { nodeId: 'in1', pin: 0 }, to: { nodeId: 'g1', pin: 0 } });
    expect(res2.ok).toBe(false);
    if (!res2.ok) expect(res2.reason).toBe('duplicate-wire');
  });

  it('15. addWire accepts feedback and multiple drivers (validation flags them)', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { kind: 'gate', id: 'g1', x: 0, y: 0, gateType: 'NOT', inputCount: 1 });

    // Gate output to its own input (self loop)
    const res = addWire(g, { from: { nodeId: 'g1', pin: 0 }, to: { nodeId: 'g1', pin: 0 } });
    expect(res.ok).toBe(true);
  });

  it('16. removeWire removes designated wire immutably', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { kind: 'input', id: 'in1', x: 0, y: 0, label: 'A', value: 0 });
    g = addNode(g, { kind: 'output', id: 'out1', x: 100, y: 0, label: 'Y' });

    const res = addWire(g, { id: 'w1', from: { nodeId: 'in1', pin: 0 }, to: { nodeId: 'out1', pin: 0 } });
    if (!res.ok) throw new Error('addWire failed');

    const g2 = removeWire(res.graph, 'w1');
    expect(g2.wires).toHaveLength(0);
  });

  it('17. structuralSignature ignores (x, y) movements and detects structural edits', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { kind: 'input', id: 'in1', x: 10, y: 20, label: 'A', value: 0 });
    g = addNode(g, { kind: 'output', id: 'out1', x: 50, y: 60, label: 'Y' });
    const sig1 = structuralSignature(g);

    const gMoved = moveNodes(g, [{ id: 'in1', x: 999, y: 888 }]);
    const sig2 = structuralSignature(gMoved);
    expect(sig1).toBe(sig2);

    const gEdited = updateNode(g, 'in1', { label: 'B' });
    const sig3 = structuralSignature(gEdited);
    expect(sig1).not.toBe(sig3);
  });

  it('18. JSON serialization round-trip', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { kind: 'input', id: 'in1', x: 0, y: 0, label: 'A', value: 1 });
    g = addNode(g, { kind: 'gate', id: 'g1', x: 100, y: 0, gateType: 'AND', inputCount: 2, delay: 2 });
    g = addNode(g, { kind: 'output', id: 'out1', x: 200, y: 0, label: 'Y' });
    const res = addWire(g, { from: { nodeId: 'in1', pin: 0 }, to: { nodeId: 'g1', pin: 0 } });
    if (res.ok) g = res.graph;

    const str = JSON.stringify(g);
    const parsed = JSON.parse(str) as CircuitGraph;
    expect(parsed).toEqual(g);
  });

  it('19. stronglyConnectedComponents identifies self-loops', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { kind: 'gate', id: 'g1', x: 0, y: 0, gateType: 'NOT', inputCount: 1 });
    const w = addWire(g, { from: { nodeId: 'g1', pin: 0 }, to: { nodeId: 'g1', pin: 0 } });
    if (w.ok) g = w.graph;

    const sccs = stronglyConnectedComponents(buildIndex(g));
    expect(sccs).toHaveLength(1);
    expect(sccs[0]).toEqual(['g1']);
  });

  it('20. stronglyConnectedComponents identifies 2-gate cross-coupled loops (SR Latch)', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { kind: 'gate', id: 'nor1', x: 0, y: 0, gateType: 'NOR', inputCount: 2 });
    g = addNode(g, { kind: 'gate', id: 'nor2', x: 100, y: 0, gateType: 'NOR', inputCount: 2 });
    const w1 = addWire(g, { from: { nodeId: 'nor1', pin: 0 }, to: { nodeId: 'nor2', pin: 1 } });
    const w2 = addWire(w1.ok ? w1.graph : g, { from: { nodeId: 'nor2', pin: 0 }, to: { nodeId: 'nor1', pin: 1 } });
    g = w2.ok ? w2.graph : g;

    const sccs = stronglyConnectedComponents(buildIndex(g));
    expect(sccs).toHaveLength(1);
    expect(sccs[0]?.slice().sort()).toEqual(['nor1', 'nor2']);
  });

  it('21. stronglyConnectedComponents identifies 3-gate ring oscillator', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { kind: 'gate', id: 'g1', x: 0, y: 0, gateType: 'NOT', inputCount: 1 });
    g = addNode(g, { kind: 'gate', id: 'g2', x: 100, y: 0, gateType: 'NOT', inputCount: 1 });
    g = addNode(g, { kind: 'gate', id: 'g3', x: 200, y: 0, gateType: 'NOT', inputCount: 1 });

    const w1 = addWire(g, { from: { nodeId: 'g1', pin: 0 }, to: { nodeId: 'g2', pin: 0 } });
    const w2 = addWire(w1.ok ? w1.graph : g, { from: { nodeId: 'g2', pin: 0 }, to: { nodeId: 'g3', pin: 0 } });
    const w3 = addWire(w2.ok ? w2.graph : g, { from: { nodeId: 'g3', pin: 0 }, to: { nodeId: 'g1', pin: 0 } });
    g = w3.ok ? w3.graph : g;

    const sccs = stronglyConnectedComponents(buildIndex(g));
    expect(sccs).toHaveLength(1);
    expect(sccs[0]?.slice().sort()).toEqual(['g1', 'g2', 'g3']);
  });

  it('22. stronglyConnectedComponents identifies multiple disjoint loops', () => {
    let g = createEmptyCircuit();
    // Loop 1
    g = addNode(g, { kind: 'gate', id: 'a1', x: 0, y: 0, gateType: 'NOT', inputCount: 1 });
    g = addNode(g, { kind: 'gate', id: 'a2', x: 0, y: 50, gateType: 'NOT', inputCount: 1 });
    const wa1 = addWire(g, { from: { nodeId: 'a1', pin: 0 }, to: { nodeId: 'a2', pin: 0 } });
    const wa2 = addWire(wa1.ok ? wa1.graph : g, { from: { nodeId: 'a2', pin: 0 }, to: { nodeId: 'a1', pin: 0 } });
    g = wa2.ok ? wa2.graph : g;

    // Loop 2
    g = addNode(g, { kind: 'gate', id: 'b1', x: 100, y: 0, gateType: 'NOT', inputCount: 1 });
    g = addNode(g, { kind: 'gate', id: 'b2', x: 100, y: 50, gateType: 'NOT', inputCount: 1 });
    const wb1 = addWire(g, { from: { nodeId: 'b1', pin: 0 }, to: { nodeId: 'b2', pin: 0 } });
    const wb2 = addWire(wb1.ok ? wb1.graph : g, { from: { nodeId: 'b2', pin: 0 }, to: { nodeId: 'b1', pin: 0 } });
    g = wb2.ok ? wb2.graph : g;

    const sccs = stronglyConnectedComponents(buildIndex(g));
    expect(sccs).toHaveLength(2);
  });

  it('23. stronglyConnectedComponents returns empty on acyclic DAG', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { kind: 'input', id: 'in1', x: 0, y: 0, label: 'A', value: 0 });
    g = addNode(g, { kind: 'gate', id: 'g1', x: 50, y: 0, gateType: 'NOT', inputCount: 1 });
    g = addNode(g, { kind: 'output', id: 'out1', x: 100, y: 0, label: 'Y' });
    const w1 = addWire(g, { from: { nodeId: 'in1', pin: 0 }, to: { nodeId: 'g1', pin: 0 } });
    const w2 = addWire(w1.ok ? w1.graph : g, { from: { nodeId: 'g1', pin: 0 }, to: { nodeId: 'out1', pin: 0 } });
    g = w2.ok ? w2.graph : g;

    const sccs = stronglyConnectedComponents(buildIndex(g));
    expect(sccs).toHaveLength(0);
  });

  it('24. Tarjan survives a deep 5,000-gate chain without stack overflow', () => {
    const nodeCount = 5000;
    const nodes: CircuitNode[] = [
      { kind: 'input', id: 'in0', x: 0, y: 0, label: 'IN', value: 0 },
    ];
    const wires = [];

    for (let i = 1; i <= nodeCount; i++) {
      nodes.push({
        kind: 'gate',
        id: `g${i}`,
        x: i * 10,
        y: 0,
        gateType: 'NOT',
        inputCount: 1,
      });
      const prevId = i === 1 ? 'in0' : `g${i - 1}`;
      wires.push({
        id: `w${i}`,
        from: { nodeId: prevId, pin: 0 },
        to: { nodeId: `g${i}`, pin: 0 },
      });
    }

    const g: CircuitGraph = { nodes, wires };
    const index = buildIndex(g);
    const sccs = stronglyConnectedComponents(index);
    expect(sccs).toHaveLength(0); // Chain is acyclic
  });

  it('25. topologicalLevels computes depths and detects feedback', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { kind: 'input', id: 'in1', x: 0, y: 0, label: 'A', value: 0 });
    g = addNode(g, { kind: 'gate', id: 'g1', x: 100, y: 0, gateType: 'NOT', inputCount: 1 });
    g = addNode(g, { kind: 'gate', id: 'g2', x: 200, y: 0, gateType: 'NOT', inputCount: 1 });
    g = addNode(g, { kind: 'output', id: 'out1', x: 300, y: 0, label: 'Y' });

    const w1 = addWire(g, { from: { nodeId: 'in1', pin: 0 }, to: { nodeId: 'g1', pin: 0 } });
    const w2 = addWire(w1.ok ? w1.graph : g, { from: { nodeId: 'g1', pin: 0 }, to: { nodeId: 'g2', pin: 0 } });
    const w3 = addWire(w2.ok ? w2.graph : g, { from: { nodeId: 'g2', pin: 0 }, to: { nodeId: 'out1', pin: 0 } });
    g = w3.ok ? w3.graph : g;

    const res = topologicalLevels(g);
    expect(res.hasFeedback).toBe(false);
    expect(res.levels.get('in1')).toBe(0);
    expect(res.levels.get('g1')).toBe(1);
    expect(res.levels.get('g2')).toBe(2);
    expect(res.levels.get('out1')).toBe(3);
    expect(res.maxLevel).toBe(3);
  });

  it('26. fanoutCone and faninCone compute transitive reachability', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { kind: 'input', id: 'in1', x: 0, y: 0, label: 'A', value: 0 });
    g = addNode(g, { kind: 'gate', id: 'g1', x: 100, y: 0, gateType: 'AND', inputCount: 2 });
    g = addNode(g, { kind: 'gate', id: 'g2', x: 200, y: 0, gateType: 'OR', inputCount: 2 });
    g = addNode(g, { kind: 'output', id: 'out1', x: 300, y: 0, label: 'Y' });

    const w1 = addWire(g, { from: { nodeId: 'in1', pin: 0 }, to: { nodeId: 'g1', pin: 0 } });
    const w2 = addWire(w1.ok ? w1.graph : g, { from: { nodeId: 'g1', pin: 0 }, to: { nodeId: 'g2', pin: 0 } });
    const w3 = addWire(w2.ok ? w2.graph : g, { from: { nodeId: 'g2', pin: 0 }, to: { nodeId: 'out1', pin: 0 } });
    g = w3.ok ? w3.graph : g;

    const fo = fanoutCone(g, ['in1']);
    expect([...fo].sort()).toEqual(['g1', 'g2', 'in1', 'out1'].sort());

    const fi = faninCone(g, ['out1']);
    expect([...fi].sort()).toEqual(['g1', 'g2', 'in1', 'out1'].sort());
  });
});
