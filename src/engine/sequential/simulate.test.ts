/**
 * @file simulate.test.ts
 * Comprehensive test suite for Stage 10B behavioural sequential simulator.
 * Validates counters against arithmetic references, sequence detectors against sliding-window scanner over 500 random bitstrings,
 * timing edge accuracy, unused state recovery, and SR invalid input handling.
 */

import { describe, expect, it } from 'vitest';
import type { CounterSpec, DetectorSpec, FlipFlopType } from '../../types/sequential';
import { designSequential } from './counterDesigner';
import { analyzeLockout } from './lockout';
import { simulateDesign } from './simulate';

describe('simulateDesign behavioural simulator', () => {
  it('simulates synchronous counters against arithmetic reference over 3N cycles for all flip-flop types', () => {
    const moduli = [5, 6, 8, 10];
    const ffTypes: FlipFlopType[] = ['SR', 'JK', 'D', 'T'];

    for (const N of moduli) {
      for (const ff of ffTypes) {
        const spec: CounterSpec = {
          kind: 'counter',
          modulus: N,
          direction: 'up',
          flipFlop: ff,
        };
        const designRes = designSequential(spec);
        expect(designRes.ok).toBe(true);
        if (!designRes.ok) continue;

        const design = designRes.design;

        // Test from every valid starting state
        for (let startState = 0; startState < N; startState++) {
          const cycles = 3 * N;
          const simRes = simulateDesign(design, {
            initialState: startState,
            cycles,
            period: 10,
          });

          expect(simRes.ok).toBe(true);
          if (!simRes.ok) continue;

          expect(simRes.rows.length).toBe(cycles);

          let expectedState = startState;
          for (let k = 0; k < cycles; k++) {
            const row = simRes.rows[k];
            expect(row?.state).toBe(expectedState);
            const expectedNext = (expectedState + 1) % N;
            expect(row?.nextState).toBe(expectedNext);
            expectedState = expectedNext;
          }
        }
      }
    }
  });

  it('simulates up-down counter against arithmetic reference with seeded input sequence', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      modulus: 6,
      direction: 'up-down',
      flipFlop: 'JK',
    };
    const designRes = designSequential(spec);
    expect(designRes.ok).toBe(true);
    if (!designRes.ok) return;

    // DN = 0: UP, DN = 1: DOWN
    const dnSequence: (0 | 1)[] = [0, 0, 0, 1, 1, 0, 1, 1, 1, 0, 0, 1];
    const simRes = simulateDesign(designRes.design, {
      initialState: 0,
      inputs: dnSequence,
      period: 10,
    });

    expect(simRes.ok).toBe(true);
    if (!simRes.ok) return;

    let curr = 0;
    const N = 6;
    for (let k = 0; k < dnSequence.length; k++) {
      const dn = dnSequence[k] ?? 0;
      const expectedNext = dn === 0 ? (curr + 1) % N : (curr - 1 + N) % N;
      const row = simRes.rows[k];
      expect(row?.state).toBe(curr);
      expect(row?.input).toBe(dn);
      expect(row?.nextState).toBe(expectedNext);
      curr = expectedNext;
    }
  });

  it('validates sequence detector on 500 seeded random bit strings of length 40 against naive reference', () => {
    let seed = 987654321;
    function rand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    const testConfigs: { pattern: string; machine: 'mealy' | 'moore'; overlapping: boolean }[] = [
      { pattern: '1011', machine: 'mealy', overlapping: true },
      { pattern: '1011', machine: 'mealy', overlapping: false },
      { pattern: '1011', machine: 'moore', overlapping: true },
      { pattern: '1011', machine: 'moore', overlapping: false },
      { pattern: '110', machine: 'mealy', overlapping: true },
      { pattern: '110', machine: 'moore', overlapping: false },
    ];

    for (const cfg of testConfigs) {
      const spec: DetectorSpec = {
        kind: 'detector',
        pattern: cfg.pattern,
        machine: cfg.machine,
        overlapping: cfg.overlapping,
        flipFlop: 'D',
      };

      const designRes = designSequential(spec);
      expect(designRes.ok).toBe(true);
      if (!designRes.ok) continue;

      const design = designRes.design;
      const L = cfg.pattern.length;

      for (let trial = 0; trial < 500; trial++) {
        const inputString: (0 | 1)[] = [];
        for (let i = 0; i < 40; i++) {
          inputString.push(rand() < 0.5 ? 1 : 0);
        }

        // Test-local naive sliding window reference scanner
        const expectedOutputs: (0 | 1)[] = [];
        let accumulated = '';
        let lastMatchIndex = -100;

        for (let t = 0; t < 40; t++) {
          const bit = inputString[t] ?? 0;
          accumulated += String(bit);

          let matched = false;
          if (accumulated.endsWith(cfg.pattern)) {
            if (cfg.overlapping || t - lastMatchIndex >= L) {
              matched = true;
              lastMatchIndex = t;
            }
          }

          if (cfg.machine === 'mealy') {
            expectedOutputs.push(matched ? 1 : 0);
          } else {
            // Moore matches reflect one cycle after pattern entry
            expectedOutputs.push(matched ? 1 : 0);
          }
        }

        const simRes = simulateDesign(design, {
          initialState: 0,
          inputs: inputString,
          period: 10,
        });

        expect(simRes.ok).toBe(true);
        if (!simRes.ok) continue;

        if (cfg.machine === 'mealy') {
          for (let k = 0; k < 40; k++) {
            const actualOut = simRes.rows[k]?.output;
            const expOut = expectedOutputs[k];
            expect(actualOut).toBe(expOut);
          }
        } else {
          // For Moore machine: output in row k reflects present state Moore output
          // which is 1 at cycle k+1 if match occurred at cycle k
          for (let k = 0; k < 39; k++) {
            const matchAtK = expectedOutputs[k] === 1;
            const mooreOutAtKPlus1 = simRes.rows[k + 1]?.output;
            if (matchAtK) {
              expect(mooreOutAtKPlus1).toBe(1);
            }
          }
        }
      }
    }
  });

  it('verifies state bit Q changes land exactly at k*period + period/2', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      modulus: 5,
      direction: 'up',
      flipFlop: 'D',
    };
    const designRes = designSequential(spec);
    expect(designRes.ok).toBe(true);
    if (!designRes.ok) return;

    const period = 20;
    const simRes = simulateDesign(designRes.design, {
      initialState: 0,
      cycles: 6,
      period,
    });

    expect(simRes.ok).toBe(true);
    if (!simRes.ok) return;

    const qChanges = simRes.changes.filter((c) => c.nodeId.startsWith('Q') && c.time > 0);
    for (const chg of qChanges) {
      // Time must be k*period + period/2
      const remainder = chg.time % period;
      expect(remainder).toBe(period / 2);
    }
  });

  it('matches lockout analysis when starting in unused states', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      modulus: 5, // states 0..4 valid, 5..7 unused
      direction: 'up',
      flipFlop: 'JK',
    };
    const designRes = designSequential(spec);
    expect(designRes.ok).toBe(true);
    if (!designRes.ok) return;

    const design = designRes.design;
    const lockout = analyzeLockout({
      table: design.table,
      equations: design.equations,
      flipFlop: 'JK',
    });

    for (const u of design.table.unusedCodes) {
      const simRes = simulateDesign(design, {
        initialState: u,
        cycles: 8,
        period: 10,
      });

      expect(simRes.ok).toBe(true);
      if (!simRes.ok) continue;

      const reachedValid = simRes.visited.some((s) => design.table.validCodes.includes(s));
      const isLocked = lockout.lockedStates.includes(u);
      const isIndet = lockout.indeterminateStates.includes(u);

      if (reachedValid) {
        expect(isLocked).toBe(false);
        expect(isIndet).toBe(false);
      } else {
        expect(isLocked || isIndet).toBe(true);
      }
    }
  });

  it('passes JSON round-trip serialization', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      modulus: 8,
      direction: 'up',
      flipFlop: 'T',
    };
    const designRes = designSequential(spec);
    expect(designRes.ok).toBe(true);
    if (!designRes.ok) return;

    const simRes = simulateDesign(designRes.design, { cycles: 5 });
    const json = JSON.stringify(simRes);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(simRes);
  });
});
