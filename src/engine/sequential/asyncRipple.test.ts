/**
 * @file asyncRipple.test.ts
 * Comprehensive test suite for Stage 10B asynchronous ripple counters.
 * Validates power-of-2 up/down counters across all 4 flip-flop types and both trigger polarities,
 * hand-checked ripple transient sequences, non-power-of-2 decode feedback resets,
 * first-value property proof, and timing violation warnings.
 */

import { describe, expect, it } from 'vitest';
import type { CounterSpec, FlipFlopType } from '../../types/sequential';
import { designAsyncRipple, simulateAsyncRipple } from './asyncRipple';

describe('designAsyncRipple and simulateAsyncRipple', () => {
  it('rejects down counters with non-power-of-2 modulus', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      modulus: 6,
      direction: 'down',
      style: 'async',
      flipFlop: 'JK',
    };
    const res = designAsyncRipple(spec);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0]?.code).toBe('async-unsupported');
    }
  });

  it('proves the first-value property exhaustively for N = 2..16', () => {
    // Property to prove: counting up from 0, the first value containing all the 1-bits of N is N itself.
    for (let N = 2; N <= 16; N++) {
      const bitIndices: number[] = [];
      for (let b = 0; b < 5; b++) {
        if (((N >> b) & 1) === 1) {
          bitIndices.push(b);
        }
      }

      for (let k = 0; k < N; k++) {
        const containsAll = bitIndices.every((b) => ((k >> b) & 1) === 1);
        expect(containsAll).toBe(false);
      }

      const nContainsAll = bitIndices.every((b) => ((N >> b) & 1) === 1);
      expect(nContainsAll).toBe(true);
    }
  });

  it('correctly produces hand-checked ripple transients for 0111 -> 1000 with equal delays', () => {
    // MOD-16 UP counter: state 7 (0111) -> state 8 (1000)
    // When Stage 0 toggles: 0111 -> 0110 (6)
    // When Stage 1 toggles: 0110 -> 0100 (4)
    // When Stage 2 toggles: 0100 -> 0000 (0)
    // When Stage 3 toggles: 0000 -> 1000 (8)
    const spec: CounterSpec = {
      kind: 'counter',
      modulus: 16,
      direction: 'up',
      style: 'async',
      flipFlop: 'T',
      asyncTrigger: 'falling',
    };
    const designRes = designAsyncRipple(spec);
    expect(designRes.ok).toBe(true);
    if (!designRes.ok) return;

    const simRes = simulateAsyncRipple(designRes.design, {
      clockCycles: 1,
      clockPeriod: 100,
      stageDelay: 5,
      initialCount: 7, // starts at 7 (0111)
    });

    // Trace intermediate state codes during the cycle
    const cycleChanges = simRes.changes.filter(
      (c) => c.nodeId.startsWith('Q') && c.time > 0
    );

    const timePoints = Array.from(new Set(cycleChanges.map((c) => c.time))).sort(
      (a, b) => a - b
    );

    const intermediateCodes: number[] = [];
    const qState: number[] = [1, 1, 1, 0]; // Q0..Q3 at start (7)

    for (const t of timePoints) {
      const atT = cycleChanges.filter((c) => c.time === t);
      for (const chg of atT) {
        const bitIdx = Number(chg.nodeId.slice(1));
        qState[bitIdx] = chg.value === 1 ? 1 : 0;
      }
      let code = 0;
      for (let b = 0; b < 4; b++) {
        code |= (qState[b] ?? 0) << b;
      }
      intermediateCodes.push(code);
    }

    // Exact intermediate states: 0110 (6), 0100 (4), 0000 (0), 1000 (8)
    expect(intermediateCodes).toEqual([6, 4, 0, 8]);
    expect(simRes.samples[0]?.settledCount).toBe(8);
  });

  it('simulates power-of-2 up and down counters for n = 1..4 across all 4 flip-flop types and trigger polarities', () => {
    const bitWidths = [1, 2, 3, 4];
    const ffTypes: FlipFlopType[] = ['SR', 'JK', 'D', 'T'];
    const triggers: ('rising' | 'falling')[] = ['rising', 'falling'];

    for (const n of bitWidths) {
      const N = 1 << n;
      for (const ff of ffTypes) {
        for (const trigger of triggers) {
          // 1. UP counter
          const upSpec: CounterSpec = {
            kind: 'counter',
            modulus: N,
            direction: 'up',
            style: 'async',
            flipFlop: ff,
            asyncTrigger: trigger,
          };
          const upDesign = designAsyncRipple(upSpec);
          expect(upDesign.ok).toBe(true);
          if (upDesign.ok) {
            const upSim = simulateAsyncRipple(upDesign.design, {
              clockCycles: 2 * N,
              clockPeriod: 40,
              stageDelay: 2,
              initialCount: 0,
            });
            for (let k = 0; k < 2 * N; k++) {
              const expected = (k + 1) % N;
              expect(upSim.samples[k]?.settledCount).toBe(expected);
            }
          }

          // 2. DOWN counter
          const downSpec: CounterSpec = {
            kind: 'counter',
            modulus: N,
            direction: 'down',
            style: 'async',
            flipFlop: ff,
            asyncTrigger: trigger,
          };
          const downDesign = designAsyncRipple(downSpec);
          expect(downDesign.ok).toBe(true);
          if (downDesign.ok) {
            const downSim = simulateAsyncRipple(downDesign.design, {
              clockCycles: 2 * N,
              clockPeriod: 40,
              stageDelay: 2,
              initialCount: 0,
            });
            let expectedDown = 0;
            for (let k = 0; k < 2 * N; k++) {
              expectedDown = (expectedDown - 1 + N) % N;
              expect(downSim.samples[k]?.settledCount).toBe(expectedDown);
            }
          }
        }
      }
    }
  });

  it('simulates mod-N up counters for N = 2..16 with decode reset transients', () => {
    for (let N = 2; N <= 16; N++) {
      const spec: CounterSpec = {
        kind: 'counter',
        modulus: N,
        direction: 'up',
        style: 'async',
        flipFlop: 'JK',
        asyncTrigger: 'falling',
      };
      const designRes = designAsyncRipple(spec);
      expect(designRes.ok).toBe(true);
      if (!designRes.ok) continue;

      const cycles = 3 * N;
      const simRes = simulateAsyncRipple(designRes.design, {
        clockCycles: cycles,
        clockPeriod: 40,
        stageDelay: 2,
        decodeDelay: 1,
        clearDelay: 1,
        initialCount: 0,
      });

      // Verify settled counts cycle 0..N-1
      for (let k = 0; k < cycles; k++) {
        const expected = (k + 1) % N;
        expect(simRes.samples[k]?.settledCount).toBe(expected);
      }

      // If N is not power of 2, verify exactly 3 transient states N occurred
      const isPow2 = (N & (N - 1)) === 0;
      if (!isPow2) {
        expect(simRes.transients.length).toBe(3);
        for (const tr of simRes.transients) {
          expect(tr.code).toBe(N);
          expect(tr.end - tr.start).toBeGreaterThan(0);
        }
      }
    }
  });

  it('issues a warning when clock is faster than counter settle time', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      modulus: 16, // 4 stages x 10 delay = 40 settle time
      direction: 'up',
      style: 'async',
      flipFlop: 'T',
    };
    const designRes = designAsyncRipple(spec);
    expect(designRes.ok).toBe(true);
    if (!designRes.ok) return;

    // Clock period 20 is shorter than 40 settle time
    const simRes = simulateAsyncRipple(designRes.design, {
      clockCycles: 4,
      clockPeriod: 20,
      stageDelay: 10,
    });

    expect(simRes.warnings.length).toBeGreaterThan(0);
    expect(simRes.warnings[0]).toContain(
      'The clock is faster than the counter can settle, so the count is unreliable'
    );
  });
});
