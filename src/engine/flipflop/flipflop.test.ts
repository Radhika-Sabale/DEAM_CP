/**
 * @file flipflop.test.ts
 * Integration tests and gate-level cross-checks comparing the high-level
 * Flip-Flop simulation engine against the discrete-event Circuit engine.
 *
 * ARCHITECTURAL NOTE:
 * This test file is the only file in src/engine/flipflop permitted to import
 * from src/engine/circuit.
 */

import { describe, expect, it } from 'vitest';
import type { LogicValue } from '../../types/ast';
import { gatedDLatchNand, masterSlaveDFlipFlop } from '../circuit/examples';
import { CircuitSimulator } from '../circuit/simulator';
import { createPrng, prngChoice } from '../common/seededRandom';
import { defaultConfig, type FlipFlopConfig } from './models';
import { simulateTimeline, type FlipFlopScript, type FlipFlopScriptEvent } from './stepper';

describe('Gate-Level Circuit Engine Cross-Checks', () => {
  it('(a) cross-checks masterSlaveDFlipFlop circuit against D rising-edge model over 50 seeded cycles', () => {
    const prng = createPrng(44556677);

    // Instantiate gate-level master-slave D flip-flop circuit (clk halfPeriod = 10, rising at t=10, 30, 50...)
    const circuitGraph = masterSlaveDFlipFlop();
    const sim = new CircuitSimulator(circuitGraph, { delayMode: 'unit' });

    const ffConfig: FlipFlopConfig = {
      ...defaultConfig('D'),
      trigger: 'rising',
      propagationDelay: 1,
    };

    const timelineEvents: FlipFlopScriptEvent[] = [];
    let currentD: LogicValue = 0;
    let expectedQ: LogicValue = 0;

    // Simulation loop over 50 clock cycles (period = 20: low [0, 10), high [10, 20))
    for (let cycle = 0; cycle < 50; cycle++) {
      const cycleStart = cycle * 20;
      const risingEdgeTime = cycleStart + 10;
      const dChangeTime = cycleStart + 5; // D changes while CLK is LOW

      currentD = prngChoice(prng, [0, 1]) ?? 0;
      sim.setInput('in_d', currentD);
      timelineEvents.push({ time: dChangeTime, signal: 'D', value: currentD });
      timelineEvents.push({ time: risingEdgeTime, signal: 'CLK', value: 1 });

      // Advance past rising edge to settle gates
      sim.advanceTo(risingEdgeTime + 5);

      const circuitQ = sim.getNodeValue('out_q');
      expectedQ = currentD;
      expect(circuitQ, `Cycle ${cycle} rising edge mismatch`).toBe(expectedQ);

      // Change D while CLK is HIGH (must NOT change output in edge-triggered flip-flop)
      const midHighTime = risingEdgeTime + 6;
      const oppositeD: LogicValue = currentD === 1 ? 0 : 1;
      sim.setInput('in_d', oppositeD);
      timelineEvents.push({ time: midHighTime, signal: 'D', value: oppositeD });

      sim.advanceTo(risingEdgeTime + 8);
      const circuitQAfterMidChange = sim.getNodeValue('out_q');
      expect(
        circuitQAfterMidChange,
        `Cycle ${cycle} output changed while CLK was high!`
      ).toBe(expectedQ);

      // Falling clock edge at end of cycle
      const fallingEdgeTime = cycleStart + 20;
      timelineEvents.push({ time: fallingEdgeTime, signal: 'CLK', value: 0 });
      sim.advanceTo(fallingEdgeTime);
    }

    // Run high-level simulator over the complete timeline
    const script: FlipFlopScript = {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { D: 0 },
      events: timelineEvents,
      endTime: 50 * 20,
    };

    const hlRes = simulateTimeline(ffConfig, script);
    expect(hlRes.ok).toBe(true);
    if (!hlRes.ok) return;

    expect(hlRes.finalState.q).toBe(expectedQ);
    expect(sim.getNodeValue('out_q')).toBe(expectedQ);
  });

  it('(b) cross-checks gatedDLatchNand circuit against D level-high model over seeded sequences', () => {
    const prng = createPrng(11223344);

    const circuitGraph = gatedDLatchNand();
    const sim = new CircuitSimulator(circuitGraph, { delayMode: 'unit' });

    const ffConfig: FlipFlopConfig = {
      ...defaultConfig('D'),
      trigger: 'level-high',
      propagationDelay: 0,
    };

    let currentTime = 0;
    sim.setInput('in_d', 0);
    sim.setInput('in_e', 0);
    sim.advanceTo(10);
    currentTime = 10;

    for (let step = 0; step < 30; step++) {
      const dVal: LogicValue = prngChoice(prng, [0, 1]) ?? 0;
      const enableVal: LogicValue = prngChoice(prng, [0, 1]) ?? 0;

      sim.setInput('in_d', dVal);
      sim.setInput('in_e', enableVal);
      sim.advanceTo(currentTime + 10);
      currentTime += 10;

      const script: FlipFlopScript = {
        initialQ: 0,
        initialClock: enableVal,
        initialInputs: { D: dVal },
        events: [],
        endTime: 5,
      };

      const hlRes = simulateTimeline(ffConfig, script);
      expect(hlRes.ok).toBe(true);
      if (!hlRes.ok) continue;

      if (enableVal === 1) {
        // Transparent: Q follows D
        expect(sim.getNodeValue('out_q')).toBe(dVal);
        expect(hlRes.finalState.q).toBe(dVal);
      }
    }
  });
});
