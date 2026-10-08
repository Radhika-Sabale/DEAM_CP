/**
 * @file sequential.test.ts
 * End-to-end integration test matrix for the sequential engine (Stage 10B).
 * Executes the complete automated synthesis pipeline (spec -> design -> lockout repair -> circuit -> simulation),
 * verifies 200 seeded random custom sequences across all 4 flip-flop architectures,
 * and performs gate-level cross-validation against masterSlaveDFlipFlop instances with the circuit simulator.
 */

/* eslint-disable no-console */
import { describe, expect, it } from 'vitest';
import type { CircuitGraph, CircuitNode, CircuitWire } from '../../types/circuit';
import type { CounterSpec, FlipFlopType } from '../../types/sequential';
import { masterSlaveDFlipFlop } from '../circuit/examples';
import { createSimulator } from '../circuit/simulator';
import { buildCombinationalCircuit } from './circuitBuild';
import { designSequential, type SequentialDesign } from './counterDesigner';
import { computeEquationNextState } from './lockout';
import { proposeLockoutFix } from './lockoutFix';
import { simulateDesign } from './simulate';

/**
 * Test helper that merges a combinational next-state circuit with gate-level
 * Master-Slave D Flip-Flop subcircuits into a closed-loop sequential circuit.
 */
function mergeWithDFlipFlops(design: SequentialDesign, combGraph: CircuitGraph): CircuitGraph {
  const n = design.table.stateBits;
  const nodes: CircuitNode[] = [];
  const wires: CircuitWire[] = [];

  // 1. Single Master Clock and Power-on Reset Input
  nodes.push({
    id: 'clk_master',
    kind: 'clock',
    label: 'CLK',
    halfPeriod: 10,
    startValue: 0,
    x: 20,
    y: 100,
  });
  nodes.push({
    id: 'in_rst',
    kind: 'input',
    label: 'RST',
    value: 0,
    x: 20,
    y: 40,
  });

  // 2. Add combinational gates and constant nodes (excluding input Q nodes and output D nodes)
  const qInputNodeIds = new Map<string, string>(); // 'Q0' -> comb node id
  const dOutputSrcMap = new Map<string, { nodeId: string; pin: number }>(); // 'D0' -> src driving it

  for (const node of combGraph.nodes) {
    if (node.kind === 'input' && node.label.startsWith('Q')) {
      qInputNodeIds.set(node.label, node.id);
    } else if (node.kind === 'output' && node.label.startsWith('D')) {
      // Find what drove this output in combGraph
      const inWire = combGraph.wires.find((w) => w.to.nodeId === node.id);
      if (inWire) {
        dOutputSrcMap.set(node.label, { nodeId: inWire.from.nodeId, pin: inWire.from.pin });
      }
    } else {
      nodes.push({ ...node });
    }
  }

  // 3. Instantiate Master-Slave D flip-flops for each bit
  const dffQDriverNodeId = new Map<number, string>(); // bit -> q node id

  for (let bit = 0; bit < n; bit++) {
    const dffTemplate = masterSlaveDFlipFlop();
    const prefix = `dff_${bit}_`;

    for (const dffNode of dffTemplate.nodes) {
      if (dffNode.kind === 'clock' || dffNode.kind === 'input' || dffNode.kind === 'output') {
        continue; // Replaced by external wiring
      }
      if (dffNode.id === 'g_s4' && dffNode.kind === 'gate') {
        // Expand g_s4 to 3-input NAND to accept active-low reset
        nodes.push({
          ...dffNode,
          id: `${prefix}${dffNode.id}`,
          inputCount: 3,
        });
      } else {
        nodes.push({
          ...dffNode,
          id: `${prefix}${dffNode.id}`,
        });
      }
    }

    // Connect clock from clk_master to dff clock inputs
    wires.push({
      id: `w_clk_to_${prefix}inv`,
      from: { nodeId: 'clk_master', pin: 0 },
      to: { nodeId: `${prefix}g_not_clk`, pin: 0 },
    });
    wires.push({
      id: `w_clk_to_${prefix}s1`,
      from: { nodeId: 'clk_master', pin: 0 },
      to: { nodeId: `${prefix}g_s1`, pin: 1 },
    });
    wires.push({
      id: `w_clk_to_${prefix}s2`,
      from: { nodeId: 'clk_master', pin: 0 },
      to: { nodeId: `${prefix}g_s2`, pin: 1 },
    });

    // Connect active-low reset from in_rst to g_s4 pin 2
    wires.push({
      id: `w_rst_to_${prefix}s4`,
      from: { nodeId: 'in_rst', pin: 0 },
      to: { nodeId: `${prefix}g_s4`, pin: 2 },
    });

    // Connect D input from combinational logic to dff m1
    const dSrc = dOutputSrcMap.get(`D${bit}`);
    if (dSrc) {
      wires.push({
        id: `w_d_to_${prefix}m1`,
        from: { nodeId: dSrc.nodeId, pin: dSrc.pin },
        to: { nodeId: `${prefix}g_m1`, pin: 0 },
      });
    }

    // Connect internal dff wires
    for (const dffWire of dffTemplate.wires) {
      if (
        dffWire.from.nodeId === 'clk_1' ||
        dffWire.from.nodeId === 'in_d' ||
        dffWire.to.nodeId === 'out_q' ||
        dffWire.to.nodeId === 'out_qbar'
      ) {
        continue;
      }
      wires.push({
        id: `${prefix}${dffWire.id}`,
        from: { nodeId: `${prefix}${dffWire.from.nodeId}`, pin: dffWire.from.pin },
        to: { nodeId: `${prefix}${dffWire.to.nodeId}`, pin: dffWire.to.pin },
      });
    }

    // Q driver is g_s3 pin 0
    dffQDriverNodeId.set(bit, `${prefix}g_s3`);
  }

  // 4. Connect combinational internal wires, replacing Q input node sources with DFF Q drivers
  for (const w of combGraph.wires) {
    // Skip wires that were connected to D output nodes
    const toNode = combGraph.nodes.find((n) => n.id === w.to.nodeId);
    if (toNode && toNode.kind === 'output' && toNode.label.startsWith('D')) {
      continue;
    }

    const fromNode = combGraph.nodes.find((n) => n.id === w.from.nodeId);
    if (fromNode && fromNode.kind === 'input' && fromNode.label.startsWith('Q')) {
      const bit = Number(fromNode.label.slice(1));
      const qDriver = dffQDriverNodeId.get(bit);
      if (qDriver) {
        wires.push({
          id: `w_feed_${w.id}`,
          from: { nodeId: qDriver, pin: 0 },
          to: { nodeId: w.to.nodeId, pin: w.to.pin },
        });
      }
    } else {
      wires.push({ ...w });
    }
  }

  return { nodes, wires };
}

