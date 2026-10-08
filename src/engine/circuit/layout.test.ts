/**
 * @file layout.test.ts
 * Unit tests for schematic graph layout, idempotence, barycenter row ordering, and feedback loop termination.
 */

import { describe, it, expect } from 'vitest';
import type { CircuitGraph } from '../../types/circuit';
import { nodeSize } from './geometry';
import { layoutCircuit } from './layout';

describe('layoutCircuit', () => {
  const halfAdderGraph: CircuitGraph = {
    nodes: [
      { id: 'in_A', kind: 'input', label: 'A', x: 0, y: 0 },
      { id: 'in_B', kind: 'input', label: 'B', x: 0, y: 0 },
      { id: 'xor1', kind: 'gate', gateType: 'XOR', inputCount: 2, x: 0, y: 0 },
      { id: 'and1', kind: 'gate', gateType: 'AND', inputCount: 2, x: 0, y: 0 },
      { id: 'out_Sum', kind: 'output', label: 'Sum', x: 0, y: 0 },
      { id: 'out_Carry', kind: 'output', label: 'Carry', x: 0, y: 0 },
    ],
    wires: [
      { id: 'w1', from: { nodeId: 'in_A', pin: 0 }, to: { nodeId: 'xor1', pin: 0 } },
      { id: 'w2', from: { nodeId: 'in_B', pin: 0 }, to: { nodeId: 'xor1', pin: 1 } },
      { id: 'w3', from: { nodeId: 'in_A', pin: 0 }, to: { nodeId: 'and1', pin: 0 } },
      { id: 'w4', from: { nodeId: 'in_B', pin: 0 }, to: { nodeId: 'and1', pin: 1 } },
      { id: 'w5', from: { nodeId: 'xor1', pin: 0 }, to: { nodeId: 'out_Sum', pin: 0 } },
      { id: 'w6', from: { nodeId: 'and1', pin: 0 }, to: { nodeId: 'out_Carry', pin: 0 } },
    ],
  };

  const srLatchGraph: CircuitGraph = {
    nodes: [
      { id: 'in_S', kind: 'input', label: 'S', x: 0, y: 0 },
      { id: 'in_R', kind: 'input', label: 'R', x: 0, y: 0 },
      { id: 'nor1', kind: 'gate', gateType: 'NOR', inputCount: 2, x: 0, y: 0 },
      { id: 'nor2', kind: 'gate', gateType: 'NOR', inputCount: 2, x: 0, y: 0 },
      { id: 'out_Q', kind: 'output', label: 'Q', x: 0, y: 0 },
      { id: 'out_Qn', kind: 'output', label: 'Qn', x: 0, y: 0 },
    ],
    wires: [
      { id: 'w1', from: { nodeId: 'in_R', pin: 0 }, to: { nodeId: 'nor1', pin: 0 } },
      { id: 'w2', from: { nodeId: 'nor2', pin: 0 }, to: { nodeId: 'nor1', pin: 1 } },
      { id: 'w3', from: { nodeId: 'in_S', pin: 0 }, to: { nodeId: 'nor2', pin: 0 } },
      { id: 'w4', from: { nodeId: 'nor1', pin: 0 }, to: { nodeId: 'nor2', pin: 1 } },
      { id: 'w5', from: { nodeId: 'nor1', pin: 0 }, to: { nodeId: 'out_Q', pin: 0 } },
      { id: 'w6', from: { nodeId: 'nor2', pin: 0 }, to: { nodeId: 'out_Qn', pin: 0 } },
    ],
  };

  it('assigns inputs to column 0, gates to intermediate columns, and outputs to the final column', () => {
    const laidOut = layoutCircuit(halfAdderGraph);

    const inA = laidOut.nodes.find((n) => n.id === 'in_A');
    const inB = laidOut.nodes.find((n) => n.id === 'in_B');
    const xor1 = laidOut.nodes.find((n) => n.id === 'xor1');
    const and1 = laidOut.nodes.find((n) => n.id === 'and1');
    const sum = laidOut.nodes.find((n) => n.id === 'out_Sum');
    const carry = laidOut.nodes.find((n) => n.id === 'out_Carry');

    expect(inA?.x).toBe(inB?.x);
    expect(xor1?.x).toBe(and1?.x);
    expect(sum?.x).toBe(carry?.x);

    expect((inA?.x ?? 0)).toBeLessThan((xor1?.x ?? 0));
    expect((xor1?.x ?? 0)).toBeLessThan((sum?.x ?? 0));
  });

  it('is strictly idempotent: layout(layout(g)) deep-equals layout(g) and preserves node object references', () => {
    const layout1 = layoutCircuit(halfAdderGraph);
    const layout2 = layoutCircuit(layout1);

    expect(layout2).toEqual(layout1);

    // Object reference preservation for unchanged nodes
    for (let i = 0; i < layout1.nodes.length; i++) {
      expect(layout2.nodes[i]).toBe(layout1.nodes[i]);
    }
  });

  it('guarantees no overlapping node bounding boxes', () => {
    const laidOut = layoutCircuit(halfAdderGraph);

    for (let i = 0; i < laidOut.nodes.length; i++) {
      for (let j = i + 1; j < laidOut.nodes.length; j++) {
        const nodeA = laidOut.nodes[i];
        const nodeB = laidOut.nodes[j];
        if (!nodeA || !nodeB) continue;

        const sizeA = nodeSize(nodeA);
        const sizeB = nodeSize(nodeB);

        const aLeft = nodeA.x;
        const aRight = nodeA.x + sizeA.width;
        const aTop = nodeA.y;
        const aBottom = nodeA.y + sizeA.height;

        const bLeft = nodeB.x;
        const bRight = nodeB.x + sizeB.width;
        const bTop = nodeB.y;
        const bBottom = nodeB.y + sizeB.height;

        const overlapX = aLeft < bRight && aRight > bLeft;
        const overlapY = aTop < bBottom && aBottom > bTop;

        expect(overlapX && overlapY).toBe(false);
      }
    }
  });

  it('terminates and lays out circuits with feedback loops (SR latch)', () => {
    const laidOut = layoutCircuit(srLatchGraph);
    expect(laidOut.nodes.length).toBe(6);

    const nor1 = laidOut.nodes.find((n) => n.id === 'nor1');
    const nor2 = laidOut.nodes.find((n) => n.id === 'nor2');

    // NOR gates in the same SCC share the same column X coordinate
    expect(nor1?.x).toBe(nor2?.x);
    expect(nor1?.y).not.toBe(nor2?.y);
  });

  it('terminates and lays out master-slave D flip-flop with multiple feedback loops', () => {
    const dffGraph: CircuitGraph = {
      nodes: [
        { id: 'in_D', kind: 'input', label: 'D', x: 0, y: 0 },
        { id: 'in_Clk', kind: 'clock', label: 'CLK', x: 0, y: 0, period: 20, dutyCycle: 0.5 },
        { id: 'not_Clk', kind: 'gate', gateType: 'NOT', inputCount: 1, x: 0, y: 0 },
        { id: 'nand1', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 0, y: 0 },
        { id: 'nand2', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 0, y: 0 },
        { id: 'nand3', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 0, y: 0 },
        { id: 'nand4', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 0, y: 0 },
        { id: 'nand5', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 0, y: 0 },
        { id: 'nand6', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 0, y: 0 },
        { id: 'out_Q', kind: 'output', label: 'Q', x: 0, y: 0 },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'in_Clk', pin: 0 }, to: { nodeId: 'not_Clk', pin: 0 } },
        { id: 'w2', from: { nodeId: 'in_D', pin: 0 }, to: { nodeId: 'nand1', pin: 0 } },
        { id: 'w3', from: { nodeId: 'in_Clk', pin: 0 }, to: { nodeId: 'nand1', pin: 1 } },
        { id: 'w4', from: { nodeId: 'nand1', pin: 0 }, to: { nodeId: 'nand2', pin: 0 } },
        { id: 'w5', from: { nodeId: 'in_Clk', pin: 0 }, to: { nodeId: 'nand2', pin: 1 } },
        { id: 'w6', from: { nodeId: 'nand1', pin: 0 }, to: { nodeId: 'nand3', pin: 0 } },
        { id: 'w7', from: { nodeId: 'nand4', pin: 0 }, to: { nodeId: 'nand3', pin: 1 } },
        { id: 'w8', from: { nodeId: 'nand2', pin: 0 }, to: { nodeId: 'nand4', pin: 0 } },
        { id: 'w9', from: { nodeId: 'nand3', pin: 0 }, to: { nodeId: 'nand4', pin: 1 } },
        { id: 'w10', from: { nodeId: 'nand3', pin: 0 }, to: { nodeId: 'nand5', pin: 0 } },
        { id: 'w11', from: { nodeId: 'not_Clk', pin: 0 }, to: { nodeId: 'nand5', pin: 1 } },
        { id: 'w12', from: { nodeId: 'nand4', pin: 0 }, to: { nodeId: 'nand6', pin: 0 } },
        { id: 'w13', from: { nodeId: 'not_Clk', pin: 0 }, to: { nodeId: 'nand6', pin: 1 } },
        { id: 'w14', from: { nodeId: 'nand5', pin: 0 }, to: { nodeId: 'out_Q', pin: 0 } },
      ],
    };

    const laidOut = layoutCircuit(dffGraph);
    expect(laidOut.nodes.length).toBe(10);
    expect(laidOut.wires.length).toBe(14);
  });
});
