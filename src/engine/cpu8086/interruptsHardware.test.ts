/**
 * @file interruptsHardware.test.ts
 * CPU-level test suite for 8086 hardware interrupts and execution dynamics:
 * - NMI non-maskability, latching, and single-edge absorption.
 * - INTR masking by IF, acknowledge line release, and STI shadow (enabled vs disabled).
 * - Simultaneous NMI + INTR + TF priority arbitration at instruction boundaries.
 * - Interrupt nesting (ISR executing STI, NMI interrupting ISR, stack unwinding).
 * - HLT waiting, waking on NMI/INTR, and "halted-waiting-forever" runner detection.
 */

import { describe, expect, it } from 'vitest';
import { assemble } from './assembler';
import { createCpuState, step } from './cpu';
import { readWord } from './memory';
import { runToHalt } from './runner';
import type { InterruptScenario } from '../interrupts';

describe('8086 Interrupts - 2. Hardware Interrupts, Priority, Nesting, and HLT', () => {
  it('handles NMI: taken regardless of IF=0, latches, and ignores duplicate edge while pending', () => {
    const source = [
      'VECTOR 2, nmi_handler',
      'CLI',
      'MOV AX, 1',
      'MOV BX, 2',
      'HLT',
      'nmi_handler:',
      'MOV DX, 0xAAAA',
      'IRET',
    ].join('\n');

    const asm = assemble(source);
    expect(asm.ok).toBe(true);
    if (!asm.ok) return;

    const program = asm.program;
    let state = createCpuState(program);
    expect(state.flags.I).toBe(0);

    // Scenario: two NMI pulses at tick 1 while IF=0
    const scenario: InterruptScenario = {
      events: [
        { atTick: 1, kind: 'nmi' },
        { atTick: 1, kind: 'nmi' }, // Duplicate edge while pending
      ],
    };

    // Step 1 (tick 0 -> 1): CLI
    state = step(state, program, { scenario }).state;
    expect(state.registers.IP).toBe(1); // Pointing to MOV AX, 1

    // Step 2 (tick 1): NMI arrives at tick 1 and is recognised at the boundary before MOV AX, 1
    const stepNmi = step(state, program, { scenario });
    expect(stepNmi.record.interruptRecord).toBeDefined();
    expect(stepNmi.record.interruptRecord?.kind).toBe('nmi');
    expect(stepNmi.record.interruptRecord?.vector).toBe(2);
    state = stepNmi.state;

    // Inside handler: IP is 4 (nmi_handler)
    expect(state.registers.IP).toBe(4);
    // Pending NMI was cleared upon entry; duplicate was absorbed
    expect(state.pendingNmi).toBe(false);

    // Step 3: Execute handler: MOV DX, 0xAAAA
    state = step(state, program, { scenario }).state;
    expect(state.registers.DX).toBe(0xaaaa);

    // Step 4: Execute IRET: returns to MOV AX, 1 (address 1)
    state = step(state, program, { scenario }).state;
    expect(state.registers.IP).toBe(1);

    // Step 5: Execute MOV AX, 1
    state = step(state, program, { scenario }).state;
    expect(state.registers.AX).toBe(1);

    // Step 6: Execute MOV BX, 2
    state = step(state, program, { scenario }).state;
    expect(state.registers.BX).toBe(2);
  });

  it('handles INTR: masked when IF=0, recognised when IF=1, line released on acknowledge', () => {
    const source = [
      'VECTOR 0x40, intr_handler',
      'CLI',
      'MOV AX, 10',
      'STI',          // Enables interrupts
      'MOV BX, 20',   // STI shadow instruction (if shadow enabled)
      'MOV CX, 30',
      'HLT',
      'intr_handler:',
      'MOV DX, 0x5555',
      'IRET',
    ].join('\n');

    const asm = assemble(source);
    expect(asm.ok).toBe(true);
    if (!asm.ok) return;

    const program = asm.program;
    const scenario: InterruptScenario = {
      events: [
        { atTick: 1, kind: 'intr', vector: 0x40 },
      ],
    };

    // 1. With STI Shadow (default stiShadow: true)
    let state = createCpuState(program);

    // Step 1 (tick 0 -> 1): CLI (IF=0)
    state = step(state, program, { scenario }).state;
    // Step 2 (tick 1 -> 2): INTR arrives at tick 1, but IF=0 so MOV AX, 10 executes and INTR stays pending
    state = step(state, program, { scenario }).state;
    expect(state.pendingIntr).toEqual({ vector: 0x40 });

    // Step 3 (tick 2 -> 3): STI (sets IF=1, activates stiShadowActive)
    state = step(state, program, { scenario }).state;
    expect(state.flags.I).toBe(1);
    expect(state.stiShadowActive).toBe(true);
    expect(state.pendingIntr).toEqual({ vector: 0x40 });

    // Step 4 (tick 3 -> 4): MOV BX, 20 executes under STI shadow (INTR is inhibited this step!)
    const stepShadow = step(state, program, { scenario });
    expect(stepShadow.record.instruction.mnemonic).toBe('MOV');
    state = stepShadow.state;
    expect(state.registers.BX).toBe(20);
    expect(state.stiShadowActive).toBe(false); // Shadow has now expired

    // Step 5 (tick 4): Now INTR is recognised!
    const stepIntr = step(state, program, { scenario });
    expect(stepIntr.record.interruptRecord).toBeDefined();
    expect(stepIntr.record.interruptRecord?.kind).toBe('intr');
    expect(stepIntr.record.interruptRecord?.vector).toBe(0x40);
    state = stepIntr.state;

    // Line is released on acknowledge (pendingIntr is now null)
    expect(state.pendingIntr).toBeNull();
    expect(state.registers.IP).toBe(6); // intr_handler
  });

  it('respects stiShadow: false by taking INTR immediately after STI without delay', () => {
    const source = [
      'VECTOR 0x40, isr',
      'STI',
      'MOV AX, 10',
      'HLT',
      'isr:',
      'MOV DX, 99',
      'IRET',
    ].join('\n');

    const asm = assemble(source);
    expect(asm.ok).toBe(true);
    if (!asm.ok) return;

    const program = asm.program;
    const scenario: InterruptScenario = {
      events: [{ atTick: 0, kind: 'intr', vector: 0x40 }],
    };

    let state = createCpuState(program);
    // Execute STI with stiShadow: false
    state = step(state, program, { scenario, stiShadow: false }).state;
    expect(state.flags.I).toBe(1);

    // With shadow disabled, INTR is recognised immediately at the boundary after STI!
    const nextStep = step(state, program, { scenario, stiShadow: false });
    expect(nextStep.record.interruptRecord).toBeDefined();
    expect(nextStep.record.interruptRecord?.vector).toBe(0x40);
  });

  it('arbitrates simultaneous NMI + INTR + TF at one boundary in strict priority order', () => {
    const source = [
      'VECTOR 1, tf_handler',
      'VECTOR 2, nmi_handler',
      'VECTOR 0x30, intr_handler',
      'MOV AX, 0x0302', // Sets TF=1 and IF=1 via POPF
      'PUSH AX',
      'POPF',
      'MOV BX, 0x1111', // TF was 1 at start of this instruction.
      'MOV CX, 0x2222',
      'HLT',
      'tf_handler:',
      'MOV DX, 1',
      'IRET',
      'nmi_handler:',
      'STI',            // Enable IF inside NMI handler to permit INTR
      'MOV DX, 2',
      'IRET',
      'intr_handler:',
      'MOV DX, 3',
      'IRET',
    ].join('\n');

    const asm = assemble(source);
    expect(asm.ok).toBe(true);
    if (!asm.ok) return;

    const program = asm.program;
    // Deliver NMI and INTR right at tick 4 (when MOV BX finishes)
    const scenario: InterruptScenario = {
      events: [
        { atTick: 4, kind: 'nmi' },
        { atTick: 4, kind: 'intr', vector: 0x30 },
      ],
    };

    let state = createCpuState(program);

    // Step 1 (tick 0 -> 1): MOV AX, 0x0302
    state = step(state, program, { scenario }).state;
    // Step 2 (tick 1 -> 2): PUSH AX
    state = step(state, program, { scenario }).state;
    // Step 3 (tick 2 -> 3): POPF (TF=1, IF=1)
    state = step(state, program, { scenario }).state;
    // Step 4 (tick 3 -> 4): MOV BX, 0x1111 (at start TF=1, IF=1; advances to tick 4)
    state = step(state, program, { scenario }).state;

    // At tick 4 boundary:
    // pendingNmi = true
    // pendingIntr = { vector: 0x30 }
    // singleStepPending = true
    // IF = 1
    // Priority order at tick 4: NMI first!
    const resNmi = step(state, program, { scenario });
    expect(resNmi.record.interruptRecord?.kind).toBe('nmi');
    expect(resNmi.record.interruptRecord?.vector).toBe(2);
    state = resNmi.state;

    // Stack contents after NMI entry:
    // [SP] = return IP (4: MOV CX, 0x2222)
    // [SP+2] = CS (0x0000)
    // [SP+4] = FLAGS (pushed with IF=1, TF=1)
    expect(readWord(state.memory, state.registers.SP)).toBe(4);
    expect(readWord(state.memory, state.registers.SP + 2)).toBe(0x0000);
    expect(state.registers.IP).toBe(8); // Start of nmi_handler

    // Following boundary: Single-step trap has priority over blocked INTR (IF=0)
    const resTf = step(state, program, { scenario });
    expect(resTf.record.interruptRecord?.kind).toBe('single-step');
    expect(resTf.record.interruptRecord?.vector).toBe(1);
    state = resTf.state;

    // Stack now has TWO nested frames:
    // Top frame (TF frame): return IP is 8 (the start of nmi_handler)
    expect(readWord(state.memory, state.registers.SP)).toBe(8);
    expect(state.registers.SP).toBe(0xfffe - 12);
    expect(state.registers.IP).toBe(6); // tf_handler

    // Execute tf_handler: MOV DX, 1 (address 6)
    state = step(state, program, { scenario }).state;
    expect(state.registers.DX).toBe(1);

    // Execute tf_handler: IRET (address 7) -> unwinds to address 8 (nmi_handler)
    state = step(state, program, { scenario }).state;
    expect(state.registers.IP).toBe(8);
    expect(state.registers.SP).toBe(0xfffe - 6); // Back to NMI frame

    // Execute STI inside NMI handler (address 8: STI) -> enables IF=1
    state = step(state, program, { scenario }).state;
    expect(state.flags.I).toBe(1);

    // Execute MOV DX, 2 inside NMI handler (address 9)
    state = step(state, program, { scenario }).state;
    expect(state.registers.DX).toBe(2);

    // Next boundary: INTR (vector 0x30) has priority and is recognised!
    const resIntr = step(state, program, { scenario });
    expect(resIntr.record.interruptRecord?.kind).toBe('intr');
    expect(resIntr.record.interruptRecord?.vector).toBe(0x30);
    state = resIntr.state;

    // Stack now has nested INTR frame on top of NMI frame!
    expect(state.registers.SP).toBe(0xfffe - 12);
    expect(state.registers.IP).toBe(11); // intr_handler

    // Execute intr_handler: MOV DX, 3 (address 11)
    state = step(state, program, { scenario }).state;
    expect(state.registers.DX).toBe(3);

    // Execute intr_handler: IRET (address 12) -> unwinds to address 10 (nmi_handler IRET)
    state = step(state, program, { scenario }).state;
    expect(state.registers.IP).toBe(10);
    expect(state.registers.SP).toBe(0xfffe - 6);

    // Execute nmi_handler: IRET (address 10) -> unwinds to address 4 (MOV CX, 0x2222)
    state = step(state, program, { scenario }).state;
    expect(state.registers.IP).toBe(4);
    expect(state.registers.SP).toBe(0xfffe); // All frames unwound!

    // Execute MOV CX, 0x2222 in main program
    state = step(state, program, { scenario }).state;
    expect(state.registers.CX).toBe(0x2222);
  });

  it('demonstrates nested interrupts: handler executing STI is interrupted by INTR, and SP unwinds cleanly', () => {
    const source = [
      'VECTOR 0x50, isr_outer',
      'VECTOR 0x60, isr_inner',
      'STI',
      'INT 0x50',
      'HLT',
      'isr_outer:',
      'STI',          // Outer ISR enables interrupts
      'MOV AX, 1',
      'IRET',
      'isr_inner:',
      'MOV BX, 2',
      'IRET',
    ].join('\n');

    const asm = assemble(source);
    expect(asm.ok).toBe(true);
    if (!asm.ok) return;

    const program = asm.program;
    const initialSp = 0xfffe;

    // INTR 0x60 arrives at tick 3 (while outer ISR is running with IF=1)
    const scenario: InterruptScenario = {
      events: [{ atTick: 3, kind: 'intr', vector: 0x60 }],
    };

    let state = createCpuState(program, { initialSp });

    // Step 1: STI
    state = step(state, program, { scenario }).state;
    // Step 2: INT 0x50 (outer ISR entered, SP = 0xFFF8)
    state = step(state, program, { scenario }).state;
    expect(state.registers.SP).toBe(initialSp - 6);
    expect(state.registers.IP).toBe(3); // isr_outer is at address 3

    // Step 3: STI inside outer ISR
    state = step(state, program, { scenario }).state;
    expect(state.flags.I).toBe(1);

    // Step 4: MOV AX, 1 inside outer ISR
    state = step(state, program, { scenario }).state;
    expect(state.registers.AX).toBe(1);

    // Step 5: INTR 0x60 interrupts outer ISR! (nested entry, SP = 0xFFF2)
    const resNested = step(state, program, { scenario });
    expect(resNested.record.interruptRecord?.vector).toBe(0x60);
    state = resNested.state;
    expect(state.registers.SP).toBe(initialSp - 12);
    expect(state.registers.IP).toBe(6); // isr_inner

    // Step 6: MOV BX, 2 inside inner ISR
    state = step(state, program, { scenario }).state;
    expect(state.registers.BX).toBe(2);

    // Step 7: IRET from inner ISR -> unwinds to outer ISR (SP back to 0xFFF8)
    state = step(state, program, { scenario }).state;
    expect(state.registers.SP).toBe(initialSp - 6);
    expect(state.registers.IP).toBe(5); // Address of outer IRET

    // Step 8: IRET from outer ISR -> unwinds to main program HLT (SP back to initialSp)
    state = step(state, program, { scenario }).state;
    expect(state.registers.SP).toBe(initialSp);
    expect(state.registers.IP).toBe(2); // HLT
  });

  it('handles HLT: wakes on NMI or INTR (with IF=1), and stops with halted-waiting-forever if no wakeup possible', () => {
    const source = [
      'VECTOR 2, nmi_waker',
      'VECTOR 0x70, intr_waker',
      'STI',
      'HLT',
      'MOV AX, 0x1234',
      'HLT',
      'nmi_waker:',
      'MOV DX, 0x99',
      'IRET',
      'intr_waker:',
      'MOV CX, 0x88',
      'IRET',
    ].join('\n');

    const asm = assemble(source);
    expect(asm.ok).toBe(true);
    if (!asm.ok) return;

    const program = asm.program;

    // Test 1: Plain HLT with no scenario stops as 'halted'
    const s1 = createCpuState(program);
    const r1 = runToHalt(s1, program);
    expect(r1.stopReason).toBe('halted');

    // Test 2: HLT with IF=0 and an INTR scheduled -> cannot wake!
    // Result: halted-waiting-forever
    const sourceCliHlt = [
      'VECTOR 0x70, intr_waker',
      'CLI',
      'HLT',
      'intr_waker:',
      'IRET',
    ].join('\n');
    const asmCli = assemble(sourceCliHlt);
    expect(asmCli.ok).toBe(true);
    if (!asmCli.ok) return;

    const sCli = createCpuState(asmCli.program);
    const rCli = runToHalt(sCli, asmCli.program, {
      scenario: { events: [{ atTick: 5, kind: 'intr', vector: 0x70 }] },
    });
    expect(rCli.stopReason).toBe('halted-waiting-forever');
    expect(rCli.explanation).toBeDefined();

    // Test 3: HLT with IF=1 woken by INTR at tick 4
    const sWakingIntr = createCpuState(program);
    const rWakingIntr = runToHalt(sWakingIntr, program, {
      scenario: { events: [{ atTick: 4, kind: 'intr', vector: 0x70 }] },
      maxSteps: 50,
    });
    // Successfully woke up, ran handler, resumed main program, and reached final HLT
    expect(rWakingIntr.state.registers.CX).toBe(0x88);
    expect(rWakingIntr.state.registers.AX).toBe(0x1234);
    // At final HLT with no further scenario events scheduled, stopReason is 'halted-waiting-forever' per Rule 10
    expect(rWakingIntr.stopReason).toBe('halted-waiting-forever');

    // Test 4: HLT with IF=0 woken by NMI at tick 4 (NMI is non-maskable!)
    const sWakingNmi = createCpuState(program);
    // Set IF=0
    const sWakingNmiCli = { ...sWakingNmi, flags: { ...sWakingNmi.flags, I: 0 as const } };
    const rWakingNmi = runToHalt(sWakingNmiCli, program, {
      scenario: { events: [{ atTick: 4, kind: 'nmi' }] },
      maxSteps: 50,
    });
    expect(rWakingNmi.state.registers.DX).toBe(0x99);
    expect(rWakingNmi.stopReason).toBe('halted-waiting-forever');
  });
});
