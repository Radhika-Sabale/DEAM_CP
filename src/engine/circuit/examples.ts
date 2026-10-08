/**
 * @file examples.ts
 * Production reference digital circuit graphs.
 * Reused by the UI Examples menu and verification tests.
 */

import type { CircuitGraph, CircuitNode, CircuitWire } from '../../types/circuit';

/**
 * Builds a 1-bit Half Adder circuit graph.
 *
 * @returns CircuitGraph with 2 inputs (A, B), 2 gates (XOR, AND), 2 outputs (S, Cout)
 */
export function halfAdder(): CircuitGraph {
  const nodes: CircuitNode[] = [
    { id: 'in_a', kind: 'input', label: 'A', value: 0, x: 80, y: 100 },
    { id: 'in_b', kind: 'input', label: 'B', value: 0, x: 80, y: 180 },
    { id: 'g_xor', kind: 'gate', gateType: 'XOR', inputCount: 2, x: 260, y: 100 },
    { id: 'g_and', kind: 'gate', gateType: 'AND', inputCount: 2, x: 260, y: 180 },
    { id: 'out_s', kind: 'output', label: 'S', x: 440, y: 100 },
    { id: 'out_cout', kind: 'output', label: 'Cout', x: 440, y: 180 },
  ];

  const wires: CircuitWire[] = [
    { id: 'w1', from: { nodeId: 'in_a', pin: 0 }, to: { nodeId: 'g_xor', pin: 0 } },
    { id: 'w2', from: { nodeId: 'in_b', pin: 0 }, to: { nodeId: 'g_xor', pin: 1 } },
    { id: 'w3', from: { nodeId: 'in_a', pin: 0 }, to: { nodeId: 'g_and', pin: 0 } },
    { id: 'w4', from: { nodeId: 'in_b', pin: 0 }, to: { nodeId: 'g_and', pin: 1 } },
    { id: 'w5', from: { nodeId: 'g_xor', pin: 0 }, to: { nodeId: 'out_s', pin: 0 } },
    { id: 'w6', from: { nodeId: 'g_and', pin: 0 }, to: { nodeId: 'out_cout', pin: 0 } },
  ];

  return { nodes, wires };
}

/**
 * Builds a 1-bit Full Adder circuit graph containing exactly 5 logic gates.
 *
 * @returns CircuitGraph with 3 inputs (A, B, Cin), 5 gates (2 XOR, 2 AND, 1 OR), 2 outputs (S, Cout)
 */
export function fullAdder(): CircuitGraph {
  const nodes: CircuitNode[] = [
    { id: 'in_a', kind: 'input', label: 'A', value: 0, x: 80, y: 100 },
    { id: 'in_b', kind: 'input', label: 'B', value: 0, x: 80, y: 180 },
    { id: 'in_cin', kind: 'input', label: 'Cin', value: 0, x: 80, y: 260 },
    { id: 'g_xor1', kind: 'gate', gateType: 'XOR', inputCount: 2, x: 240, y: 140 },
    { id: 'g_xor2', kind: 'gate', gateType: 'XOR', inputCount: 2, x: 400, y: 140 },
    { id: 'g_and1', kind: 'gate', gateType: 'AND', inputCount: 2, x: 240, y: 240 },
    { id: 'g_and2', kind: 'gate', gateType: 'AND', inputCount: 2, x: 400, y: 220 },
    { id: 'g_or1', kind: 'gate', gateType: 'OR', inputCount: 2, x: 560, y: 230 },
    { id: 'out_s', kind: 'output', label: 'S', x: 560, y: 140 },
    { id: 'out_cout', kind: 'output', label: 'Cout', x: 700, y: 230 },
  ];

  const wires: CircuitWire[] = [
    { id: 'w1', from: { nodeId: 'in_a', pin: 0 }, to: { nodeId: 'g_xor1', pin: 0 } },
    { id: 'w2', from: { nodeId: 'in_b', pin: 0 }, to: { nodeId: 'g_xor1', pin: 1 } },
    { id: 'w3', from: { nodeId: 'g_xor1', pin: 0 }, to: { nodeId: 'g_xor2', pin: 0 } },
    { id: 'w4', from: { nodeId: 'in_cin', pin: 0 }, to: { nodeId: 'g_xor2', pin: 1 } },
    { id: 'w5', from: { nodeId: 'g_xor2', pin: 0 }, to: { nodeId: 'out_s', pin: 0 } },
    { id: 'w6', from: { nodeId: 'in_a', pin: 0 }, to: { nodeId: 'g_and1', pin: 0 } },
    { id: 'w7', from: { nodeId: 'in_b', pin: 0 }, to: { nodeId: 'g_and1', pin: 1 } },
    { id: 'w8', from: { nodeId: 'g_xor1', pin: 0 }, to: { nodeId: 'g_and2', pin: 0 } },
    { id: 'w9', from: { nodeId: 'in_cin', pin: 0 }, to: { nodeId: 'g_and2', pin: 1 } },
    { id: 'w10', from: { nodeId: 'g_and1', pin: 0 }, to: { nodeId: 'g_or1', pin: 0 } },
    { id: 'w11', from: { nodeId: 'g_and2', pin: 0 }, to: { nodeId: 'g_or1', pin: 1 } },
    { id: 'w12', from: { nodeId: 'g_or1', pin: 0 }, to: { nodeId: 'out_cout', pin: 0 } },
  ];

  return { nodes, wires };
}

