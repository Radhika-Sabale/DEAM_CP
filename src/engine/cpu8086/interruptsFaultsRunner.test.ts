/**
 * @file interruptsFaultsRunner.test.ts
 * CPU-level test suite for 8086 interrupt faults, assembler features, and run control:
 * - Runtime faults: unset-vector, invalid-vector-target, corrupted-interrupt-frame, iret-on-empty-stack.
 * - Assembler: new instructions, VECTOR directive validation, INT range, data-overlaps-ivt,
 *   default 0x0400 origin with warning, runtime vector installation via MOV, disassemble round trip.
 * - Runner: stepOver on INT n, stepOut of handler, breakpoints and interrupt watchpoints.
 */

import { describe, expect, it } from 'vitest';
import { assemble } from './assembler';
import { createCpuState, step } from './cpu';
import { disassemble } from './disassembler';
import { writeWord } from './memory';
import { runUntil, stepOnce, stepOut, stepOver } from './runner';

describe('8086 Interrupts - 3. Faults, Assembler Features, and Runner Controls', () => {
  describe('Runtime Faults', () => {
    it('produces unset-vector fault naming vector and address n*4 when vector entry is all zeros', () => {
      const source = [
        'INT 0x15', // Uninstalled vector (0x15 = 21 decimal)
        'HLT',
      ].join('\n');

      const asm = assemble(source);
      expect(asm.ok).toBe(true);
      if (!asm.ok) return;

      const state = createCpuState(asm.program);
      const res = step(state, asm.program);

      expect(res.record.fault).toBeDefined();
      expect(res.record.fault?.type).toBe('unset-vector');
      expect(res.record.fault?.message).toContain('21');
      // Vector 0x15 = 21, address = 21 * 4 = 84 = 0x0054
      expect(res.record.fault?.message).toContain('0054');
    });

    it('produces invalid-vector-target fault when vector points beyond program instruction length', () => {
      const source = [
        'MOV WORD PTR [0x0080], 9999', // Vector 0x20 = 32 * 4 = 0x80
        'INT 0x20',
        'HLT',
      ].join('\n');

      const asm = assemble(source);
      expect(asm.ok).toBe(true);
      if (!asm.ok) return;

      let state = createCpuState(asm.program);
      // Execute MOV WORD PTR [0x0080], 9999
      state = step(state, asm.program).state;
      // Execute INT 0x20
      const res = step(state, asm.program);

      expect(res.record.fault).toBeDefined();
      expect(res.record.fault?.type).toBe('invalid-vector-target');
      expect(res.record.fault?.message).toContain('9999');
    });

    it('produces corrupted-interrupt-frame fault when CS slot on stack is overwritten to non-zero', () => {
      const source = [
        'VECTOR 0x21, isr',
        'INT 0x21',
        'HLT',
        'isr:',
        'IRET',
      ].join('\n');

      const asm = assemble(source);
      expect(asm.ok).toBe(true);
      if (!asm.ok) return;

      let state = createCpuState(asm.program);
      // Step 1: INT 0x21 (pushes frame, SP = initialSp - 6)
      state = step(state, asm.program).state;

      // Corrupt CS on the stack: [SP + 2] = 0x1234 (instead of 0x0000)
      const corruptedMem = writeWord(state.memory, state.registers.SP + 2, 0x1234).memory;
      state = { ...state, memory: corruptedMem };

      // Step 2: IRET
      const res = step(state, asm.program);
      expect(res.record.fault).toBeDefined();
      expect(res.record.fault?.type).toBe('corrupted-interrupt-frame');
      expect(res.record.fault?.message).toContain('1234');
    });

    it('produces iret-on-empty-stack fault when IRET executes with empty or incomplete stack', () => {
      const source = [
        'IRET',
      ].join('\n');

      const asm = assemble(source);
      expect(asm.ok).toBe(true);
      if (!asm.ok) return;

      const state = createCpuState(asm.program);
      const res = step(state, asm.program);

      expect(res.record.fault).toBeDefined();
      expect(res.record.fault?.type).toBe('iret-on-empty-stack');
    });
  });

  describe('Assembler and Directives', () => {
    it('validates VECTOR directive syntax and operand constraints', () => {
      // Missing operands
      const r1 = assemble('VECTOR\nHLT');
      expect(r1.ok).toBe(false);
      if (!r1.ok) expect(r1.errors[0]?.code).toBe('wrong-operand-count');

      // Vector number out of range (> 255)
      const r2 = assemble('VECTOR 256, target\ntarget: HLT');
      expect(r2.ok).toBe(false);
      if (!r2.ok) expect(r2.errors[0]?.code).toBe('vector-out-of-range');

      // Target is data label instead of code label
      const r3 = assemble('.data\nval: DW 0\n.code\nVECTOR 10, val\nHLT');
      expect(r3.ok).toBe(false);
      if (!r3.ok) expect(r3.errors[0]?.code).toBe('vector-target-is-data-label');

      // Undefined target label
      const r4 = assemble('VECTOR 10, missing_label\nHLT');
      expect(r4.ok).toBe(false);
      if (!r4.ok) expect(r4.errors[0]?.code).toBe('undefined-label');

      // Warning when VECTOR points at instruction address 0
      const r5 = assemble('VECTOR 10, entry\nentry: HLT');
      expect(r5.ok).toBe(true);
      if (r5.ok) {
        expect(r5.warnings.some((w) => w.code === 'vector-at-zero')).toBe(true);
      }
    });

    it('validates INT instruction operand range (0..255)', () => {
      const rBad = assemble('INT 300\nHLT');
      expect(rBad.ok).toBe(false);
      if (!rBad.ok) {
        expect(rBad.errors[0]?.code).toBe('immediate-out-of-range');
      }

      const rGood = assemble('INT 0xFF\nHLT');
      expect(rGood.ok).toBe(true);
    });

    it('defaults data origin to 0x0400 with a warning when program uses interrupt features', () => {
      const source = [
        '.data',
        'my_var: DW 0x1234',
        '.code',
        'STI',
        'HLT',
      ].join('\n');

      const asm = assemble(source);
      expect(asm.ok).toBe(true);
      if (!asm.ok) return;

      expect(asm.program.symbols['my_var']?.address).toBe(0x0400);
      expect(asm.warnings.some((w) => w.message.includes('0x0400'))).toBe(true);
    });

    it('detects data-overlaps-ivt when explicit ORG places data inside 0x0000-0x03FF in interrupt program', () => {
      const source = [
        '.data',
        'ORG 0x0200',
        'val: DW 1',
        '.code',
        'STI',
        'HLT',
      ].join('\n');

      const asm = assemble(source);
      expect(asm.ok).toBe(false);
      if (!asm.ok) {
        expect(asm.errors.some((e) => e.code === 'data-overlaps-ivt')).toBe(true);
      }
    });

    it('supports runtime vector installation using MOV with code label as immediate', () => {
      const source = [
        'MOV WORD PTR [0x0080], isr_runtime', // Vector 0x20 = 32 * 4 = 0x80
        'INT 0x20',
        'HLT',
        'isr_runtime:',
        'MOV AX, 0xBEEF',
        'IRET',
      ].join('\n');

      const asm = assemble(source);
      expect(asm.ok).toBe(true);
      if (!asm.ok) return;

      const program = asm.program;
      let state = createCpuState(program);

      // Execute MOV WORD PTR [0x0080], isr_runtime
      state = step(state, program).state;
      // Execute INT 0x20
      state = step(state, program).state;
      expect(state.registers.IP).toBe(3); // isr_runtime

      // Execute MOV AX, 0xBEEF
      state = step(state, program).state;
      expect(state.registers.AX).toBe(0xbeef);

      // Execute IRET
      state = step(state, program).state;
      expect(state.registers.IP).toBe(2); // HLT
    });

    it('round-trips all new instructions and VECTOR directives through disassembler', () => {
      const source = [
        'VECTOR 5, isr',
        'CLI',
        'STI',
        'PUSHF',
        'POPF',
        'INT 5',
        'IRET',
        'isr:',
        'IRET',
      ].join('\n');

      const asm1 = assemble(source);
      expect(asm1.ok).toBe(true);
      if (!asm1.ok) return;

      const disasmText = disassemble(asm1.program);
      const asm2 = assemble(disasmText);
      expect(asm2.ok).toBe(true);
      if (!asm2.ok) return;

      expect(asm2.program.instructions.length).toBe(asm1.program.instructions.length);
      expect(asm2.program.installedVectors).toEqual(asm1.program.installedVectors);
    });
  });

  describe('Runner Controls & Debugging', () => {
    it('stepOver treats INT n like CALL by executing until IRET completes', () => {
      const source = [
        'VECTOR 0x21, isr',
        'MOV AX, 1',
        'INT 0x21',    // Address 1
        'MOV BX, 2',    // Address 2
        'HLT',
        'isr:',
        'MOV CX, 99',
        'IRET',
      ].join('\n');

      const asm = assemble(source);
      expect(asm.ok).toBe(true);
      if (!asm.ok) return;

      const program = asm.program;
      let state = createCpuState(program);

      // Step 1: MOV AX, 1
      state = stepOnce(state, program).state;
      expect(state.registers.IP).toBe(1);

      // StepOver on INT 0x21: runs isr to IRET and stops after INT at address 2 (MOV BX, 2)
      const res = stepOver(state, program);
      expect(res.state.registers.IP).toBe(2);
      expect(res.state.registers.CX).toBe(99);
      expect(res.stepsExecuted).toBeGreaterThan(1);
    });

    it('stepOut runs until current interrupt handler IRET completes', () => {
      const source = [
        'VECTOR 0x21, isr',
        'INT 0x21',
        'MOV AX, 10',
        'HLT',
        'isr:',
        'MOV CX, 1',
        'MOV DX, 2',
        'IRET',
      ].join('\n');

      const asm = assemble(source);
      expect(asm.ok).toBe(true);
      if (!asm.ok) return;

      const program = asm.program;
      let state = createCpuState(program);

      // Step into INT 0x21
      state = stepOnce(state, program).state;
      expect(state.registers.IP).toBe(3); // Start of isr

      // Step inside handler (MOV CX, 1)
      state = stepOnce(state, program).state;
      expect(state.registers.CX).toBe(1);

      // stepOut of isr: runs until IRET completes and stops at address 1 (MOV AX, 10)
      const res = stepOut(state, program);
      expect(res.state.registers.IP).toBe(1);
      expect(res.state.registers.DX).toBe(2);
    });

    it('stops execution on watchpoint type: interrupt when an interrupt is recognised', () => {
      const source = [
        'VECTOR 0x21, isr',
        'MOV AX, 1',
        'INT 0x21',
        'HLT',
        'isr:',
        'IRET',
      ].join('\n');

      const asm = assemble(source);
      expect(asm.ok).toBe(true);
      if (!asm.ok) return;

      const program = asm.program;
      const state = createCpuState(program);

      // Run with watchpoint on interrupt recognition
      const res = runUntil(state, program, {
        watchpoints: [{ type: 'interrupt' }],
      });

      expect(res.stopReason).toBe('watch-triggered');
      expect(res.lastRecord?.interruptRecord?.vector).toBe(0x21);
      expect(res.state.registers.IP).toBe(3); // Inside isr
    });
  });
});
