/**
 * @file circuit.test.ts
 * Comprehensive behavioral tests on reference digital circuits.
 */

import { describe, expect, it } from 'vitest';
import type { LogicValue } from '../../types/ast';
import { createPrng, prngInt } from '../common/seededRandom';
import {
  fullAdder,
  gatedDLatchNand,
  halfAdder,
  masterSlaveDFlipFlop,
  rippleCarryAdder,
  srLatchNor,
  xorFromNands,
} from './examples';
import { createSimulator } from './simulator';
import { validateCircuit } from './validate';

describe('Reference Digital Circuits (Examples)', () => {
  it('1. all reference examples validate cleanly with zero errors', () => {
    expect(validateCircuit(halfAdder(), { allowFeedback: false }).hasErrors).toBe(false);
    expect(validateCircuit(fullAdder(), { allowFeedback: false }).hasErrors).toBe(false);
    expect(validateCircuit(rippleCarryAdder(4), { allowFeedback: false }).hasErrors).toBe(false);
    expect(validateCircuit(rippleCarryAdder(10), { allowFeedback: false }).hasErrors).toBe(false);
    expect(validateCircuit(xorFromNands(), { allowFeedback: false }).hasErrors).toBe(false);

    expect(validateCircuit(srLatchNor(), { allowFeedback: true }).hasErrors).toBe(false);
    expect(validateCircuit(gatedDLatchNand(), { allowFeedback: true }).hasErrors).toBe(false);
    expect(validateCircuit(masterSlaveDFlipFlop(), { allowFeedback: true }).hasErrors).toBe(false);
  });

  it('2. half adder and 4-NAND XOR exhaustively match truth tables', () => {
    const ha = halfAdder();
    const xorNand = xorFromNands();

    for (const a of [0, 1] as const) {
      for (const b of [0, 1] as const) {
        const simHa = createSimulator(ha, { delayMode: 'zero' });
        expect(simHa.ok).toBe(true);
        if (!simHa.ok) return;
        simHa.sim.setInput('in_a', a);
        simHa.sim.setInput('in_b', b);
        simHa.sim.settle();
        expect(simHa.sim.getNodeValue('out_s')).toBe(a ^ b);
        expect(simHa.sim.getNodeValue('out_cout')).toBe(a & b);

        const simXor = createSimulator(xorNand, { delayMode: 'zero' });
        expect(simXor.ok).toBe(true);
        if (!simXor.ok) return;
        simXor.sim.setInput('in_a', a);
        simXor.sim.setInput('in_b', b);
        simXor.sim.settle();
        expect(simXor.sim.getNodeValue('out_y')).toBe(a ^ b);
      }
    }
  });

  it('3. full adder exhaustively matches 3-input addition truth table', () => {
    const fa = fullAdder();
    for (const a of [0, 1] as const) {
      for (const b of [0, 1] as const) {
        for (const cin of [0, 1] as const) {
          const sim = createSimulator(fa, { delayMode: 'zero' });
          expect(sim.ok).toBe(true);
          if (!sim.ok) return;
          sim.sim.setInput('in_a', a);
          sim.sim.setInput('in_b', b);
          sim.sim.setInput('in_cin', cin);
          sim.sim.settle();

          const sum = a + b + cin;
          expect(sim.sim.getNodeValue('out_s')).toBe(sum & 1);
          expect(sim.sim.getNodeValue('out_cout')).toBe((sum >> 1) & 1);
        }
      }
    }
  });

  it('4. 4-bit ripple adder exhaustively matches all 512 arithmetic addition vectors (zero & unit delay)', () => {
    const adder = rippleCarryAdder(4);

    for (const delayMode of ['zero', 'unit'] as const) {
      const simRes = createSimulator(adder, { delayMode });
      expect(simRes.ok).toBe(true);
      if (!simRes.ok) return;
      const sim = simRes.sim;

      for (let a = 0; a < 16; a++) {
        for (let b = 0; b < 16; b++) {
          for (let cin = 0; cin < 2; cin++) {
            sim.setInput('in_cin', cin as LogicValue);
            for (let i = 0; i < 4; i++) {
              sim.setInput(`in_a_${i}`, ((a >> i) & 1) as LogicValue);
              sim.setInput(`in_b_${i}`, ((b >> i) & 1) as LogicValue);
            }
            sim.settle();

            let outSum = 0;
            for (let i = 0; i < 4; i++) {
              const bit = sim.getNodeValue(`out_s_${i}`);
              if (bit === 1) outSum |= 1 << i;
            }
            const cout = sim.getNodeValue('out_cout') === 1 ? 1 : 0;
            const total = outSum + (cout << 4);

            expect(total).toBe(a + b + cin);
          }
        }
      }
    }
  });

  it('5. SR latch accurately executes Set, Hold, Reset, Hold, Invalid State, and Metastability release', () => {
    const latch = srLatchNor();
    const simRes = createSimulator(latch, { delayMode: 'zero' });
    expect(simRes.ok).toBe(true);
    if (!simRes.ok) return;
    const sim = simRes.sim;

    // Set S=1, R=0 -> Q=1, Qbar=0
    sim.setInput('in_s', 1);
    sim.setInput('in_r', 0);
    sim.settle();
    expect(sim.getNodeValue('out_q')).toBe(1);
    expect(sim.getNodeValue('out_qbar')).toBe(0);

    // Hold S=0, R=0 -> retains Q=1, Qbar=0
    sim.setInput('in_s', 0);
    sim.setInput('in_r', 0);
    sim.settle();
    expect(sim.getNodeValue('out_q')).toBe(1);
    expect(sim.getNodeValue('out_qbar')).toBe(0);

    // Reset S=0, R=1 -> Q=0, Qbar=1
    sim.setInput('in_s', 0);
    sim.setInput('in_r', 1);
    sim.settle();
    expect(sim.getNodeValue('out_q')).toBe(0);
    expect(sim.getNodeValue('out_qbar')).toBe(1);

    // Hold S=0, R=0 -> retains Q=0, Qbar=1
    sim.setInput('in_s', 0);
    sim.setInput('in_r', 0);
    sim.settle();
    expect(sim.getNodeValue('out_q')).toBe(0);
    expect(sim.getNodeValue('out_qbar')).toBe(1);

    // S=1, R=1 -> both NOR outputs forced to 0
    sim.setInput('in_s', 1);
    sim.setInput('in_r', 1);
    sim.settle();
    expect(sim.getNodeValue('out_q')).toBe(0);
    expect(sim.getNodeValue('out_qbar')).toBe(0);

    // Releasing both simultaneously from S=R=1 to S=R=0 triggers symmetric oscillation
    const releaseTime = sim.time + 1;
    sim.scheduleInput(releaseTime, 'in_s', 0);
    sim.scheduleInput(releaseTime, 'in_r', 0);
    const advanceRes = sim.advanceTo(releaseTime);
    expect(advanceRes.status).toBe('oscillating');
    expect(sim.getNodeValue('out_q')).toBe('X');
    expect(sim.getNodeValue('out_qbar')).toBe('X');
  });

  it('6. master-slave D flip-flop maintains edge-triggered invariance over 50 seeded clock cycles', () => {
    const dff = masterSlaveDFlipFlop();
    const simRes = createSimulator(dff, { delayMode: 'unit' });
    expect(simRes.ok).toBe(true);
    if (!simRes.ok) return;
    const sim = simRes.sim;

    const prng = createPrng(0x4d53_6466);
    let expectedQ: LogicValue = 0;

    for (let cycle = 0; cycle < 50; cycle++) {
      const nextD: LogicValue = prngInt(prng, 0, 1) as LogicValue;
      // CLK cycle period is 20: CLK is 0 in [cycle*20, cycle*20+10), 1 in [cycle*20+10, cycle*20+20)
      // 1. Setup D while CLK is LOW at cycle*20 + 2
      const setupTime = cycle * 20 + 2;
      sim.advanceTo(setupTime);
      sim.setInput('in_d', nextD);

      // 2. Rising clock edge occurs at cycle*20 + 10
      const risingEdgeTime = cycle * 20 + 10;
      sim.advanceTo(risingEdgeTime + 5); // Allow slave latch to capture and settle
      expectedQ = nextD;
      expect(sim.getNodeValue('out_q')).toBe(expectedQ);
      expect(sim.getNodeValue('out_qbar')).toBe(expectedQ === 1 ? 0 : 1);

      // 3. Mutate D while CLK is HIGH (CLK remains 1 until cycle*20 + 20)
      const glitchD: LogicValue = (nextD === 1 ? 0 : 1) as LogicValue;
      sim.advanceTo(risingEdgeTime + 6);
      sim.setInput('in_d', glitchD);
      sim.advanceTo(risingEdgeTime + 8);

      // Output Q must remain invariant to D glitches while CLK is high
      expect(sim.getNodeValue('out_q')).toBe(expectedQ);
    }
  });
});