/**
 * Builds an n-bit Ripple-Carry Adder composed of cascaded 5-gate Full Adders.
 *
 * @param bits Number of adder stages (bits >= 1, 5 gates per bit)
 * @returns CircuitGraph with inputs A0..A{n-1}, B0..B{n-1}, Cin, and outputs S0..S{n-1}, Cout
 */
export function rippleCarryAdder(bits: number): CircuitGraph {
  const count = Math.max(1, Math.floor(bits));
  const nodes: CircuitNode[] = [];
  const wires: CircuitWire[] = [];

  nodes.push({ id: 'in_cin', kind: 'input', label: 'Cin', value: 0, x: 80, y: 40 });

  for (let i = 0; i < count; i++) {
    const yBase = 120 + i * 180;
    nodes.push(
      { id: `in_a_${i}`, kind: 'input', label: `A${i}`, value: 0, x: 80, y: yBase },
      { id: `in_b_${i}`, kind: 'input', label: `B${i}`, value: 0, x: 80, y: yBase + 60 },
      { id: `g_xor1_${i}`, kind: 'gate', gateType: 'XOR', inputCount: 2, x: 220, y: yBase + 20 },
      { id: `g_xor2_${i}`, kind: 'gate', gateType: 'XOR', inputCount: 2, x: 360, y: yBase + 20 },
      { id: `g_and1_${i}`, kind: 'gate', gateType: 'AND', inputCount: 2, x: 220, y: yBase + 100 },
      { id: `g_and2_${i}`, kind: 'gate', gateType: 'AND', inputCount: 2, x: 360, y: yBase + 90 },
      { id: `g_or1_${i}`, kind: 'gate', gateType: 'OR', inputCount: 2, x: 480, y: yBase + 95 },
      { id: `out_s_${i}`, kind: 'output', label: `S${i}`, x: 500, y: yBase + 20 }
    );

    const prevCarryNodeId = i === 0 ? 'in_cin' : `g_or1_${i - 1}`;

    wires.push(
      { id: `w_a_x1_${i}`, from: { nodeId: `in_a_${i}`, pin: 0 }, to: { nodeId: `g_xor1_${i}`, pin: 0 } },
      { id: `w_b_x1_${i}`, from: { nodeId: `in_b_${i}`, pin: 0 }, to: { nodeId: `g_xor1_${i}`, pin: 1 } },
      { id: `w_x1_x2_${i}`, from: { nodeId: `g_xor1_${i}`, pin: 0 }, to: { nodeId: `g_xor2_${i}`, pin: 0 } },
      { id: `w_cin_x2_${i}`, from: { nodeId: prevCarryNodeId, pin: 0 }, to: { nodeId: `g_xor2_${i}`, pin: 1 } },
      { id: `w_x2_s_${i}`, from: { nodeId: `g_xor2_${i}`, pin: 0 }, to: { nodeId: `out_s_${i}`, pin: 0 } },
      { id: `w_a_a1_${i}`, from: { nodeId: `in_a_${i}`, pin: 0 }, to: { nodeId: `g_and1_${i}`, pin: 0 } },
      { id: `w_b_a1_${i}`, from: { nodeId: `in_b_${i}`, pin: 0 }, to: { nodeId: `g_and1_${i}`, pin: 1 } },
      { id: `w_x1_a2_${i}`, from: { nodeId: `g_xor1_${i}`, pin: 0 }, to: { nodeId: `g_and2_${i}`, pin: 0 } },
      { id: `w_cin_a2_${i}`, from: { nodeId: prevCarryNodeId, pin: 0 }, to: { nodeId: `g_and2_${i}`, pin: 1 } },
      { id: `w_a1_or_${i}`, from: { nodeId: `g_and1_${i}`, pin: 0 }, to: { nodeId: `g_or1_${i}`, pin: 0 } },
      { id: `w_a2_or_${i}`, from: { nodeId: `g_and2_${i}`, pin: 0 }, to: { nodeId: `g_or1_${i}`, pin: 1 } }
    );
  }

  const lastOrId = `g_or1_${count - 1}`;
  nodes.push({ id: 'out_cout', kind: 'output', label: 'Cout', x: 620, y: 120 + (count - 1) * 180 + 95 });
  wires.push({ id: 'w_final_cout', from: { nodeId: lastOrId, pin: 0 }, to: { nodeId: 'out_cout', pin: 0 } });

  return { nodes, wires };
}

