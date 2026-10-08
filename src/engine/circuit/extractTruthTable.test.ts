/**
 * @file extractTruthTable.test.ts
 * Test suite for combinational circuit truth table extraction.
 */

import { describe, expect, it } from 'vitest';
import type { LogicValue } from '../../types/ast';
import type { CircuitGraph, CircuitNode, CircuitWire, GateType } from '../../types/circuit';
import { createPrng, prngChoice, prngInt } from '../common/seededRandom';
import { halfAdder, srLatchNor, xorFromNands } from './examples';
import { extractTruthTable } from './extractTruthTable';
import { addNode, addWire, createEmptyCircuit } from './graph';
import { createSimulator } from './simulator';

/**
 * Builds a 3-input majority logic circuit: M(A, B, C) = AB + BC + AC
 */
function build3InputMajority(): CircuitGraph {
  let g = createEmptyCircuit();
  g = addNode(g, { id: 'in_a', kind: 'input', label: 'A', value: 0, x: 50, y: 50 });
  g = addNode(g, { id: 'in_b', kind: 'input', label: 'B', value: 0, x: 50, y: 150 });
  g = addNode(g, { id: 'in_c', kind: 'input', label: 'C', value: 0, x: 50, y: 250 });

  g = addNode(g, { id: 'g_ab', kind: 'gate', gateType: 'AND', inputCount: 2, x: 200, y: 70 });
  g = addNode(g, { id: 'g_bc', kind: 'gate', gateType: 'AND', inputCount: 2, x: 200, y: 170 });
  g = addNode(g, { id: 'g_ac', kind: 'gate', gateType: 'AND', inputCount: 2, x: 200, y: 270 });

  g = addNode(g, { id: 'g_or1', kind: 'gate', gateType: 'OR', inputCount: 2, x: 350, y: 120 });
  g = addNode(g, { id: 'g_or2', kind: 'gate', gateType: 'OR', inputCount: 2, x: 480, y: 170 });

  g = addNode(g, { id: 'out_m', kind: 'output', label: 'M', x: 600, y: 170 });

  const wires = [
    { from: { nodeId: 'in_a', pin: 0 }, to: { nodeId: 'g_ab', pin: 0 } },
    { from: { nodeId: 'in_b', pin: 0 }, to: { nodeId: 'g_ab', pin: 1 } },
    { from: { nodeId: 'in_b', pin: 0 }, to: { nodeId: 'g_bc', pin: 0 } },
    { from: { nodeId: 'in_c', pin: 0 }, to: { nodeId: 'g_bc', pin: 1 } },
    { from: { nodeId: 'in_a', pin: 0 }, to: { nodeId: 'g_ac', pin: 0 } },
    { from: { nodeId: 'in_c', pin: 0 }, to: { nodeId: 'g_ac', pin: 1 } },
    { from: { nodeId: 'g_ab', pin: 0 }, to: { nodeId: 'g_or1', pin: 0 } },
    { from: { nodeId: 'g_bc', pin: 0 }, to: { nodeId: 'g_or1', pin: 1 } },
    { from: { nodeId: 'g_or1', pin: 0 }, to: { nodeId: 'g_or2', pin: 0 } },
    { from: { nodeId: 'g_ac', pin: 0 }, to: { nodeId: 'g_or2', pin: 1 } },
    { from: { nodeId: 'g_or2', pin: 0 }, to: { nodeId: 'out_m', pin: 0 } },
  ];

  for (const w of wires) {
    const res = addWire(g, w);
    if (res.ok) g = res.graph;
  }
  return g;
}

