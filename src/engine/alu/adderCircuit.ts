/**
 * @file adderCircuit.ts
 * Generates interactive gate-level ripple-carry adder/subtractor circuit schematics
 * for the Virtual Lab Circuit Simulator, and maintains bidirectional gate correspondence.
 */

import type {
  CircuitGraph,
  CircuitNode,
  CircuitWire,
} from '../../types/circuit';

/**
 * Structural correspondence link between an ALU datapath gate and its schematic component.
 */
export interface GateCorrespondence {
  readonly carryChainGateId: string;
  readonly circuitNodeId: string;
  readonly bitIndex: number;
  readonly role: 'sub_invert' | 'propagate' | 'generate' | 'sum' | 'carry_transfer' | 'carry_out';
}

/**
 * Builds an n-bit ripple-carry adder/subtractor circuit graph compatible with CircuitSimulator.
 *
 * @param width Number of bits (2..16)
 * @returns Deterministic CircuitGraph with inputs A0..A(n-1), B0..B(n-1), SUB, outputs S0..S(n-1), COUT
 */
export function buildAdderSubtractorCircuit(width: number): CircuitGraph {
  const count = Math.max(2, Math.min(16, Math.floor(width)));
  const nodes: CircuitNode[] = [];
  const wires: CircuitWire[] = [];

  // SUB control input: 0 for addition, 1 for subtraction
  nodes.push({ id: 'in_sub', kind: 'input', label: 'SUB', value: 0, x: 80, y: 40 });

  for (let i = 0; i < count; i++) {
    const yBase = 120 + i * 220;

    nodes.push(
      { id: `in_a_${i}`, kind: 'input', label: `A${i}`, value: 0, x: 80, y: yBase },
      { id: `in_b_${i}`, kind: 'input', label: `B${i}`, value: 0, x: 80, y: yBase + 60 },
      // Conditional subtraction negation XOR
      { id: `g_sub_${i}`, kind: 'gate', gateType: 'XOR', inputCount: 2, x: 220, y: yBase + 60 },
      // Half Adder 1: p_i (XOR) and g_i (AND)
      { id: `g_xor1_${i}`, kind: 'gate', gateType: 'XOR', inputCount: 2, x: 360, y: yBase + 20 },
      { id: `g_and1_${i}`, kind: 'gate', gateType: 'AND', inputCount: 2, x: 360, y: yBase + 120 },
      // Half Adder 2: sum s_i (XOR) and carry transfer t_i (AND)
      { id: `g_xor2_${i}`, kind: 'gate', gateType: 'XOR', inputCount: 2, x: 500, y: yBase + 20 },
      { id: `g_and2_${i}`, kind: 'gate', gateType: 'AND', inputCount: 2, x: 500, y: yBase + 100 },
      // Stage carry out: c_{i+1} (OR)
      { id: `g_or1_${i}`, kind: 'gate', gateType: 'OR', inputCount: 2, x: 640, y: yBase + 110 },
      // Sum output probe
      { id: `out_s_${i}`, kind: 'output', label: `S${i}`, x: 760, y: yBase + 20 }
    );

    const prevCarryNodeId = i === 0 ? 'in_sub' : `g_or1_${i - 1}`;

    wires.push(
      // B negation stage: B_i XOR SUB
      { id: `w_b_sub_${i}`, from: { nodeId: `in_b_${i}`, pin: 0 }, to: { nodeId: `g_sub_${i}`, pin: 0 } },
      { id: `w_ctrl_sub_${i}`, from: { nodeId: 'in_sub', pin: 0 }, to: { nodeId: `g_sub_${i}`, pin: 1 } },
      // Half Adder 1 wires
      { id: `w_a_x1_${i}`, from: { nodeId: `in_a_${i}`, pin: 0 }, to: { nodeId: `g_xor1_${i}`, pin: 0 } },
      { id: `w_beff_x1_${i}`, from: { nodeId: `g_sub_${i}`, pin: 0 }, to: { nodeId: `g_xor1_${i}`, pin: 1 } },
      { id: `w_a_a1_${i}`, from: { nodeId: `in_a_${i}`, pin: 0 }, to: { nodeId: `g_and1_${i}`, pin: 0 } },
      { id: `w_beff_a1_${i}`, from: { nodeId: `g_sub_${i}`, pin: 0 }, to: { nodeId: `g_and1_${i}`, pin: 1 } },
      // Half Adder 2 wires
      { id: `w_p_x2_${i}`, from: { nodeId: `g_xor1_${i}`, pin: 0 }, to: { nodeId: `g_xor2_${i}`, pin: 0 } },
      { id: `w_cin_x2_${i}`, from: { nodeId: prevCarryNodeId, pin: 0 }, to: { nodeId: `g_xor2_${i}`, pin: 1 } },
      { id: `w_p_a2_${i}`, from: { nodeId: `g_xor1_${i}`, pin: 0 }, to: { nodeId: `g_and2_${i}`, pin: 0 } },
      { id: `w_cin_a2_${i}`, from: { nodeId: prevCarryNodeId, pin: 0 }, to: { nodeId: `g_and2_${i}`, pin: 1 } },
      // Stage carry out wires
      { id: `w_g_or_${i}`, from: { nodeId: `g_and1_${i}`, pin: 0 }, to: { nodeId: `g_or1_${i}`, pin: 0 } },
      { id: `w_t_or_${i}`, from: { nodeId: `g_and2_${i}`, pin: 0 }, to: { nodeId: `g_or1_${i}`, pin: 1 } },
      // Sum output wire
      { id: `w_s_out_${i}`, from: { nodeId: `g_xor2_${i}`, pin: 0 }, to: { nodeId: `out_s_${i}`, pin: 0 } }
    );
  }

  // Final Cout output terminal
  const lastOrId = `g_or1_${count - 1}`;
  nodes.push({
    id: 'out_cout',
    kind: 'output',
    label: 'COUT',
    x: 760,
    y: 120 + (count - 1) * 220 + 110,
  });
  wires.push({
    id: 'w_final_cout',
    from: { nodeId: lastOrId, pin: 0 },
    to: { nodeId: 'out_cout', pin: 0 },
  });

  return { nodes, wires };
}

