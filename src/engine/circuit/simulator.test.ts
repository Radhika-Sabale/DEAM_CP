/**
 * @file simulator.test.ts
 * Comprehensive test suite for discrete-event digital circuit simulation engine.
 *
 * Verifies:
 * - Equivalence of zero-delay mode against an independent levelized evaluator on 200 random DAGs.
 * - Exact propagation timing on inverter chains (5-inverter chain settles at t = 5).
 * - Static-1 hazard pulse detection (glitches captured under unit delay, none in zero-delay).
 * - 3-valued Kleene pessimism and floating inputs reading as X.
 * - Zero-delay oscillation loop termination with status 'oscillating'.
 * - Ring oscillator continuous execution and maxEvents cutoff with status 'limit'.
 * - Rejection of blocking errors during simulator creation.
 * - Deterministic repeatability and trace serialization.
 */

import { describe, expect, it } from 'vitest';
import type { LogicValue } from '../../types/ast';
import type { CircuitGraph, CircuitNode, CircuitWire, GateType } from '../../types/circuit';
import { createPrng, prngChoice, prngInt } from '../common/seededRandom';
import { evaluateGate } from './gateLogic';
import { topologicalLevels } from './graphAnalysis';
import { createSimulator } from './simulator';

/**
 * Independent levelized combinational evaluator for acyclic graphs.
 */
function evaluateDagReference(
  graph: CircuitGraph,
  inputs: Record<string, LogicValue>
): Record<string, LogicValue> {
  const { levels } = topologicalLevels(graph);
  const sortedNodes = [...graph.nodes].sort((a, b) => {
    return (levels.get(a.id) ?? 0) - (levels.get(b.id) ?? 0);
  });

  const values: Record<string, LogicValue> = { ...inputs };

  for (const node of sortedNodes) {
    if (node.kind === 'input') {
      if (values[node.id] === undefined) values[node.id] = node.value;
    } else if (node.kind === 'const') {
      values[node.id] = node.value;
    } else if (node.kind === 'output') {
      const incoming = graph.wires.find((w) => w.to.nodeId === node.id);
      values[node.id] = incoming ? values[incoming.from.nodeId] ?? 'X' : 'X';
    } else if (node.kind === 'gate') {
      const inVals: LogicValue[] = [];
      for (let p = 0; p < node.inputCount; p++) {
        const wire = graph.wires.find((w) => w.to.nodeId === node.id && w.to.pin === p);
        inVals.push(wire ? values[wire.from.nodeId] ?? 'X' : 'X');
      }
      values[node.id] = evaluateGate(node.gateType, inVals);
    }
  }

  return values;
}