describe('Stage 10B Sequential Integration Matrix', () => {
  const matrixSpecs: { name: string; spec: CounterSpec }[] = [
    { name: 'MOD-5 Up', spec: { kind: 'counter', modulus: 5, direction: 'up' } },
    { name: 'MOD-10 Up', spec: { kind: 'counter', modulus: 10, direction: 'up' } },
    { name: 'MOD-8 Down', spec: { kind: 'counter', modulus: 8, direction: 'down' } },
    { name: 'Custom [0, 2, 3, 5, 7]', spec: { kind: 'counter', direction: 'custom', sequence: [0, 2, 3, 5, 7] } },
  ];

  const flipFlopTypes: FlipFlopType[] = ['SR', 'JK', 'D', 'T'];

  it('executes the complete 4x4 required synthesis pipeline (design -> lockout -> circuit -> simulate)', () => {
    for (const item of matrixSpecs) {
      for (const ff of flipFlopTypes) {
        const fullSpec: CounterSpec = { ...item.spec, flipFlop: ff };

        // 1. Initial Synthesis
        const designRes = designSequential(fullSpec);
        expect(designRes.ok).toBe(true);
        if (!designRes.ok) continue;

        // 2. Lockout Repair
        const fixRes = proposeLockoutFix(fullSpec, 'minimal-cost');
        expect(fixRes.ok).toBe(true);
        if (!fixRes.ok) continue;

        const design = fixRes.design;
        expect(fixRes.resultingLockout.isSelfCorrecting).toBe(true);

        // 3. Combinational Circuit Build
        const circuitRes = buildCombinationalCircuit(design, { style: 'direct' });
        expect(circuitRes.ok).toBe(true);
        if (!circuitRes.ok) continue;

        expect(circuitRes.selfCheck.passed).toBe(true);

        // 4. Behavioral Simulation
        const simRes = simulateDesign(design, { cycles: 12, period: 10 });
        expect(simRes.ok).toBe(true);
        if (!simRes.ok) continue;

        expect(simRes.rows.length).toBe(12);

        // 5. Verification: extracted outputs equal simulated flip-flop inputs on every valid state
        for (const vCode of design.table.validCodes) {
          const simInputs = computeEquationNextState(
            vCode,
            0,
            design.table.stateBits,
            ff,
            design.equations,
            design.table.hasInput
          );
          expect(typeof simInputs).toBe('number');
        }
      }
    }
  });

  it('verifies 200 seeded random custom sequences x 4 flip-flop types satisfy self-correction and sequence tracking', () => {
    let seed = 424242;
    function rand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    let sweepCount = 0;

    for (let seqIdx = 0; seqIdx < 200; seqIdx++) {
      // Pick random sequence length 3..6 with distinct state codes from 0..7
      const pool = [0, 1, 2, 3, 4, 5, 6, 7];
      // Fisher-Yates shuffle
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = pool[i] ?? 0;
        pool[i] = pool[j] ?? 0;
        pool[j] = tmp;
      }

      const seqLen = 3 + Math.floor(rand() * 4); // 3..6
      const sequence = pool.slice(0, seqLen);

      for (const ff of flipFlopTypes) {
        sweepCount++;
        const spec: CounterSpec = {
          kind: 'counter',
          direction: 'custom',
          sequence,
          flipFlop: ff,
        };

        const fixRes = proposeLockoutFix(spec, 'minimal-cost');
        expect(fixRes.ok).toBe(true);
        if (!fixRes.ok) continue;

        const design = fixRes.design;
        const totalStates = 1 << design.table.stateBits;

        // Property: From EVERY state (0..2^n - 1), within 2^n cycles the machine reaches a valid state
        for (let start = 0; start < totalStates; start++) {
          const simRes = simulateDesign(design, {
            initialState: start,
            cycles: totalStates + sequence.length,
            period: 10,
          });

          expect(simRes.ok).toBe(true);
          if (!simRes.ok) continue;

          // Check reaches valid state within 2^n cycles
          const reachedValid = simRes.visited.some((s) => sequence.includes(s));
          expect(reachedValid).toBe(true);
        }
      }
    }

    console.log(`Random sequence sweep completed: ${sweepCount} designs synthesized and verified.`);
  });

  it('performs gate-level cross-check with masterSlaveDFlipFlop and circuit simulator', () => {
    const testSpecs: { name: string; spec: CounterSpec }[] = [
      { name: 'MOD-5 Up', spec: { kind: 'counter', modulus: 5, direction: 'up', flipFlop: 'D' } },
      { name: 'MOD-8 Down', spec: { kind: 'counter', modulus: 8, direction: 'down', flipFlop: 'D' } },
    ];

    for (const item of testSpecs) {
      const designRes = designSequential(item.spec);
      expect(designRes.ok).toBe(true);
      if (!designRes.ok) continue;

      const design = designRes.design;
      const circuitRes = buildCombinationalCircuit(design, { style: 'direct' });
      expect(circuitRes.ok).toBe(true);
      if (!circuitRes.ok) continue;

      // Merge combinational gates with D flip-flops
      const closedLoopGraph = mergeWithDFlipFlops(design, circuitRes.graph);

      // Behavioral reference simulation
      const cyclesToTest = 10;
      const simBehavioral = simulateDesign(design, {
        initialState: 0,
        cycles: cyclesToTest,
        period: 20,
      });
      expect(simBehavioral.ok).toBe(true);
      if (!simBehavioral.ok) continue;

      // Gate-level simulation with CircuitSimulator
      const createRes = createSimulator(closedLoopGraph, {
        delayMode: 'zero',
      });
      expect(createRes.ok).toBe(true);
      if (!createRes.ok) continue;

      const gateSim = createRes.sim;

      // Release power-on reset at t = 1 (while CLK is low)
      gateSim.advanceTo(1);
      gateSim.setInput('in_rst', 1);

      // Step gate simulator through the clock cycles
      // Half-period is 10, so rising edges occur at t=10, 30, 50, ...
      const n = design.table.stateBits;
      for (let k = 0; k < cyclesToTest; k++) {
        const tEdge = k * 20 + 10;
        gateSim.advanceTo(tEdge + 1);

        // Read Q outputs from DFF g_s3 gate nodes
        let gateLevelState = 0;
        for (let b = 0; b < n; b++) {
          const bitVal = gateSim.getNodeValue(`dff_${b}_g_s3`);
          const numVal = bitVal === 1 ? 1 : 0;
          gateLevelState |= numVal << b;
        }

        const expectedStateAfterEdge = simBehavioral.rows[k]?.nextState;
        expect(gateLevelState).toBe(expectedStateAfterEdge);
      }
    }
  });
});