/**
 * Builds a 2-input XOR logic function using exactly 4 2-input NAND gates.
 *
 * @returns CircuitGraph with inputs A, B, 4 NAND gates, and output OUT
 */
export function xorFromNands(): CircuitGraph {
  const nodes: CircuitNode[] = [
    { id: 'in_a', kind: 'input', label: 'A', value: 0, x: 80, y: 100 },
    { id: 'in_b', kind: 'input', label: 'B', value: 0, x: 80, y: 220 },
    { id: 'g_nand1', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 220, y: 160 },
    { id: 'g_nand2', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 360, y: 100 },
    { id: 'g_nand3', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 360, y: 220 },
    { id: 'g_nand4', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 500, y: 160 },
    { id: 'out_y', kind: 'output', label: 'OUT', x: 640, y: 160 },
  ];

  const wires: CircuitWire[] = [
    { id: 'w1', from: { nodeId: 'in_a', pin: 0 }, to: { nodeId: 'g_nand1', pin: 0 } },
    { id: 'w2', from: { nodeId: 'in_b', pin: 0 }, to: { nodeId: 'g_nand1', pin: 1 } },
    { id: 'w3', from: { nodeId: 'in_a', pin: 0 }, to: { nodeId: 'g_nand2', pin: 0 } },
    { id: 'w4', from: { nodeId: 'g_nand1', pin: 0 }, to: { nodeId: 'g_nand2', pin: 1 } },
    { id: 'w5', from: { nodeId: 'g_nand1', pin: 0 }, to: { nodeId: 'g_nand3', pin: 0 } },
    { id: 'w6', from: { nodeId: 'in_b', pin: 0 }, to: { nodeId: 'g_nand3', pin: 1 } },
    { id: 'w7', from: { nodeId: 'g_nand2', pin: 0 }, to: { nodeId: 'g_nand4', pin: 0 } },
    { id: 'w8', from: { nodeId: 'g_nand3', pin: 0 }, to: { nodeId: 'g_nand4', pin: 1 } },
    { id: 'w9', from: { nodeId: 'g_nand4', pin: 0 }, to: { nodeId: 'out_y', pin: 0 } },
  ];

  return { nodes, wires };
}

/**
 * Builds an active-high Set-Reset (SR) Latch from 2 cross-coupled NOR gates.
 *
 * @returns CircuitGraph with inputs S, R, 2 NOR gates, and outputs Q, Qbar
 */