describe('CircuitSimulator', () => {
  it('1. matches independent levelized evaluator on 200 seeded random DAGs in zero-delay mode', () => {
    const rng = createPrng(13579);
    const gateTypes: GateType[] = ['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR'];

    for (let testIdx = 0; testIdx < 200; testIdx++) {
      const inputCount = prngInt(rng, 2, 4);
      const gateCount = prngInt(rng, 4, 10);

      const nodes: CircuitNode[] = [];
      const wires: CircuitWire[] = [];

      // Create inputs
      for (let i = 0; i < inputCount; i++) {
        const val: LogicValue = (prngChoice(rng, [0, 1, 'X']) as LogicValue) ?? 0;
        nodes.push({ kind: 'input', id: `in${i}`, x: 0, y: i * 20, label: `IN${i}`, value: val });
      }

      // Create gates in layers to ensure DAG
      const availableDrivers = nodes.map((n) => n.id);

      for (let g = 0; g < gateCount; g++) {
        const gType = prngChoice(rng, gateTypes) as GateType;
        const inArity = prngInt(rng, 2, Math.min(4, availableDrivers.length));
        const gateId = `g${g}`;
        nodes.push({
          kind: 'gate',
          id: gateId,
          x: 100 + g * 20,
          y: g * 20,
          gateType: gType,
          inputCount: inArity,
        });

        for (let p = 0; p < inArity; p++) {
          const srcId = prngChoice(rng, availableDrivers) as string;
          wires.push({
            id: `w_${gateId}_${p}`,
            from: { nodeId: srcId, pin: 0 },
            to: { nodeId: gateId, pin: p },
          });
        }
        availableDrivers.push(gateId);
      }

      // Add output
      const lastGateId = `g${gateCount - 1}`;
      nodes.push({ kind: 'output', id: 'out0', x: 500, y: 0, label: 'OUT' });
      wires.push({
        id: 'w_out',
        from: { nodeId: lastGateId, pin: 0 },
        to: { nodeId: 'out0', pin: 0 },
      });

      const g: CircuitGraph = { nodes, wires };
      const simRes = createSimulator(g, { delayMode: 'zero' });
      expect(simRes.ok).toBe(true);
      if (!simRes.ok) continue;

      const sim = simRes.sim;
      sim.settle();

      const refValues = evaluateDagReference(g, {});
      for (const node of g.nodes) {
        expect(sim.getNodeValue(node.id)).toBe(refValues[node.id]);
      }
    }
  });

  it('2. settles a 5-inverter chain at exact timestamp t = 5 under unit delay', () => {
    const g: CircuitGraph = {
      nodes: [
        { kind: 'input', id: 'in1', x: 0, y: 0, label: 'A', value: 0 },
        { kind: 'gate', id: 'g1', x: 50, y: 0, gateType: 'NOT', inputCount: 1 },
        { kind: 'gate', id: 'g2', x: 100, y: 0, gateType: 'NOT', inputCount: 1 },
        { kind: 'gate', id: 'g3', x: 150, y: 0, gateType: 'NOT', inputCount: 1 },
        { kind: 'gate', id: 'g4', x: 200, y: 0, gateType: 'NOT', inputCount: 1 },
        { kind: 'gate', id: 'g5', x: 250, y: 0, gateType: 'NOT', inputCount: 1 },
        { kind: 'output', id: 'out1', x: 300, y: 0, label: 'Y' },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'in1', pin: 0 }, to: { nodeId: 'g1', pin: 0 } },
        { id: 'w2', from: { nodeId: 'g1', pin: 0 }, to: { nodeId: 'g2', pin: 0 } },
        { id: 'w3', from: { nodeId: 'g2', pin: 0 }, to: { nodeId: 'g3', pin: 0 } },
        { id: 'w4', from: { nodeId: 'g3', pin: 0 }, to: { nodeId: 'g4', pin: 0 } },
        { id: 'w5', from: { nodeId: 'g4', pin: 0 }, to: { nodeId: 'g5', pin: 0 } },
        { id: 'w6', from: { nodeId: 'g5', pin: 0 }, to: { nodeId: 'out1', pin: 0 } },
      ],
    };

    const simRes = createSimulator(g, { delayMode: 'unit' });
    expect(simRes.ok).toBe(true);
    if (!simRes.ok) return;

    const sim = simRes.sim;
    sim.settle();

    // in1 = 0 -> g1=1, g2=0, g3=1, g4=0, g5=1 -> out1=1
    expect(sim.getNodeValue('out1')).toBe(1);

    // Toggle in1: 0 -> 1 at t = 10
    sim.advanceTo(10);
    sim.setInput('in1', 1);

    // At t = 10: g1 not changed yet
    expect(sim.getNodeValue('g1')).toBe(1);
    expect(sim.getNodeValue('out1')).toBe(1);

    sim.advanceTo(11);
    expect(sim.getNodeValue('g1')).toBe(0);

    sim.advanceTo(12);
    expect(sim.getNodeValue('g2')).toBe(1);

    sim.advanceTo(13);
    expect(sim.getNodeValue('g3')).toBe(0);

    sim.advanceTo(14);
    expect(sim.getNodeValue('g4')).toBe(1);

    sim.advanceTo(15);
    expect(sim.getNodeValue('g5')).toBe(0);
    expect(sim.getNodeValue('out1')).toBe(0);
  });

  it('3. detects static-1 hazard glitch (1-0-1) in F = AB + A`C under unit delay, and none in zero delay', () => {
    // F = AB + A'C. With B = 1, C = 1, transitioning A from 1 -> 0 causes a momentary 0 glitch
    // under unit delay, while zero delay settles instantaneously at the same timestamp.
    const createHazardCircuit = (): CircuitGraph => ({
      nodes: [
        { kind: 'input', id: 'inA', x: 0, y: 0, label: 'A', value: 1 },
        { kind: 'const', id: 'cB', x: 0, y: 50, value: 1 },
        { kind: 'const', id: 'cC', x: 0, y: 100, value: 1 },
        { kind: 'gate', id: 'gNotA', x: 50, y: 100, gateType: 'NOT', inputCount: 1 },
        { kind: 'gate', id: 'gAnd1', x: 100, y: 20, gateType: 'AND', inputCount: 2 },
        { kind: 'gate', id: 'gAnd2', x: 100, y: 80, gateType: 'AND', inputCount: 2 },
        { kind: 'gate', id: 'gOr', x: 180, y: 50, gateType: 'OR', inputCount: 2 },
        { kind: 'output', id: 'outF', x: 250, y: 50, label: 'F' },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'inA', pin: 0 }, to: { nodeId: 'gAnd1', pin: 0 } },
        { id: 'w2', from: { nodeId: 'cB', pin: 0 }, to: { nodeId: 'gAnd1', pin: 1 } },
        { id: 'w3', from: { nodeId: 'inA', pin: 0 }, to: { nodeId: 'gNotA', pin: 0 } },
        { id: 'w4', from: { nodeId: 'gNotA', pin: 0 }, to: { nodeId: 'gAnd2', pin: 0 } },
        { id: 'w5', from: { nodeId: 'cC', pin: 0 }, to: { nodeId: 'gAnd2', pin: 1 } },
        { id: 'w6', from: { nodeId: 'gAnd1', pin: 0 }, to: { nodeId: 'gOr', pin: 0 } },
        { id: 'w7', from: { nodeId: 'gAnd2', pin: 0 }, to: { nodeId: 'gOr', pin: 1 } },
        { id: 'w8', from: { nodeId: 'gOr', pin: 0 }, to: { nodeId: 'outF', pin: 0 } },
      ],
    });

    // Test A: Unit delay produces glitch across timestamps
    const simUnitRes = createSimulator(createHazardCircuit(), { delayMode: 'unit' });
    expect(simUnitRes.ok).toBe(true);
    if (!simUnitRes.ok) return;

    const simUnit = simUnitRes.sim;
    simUnit.settle();
    expect(simUnit.getNodeValue('outF')).toBe(1);

    simUnit.advanceTo(10);
    simUnit.setInput('inA', 0);
    simUnit.settle();

    const traceUnit = simUnit.getTrace().changes.filter((c) => c.nodeId === 'outF');
    const fValues = traceUnit.map((c) => c.value);
    // Initial 1, glitches to 0 at t = 11, recovers to 1 at t = 12
    expect(fValues).toContain(0);
    expect(simUnit.getNodeValue('outF')).toBe(1);

    // Test B: Zero delay settles within tick t = 10 with no committed glitch
    const simZeroRes = createSimulator(createHazardCircuit(), { delayMode: 'zero' });
    expect(simZeroRes.ok).toBe(true);
    if (!simZeroRes.ok) return;

    const simZero = simZeroRes.sim;
    simZero.settle();
    simZero.advanceTo(10);
    simZero.setInput('inA', 0);
    simZero.settle();

    const traceZero = simZero.getTrace().changes.filter((c) => c.nodeId === 'outF');
    // In zero delay, committed output stays 1 with no glitch in trace
    expect(traceZero.map((c) => c.value)).not.toContain(0);
  });

  it('4. follows three-valued Kleene rules and floating inputs', () => {
    // AND(0, X) = 0, OR(1, X) = 1, floating input = X
    const g: CircuitGraph = {
      nodes: [
        { kind: 'const', id: 'c0', x: 0, y: 0, value: 0 },
        { kind: 'const', id: 'c1', x: 0, y: 50, value: 1 },
        { kind: 'gate', id: 'gAnd', x: 100, y: 0, gateType: 'AND', inputCount: 2 },
        { kind: 'gate', id: 'gOr', x: 100, y: 50, gateType: 'OR', inputCount: 2 },
        { kind: 'output', id: 'outAnd', x: 200, y: 0, label: 'AND_OUT' },
        { kind: 'output', id: 'outOr', x: 200, y: 50, label: 'OR_OUT' },
      ],
      wires: [
        // gAnd pin 0 is 0; pin 1 is floating (reads X)
        { id: 'w1', from: { nodeId: 'c0', pin: 0 }, to: { nodeId: 'gAnd', pin: 0 } },
        { id: 'w2', from: { nodeId: 'gAnd', pin: 0 }, to: { nodeId: 'outAnd', pin: 0 } },
        // gOr pin 0 is 1; pin 1 is floating (reads X)
        { id: 'w3', from: { nodeId: 'c1', pin: 0 }, to: { nodeId: 'gOr', pin: 0 } },
        { id: 'w4', from: { nodeId: 'gOr', pin: 0 }, to: { nodeId: 'outOr', pin: 0 } },
      ],
    };

    const simRes = createSimulator(g, { delayMode: 'zero' });
    expect(simRes.ok).toBe(true);
    if (!simRes.ok) return;

    const sim = simRes.sim;
    sim.settle();

    expect(sim.getNodeValue('outAnd')).toBe(0); // 0 AND X = 0
    expect(sim.getNodeValue('outOr')).toBe(1);  // 1 OR X = 1
  });

  it('5. terminates zero-delay self-loop inverter with status oscillating', () => {
    // Gated inverter: NAND(EN, output) where EN transitions from 0 -> 1
    const g: CircuitGraph = {
      nodes: [
        { kind: 'input', id: 'inEN', x: 0, y: 0, label: 'EN', value: 0 },
        { kind: 'gate', id: 'g1', x: 100, y: 0, gateType: 'NAND', inputCount: 2 },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'inEN', pin: 0 }, to: { nodeId: 'g1', pin: 0 } },
        { id: 'w2', from: { nodeId: 'g1', pin: 0 }, to: { nodeId: 'g1', pin: 1 } },
      ],
    };

    const simRes = createSimulator(g, { delayMode: 'zero', maxDeltaCycles: 50 });
    expect(simRes.ok).toBe(true);
    if (!simRes.ok) return;

    const sim = simRes.sim;
    sim.settle();
    expect(sim.getNodeValue('g1')).toBe(1); // NAND(0, X) = 1

    // Enable oscillation at t = 10
    sim.advanceTo(10);
    const stepRes = sim.setInput('inEN', 1);

    expect(stepRes.status).toBe('oscillating');
    expect(sim.getNodeValue('g1')).toBe('X');
  });

  it('6. executes unit-delay ring oscillator and halts at maxEvents with status limit', () => {
    // Gated 3-inverter ring oscillator: NAND(EN, g3) -> g2 (NOT) -> g3 (NOT) -> feedback
    const g: CircuitGraph = {
      nodes: [
        { kind: 'input', id: 'inEN', x: 0, y: 0, label: 'EN', value: 0 },
        { kind: 'gate', id: 'g1', x: 100, y: 0, gateType: 'NAND', inputCount: 2 },
        { kind: 'gate', id: 'g2', x: 200, y: 0, gateType: 'NOT', inputCount: 1 },
        { kind: 'gate', id: 'g3', x: 300, y: 0, gateType: 'NOT', inputCount: 1 },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'inEN', pin: 0 }, to: { nodeId: 'g1', pin: 0 } },
        { id: 'w2', from: { nodeId: 'g3', pin: 0 }, to: { nodeId: 'g1', pin: 1 } },
        { id: 'w3', from: { nodeId: 'g1', pin: 0 }, to: { nodeId: 'g2', pin: 0 } },
        { id: 'w4', from: { nodeId: 'g2', pin: 0 }, to: { nodeId: 'g3', pin: 0 } },
      ],
    };

    const simRes = createSimulator(g, { delayMode: 'unit', maxEvents: 100 });
    expect(simRes.ok).toBe(true);
    if (!simRes.ok) return;

    const sim = simRes.sim;
    sim.settle();
    expect(sim.getNodeValue('g1')).toBe(1);
    expect(sim.getNodeValue('g2')).toBe(0);
    expect(sim.getNodeValue('g3')).toBe(1);

    // Enable ring oscillation at t = 5
    sim.advanceTo(5);
    sim.setInput('inEN', 1);

    const res = sim.advanceTo(500);
    expect(res.status).toBe('limit');
    expect(sim.stats.eventsProcessed).toBeGreaterThanOrEqual(100);
  });

  it('7. refuses simulator creation on blocking topological errors', () => {
    const g: CircuitGraph = {
      nodes: [{ kind: 'input', id: 'in1', x: 0, y: 0, label: 'A', value: 0 }],
      wires: [{ id: 'w1', from: { nodeId: 'in1', pin: 0 }, to: { nodeId: 'missingNode', pin: 0 } }],
    };

    const simRes = createSimulator(g);
    expect(simRes.ok).toBe(false);
    if (!simRes.ok) {
      expect(simRes.diagnostics.some((d) => d.code === 'invalid-reference')).toBe(true);
    }
  });

  it('8. produces identical traces across independent repeated runs', () => {
    const g: CircuitGraph = {
      nodes: [
        { kind: 'input', id: 'in1', x: 0, y: 0, label: 'A', value: 0 },
        { kind: 'gate', id: 'g1', x: 50, y: 0, gateType: 'NOT', inputCount: 1 },
        { kind: 'output', id: 'out1', x: 100, y: 0, label: 'Y' },
      ],
      wires: [
        { id: 'w1', from: { nodeId: 'in1', pin: 0 }, to: { nodeId: 'g1', pin: 0 } },
        { id: 'w2', from: { nodeId: 'g1', pin: 0 }, to: { nodeId: 'out1', pin: 0 } },
      ],
    };

    const runSim = (): unknown => {
      const res = createSimulator(g, { delayMode: 'unit' });
      if (!res.ok) throw new Error('Create failed');
      const sim = res.sim;
      sim.advanceTo(5);
      sim.setInput('in1', 1);
      sim.advanceTo(10);
      return sim.getTrace();
    };

    const trace1 = runSim();
    const trace2 = runSim();
    expect(trace1).toEqual(trace2);
  });

  it('9. supports future scheduled inputs with scheduleInput', () => {
    const g: CircuitGraph = {
      nodes: [
        { kind: 'input', id: 'in1', x: 0, y: 0, label: 'A', value: 0 },
        { kind: 'output', id: 'out1', x: 100, y: 0, label: 'Y' },
      ],
      wires: [{ id: 'w1', from: { nodeId: 'in1', pin: 0 }, to: { nodeId: 'out1', pin: 0 } }],
    };

    const simRes = createSimulator(g, { delayMode: 'unit' });
    if (!simRes.ok) throw new Error('Create failed');
    const sim = simRes.sim;

    expect(sim.scheduleInput(5, 'in1', 1)).toBe(true);
    expect(sim.scheduleInput(10, 'in1', 0)).toBe(true);

    sim.advanceTo(4);
    expect(sim.getNodeValue('in1')).toBe(0);

    sim.advanceTo(5);
    expect(sim.getNodeValue('in1')).toBe(1);

    sim.advanceTo(9);
    expect(sim.getNodeValue('in1')).toBe(1);

    sim.advanceTo(10);
    expect(sim.getNodeValue('in1')).toBe(0);
  });
});
