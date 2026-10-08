/**
 * @file performance.test.ts
 * Performance, scalability, and event-driven fanout pruning benchmarks.
 */

import { describe, expect, it } from 'vitest';
import type { LogicValue } from '../../types/ast';
import type { CircuitGraph, CircuitNode, CircuitWire, GateType } from '../../types/circuit';
import { createPrng, prngChoice, prngInt } from '../common/seededRandom';
import { rippleCarryAdder } from './examples';
import { createSimulator } from './simulator';
import { validateCircuit } from './validate';

/**
 * Generates a deterministic 500-gate layered DAG circuit.
 */
function buildSeeded500GateDag(seed = 123456): CircuitGraph {
  const prng = createPrng(seed);
  const nodes: CircuitNode[] = [];
  const wires: CircuitWire[] = [];

  const inputCount = 10;
  const layerCount = 20;
  const gatesPerLayer = 25; // 20 * 25 = 500 gates
  const outputCount = 10;
  const gateTypes: GateType[] = ['AND', 'OR', 'XOR', 'NAND', 'NOR'];

  for (let i = 0; i < inputCount; i++) {
    nodes.push({
      id: `in_${i}`,
      kind: 'input',
      label: `IN_${i}`,
      value: (prngInt(prng, 0, 1) as LogicValue),
      x: 50,
      y: 50 + i * 40,
    });
  }

  const layers: string[][] = [];
  let gateIndex = 0;
  let wireIndex = 0;

  for (let l = 0; l < layerCount; l++) {
    const layerGateIds: string[] = [];
    const prevPool = l === 0 ? nodes.map((n) => n.id) : layers[l - 1] ?? [];

    for (let g = 0; g < gatesPerLayer; g++) {
      const gId = `g_${gateIndex++}`;
      const gType = prngChoice(prng, gateTypes) ?? 'AND';
      layerGateIds.push(gId);

      nodes.push({
        id: gId,
        kind: 'gate',
        gateType: gType,
        inputCount: 2,
        x: 150 + l * 80,
        y: 50 + g * 35,
      });

      const src0 = prngChoice(prng, prevPool) ?? `in_0`;
      const src1 = prngChoice(prng, prevPool) ?? `in_0`;

      wires.push(
        { id: `w_${wireIndex++}`, from: { nodeId: src0, pin: 0 }, to: { nodeId: gId, pin: 0 } },
        { id: `w_${wireIndex++}`, from: { nodeId: src1, pin: 0 }, to: { nodeId: gId, pin: 1 } }
      );
    }
    layers.push(layerGateIds);
  }

  const lastLayer = layers[layers.length - 1] ?? [];
  for (let i = 0; i < outputCount; i++) {
    const outId = `out_${i}`;
    nodes.push({
      id: outId,
      kind: 'output',
      label: `OUT_${i}`,
      x: 150 + layerCount * 80,
      y: 50 + i * 40,
    });
    const src = lastLayer[i % lastLayer.length] ?? `g_0`;
    wires.push({
      id: `w_${wireIndex++}`,
      from: { nodeId: src, pin: 0 },
      to: { nodeId: outId, pin: 0 },
    });
  }

  return { nodes, wires };
}

/**
 * Computes the exact gate fan-out cone size of a node via independent BFS.
 */