describe('extractTruthTable', () => {
  it('1. correctly extracts Half Adder and 4-NAND XOR truth tables', () => {
    const haRes = extractTruthTable(halfAdder(), { outputOrder: ['S', 'Cout'] });
    expect(haRes.ok).toBe(true);
    if (!haRes.ok) return;

    expect(haRes.table.inputs).toEqual(['A', 'B']);
    expect(haRes.table.outputs).toEqual(['S', 'Cout']);
    expect(haRes.table.rows).toEqual([
      { index: 0, inputs: [0, 0], outputs: [0, 0] },
      { index: 1, inputs: [0, 1], outputs: [1, 0] },
      { index: 2, inputs: [1, 0], outputs: [1, 0] },
      { index: 3, inputs: [1, 1], outputs: [0, 1] },
    ]);

    const xorRes = extractTruthTable(xorFromNands());
    expect(xorRes.ok).toBe(true);
    if (!xorRes.ok) return;

    expect(xorRes.table.inputs).toEqual(['A', 'B']);
    expect(xorRes.table.rows.map((r) => r.outputs[0])).toEqual([0, 1, 1, 0]);
  });

  it('2. correctly extracts 3-input majority logic function', () => {
    const maj = build3InputMajority();
    const res = extractTruthTable(maj);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.table.inputs).toEqual(['A', 'B', 'C']);
    // Min terms with >= 2 ones: 3 (011), 5 (101), 6 (110), 7 (111)
    const expectedOutputs: LogicValue[] = [0, 0, 0, 1, 0, 1, 1, 1];
    expect(res.table.rows.map((r) => r.outputs[0])).toEqual(expectedOutputs);
  });

  it('3. respects custom inputOrder and MSB binary encoding rules', () => {
    const maj = build3InputMajority();
    const customRes = extractTruthTable(maj, { inputOrder: ['C', 'B', 'A'] });
    expect(customRes.ok).toBe(true);
    if (!customRes.ok) return;

    expect(customRes.table.inputs).toEqual(['C', 'B', 'A']);
    // Row index is encoded with C as MSB, then B, then A
    // Row 1: C=0, B=0, A=1 -> 0
    // Row 3: C=0, B=1, A=1 -> 1
    // Row 5: C=1, B=0, A=1 -> 1
    // Row 6: C=1, B=1, A=0 -> 1
    // Row 7: C=1, B=1, A=1 -> 1
    const outputs = customRes.table.rows.map((r) => r.outputs[0]);
    expect(outputs).toEqual([0, 0, 0, 1, 0, 1, 1, 1]);
  });

  it('4. reports proper error codes for invalid circuit conditions', () => {
    // has-clock
    let gClock = createEmptyCircuit();
    gClock = addNode(gClock, { id: 'clk1', kind: 'clock', label: 'CLK', halfPeriod: 10, startValue: 0, x: 0, y: 0 });
    gClock = addNode(gClock, { id: 'out1', kind: 'output', label: 'Y', x: 100, y: 0 });
    const wClk = addWire(gClock, { from: { nodeId: 'clk1', pin: 0 }, to: { nodeId: 'out1', pin: 0 } });
    const clkRes = extractTruthTable(wClk.ok ? wClk.graph : gClock);
    expect(clkRes.ok).toBe(false);
    if (!clkRes.ok) expect(clkRes.error.code).toBe('has-clock');

    // has-feedback
    const sccRes = extractTruthTable(srLatchNor());
    expect(sccRes.ok).toBe(false);
    if (!sccRes.ok) expect(sccRes.error.code).toBe('has-feedback');

    // no-outputs
    let gNoOut = createEmptyCircuit();
    gNoOut = addNode(gNoOut, { id: 'in1', kind: 'input', label: 'A', value: 0, x: 0, y: 0 });
    const noOutRes = extractTruthTable(gNoOut);
    expect(noOutRes.ok).toBe(false);
    if (!noOutRes.ok) expect(noOutRes.error.code).toBe('no-outputs');

    // too-many-inputs (> 6)
    let g7 = createEmptyCircuit();
    for (let i = 0; i < 7; i++) {
      g7 = addNode(g7, { id: `in${i}`, kind: 'input', label: `IN${i}`, value: 0, x: 0, y: i * 20 });
    }
    g7 = addNode(g7, { id: 'out1', kind: 'output', label: 'Y', x: 200, y: 0 });
    const tooManyRes = extractTruthTable(g7);
    expect(tooManyRes.ok).toBe(false);
    if (!tooManyRes.ok) expect(tooManyRes.error.code).toBe('too-many-inputs');

    // duplicate-labels
    let gDup = createEmptyCircuit();
    gDup = addNode(gDup, { id: 'in1', kind: 'input', label: 'A', value: 0, x: 0, y: 0 });
    gDup = addNode(gDup, { id: 'in2', kind: 'input', label: 'A', value: 0, x: 0, y: 50 });
    gDup = addNode(gDup, { id: 'out1', kind: 'output', label: 'Y', x: 200, y: 0 });
    const dupRes = extractTruthTable(gDup);
    expect(dupRes.ok).toBe(false);
    if (!dupRes.ok) expect(dupRes.error.code).toBe('duplicate-labels');
  });

  it('5. evaluates floating pins as X and emits warnings', () => {
    let g = createEmptyCircuit();
    g = addNode(g, { id: 'in1', kind: 'input', label: 'A', value: 0, x: 0, y: 0 });
    g = addNode(g, { id: 'g1', kind: 'gate', gateType: 'AND', inputCount: 2, x: 100, y: 0 });
    g = addNode(g, { id: 'out1', kind: 'output', label: 'Y', x: 200, y: 0 });

    const w1 = addWire(g, { from: { nodeId: 'in1', pin: 0 }, to: { nodeId: 'g1', pin: 0 } });
    const w2 = addWire(w1.ok ? w1.graph : g, { from: { nodeId: 'g1', pin: 0 }, to: { nodeId: 'out1', pin: 0 } });
    g = w2.ok ? w2.graph : g;

    const res = extractTruthTable(g);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // AND(A=0, X) = 0, AND(A=1, X) = X
    expect(res.table.rows[0]?.outputs[0]).toBe(0);
    expect(res.table.rows[1]?.outputs[0]).toBe('X');
    expect(res.warnings && res.warnings.length > 0).toBe(true);
  });

  it('6. matches settled event simulator across 100 seeded random DAGs (<= 6 inputs)', () => {
    const rng = createPrng(0xcafe_babe);
    const gateTypes: GateType[] = ['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR'];

    for (let trial = 0; trial < 100; trial++) {
      const inputCount = prngInt(rng, 2, 4);
      const gateCount = prngInt(rng, 3, 8);

      const nodes: CircuitNode[] = [];
      const wires: CircuitWire[] = [];

      for (let i = 0; i < inputCount; i++) {
        nodes.push({ kind: 'input', id: `in${i}`, label: `IN${i}`, value: 0, x: 0, y: i * 30 });
      }

      const availableDrivers = nodes.map((n) => n.id);

      for (let gIdx = 0; gIdx < gateCount; gIdx++) {
        const gType = prngChoice(rng, gateTypes) as GateType;
        const gateId = `g${gIdx}`;
        nodes.push({
          kind: 'gate',
          id: gateId,
          gateType: gType,
          inputCount: 2,
          x: 100 + gIdx * 40,
          y: gIdx * 30,
        });

        const src0 = prngChoice(rng, availableDrivers) as string;
        const src1 = prngChoice(rng, availableDrivers) as string;
        wires.push(
          { id: `w_${gIdx}_0`, from: { nodeId: src0, pin: 0 }, to: { nodeId: gateId, pin: 0 } },
          { id: `w_${gIdx}_1`, from: { nodeId: src1, pin: 0 }, to: { nodeId: gateId, pin: 1 } }
        );
        availableDrivers.push(gateId);
      }

      const lastGateId = `g${gateCount - 1}`;
      nodes.push({ kind: 'output', id: 'out0', label: 'OUT0', x: 600, y: 0 });
      wires.push({ id: 'w_out', from: { nodeId: lastGateId, pin: 0 }, to: { nodeId: 'out0', pin: 0 } });

      const g: CircuitGraph = { nodes, wires };

      const extractRes = extractTruthTable(g);
      expect(extractRes.ok).toBe(true);
      if (!extractRes.ok) continue;

      const simRes = createSimulator(g, { delayMode: 'zero' });
      expect(simRes.ok).toBe(true);
      if (!simRes.ok) continue;
      const sim = simRes.sim;

      for (const row of extractRes.table.rows) {
        for (let b = 0; b < inputCount; b++) {
          sim.setInput(`in${b}`, row.inputs[b] as LogicValue);
        }
        sim.settle();
        const simOut = sim.getNodeValue('out0');
        expect(row.outputs[0]).toBe(simOut);
      }
    }
  });
});
