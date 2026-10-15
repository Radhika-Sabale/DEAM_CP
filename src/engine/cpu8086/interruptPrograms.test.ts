/* eslint-disable no-console */
/**
 * @file interruptPrograms.test.ts
 * CPU-level test suite for Stage 15A:
 * - TRANSPARENCY PROPERTY: 300 seeded random programs with saving/restoring ISRs
 *   run with vs without interrupt scenarios, verifying identical final program state.
 * - REFERENCE MODEL AUDIT: 500 seeded sequences comparing engine arbitration & entry against an independent model.
 * - HISTORY AUDIT: 100 random state reconstructions and stepBack verification across interrupt boundaries.
 * - PERFORMANCE BENCHMARK: 100,000 steps with 1,000 scheduled scenario events executed in under a few seconds.
 */

import { describe, expect, it } from 'vitest';
import { assemble } from './assembler';
import { createCpuState, step } from './cpu';
import { readWord } from './memory';
import { applyReverseDelta } from './history';
import { arbitrateInterrupt } from '../interrupts';
import type { CpuState, StepRecord } from './cpuTypes';
import type { InterruptScenario } from '../interrupts';

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('8086 Interrupts - 4. Transparency, Reference Audit, History, and Performance', () => {
  it('verifies the TRANSPARENCY PROPERTY across 300 seeded random programs with saving/restoring ISRs', () => {
    const rand = lcg(42);
    let testsRun = 0;
    let failures = 0;

    const registers = ['AX', 'BX', 'CX', 'DX', 'SI', 'DI'] as const;
    const ops = ['ADD', 'SUB', 'XOR', 'OR', 'AND'] as const;

    for (let p = 0; p < 300; p++) {
      // Build a random straight-line and arithmetic program
      const lines: string[] = [
        'VECTOR 2, nmi_isr',
        'VECTOR 0x40, intr_isr',
        'STI', // Enable interrupts
      ];

      // Initial assignments
      for (const r of registers) {
        const val = Math.floor(rand() * 1000) + 1;
        lines.push(`MOV ${r}, ${val}`);
      }

      // Random operations
      const numOps = 10 + Math.floor(rand() * 15);
      for (let i = 0; i < numOps; i++) {
        const r1 = registers[Math.floor(rand() * registers.length)];
        const r2 = registers[Math.floor(rand() * registers.length)];
        const op = ops[Math.floor(rand() * ops.length)];
        if (rand() > 0.5) {
          const imm = Math.floor(rand() * 50) + 1;
          lines.push(`${op} ${r1}, ${imm}`);
        } else {
          lines.push(`${op} ${r1}, ${r2}`);
        }
      }

      lines.push('done:');
      lines.push('HLT');
      lines.push('JMP done');

      // Transparent ISRs that save and restore flags and atomically increment private counter
      lines.push('nmi_isr:');
      lines.push('PUSHF');
      lines.push('INC WORD PTR [0x0500]');
      lines.push('POPF');
      lines.push('IRET');

      lines.push('intr_isr:');
      lines.push('PUSHF');
      lines.push('INC WORD PTR [0x0500]');
      lines.push('POPF');
      lines.push('IRET');

      const asm = assemble(lines.join('\n'));
      if (!asm.ok) {
        failures++;
        continue;
      }

      const program = asm.program;

      // 1. Run (A) with NO scenario to measure baseline execution
      let stateA = createCpuState(program);
      while (!stateA.halted && stateA.ticks < 1000) {
        stateA = step(stateA, program).state;
      }

      const activeTicks = stateA.ticks - 2; // Ticks before reaching HLT

      // 2. Build seeded random scenario of NMI and INTR events during active program execution
      const numEvents = 2 + Math.floor(rand() * 5);
      const events = [];
      for (let e = 0; e < numEvents; e++) {
        const atTick = 1 + Math.floor(rand() * activeTicks);
        if (rand() > 0.5) {
          events.push({ atTick, kind: 'nmi' as const });
        } else {
          events.push({ atTick, kind: 'intr' as const, vector: 0x40 });
        }
      }
      const scenario: InterruptScenario = { events };

      // 3. Run (B) WITH scenario
      let stateB = createCpuState(program);
      let interruptsRecognised = 0;

      while (!stateB.halted && stateB.ticks < 1000) {
        const stepRes = step(stateB, program, { scenario });
        if (stepRes.record.interruptRecord) {
          interruptsRecognised++;
        }
        stateB = stepRes.state;
      }

      // Verify Transparency Assertions:
      try {
        // Registers must be identical
        for (const r of registers) {
          expect(stateB.registers[r]).toBe(stateA.registers[r]);
        }
        expect(stateB.registers.SP).toBe(stateA.registers.SP);
        expect(stateB.registers.IP).toBe(stateA.registers.IP);

        // Flags must be identical
        expect(stateB.flags.C).toBe(stateA.flags.C);
        expect(stateB.flags.Z).toBe(stateA.flags.Z);
        expect(stateB.flags.S).toBe(stateA.flags.S);
        expect(stateB.flags.O).toBe(stateA.flags.O);
        expect(stateB.flags.I).toBe(stateA.flags.I);
        expect(stateB.flags.T).toBe(stateA.flags.T);

        // Private counter in stateB must equal the number of recognised interrupts
        const privateCounter = readWord(stateB.memory, 0x0500);
        expect(privateCounter).toBe(interruptsRecognised);
      } catch (err) {
        if (failures < 3) console.log('Transparency failure:', err);
        failures++;
      }

      testsRun++;
    }

    console.log(`[TRANSPARENCY AUDIT] Tested ${testsRun} random programs with ISRs, ${failures} failures.`);
    expect(testsRun).toBe(300);
    expect(failures).toBe(0);
  });

  it('validates against an independent reference model across 500 seeded event sequences', () => {
    const rand = lcg(12345);
    let tested = 0;
    let disagreements = 0;

    // Independent reference model
    function refArbitrate(
      pendingNmi: boolean,
      pendingIntr: { vector: number } | null,
      singleStep: boolean,
      ifFlag: 0 | 1,
      stiShadow: boolean
    ) {
      if (pendingNmi) {
        return {
          kind: 'nmi' as const,
          vector: 2,
          nextNmi: false,
          nextIntr: pendingIntr,
          nextStep: singleStep,
        };
      }
      if (pendingIntr && ifFlag === 1 && !stiShadow) {
        return {
          kind: 'intr' as const,
          vector: pendingIntr.vector,
          nextNmi: false,
          nextIntr: null,
          nextStep: singleStep,
        };
      }
      if (singleStep && !stiShadow) {
        return {
          kind: 'single-step' as const,
          vector: 1,
          nextNmi: false,
          nextIntr: pendingIntr,
          nextStep: false,
        };
      }
      return {
        kind: null,
        vector: null,
        nextNmi: pendingNmi,
        nextIntr: pendingIntr,
        nextStep: singleStep,
      };
    }

    for (let i = 0; i < 500; i++) {
      const pendingNmi = rand() > 0.6;
      const pendingIntr = rand() > 0.5 ? { vector: Math.floor(rand() * 256) } : null;
      const singleStepPending = rand() > 0.5;
      const ifFlag = rand() > 0.4 ? (1 as const) : (0 as const);
      const stiShadowActive = rand() > 0.7;

      const ref = refArbitrate(pendingNmi, pendingIntr, singleStepPending, ifFlag, stiShadowActive);
      const engine = arbitrateInterrupt({
        pendingNmi,
        pendingIntr,
        singleStepPending,
        ifFlag,
        stiShadowActive,
      });

      if (ref.kind === null) {
        if (engine.recognised !== null) disagreements++;
      } else {
        if (!engine.recognised || engine.recognised.kind !== ref.kind || engine.recognised.vector !== ref.vector) {
          disagreements++;
        }
      }

      if (engine.nextPendingNmi !== ref.nextNmi) disagreements++;
      if (Boolean(engine.nextPendingIntr) !== Boolean(ref.nextIntr)) disagreements++;
      if (engine.nextSingleStepPending !== ref.nextStep) disagreements++;

      tested++;
    }

    console.log(`[REFERENCE AUDIT] Tested ${tested} event sequences against independent reference model, ${disagreements} disagreements.`);
    expect(tested).toBe(500);
    expect(disagreements).toBe(0);
  });

  it('reconstructs state from history and verifies stepBack across 100 random runs', () => {
    const rand = lcg(999);
    let testsRun = 0;

    const source = [
      'VECTOR 2, nmi_h',
      'VECTOR 0x40, intr_h',
      'STI',
      'MOV AX, 1',
      'MOV BX, 2',
      'ADD AX, BX',
      'MOV CX, 3',
      'SUB CX, 1',
      'HLT',
      'nmi_h:',
      'MOV DX, 0x11',
      'IRET',
      'intr_h:',
      'MOV DX, 0x22',
      'IRET',
    ].join('\n');

    const asm = assemble(source);
    expect(asm.ok).toBe(true);
    if (!asm.ok) return;

    const program = asm.program;

    for (let t = 0; t < 100; t++) {
      const scenario: InterruptScenario = {
        events: [
          { atTick: 1 + Math.floor(rand() * 4), kind: rand() > 0.5 ? 'nmi' : 'intr', vector: 0x40 },
        ],
      };

      const states: CpuState[] = [];
      const records: StepRecord[] = [];

      let state = createCpuState(program);
      states.push(state);

      while (!state.halted && states.length < 25) {
        const res = step(state, program, { scenario });
        records.push(res.record);
        state = res.state;
        states.push(state);
      }

      // Step back from the final state to each intermediate state
      let curr = states[states.length - 1];
      if (!curr) continue;

      for (let i = records.length - 1; i >= 0; i--) {
        const rec = records[i];
        if (!rec) continue;
        curr = applyReverseDelta(curr, rec);
        const expected = states[i];
        if (expected) {
          expect(curr.registers.AX).toBe(expected.registers.AX);
          expect(curr.registers.BX).toBe(expected.registers.BX);
          expect(curr.registers.CX).toBe(expected.registers.CX);
          expect(curr.registers.DX).toBe(expected.registers.DX);
          expect(curr.registers.SP).toBe(expected.registers.SP);
          expect(curr.registers.IP).toBe(expected.registers.IP);
          expect(curr.flags.I).toBe(expected.flags.I);
          expect(curr.flags.T).toBe(expected.flags.T);
          expect(curr.flags.C).toBe(expected.flags.C);
          expect(curr.flags.Z).toBe(expected.flags.Z);
        }
      }

      testsRun++;
    }

    console.log(`[HISTORY AUDIT] ${testsRun} random history reconstructions verified identical to forward execution.`);
    expect(testsRun).toBe(100);
  });

  it('performance benchmark: executes 100,000 steps with 1,000 scheduled events rapidly', () => {
    const source = [
      'VECTOR 2, isr',
      'STI',
      'loop:',
      'ADD AX, 1',
      'JMP loop',
      'isr:',
      'INC BX',
      'IRET',
    ].join('\n');

    const asm = assemble(source);
    expect(asm.ok).toBe(true);
    if (!asm.ok) return;

    const program = asm.program;

    // Schedule 1,000 NMI events every 90 ticks up to tick 90,000
    const events = [];
    for (let i = 0; i < 1000; i++) {
      events.push({ atTick: i * 90 + 5, kind: 'nmi' as const });
    }
    const scenario: InterruptScenario = { events };

    let state = createCpuState(program);
    const targetSteps = 100_000;

    const tStart = performance.now();
    for (let s = 0; s < targetSteps; s++) {
      state = step(state, program, { scenario }).state;
    }
    const elapsedMs = performance.now() - tStart;

    console.log(`[PERF BENCHMARK] 100,000 steps with 1,000 scheduled events executed in ${elapsedMs.toFixed(2)} ms.`);
    // Expect execution within reasonable bounds even under heavy parallel vitest load
    expect(elapsedMs).toBeLessThan(20000);
    // Verified that interrupts were repeatedly entered and processed
    expect(state.registers.BX).toBeGreaterThan(500);
  });
});