export function srLatchNor(): CircuitGraph {
  const nodes: CircuitNode[] = [
    { id: 'in_r', kind: 'input', label: 'R', value: 0, x: 80, y: 100 },
    { id: 'in_s', kind: 'input', label: 'S', value: 0, x: 80, y: 220 },
    { id: 'g_nor1', kind: 'gate', gateType: 'NOR', inputCount: 2, x: 260, y: 110 },
    { id: 'g_nor2', kind: 'gate', gateType: 'NOR', inputCount: 2, x: 260, y: 210 },
    { id: 'out_q', kind: 'output', label: 'Q', x: 440, y: 110 },
    { id: 'out_qbar', kind: 'output', label: 'Qbar', x: 440, y: 210 },
  ];

  const wires: CircuitWire[] = [
    { id: 'w1', from: { nodeId: 'in_r', pin: 0 }, to: { nodeId: 'g_nor1', pin: 0 } },
    { id: 'w2', from: { nodeId: 'g_nor2', pin: 0 }, to: { nodeId: 'g_nor1', pin: 1 } },
    { id: 'w3', from: { nodeId: 'in_s', pin: 0 }, to: { nodeId: 'g_nor2', pin: 0 } },
    { id: 'w4', from: { nodeId: 'g_nor1', pin: 0 }, to: { nodeId: 'g_nor2', pin: 1 } },
    { id: 'w5', from: { nodeId: 'g_nor1', pin: 0 }, to: { nodeId: 'out_q', pin: 0 } },
    { id: 'w6', from: { nodeId: 'g_nor2', pin: 0 }, to: { nodeId: 'out_qbar', pin: 0 } },
  ];

  return { nodes, wires };
}

/**
 * Builds a Level-Sensitive Gated D Latch using 4 NAND gates.
 *
 * @returns CircuitGraph with inputs D, E, 4 NAND gates, and outputs Q, Qbar
 */
export function gatedDLatchNand(): CircuitGraph {
  const nodes: CircuitNode[] = [
    { id: 'in_d', kind: 'input', label: 'D', value: 0, x: 80, y: 100 },
    { id: 'in_e', kind: 'input', label: 'E', value: 0, x: 80, y: 220 },
    { id: 'g_nand1', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 240, y: 110 },
    { id: 'g_nand2', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 240, y: 210 },
    { id: 'g_nand3', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 420, y: 110 },
    { id: 'g_nand4', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 420, y: 210 },
    { id: 'out_q', kind: 'output', label: 'Q', x: 580, y: 110 },
    { id: 'out_qbar', kind: 'output', label: 'Qbar', x: 580, y: 210 },
  ];

  const wires: CircuitWire[] = [
    { id: 'w1', from: { nodeId: 'in_d', pin: 0 }, to: { nodeId: 'g_nand1', pin: 0 } },
    { id: 'w2', from: { nodeId: 'in_e', pin: 0 }, to: { nodeId: 'g_nand1', pin: 1 } },
    { id: 'w3', from: { nodeId: 'g_nand1', pin: 0 }, to: { nodeId: 'g_nand2', pin: 0 } },
    { id: 'w4', from: { nodeId: 'in_e', pin: 0 }, to: { nodeId: 'g_nand2', pin: 1 } },
    { id: 'w5', from: { nodeId: 'g_nand1', pin: 0 }, to: { nodeId: 'g_nand3', pin: 0 } },
    { id: 'w6', from: { nodeId: 'g_nand4', pin: 0 }, to: { nodeId: 'g_nand3', pin: 1 } },
    { id: 'w7', from: { nodeId: 'g_nand2', pin: 0 }, to: { nodeId: 'g_nand4', pin: 0 } },
    { id: 'w8', from: { nodeId: 'g_nand3', pin: 0 }, to: { nodeId: 'g_nand4', pin: 1 } },
    { id: 'w9', from: { nodeId: 'g_nand3', pin: 0 }, to: { nodeId: 'out_q', pin: 0 } },
    { id: 'w10', from: { nodeId: 'g_nand4', pin: 0 }, to: { nodeId: 'out_qbar', pin: 0 } },
  ];

  return { nodes, wires };
}

/**
 * Builds an Edge-Triggered Master-Slave D Flip-Flop.
 * Comprises two gated D latches (8 NAND gates) plus clock inverter.
 * Master captures on CLK=0, Slave updates output on CLK=1.
 *
 * @returns CircuitGraph with clock CLK, input D, 9 gates, and outputs Q, Qbar
 */