function computeIndependentFanoutGateCount(graph: CircuitGraph, startNodeId: string): number {
  const nodeMap = new Map<string, CircuitNode>(graph.nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, string[]>();

  for (const w of graph.wires) {
    const list = adjacency.get(w.from.nodeId) ?? [];
    list.push(w.to.nodeId);
    adjacency.set(w.from.nodeId, list);
  }

  const visited = new Set<string>([startNodeId]);
  const queue = [startNodeId];
  let gateCount = 0;

  while (queue.length > 0) {
    const curr = queue.shift();
    if (!curr) continue;

    const neighbors = adjacency.get(curr) ?? [];
    for (const nextId of neighbors) {
      if (!visited.has(nextId)) {
        visited.add(nextId);
        const node = nodeMap.get(nextId);
        if (node && node.kind === 'gate') {
          gateCount++;
        }
        queue.push(nextId);
      }
    }
  }

  return gateCount;
}

/**
 * Generates a random N-bit BigInt using a deterministic PRNG.
 */
function randomBigInt(prng: () => number, bits: number): bigint {
  let result = 0n;
  for (let i = 0; i < bits; i++) {
    if (prngInt(prng, 0, 1) === 1) {
      result |= 1n << BigInt(i);
    }
  }
  return result;
}

describe('Circuit Engine Performance and Scaling', () => {
  it('1. 500-gate layered DAG validates, simulates, and evaluates strictly <= fanout cone size', () => {
    const startTime = performance.now();
    const dag = buildSeeded500GateDag(777);

    const valRes = validateCircuit(dag, { allowFeedback: false });
    expect(valRes.hasErrors).toBe(false);

    const simRes = createSimulator(dag, { delayMode: 'zero' });
    expect(simRes.ok).toBe(true);
    if (!simRes.ok) return;
    const sim = simRes.sim;

    sim.settle();

    const prng = createPrng(999);
    let totalEvalsAcrossToggles = 0;
    let totalFanoutCapAcrossToggles = 0;

    for (let testIdx = 0; testIdx < 200; testIdx++) {
      const inputIdx = prngInt(prng, 0, 9);
      const inputId = `in_${inputIdx}`;
      const curVal = sim.getNodeValue(inputId);
      const nextVal: LogicValue = curVal === 1 ? 0 : 1;

      const maxTheoreticalGateEvals = computeIndependentFanoutGateCount(dag, inputId);
      const evalsBefore = sim.stats.gateEvaluations;

      sim.setInput(inputId, nextVal);

      const evalsUsed = sim.stats.gateEvaluations - evalsBefore;
      totalEvalsAcrossToggles += evalsUsed;
      totalFanoutCapAcrossToggles += maxTheoreticalGateEvals;

      expect(evalsUsed).toBeLessThanOrEqual(maxTheoreticalGateEvals);
    }

    const elapsed = performance.now() - startTime;
    expect(totalEvalsAcrossToggles).toBeLessThanOrEqual(totalFanoutCapAcrossToggles);
    expect(elapsed).toBeLessThan(2000);
  });

  it('2. 100-bit ripple adder (500 gates) completes 50 100-bit additions matching BigInt arithmetic', () => {
    const startTime = performance.now();
    const adder100 = rippleCarryAdder(100);

    const valRes = validateCircuit(adder100, { allowFeedback: false });
    expect(valRes.hasErrors).toBe(false);

    const simRes = createSimulator(adder100, { delayMode: 'zero' });
    expect(simRes.ok).toBe(true);
    if (!simRes.ok) return;
    const sim = simRes.sim;

    const prng = createPrng(54321);

    for (let trial = 0; trial < 50; trial++) {
      const a = randomBigInt(prng, 100);
      const b = randomBigInt(prng, 100);
      const cin = prngInt(prng, 0, 1);

      sim.setInput('in_cin', cin as LogicValue);
      for (let bit = 0; bit < 100; bit++) {
        const aBit = ((a >> BigInt(bit)) & 1n) === 1n ? 1 : 0;
        const bBit = ((b >> BigInt(bit)) & 1n) === 1n ? 1 : 0;
        sim.setInput(`in_a_${bit}`, aBit);
        sim.setInput(`in_b_${bit}`, bBit);
      }

      sim.settle();

      let sumBigInt = 0n;
      for (let bit = 0; bit < 100; bit++) {
        if (sim.getNodeValue(`out_s_${bit}`) === 1) {
          sumBigInt |= 1n << BigInt(bit);
        }
      }
      if (sim.getNodeValue('out_cout') === 1) {
        sumBigInt |= 1n << 100n;
      }

      const expectedSum = a + b + BigInt(cin);
      expect(sumBigInt).toBe(expectedSum);
    }

    const elapsed = performance.now() - startTime;
    expect(sim.stats.gateEvaluations).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(2000);
  });
});
