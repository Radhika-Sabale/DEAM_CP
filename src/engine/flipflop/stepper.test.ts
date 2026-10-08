/**
 * @file stepper.test.ts
 * Comprehensive test suite for discrete-event flip-flop timeline simulator:
 * - Hand-checked scenarios for every flip-flop type and trigger mode.
 * - Sampling rule: data changes at the same instant as the clock edge are NOT captured.
 * - Independent naive tick-by-tick reference model vs simulateTimeline over 300 seeded scripts.
 * - Asynchronous controls: PRE, CLR, active-low/high, priority override, conflict, and release.
 * - Setup and hold timing violations.
 * - Unknown clock transitions (X).
 * - All error codes and input validation boundaries (including 10,000 event limit).
 * - Determinism, time-shift invariance, delay-shift invariance, and JSON round-trip stability.
 */

import { describe, expect, it } from 'vitest';
import type { LogicValue } from '../../types/ast';
import type { FlipFlopType, TriggerMode } from '../../types/sequential';
import { createPrng, prngChoice, prngInt } from '../common/seededRandom';
import { defaultConfig, inputNames, nextState, type FlipFlopConfig } from './models';
import {
  simulateTimeline,
  type FlipFlopScript,
  type FlipFlopScriptEvent,
} from './stepper';

