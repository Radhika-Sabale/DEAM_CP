/**
 * @file counterMachines.test.ts
 * Comprehensive verification of counter machine builder across all moduli 2..16,
 * up/down/up-down directions, 30-step simulation runs, and 200 seeded random custom sequences.
 */
/* eslint-disable no-console */

import { describe, expect, it } from 'vitest';
import type { FlipFlopType } from '../../types/sequential';
import { createPrng, prngInt, prngShuffle } from '../common/seededRandom';
import { counterMachine } from './counterMachines';
import { runTable } from './stateTable';

describe('counterMachines.ts', () => {
  const flipFlops: FlipFlopType[] = ['SR', 'JK', 'D', 'T'];

  it('verifies all Up counters for N = 2..16 against arithmetic reference', () => {
    let checkedCount = 0;
    for (let N = 2; N <= 16; N++) {
      const ff = flipFlops[N % 4] ?? 'JK';
      const res = counterMachine({
        kind: 'counter',
        flipFlop: ff,
        style: 'sync',
        direction: 'up',
        modulus: N,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        checkedCount++;
        const { table } = res.machine;
        expect(table.validCodes.length).toBe(N);

        for (let c = 0; c < N; c++) {
          const row = table.rows.find((r) => r.code === c);
          expect(row?.valid).toBe(true);
          expect(row?.nextCode).toBe((c + 1) % N);
        }

        // 30-step simulation
        const steps = runTable(table, 0, new Array(30).fill(0));
        expect(steps.length).toBe(30);
        for (let i = 0; i < 30; i++) {
          expect(steps[i]?.state).toBe(i % N);
        }
      }
    }
    expect(checkedCount).toBe(15);
  });

  it('verifies all Down counters for N = 2..16 against arithmetic reference', () => {
    let checkedCount = 0;
    for (let N = 2; N <= 16; N++) {
      const ff = flipFlops[N % 4] ?? 'D';
      const res = counterMachine({
        kind: 'counter',
        flipFlop: ff,
        style: 'sync',
        direction: 'down',
        modulus: N,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        checkedCount++;
        const { table } = res.machine;
        for (let c = 0; c < N; c++) {
          const row = table.rows.find((r) => r.code === c);
          expect(row?.valid).toBe(true);
          expect(row?.nextCode).toBe((c - 1 + N) % N);
        }

        // 30-step simulation
        const steps = runTable(table, 0, new Array(30).fill(0));
        let expectedState = 0;
        for (let i = 0; i < 30; i++) {
          expect(steps[i]?.state).toBe(expectedState);
          expectedState = (expectedState - 1 + N) % N;
        }
      }
    }
    expect(checkedCount).toBe(15);
  });

  it('verifies all Up-Down counters for N = 2..16 under both DN=0 (up) and DN=1 (down)', () => {
    let checkedCount = 0;
    for (let N = 2; N <= 16; N++) {
      const ff = flipFlops[N % 4] ?? 'T';
      const res = counterMachine({
        kind: 'counter',
        flipFlop: ff,
        style: 'sync',
        direction: 'up-down',
        modulus: N,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        checkedCount++;
        const { table } = res.machine;

        for (let c = 0; c < N; c++) {
          // DN = 0 -> Up
          const rowUp = table.rows.find((r) => r.code === c && r.inputValue === 0);
          expect(rowUp?.valid).toBe(true);
          expect(rowUp?.nextCode).toBe((c + 1) % N);

          // DN = 1 -> Down
          const rowDown = table.rows.find((r) => r.code === c && r.inputValue === 1);
          expect(rowDown?.valid).toBe(true);
          expect(rowDown?.nextCode).toBe((c - 1 + N) % N);
        }

        // 30-step trace with alternating DN values: [0, 0, 0, 1, 1, 0, ...]
        const inputPattern: (0 | 1)[] = Array.from({ length: 30 }, (_, i) => (Math.floor(i / 5) % 2 === 0 ? 0 : 1));
        const steps = runTable(table, 0, inputPattern);
        expect(steps.length).toBe(30);
      }
    }
    expect(checkedCount).toBe(15);
  });

  it('tests 200 seeded random custom sequences (3 and 4 bits) verifying cyclic next-states and unused states', () => {
    const prng = createPrng(987654321);
    let customMachinesChecked = 0;

    for (let iter = 0; iter < 200; iter++) {
      const stateBits = prngInt(prng, 3, 4); // 3 or 4 bits
      const maxPossibleCode = (1 << stateBits) - 1;
      const allCodes = Array.from({ length: maxPossibleCode + 1 }, (_, i) => i);
      const shuffled = prngShuffle(prng, allCodes);

      const seqLength = prngInt(prng, 2, maxPossibleCode + 1);
      const sequence = shuffled.slice(0, seqLength);

      const ff = flipFlops[iter % 4] ?? 'JK';

      const res = counterMachine({
        kind: 'counter',
        flipFlop: ff,
        style: 'sync',
        direction: 'custom',
        modulus: seqLength,
        sequence,
        stateBits,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        customMachinesChecked++;
        const { table } = res.machine;

        expect(table.validCodes).toEqual(sequence);

        const seqSet = new Set(sequence);
        for (let c = 0; c <= maxPossibleCode; c++) {
          const row = table.rows.find((r) => r.code === c);
          if (seqSet.has(c)) {
            expect(row?.valid).toBe(true);
            const idxInSeq = sequence.indexOf(c);
            const expectedNext = sequence[(idxInSeq + 1) % sequence.length];
            expect(row?.nextCode).toBe(expectedNext);
          } else {
            expect(row?.valid).toBe(false);
            expect(row?.nextCode).toBe('X');
          }
        }

        // Trace run through full cycle
        const steps = runTable(table, sequence[0] ?? 0, new Array(sequence.length * 2).fill(0));
        for (let s = 0; s < sequence.length * 2; s++) {
          const expectedCode = sequence[s % sequence.length];
          expect(steps[s]?.state).toBe(expectedCode);
        }
      }
    }

    expect(customMachinesChecked).toBe(200);
    console.log(`[Counter Machine Sweep] Verified 15 Up, 15 Down, 15 Up-Down, and ${customMachinesChecked} custom counter machines.`);
  });
});