/**
 * Returns the exact correspondence between carry chain gates and circuit nodes.
 */
export function getGateCorrespondence(width: number): readonly GateCorrespondence[] {
  const result: GateCorrespondence[] = [];
  for (let i = 0; i < width; i++) {
    result.push(
      {
        carryChainGateId: `g_sub_${i}`,
        circuitNodeId: `g_sub_${i}`,
        bitIndex: i,
        role: 'sub_invert',
      },
      {
        carryChainGateId: `g_xor1_${i}`,
        circuitNodeId: `g_xor1_${i}`,
        bitIndex: i,
        role: 'propagate',
      },
      {
        carryChainGateId: `g_and1_${i}`,
        circuitNodeId: `g_and1_${i}`,
        bitIndex: i,
        role: 'generate',
      },
      {
        carryChainGateId: `g_xor2_${i}`,
        circuitNodeId: `g_xor2_${i}`,
        bitIndex: i,
        role: 'sum',
      },
      {
        carryChainGateId: `g_and2_${i}`,
        circuitNodeId: `g_and2_${i}`,
        bitIndex: i,
        role: 'carry_transfer',
      },
      {
        carryChainGateId: `g_or1_${i}`,
        circuitNodeId: `g_or1_${i}`,
        bitIndex: i,
        role: 'carry_out',
      }
    );
  }
  return result;
}

/**
 * Looks up the circuit component ID corresponding to a given carry chain gate ID.
 */
export function getCircuitNodeForGateId(gateId: string, width: number): string | undefined {
  const correspondence = getGateCorrespondence(width);
  const match = correspondence.find((c) => c.carryChainGateId === gateId);
  return match?.circuitNodeId;
}