export function masterSlaveDFlipFlop(): CircuitGraph {
  const nodes: CircuitNode[] = [
    { id: 'clk_1', kind: 'clock', label: 'CLK', halfPeriod: 10, startValue: 0, x: 80, y: 160 },
    { id: 'in_d', kind: 'input', label: 'D', value: 0, x: 80, y: 80 },
    { id: 'g_not_clk', kind: 'gate', gateType: 'NOT', inputCount: 1, x: 200, y: 160 },
    // Master Latch (enabled by clk_bar)
    { id: 'g_m1', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 320, y: 80 },
    { id: 'g_m2', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 320, y: 180 },
    { id: 'g_m3', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 460, y: 80 },
    { id: 'g_m4', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 460, y: 180 },
    // Slave Latch (enabled by clk)
    { id: 'g_s1', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 600, y: 80 },
    { id: 'g_s2', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 600, y: 180 },
    { id: 'g_s3', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 740, y: 80 },
    { id: 'g_s4', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 740, y: 180 },
    { id: 'out_q', kind: 'output', label: 'Q', x: 880, y: 80 },
    { id: 'out_qbar', kind: 'output', label: 'Qbar', x: 880, y: 180 },
  ];

  const wires: CircuitWire[] = [
    // Clock inverter
    { id: 'w_clk_inv', from: { nodeId: 'clk_1', pin: 0 }, to: { nodeId: 'g_not_clk', pin: 0 } },
    // Master connections
    { id: 'wm1', from: { nodeId: 'in_d', pin: 0 }, to: { nodeId: 'g_m1', pin: 0 } },
    { id: 'wm2', from: { nodeId: 'g_not_clk', pin: 0 }, to: { nodeId: 'g_m1', pin: 1 } },
    { id: 'wm3', from: { nodeId: 'g_m1', pin: 0 }, to: { nodeId: 'g_m2', pin: 0 } },
    { id: 'wm4', from: { nodeId: 'g_not_clk', pin: 0 }, to: { nodeId: 'g_m2', pin: 1 } },
    { id: 'wm5', from: { nodeId: 'g_m1', pin: 0 }, to: { nodeId: 'g_m3', pin: 0 } },
    { id: 'wm6', from: { nodeId: 'g_m4', pin: 0 }, to: { nodeId: 'g_m3', pin: 1 } },
    { id: 'wm7', from: { nodeId: 'g_m2', pin: 0 }, to: { nodeId: 'g_m4', pin: 0 } },
    { id: 'wm8', from: { nodeId: 'g_m3', pin: 0 }, to: { nodeId: 'g_m4', pin: 1 } },
    // Slave connections (fed from master Q_m = g_m3)
    { id: 'ws1', from: { nodeId: 'g_m3', pin: 0 }, to: { nodeId: 'g_s1', pin: 0 } },
    { id: 'ws2', from: { nodeId: 'clk_1', pin: 0 }, to: { nodeId: 'g_s1', pin: 1 } },
    { id: 'ws3', from: { nodeId: 'g_s1', pin: 0 }, to: { nodeId: 'g_s2', pin: 0 } },
    { id: 'ws4', from: { nodeId: 'clk_1', pin: 0 }, to: { nodeId: 'g_s2', pin: 1 } },
    { id: 'ws5', from: { nodeId: 'g_s1', pin: 0 }, to: { nodeId: 'g_s3', pin: 0 } },
    { id: 'ws6', from: { nodeId: 'g_s4', pin: 0 }, to: { nodeId: 'g_s3', pin: 1 } },
    { id: 'ws7', from: { nodeId: 'g_s2', pin: 0 }, to: { nodeId: 'g_s4', pin: 0 } },
    { id: 'ws8', from: { nodeId: 'g_s3', pin: 0 }, to: { nodeId: 'g_s4', pin: 1 } },
    // Outputs
    { id: 'wq', from: { nodeId: 'g_s3', pin: 0 }, to: { nodeId: 'out_q', pin: 0 } },
    { id: 'wqb', from: { nodeId: 'g_s4', pin: 0 }, to: { nodeId: 'out_qbar', pin: 0 } },
  ];

  return { nodes, wires };
}
