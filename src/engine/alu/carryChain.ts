/**
 * @file carryChain.ts
 * Gate-level ripple-carry adder/subtractor datapath model and verification oracle.
 *
 * Models a hardware ripple-carry adder built from cascaded 2-gate half adders
 * and an input XOR negation stage for two's-complement subtraction.
 *
 * Delay model: Each full adder stage contributes exactly 2 gate levels along the carry propagation path
 * (t_i = AND(p_i, c_i) -> c_{i+1} = OR(g_i, t_i)).
 */

import { getBit } from '../common/bitUtils';
import type {
  CarryChainBit,
  CarryChainModel,
  ChainVerificationResult,
  GateTraceStep,
} from './types';

/**
 * Builds a deterministic gate-level carry chain model for addition or subtraction.
 *
 * @param a Unsigned operand A
 * @param b Unsigned operand B
 * @param width Data width in bits (2..16)
 * @param isSubtract True if performing subtraction (A - B = A + ~B + 1)
 */
export function buildCarryChain(
  a: number,
  b: number,
  width: number,
  isSubtract: boolean
): CarryChainModel {
  const subBit: 0 | 1 = isSubtract ? 1 : 0;
  const gates: GateTraceStep[] = [];
  const bits: CarryChainBit[] = [];
  const carryVector: (0 | 1)[] = [subBit];
  const sumBits: (0 | 1)[] = [];

  let currentCarry: 0 | 1 = subBit;

  for (let i = 0; i < width; i++) {
    const bitA = getBit(a, i);
    const rawBitB = getBit(b, i);
    const effBitB = (rawBitB ^ subBit) as 0 | 1;

    // Stage 1: Conditional negation of B for subtraction
    const subGate: GateTraceStep = {
      id: `g_sub_${i}`,
      gate: 'XOR',
      inputs: [
        { name: `B${i}`, value: rawBitB },
        { name: 'SUB', value: subBit },
      ],
      output: { name: `b_eff_${i}`, value: effBitB },
    };
    gates.push(subGate);

    // Half Adder 1: Propagate and Generate
    const pVal = (bitA ^ effBitB) as 0 | 1;
    const gVal = (bitA & effBitB) as 0 | 1;

    const xor1Gate: GateTraceStep = {
      id: `g_xor1_${i}`,
      gate: 'XOR',
      inputs: [
        { name: `A${i}`, value: bitA },
        { name: `b_eff_${i}`, value: effBitB },
      ],
      output: { name: `p_${i}`, value: pVal },
    };
    const and1Gate: GateTraceStep = {
      id: `g_and1_${i}`,
      gate: 'AND',
      inputs: [
        { name: `A${i}`, value: bitA },
        { name: `b_eff_${i}`, value: effBitB },
      ],
      output: { name: `g_${i}`, value: gVal },
    };
    gates.push(xor1Gate, and1Gate);

    // Half Adder 2: Sum bit and Carry transfer
    const sVal = (pVal ^ currentCarry) as 0 | 1;
    const tVal = (pVal & currentCarry) as 0 | 1;

    const xor2Gate: GateTraceStep = {
      id: `g_xor2_${i}`,
      gate: 'XOR',
      inputs: [
        { name: `p_${i}`, value: pVal },
        { name: `c_${i}`, value: currentCarry },
      ],
      output: { name: `S${i}`, value: sVal },
    };
    const and2Gate: GateTraceStep = {
      id: `g_and2_${i}`,
      gate: 'AND',
      inputs: [
        { name: `p_${i}`, value: pVal },
        { name: `c_${i}`, value: currentCarry },
      ],
      output: { name: `t_${i}`, value: tVal },
    };
    gates.push(xor2Gate, and2Gate);

    // Carry out OR stage
    const nextCarry = (gVal | tVal) as 0 | 1;
    const or1Gate: GateTraceStep = {
      id: `g_or1_${i}`,
      gate: 'OR',
      inputs: [
        { name: `g_${i}`, value: gVal },
        { name: `t_${i}`, value: tVal },
      ],
      output: { name: `c_${i + 1}`, value: nextCarry },
    };
    gates.push(or1Gate);

    // Classify bit role for pedagogical feedback
    const role: 'generate' | 'propagate' | 'kill' =
      bitA === 1 && effBitB === 1
        ? 'generate'
        : pVal === 1
        ? 'propagate'
        : 'kill';

    bits.push({
      bitIndex: i,
      a: bitA,
      b: effBitB,
      carryIn: currentCarry,
      sum: sVal,
      carryOut: nextCarry,
      role,
    });

    sumBits.push(sVal);
    carryVector.push(nextCarry);
    currentCarry = nextCarry;
  }

  // 2 gate levels per bit along the carry ripple chain (AND -> OR)
  const delayLevels = width * 2;

  return {
    bits,
    gates,
    carryVector,
    sumBits,
    delayLevels,
  };
}

/**
 * Verifies that every gate in a carry chain produces an output that exactly
 * matches its Boolean truth table. Returns the first inconsistency found.
 */
export function verifyChain(chain: CarryChainModel): ChainVerificationResult {
  for (const step of chain.gates) {
    let expected: 0 | 1;
    switch (step.gate) {
      case 'XOR': {
        const in0 = step.inputs[0]?.value ?? 0;
        const in1 = step.inputs[1]?.value ?? 0;
        expected = (in0 ^ in1) as 0 | 1;
        break;
      }
      case 'AND': {
        const in0 = step.inputs[0]?.value ?? 0;
        const in1 = step.inputs[1]?.value ?? 0;
        expected = (in0 & in1) as 0 | 1;
        break;
      }
      case 'OR': {
        const in0 = step.inputs[0]?.value ?? 0;
        const in1 = step.inputs[1]?.value ?? 0;
        expected = (in0 | in1) as 0 | 1;
        break;
      }
      case 'NOT': {
        const in0 = step.inputs[0]?.value ?? 0;
        expected = (in0 === 1 ? 0 : 1) as 0 | 1;
        break;
      }
    }

    if (step.output.value !== expected) {
      return {
        valid: false,
        failedGateId: step.id,
        expected,
        actual: step.output.value,
        message: `Gate ${step.id} (${step.gate}) evaluated to ${step.output.value}, expected ${expected}`,
      };
    }
  }

  return { valid: true };
}
