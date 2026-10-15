import { describe, it, expect } from 'vitest';
import {
  arbitrateInterrupt,
  buildEntrySequence,
  type ArbitrateInterruptInput,
} from './interruptController';
import type { ModeledFlags } from './flagsWord';

describe('Interrupt Controller Arbitration & Priority Table', () => {
  it('exhaustively checks the full priority table across all 32 input states', () => {
    const nmiValues = [false, true];
    const intrValues: ({ vector: number } | null)[] = [null, { vector: 32 }];
    const ifValues: (0 | 1)[] = [0, 1];
    const tfValues = [false, true];
    const shadowValues = [false, true];

    let combinationsTested = 0;

    for (const pendingNmi of nmiValues) {
      for (const pendingIntr of intrValues) {
        for (const ifFlag of ifValues) {
          for (const singleStepPending of tfValues) {
            for (const stiShadowActive of shadowValues) {
              const input: ArbitrateInterruptInput = {
                pendingNmi,
                pendingIntr,
                singleStepPending,
                ifFlag,
                stiShadowActive,
              };

              const outcome = arbitrateInterrupt(input);

              // 1. NMI priority check
              if (pendingNmi) {
                expect(outcome.recognised).toEqual({
                  kind: 'nmi',
                  vector: 2,
                  source: 'hardware-nmi',
                });
                expect(outcome.nextPendingNmi).toBe(false);
                expect(outcome.nextPendingIntr).toBe(pendingIntr);
                expect(outcome.nextSingleStepPending).toBe(singleStepPending);
              }
              // 2. INTR priority check (if NMI not pending)
              else if (pendingIntr !== null && ifFlag === 1 && !stiShadowActive) {
                expect(outcome.recognised).toEqual({
                  kind: 'intr',
                  vector: 32,
                  source: 'hardware-intr',
                });
                expect(outcome.nextPendingNmi).toBe(false);
                expect(outcome.nextPendingIntr).toBeNull();
                expect(outcome.nextSingleStepPending).toBe(singleStepPending);
              }
              // 3. Single-step debug trap priority check (if neither NMI nor INTR accepted)
              else if (singleStepPending && !stiShadowActive) {
                expect(outcome.recognised).toEqual({
                  kind: 'single-step',
                  vector: 1,
                  source: 'single-step-trap',
                });
                expect(outcome.nextPendingNmi).toBe(false);
                expect(outcome.nextPendingIntr).toBe(pendingIntr);
                expect(outcome.nextSingleStepPending).toBe(false);
              }
              // 4. None recognised
              else {
                expect(outcome.recognised).toBeNull();
                expect(outcome.nextPendingNmi).toBe(false);
                expect(outcome.nextPendingIntr).toBe(pendingIntr);
                expect(outcome.nextSingleStepPending).toBe(singleStepPending);
              }

              combinationsTested++;
            }
          }
        }
      }
    }

    expect(combinationsTested).toBe(32);
  });

  it('builds the exact 5 micro-steps in order for interrupt entry sequence', () => {
    const memory = new Map<number, number>();
    const readMem = (addr: number) => memory.get(addr) ?? 0;

    const initialFlags: ModeledFlags = {
      C: 1,
      Z: 0,
      S: 1,
      O: 0,
      I: 1,
      T: 1,
    };

    const res = buildEntrySequence({
      kind: 'intr',
      vector: 0x20,
      source: 'hardware-intr',
      currentSp: 0x0800,
      currentFlags: initialFlags,
      returnIp: 0x0005,
      handlerIp: 0x0020,
      readMemoryByte: readMem,
    });

    expect(res.microSteps.length).toBe(5);
    expect(res.microSteps.map((s) => s.kind)).toEqual([
      'push-flags',
      'clear-if-tf',
      'push-cs',
      'push-ip',
      'read-vector',
    ]);

    const [s0, s1, s2, s3, s4] = res.microSteps;
    expect(s0).toBeDefined();
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
    expect(s3).toBeDefined();
    expect(s4).toBeDefined();
    if (!s0 || !s1 || !s2 || !s3 || !s4) return;

    // Check micro-step 1: push-flags
    expect(s0.registersChanged).toEqual([
      { name: 'SP', old: 0x0800, new: 0x07fe },
    ]);
    expect(s0.memoryWrites.length).toBe(2);

    // Check micro-step 2: clear-if-tf
    expect(s1.flagsChanged).toEqual([
      { name: 'I', old: 1, new: 0 },
      { name: 'T', old: 1, new: 0 },
    ]);

    // Check micro-step 3: push-cs
    expect(s2.registersChanged).toEqual([
      { name: 'SP', old: 0x07fe, new: 0x07fc },
    ]);
    expect(s2.memoryWrites[0]?.newByte).toBe(0x00);
    expect(s2.memoryWrites[1]?.newByte).toBe(0x00);

    // Check micro-step 4: push-ip
    expect(s3.registersChanged).toEqual([
      { name: 'SP', old: 0x07fc, new: 0x07fa },
    ]);
    expect(s3.memoryWrites[0]?.newByte).toBe(0x05);
    expect(s3.memoryWrites[1]?.newByte).toBe(0x00);

    // Check micro-step 5: read-vector
    expect(s4.registersChanged).toEqual([
      { name: 'IP', old: 0x0005, new: 0x0020 },
    ]);

    // Final state checks
    expect(res.finalSp).toBe(0x07fa);
    expect(res.finalFlags.I).toBe(0);
    expect(res.finalFlags.T).toBe(0);
    expect(res.record.flagsBefore & (1 << 9)).toBeTruthy(); // IF set
    expect(res.record.flagsBefore & (1 << 8)).toBeTruthy(); // TF set
    expect(res.record.flagsAfter & (1 << 9)).toBeFalsy(); // IF cleared
    expect(res.record.flagsAfter & (1 << 8)).toBeFalsy(); // TF cleared
  });
});