describe('1. Hand-Checked Scenarios and Sampling Rule', () => {
  it('D flip-flop captures data on rising clock edge', () => {
    const config = defaultConfig('D'); // rising, delay 1
    const script: FlipFlopScript = {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { D: 0 },
      events: [
        { time: 5, signal: 'D', value: 1 },
        { time: 10, signal: 'CLK', value: 1 }, // rising edge at t=10
        { time: 20, signal: 'CLK', value: 0 },
      ],
      endTime: 30,
    };

    const res = simulateTimeline(config, script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.stats.activeEdgesCount).toBe(1);
    expect(res.stats.qTogglesCount).toBe(1);
    // Q updates to 1 at t = 10 + 1 = 11
    const qChanges = res.changes.filter((c) => c.nodeId === 'Q');
    expect(qChanges).toEqual([
      { time: 0, nodeId: 'Q', value: 0 },
      { time: 11, nodeId: 'Q', value: 1 },
    ]);
    expect(res.finalState.q).toBe(1);
  });

  it('SAMPLING RULE: D change at the exact same instant as rising edge is NOT captured', () => {
    const config = defaultConfig('D'); // rising, delay 1
    const script: FlipFlopScript = {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { D: 0 },
      events: [
        // Both D and CLK change at t = 10
        { time: 10, signal: 'D', value: 1 },
        { time: 10, signal: 'CLK', value: 1 },
      ],
      endTime: 20,
    };

    const res = simulateTimeline(config, script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Snapshot at t=10- was D=0, so Q remains 0
    expect(res.finalState.q).toBe(0);
    expect(res.stats.qTogglesCount).toBe(0);
  });

  it('T flip-flop divides clock frequency by 2 in toggle mode', () => {
    const config = defaultConfig('T'); // rising, delay 1
    const script: FlipFlopScript = {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { T: 1 },
      events: [
        { time: 10, signal: 'CLK', value: 1 }, // edge 1: 0 -> 1
        { time: 20, signal: 'CLK', value: 0 },
        { time: 30, signal: 'CLK', value: 1 }, // edge 2: 1 -> 0
        { time: 40, signal: 'CLK', value: 0 },
        { time: 50, signal: 'CLK', value: 1 }, // edge 3: 0 -> 1
        { time: 60, signal: 'CLK', value: 0 },
      ],
      endTime: 70,
    };

    const res = simulateTimeline(config, script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.stats.activeEdgesCount).toBe(3);
    expect(res.stats.qTogglesCount).toBe(3);
    expect(res.finalState.q).toBe(1);
    const qChanges = res.changes.filter((c) => c.nodeId === 'Q');
    expect(qChanges).toEqual([
      { time: 0, nodeId: 'Q', value: 0 },
      { time: 11, nodeId: 'Q', value: 1 },
      { time: 31, nodeId: 'Q', value: 0 },
      { time: 51, nodeId: 'Q', value: 1 },
    ]);
  });

  it('falling-edge JK flip-flop toggles on falling clock transitions', () => {
    const config: FlipFlopConfig = {
      ...defaultConfig('JK'),
      trigger: 'falling',
      propagationDelay: 2,
    };

    const script: FlipFlopScript = {
      initialQ: 0,
      initialClock: 1,
      initialInputs: { J: 1, K: 1 },
      events: [
        { time: 10, signal: 'CLK', value: 0 }, // falling edge at t=10
        { time: 20, signal: 'CLK', value: 1 },
      ],
      endTime: 30,
    };

    const res = simulateTimeline(config, script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.stats.activeEdgesCount).toBe(1);
    expect(res.finalState.q).toBe(1);
    const qChanges = res.changes.filter((c) => c.nodeId === 'Q');
    expect(qChanges).toEqual([
      { time: 0, nodeId: 'Q', value: 0 },
      { time: 12, nodeId: 'Q', value: 1 },
    ]);
  });
});

describe('2. Independent Naive Tick-by-Tick Reference Property Test', () => {
  // Independent naive simulation reference stepping tick by integer tick
  function naiveTickByTickSimulator(
    config: FlipFlopConfig,
    script: FlipFlopScript
  ): { finalQ: LogicValue; toggles: number } {
    const names = inputNames(config.type);
    const inputs: Record<string, LogicValue> = {};
    for (const n of names) inputs[n] = script.initialInputs?.[n] ?? 0;
    let clock: LogicValue = script.initialClock ?? 0;
    let q: LogicValue = script.initialQ ?? 'X';
    let toggles = 0;

    interface Pending {
      dueTime: number;
      targetQ: LogicValue;
    }
    const pendingList: Pending[] = [];

    for (let t = 0; t <= script.endTime; t++) {
      // 1. Apply scheduled updates landing at t
      const due = pendingList.filter((p) => p.dueTime === t);
      if (due.length > 0) {
        const last = due[due.length - 1];
        if (last && q !== last.targetQ) {
          q = last.targetQ;
          toggles++;
        }
      }

      // 2. Snapshot
      const snapInputs = { ...inputs };
      const snapClock = clock;

      // 3. Apply stimulus at t
      for (const ev of script.events) {
        if (ev.time === t) {
          if (names.includes(ev.signal)) {
            inputs[ev.signal] = ev.value;
          } else if (ev.signal === 'CLK') {
            clock = ev.value;
          }
        }
      }

      // 4. Clock eval
      if (config.trigger === 'rising') {
        if (snapClock === 0 && clock === 1) {
          const inVec = names.map((n) => snapInputs[n] ?? 0);
          const nq = nextState(config.type, inVec, q);
          if (config.propagationDelay === 0) {
            if (q !== nq) {
              q = nq;
              toggles++;
            }
          } else {
            pendingList.push({ dueTime: t + config.propagationDelay, targetQ: nq });
          }
        }
      } else if (config.trigger === 'falling') {
        if (snapClock === 1 && clock === 0) {
          const inVec = names.map((n) => snapInputs[n] ?? 0);
          const nq = nextState(config.type, inVec, q);
          if (config.propagationDelay === 0) {
            if (q !== nq) {
              q = nq;
              toggles++;
            }
          } else {
            pendingList.push({ dueTime: t + config.propagationDelay, targetQ: nq });
          }
        }
      }
    }

    return { finalQ: q, toggles };
  }

  it('matches naive tick reference across 300 seeded random scripts per trigger (delay 0 and 1)', () => {
    const prng = createPrng(987654321);
    const triggers: TriggerMode[] = ['rising', 'falling'];
    const types: FlipFlopType[] = ['SR', 'JK', 'D', 'T'];

    let count = 0;
    for (const trigger of triggers) {
      for (let i = 0; i < 300; i++) {
        const type = prngChoice(prng, types) ?? 'D';
        const delay = prngChoice(prng, [0, 1]) ?? 1;
        const names = inputNames(type);

        const config: FlipFlopConfig = {
          type,
          trigger,
          asyncControls: false,
          asyncActiveLow: true,
          propagationDelay: delay,
          setupTime: 0,
          holdTime: 0,
        };

        const initialInputs: Record<string, LogicValue> = {};
        for (const n of names) initialInputs[n] = prngChoice(prng, [0, 1]) ?? 0;

        const events: FlipFlopScriptEvent[] = [];
        let currTime = prngInt(prng, 1, 5);
        const eventCount = prngInt(prng, 3, 10);

        for (let j = 0; j < eventCount; j++) {
          const isClock = prng() < 0.5;
          const sig = isClock ? 'CLK' : (prngChoice(prng, names) ?? names[0]!);
          const val: LogicValue = prngChoice(prng, [0, 1]) ?? 0;
          events.push({ time: currTime, signal: sig, value: val });
          currTime += prngInt(prng, 1, 4);
        }

        const endTime = currTime + 5;
        const script: FlipFlopScript = {
          initialQ: prngChoice(prng, [0, 1]) ?? 0,
          initialClock: prngChoice(prng, [0, 1]) ?? 0,
          initialInputs,
          events,
          endTime,
        };

        const engineRes = simulateTimeline(config, script);
        expect(engineRes.ok).toBe(true);
        if (!engineRes.ok) continue;

        const refRes = naiveTickByTickSimulator(config, script);
        expect(engineRes.finalState.q).toBe(refRes.finalQ);
        expect(engineRes.stats.qTogglesCount).toBe(refRes.toggles);
        count++;
      }
    }
    expect(count).toBe(600);
  });
});

describe('3. Asynchronous Controls and Override Scenarios', () => {
  it('asynchronous CLEAR overrides active clock edge', () => {
    const config: FlipFlopConfig = {
      ...defaultConfig('D'),
      asyncControls: true,
      asyncActiveLow: true, // CLR=0 asserts
      propagationDelay: 1,
    };

    const script: FlipFlopScript = {
      initialQ: 1,
      initialClock: 0,
      initialPreset: 1,
      initialClear: 1,
      initialInputs: { D: 1 },
      events: [
        { time: 5, signal: 'CLR', value: 0 }, // assert clear
        { time: 10, signal: 'CLK', value: 1 }, // clock rises while CLR=0
        { time: 20, signal: 'CLR', value: 1 }, // release clear
      ],
      endTime: 30,
    };

    const res = simulateTimeline(config, script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.stats.asyncEventsCount).toBeGreaterThan(0);
    // Clock at t=10 should be ignored
    const ignored = res.events.filter((e) => e.kind === 'clock-ignored');
    expect(ignored.length).toBeGreaterThanOrEqual(1);
    expect(res.finalState.q).toBe(0);
  });

  it('asynchronous CONFLICT: both PRE and CLR asserted forces Q=1, Qbar=1', () => {
    const config: FlipFlopConfig = {
      ...defaultConfig('SR'),
      asyncControls: true,
      asyncActiveLow: true,
      propagationDelay: 1,
    };

    const script: FlipFlopScript = {
      initialQ: 0,
      initialPreset: 0, // PRE asserted
      initialClear: 0, // CLR asserted
      events: [],
      endTime: 10,
    };

    const res = simulateTimeline(config, script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const conflict = res.events.find((e) => e.kind === 'async-conflict');
    expect(conflict).toBeDefined();
    expect(res.finalState.q).toBe(1);
    expect(res.finalState.qBar).toBe(1);
  });

  it('simultaneous release of both PRE and CLR causes Q and Qbar to become X', () => {
    const config: FlipFlopConfig = {
      ...defaultConfig('JK'),
      asyncControls: true,
      asyncActiveLow: true,
      propagationDelay: 1,
    };

    const script: FlipFlopScript = {
      initialQ: 1,
      initialPreset: 0,
      initialClear: 0,
      events: [
        // Release both at t = 5
        { time: 5, signal: 'PRE', value: 1 },
        { time: 5, signal: 'CLR', value: 1 },
      ],
      endTime: 15,
    };

    const res = simulateTimeline(config, script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const release = res.events.find((e) => e.kind === 'async-release');
    expect(release).toBeDefined();
    expect(res.finalState.q).toBe('X');
    expect(res.finalState.qBar).toBe('X');
  });

  it('staggered release: one pin released while other remains asserted', () => {
    const config: FlipFlopConfig = {
      ...defaultConfig('D'),
      asyncControls: true,
      asyncActiveLow: false, // Active-High: 1 is asserted
      propagationDelay: 1,
    };

    const script: FlipFlopScript = {
      initialQ: 0,
      initialPreset: 1,
      initialClear: 1,
      events: [
        { time: 5, signal: 'PRE', value: 0 }, // release PRE, CLR still 1
      ],
      endTime: 15,
    };

    const res = simulateTimeline(config, script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // CLR prevails -> Q settles to 0
    expect(res.finalState.q).toBe(0);
  });
});

describe('4. Timing Violations, Unknown Clock, and Error Codes', () => {
  it('detects setup time violation when data input changes inside setup window', () => {
    const config: FlipFlopConfig = {
      ...defaultConfig('D'),
      setupTime: 3,
      holdTime: 2,
      propagationDelay: 1,
    };

    const script: FlipFlopScript = {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { D: 0 },
      events: [
        { time: 8, signal: 'D', value: 1 }, // changed at t=8 (inside [10-3, 10))
        { time: 10, signal: 'CLK', value: 1 }, // edge at t=10
      ],
      endTime: 20,
    };

    const res = simulateTimeline(config, script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.stats.timingViolationsCount).toBe(1);
    const violation = res.events.find((e) => e.kind === 'timing-violation');
    expect(violation).toBeDefined();
    expect(res.finalState.q).toBe('X');
  });

  it('detects hold time violation when data input changes inside hold window', () => {
    const config: FlipFlopConfig = {
      ...defaultConfig('D'),
      setupTime: 2,
      holdTime: 3,
      propagationDelay: 1,
    };

    const script: FlipFlopScript = {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { D: 0 },
      events: [
        { time: 10, signal: 'CLK', value: 1 }, // edge at t=10
        { time: 11, signal: 'D', value: 1 }, // changed at t=11 (inside [10, 10+3))
      ],
      endTime: 20,
    };

    const res = simulateTimeline(config, script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.stats.timingViolationsCount).toBe(1);
    expect(res.finalState.q).toBe('X');
  });

  it('handles clock transition to X with unknown-clock event', () => {
    const config = defaultConfig('D');
    const script: FlipFlopScript = {
      initialQ: 1,
      initialClock: 0,
      events: [{ time: 5, signal: 'CLK', value: 'X' }],
      endTime: 15,
    };

    const res = simulateTimeline(config, script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const unk = res.events.find((e) => e.kind === 'unknown-clock');
    expect(unk).toBeDefined();
    expect(res.finalState.q).toBe('X');
  });

  it('validates all script error codes gracefully without throwing', () => {
    const config = defaultConfig('D');

    // unsorted-times
    expect(
      simulateTimeline(config, {
        events: [
          { time: 10, signal: 'D', value: 1 },
          { time: 5, signal: 'D', value: 0 },
        ],
        endTime: 20,
      }).ok
    ).toBe(false);

    // unknown-signal
    expect(
      simulateTimeline(config, {
        events: [{ time: 5, signal: 'NON_EXISTENT', value: 1 }],
        endTime: 20,
      }).ok
    ).toBe(false);

    // async-not-enabled
    expect(
      simulateTimeline(config, {
        events: [{ time: 5, signal: 'PRE', value: 0 }],
        endTime: 20,
      }).ok
    ).toBe(false);

    // bad-time
    expect(
      simulateTimeline(config, {
        events: [{ time: -1, signal: 'D', value: 1 }],
        endTime: 20,
      }).ok
    ).toBe(false);

    // end-before-last-event
    expect(
      simulateTimeline(config, {
        events: [{ time: 25, signal: 'D', value: 1 }],
        endTime: 20,
      }).ok
    ).toBe(false);

    // too-many-events cap (10,000)
    const bigEvents: FlipFlopScriptEvent[] = [];
    for (let i = 0; i < 10001; i++) {
      bigEvents.push({ time: i, signal: 'CLK', value: (i % 2) as 0 | 1 });
    }
    const capRes = simulateTimeline(config, { events: bigEvents, endTime: 20000 });
    expect(capRes.ok).toBe(false);
    if (!capRes.ok) {
      expect(capRes.error.code).toBe('too-many-events');
    }
  });
});

describe('5. Invariance, Determinism, and JSON Round-Trip Stability', () => {
  it('is strictly deterministic across multiple runs of identical scripts', () => {
    const config = defaultConfig('JK');
    const script: FlipFlopScript = {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { J: 1, K: 1 },
      events: [
        { time: 10, signal: 'CLK', value: 1 },
        { time: 20, signal: 'CLK', value: 0 },
        { time: 30, signal: 'CLK', value: 1 },
      ],
      endTime: 40,
    };

    const res1 = simulateTimeline(config, script);
    const res2 = simulateTimeline(config, script);
    expect(res1).toEqual(res2);
  });

  it('TIME-SHIFT INVARIANCE: shifting all events by delta shifts all output changes by delta', () => {
    const config = defaultConfig('D');
    const delta = 100;

    const baseScript: FlipFlopScript = {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { D: 1 },
      events: [
        { time: 10, signal: 'CLK', value: 1 },
        { time: 20, signal: 'CLK', value: 0 },
      ],
      endTime: 30,
    };

    const shiftedScript: FlipFlopScript = {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { D: 1 },
      events: [
        { time: 10 + delta, signal: 'CLK', value: 1 },
        { time: 20 + delta, signal: 'CLK', value: 0 },
      ],
      endTime: 30 + delta,
    };

    const resBase = simulateTimeline(config, baseScript);
    const resShifted = simulateTimeline(config, shiftedScript);

    expect(resBase.ok).toBe(true);
    expect(resShifted.ok).toBe(true);
    if (!resBase.ok || !resShifted.ok) return;

    const baseQ = resBase.changes.filter((c) => c.nodeId === 'Q' && c.time > 0);
    const shiftedQ = resShifted.changes.filter((c) => c.nodeId === 'Q' && c.time > 0);

    expect(shiftedQ).toHaveLength(baseQ.length);
    for (let i = 0; i < baseQ.length; i++) {
      expect(shiftedQ[i]?.time).toBe((baseQ[i]?.time ?? 0) + delta);
      expect(shiftedQ[i]?.value).toBe(baseQ[i]?.value);
    }
  });

  it('DELAY SHIFT: changes land exactly propagationDelay time units later', () => {
    const script: FlipFlopScript = {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { D: 1 },
      events: [{ time: 10, signal: 'CLK', value: 1 }],
      endTime: 30,
    };

    for (const delay of [1, 2, 5, 10]) {
      const config: FlipFlopConfig = { ...defaultConfig('D'), propagationDelay: delay };
      const res = simulateTimeline(config, script);
      expect(res.ok).toBe(true);
      if (!res.ok) continue;

      const qChange = res.changes.find((c) => c.nodeId === 'Q' && c.time > 0);
      expect(qChange?.time).toBe(10 + delay);
    }
  });

  it('JSON round-trip stability for all outputs', () => {
    const config = defaultConfig('SR');
    const script: FlipFlopScript = {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { S: 1, R: 0 },
      events: [{ time: 5, signal: 'CLK', value: 1 }],
      endTime: 20,
    };

    const res = simulateTimeline(config, script);
    expect(res.ok).toBe(true);
    const serialized = JSON.stringify(res);
    const deserialized = JSON.parse(serialized);
    expect(deserialized).toEqual(res);
  });
});
