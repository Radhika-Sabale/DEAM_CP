/* eslint-disable no-console */
/**
 * @file interruptsBasics.test.ts
 * CPU-level test suite for 8086 interrupt basics:
 * - INT n for all 256 vectors with frame verification and IRET restoration.
 * - All 64 initial flag combinations preserved across INT / IRET.
 * - RET versus IRET demonstration of the classic stack/flag misconception.
 * - CLI, STI, PUSHF, POPF round trips.
 * - TF single-step timing rule around POPF and IRET (trap after next instruction, handler not stepped).
 */

import { describe, expect, it } from 'vitest';
import { assemble } from './assembler';
import { createCpuState, step } from './cpu';
import { readWord } from './memory';
import { flagsToWord } from '../interrupts';
import type { CpuFlags } from './cpuTypes';

describe('8086 Interrupts - 1. Basic INT n and IRET across all 256 vectors', () => {
  it('verifies all 256 vectors for INT n / IRET roundtrip, stack frame layout, and SP/flag restoration', () => {
    let vectorsChecked = 0;

    for (let vector = 0; vector < 256; vector++) {
      const source = [
        `VECTOR ${vector}, handler_${vector}`,
        `INT ${vector}`,
        'HLT',
        `handler_${vector}:`,
        'MOV AX, 0x1234',
        'IRET',
      ].join('\n');

      const asmResult = assemble(source);
      expect(asmResult.ok).toBe(true);
      if (!asmResult.ok) continue;

      const program = asmResult.program;
      const initialSp = 0xfffe;
      let state = createCpuState(program, { initialSp });

      // Set known initial flags (IF=1, TF=0, CF=1, ZF=1)
      state = {
        ...state,
        flags: { ...state.flags, I: 1, T: 0, C: 1, Z: 1 },
      };
      const initialFlags = state.flags;
      const expectedFlagsWord = flagsToWord(initialFlags);

      // Step 1: Execute INT vector
      const step1 = step(state, program);
      expect(step1.record.fault).toBeUndefined();
      state = step1.state;

      // Assertions on entry:
      // SP decreased by 6
      expect(state.registers.SP).toBe(initialSp - 6);
      // IF and TF cleared
      expect(state.flags.I).toBe(0);
      expect(state.flags.T).toBe(0);
      // Other flags unchanged on entry
      expect(state.flags.C).toBe(1);
      expect(state.flags.Z).toBe(1);
      // IP pointing to handler
      const handlerAddress = 2; // Address of `MOV AX, 0x1234`
      expect(state.registers.IP).toBe(handlerAddress);

      // Frame contents in memory:
      // [SP] = return IP (1, since INT was at 0, return is next instruction HLT at 1)
      const poppedIp = readWord(state.memory, state.registers.SP);
      expect(poppedIp).toBe(1);
      // [SP+2] = CS (0x0000)
      const poppedCs = readWord(state.memory, state.registers.SP + 2);
      expect(poppedCs).toBe(0x0000);
      // [SP+4] = pushed FLAGS word
      const pushedFlags = readWord(state.memory, state.registers.SP + 4);
      expect(pushedFlags).toBe(expectedFlagsWord);
      // Bit 1 of flags word is always 1
      expect((pushedFlags & 0x0002) !== 0).toBe(true);

      // Step 2: Execute handler instruction `MOV AX, 0x1234`
      const step2 = step(state, program);
      expect(step2.record.fault).toBeUndefined();
      state = step2.state;
      expect(state.registers.AX).toBe(0x1234);
      expect(state.registers.IP).toBe(3); // Address of `IRET`

      // Step 3: Execute `IRET`
      const step3 = step(state, program);
      expect(step3.record.fault).toBeUndefined();
      state = step3.state;

      // Assertions on return:
      // IP restored to return IP (1)
      expect(state.registers.IP).toBe(1);
      // SP restored to initial SP
      expect(state.registers.SP).toBe(initialSp);
      // Flags (including IF and TF) restored exactly
      expect(state.flags.I).toBe(initialFlags.I);
      expect(state.flags.T).toBe(initialFlags.T);
      expect(state.flags.C).toBe(initialFlags.C);
      expect(state.flags.Z).toBe(initialFlags.Z);

      vectorsChecked++;
    }

    console.log(`[IVT AUDIT] Verified all ${vectorsChecked} vectors for INT n / IRET roundtrip.`);
    expect(vectorsChecked).toBe(256);
  });

  it('preserves all 64 combinations of initial flags (CF, ZF, SF, OF, IF, TF) across INT / IRET', () => {
    const source = [
      'VECTOR 0x21, isr',
      'INT 0x21',
      'HLT',
      'isr:',
      'IRET',
    ].join('\n');

    const asmResult = assemble(source);
    expect(asmResult.ok).toBe(true);
    if (!asmResult.ok) return;

    const program = asmResult.program;
    let combinationsTested = 0;

    for (let combo = 0; combo < 64; combo++) {
      const c = (combo & 1) ? 1 : 0;
      const z = (combo & 2) ? 1 : 0;
      const s = (combo & 4) ? 1 : 0;
      const t = (combo & 8) ? 1 : 0;
      const i = (combo & 16) ? 1 : 0;
      const o = (combo & 32) ? 1 : 0;

      const initialFlags: CpuFlags = {
        C: c as 0 | 1,
        Z: z as 0 | 1,
        S: s as 0 | 1,
        O: o as 0 | 1,
        I: i as 0 | 1,
        T: t as 0 | 1,
      };

      let state = createCpuState(program);
      state = { ...state, flags: initialFlags };

      // Step 1: INT 0x21
      const res1 = step(state, program);
      expect(res1.record.fault).toBeUndefined();
      state = res1.state;
      expect(state.flags.I).toBe(0);
      expect(state.flags.T).toBe(0);

      // Step 2: IRET
      const res2 = step(state, program);
      expect(res2.record.fault).toBeUndefined();
      state = res2.state;

      // Flags restored
      expect(state.flags.C).toBe(initialFlags.C);
      expect(state.flags.Z).toBe(initialFlags.Z);
      expect(state.flags.S).toBe(initialFlags.S);
      expect(state.flags.O).toBe(initialFlags.O);
      expect(state.flags.I).toBe(initialFlags.I);
      expect(state.flags.T).toBe(initialFlags.T);

      combinationsTested++;
    }

    console.log(`[FLAGS AUDIT] Verified all ${combinationsTested} initial flag combinations around INT/IRET.`);
    expect(combinationsTested).toBe(64);
  });

  it('demonstrates the RET versus IRET misconception: RET leaves 4 bytes on stack and does not restore flags', () => {
    const source = [
      'VECTOR 0x10, bad_isr',
      'INT 0x10',
      'HLT',
      'bad_isr:',
      'MOV AX, 0x9999',
      'RET',
    ].join('\n');

    const asmResult = assemble(source);
    expect(asmResult.ok).toBe(true);
    if (!asmResult.ok) return;

    const program = asmResult.program;
    const initialSp = 0xfffe;
    let state = createCpuState(program, { initialSp });
    state = { ...state, flags: { ...state.flags, I: 1, T: 1, C: 1 } };

    // Step 1: INT 0x10 (pushes FLAGS, CS=0, IP=1; SP becomes 0xFFF8)
    state = step(state, program).state;
    expect(state.registers.SP).toBe(0xfff8);
    expect(state.flags.I).toBe(0);
    expect(state.flags.T).toBe(0);

    // Step 2: MOV AX, 0x9999
    state = step(state, program).state;
    expect(state.registers.AX).toBe(0x9999);

    // Step 3: RET instead of IRET
    // RET only pops one word (IP) and SP increases by 2 to 0xFFFA
    state = step(state, program).state;

    // Stack is now corrupted: 4 bytes left on the stack!
    expect(state.registers.SP).toBe(0xfffa);
    expect(state.registers.SP).not.toBe(initialSp);
    expect(initialSp - state.registers.SP).toBe(4);

    // Popped IP was correct (1), so IP is back at HLT
    expect(state.registers.IP).toBe(1);

    // But flags were NOT restored! IF and TF remain 0 (unlike IRET which would restore IF=1, TF=1)
    expect(state.flags.I).toBe(0);
    expect(state.flags.T).toBe(0);

    // The remaining words on the stack are CS (0x0000) and the pushed FLAGS
    expect(readWord(state.memory, 0xfffa)).toBe(0x0000);
    const unpoppedFlags = readWord(state.memory, 0xfffc);
    expect((unpoppedFlags & 0x0200) !== 0).toBe(true); // Bit 9 (IF) was 1
  });

  it('executes CLI and STI, setting and clearing the IF flag', () => {
    const source = [
      'STI',
      'CLI',
      'STI',
      'HLT',
    ].join('\n');

    const asm = assemble(source);
    expect(asm.ok).toBe(true);
    if (!asm.ok) return;

    let state = createCpuState(asm.program);
    expect(state.flags.I).toBe(0);

    // Step 1: STI
    state = step(state, asm.program).state;
    expect(state.flags.I).toBe(1);
    expect(state.stiShadowActive).toBe(true);

    // Step 2: CLI
    state = step(state, asm.program).state;
    expect(state.flags.I).toBe(0);
    expect(state.stiShadowActive).toBe(false);

    // Step 3: STI
    state = step(state, asm.program).state;
    expect(state.flags.I).toBe(1);
    expect(state.stiShadowActive).toBe(true);
  });

  it('executes PUSHF and POPF round trip including IF and TF flags', () => {
    const source = [
      'STI',
      'PUSHF',
      'CLI',
      'POPF',
      'HLT',
    ].join('\n');

    const asm = assemble(source);
    expect(asm.ok).toBe(true);
    if (!asm.ok) return;

    let state = createCpuState(asm.program);
    state = { ...state, flags: { ...state.flags, C: 1, Z: 1, S: 0, O: 1, I: 0, T: 0 } };

    // Step 1: STI -> IF=1
    state = step(state, asm.program).state;
    expect(state.flags.I).toBe(1);

    // Step 2: PUSHF -> pushes flags word (with IF=1, C=1, Z=1, O=1)
    const spBeforePush = state.registers.SP;
    state = step(state, asm.program).state;
    expect(state.registers.SP).toBe(spBeforePush - 2);

    // Step 3: CLI -> IF=0
    state = step(state, asm.program).state;
    expect(state.flags.I).toBe(0);

    // Step 4: POPF -> restores pushed flags (IF=1)
    state = step(state, asm.program).state;
    expect(state.registers.SP).toBe(spBeforePush);
    expect(state.flags.I).toBe(1);
    expect(state.flags.C).toBe(1);
    expect(state.flags.Z).toBe(1);
    expect(state.flags.O).toBe(1);
  });

  it('validates TF rule: POPF setting TF triggers single-step trap after the NEXT instruction, not immediately', () => {
    // Vector 1 is single-step trap
    const source = [
      'VECTOR 1, step_isr',
      'MOV AX, 0x0302', // Bit 8 = TF(1), Bit 9 = IF(1), Bit 1 = Fixed 1
      'PUSH AX',
      'POPF',          // Sets TF=1. But TF was 0 at START of POPF!
      'MOV BX, 0x1111',// TF was 1 at START of this instruction! Trap occurs AFTER this completes.
      'MOV CX, 0x2222',
      'HLT',
      'step_isr:',
      'MOV DX, 0x7777',
      'IRET',
    ].join('\n');

    const asm = assemble(source);
    expect(asm.ok).toBe(true);
    if (!asm.ok) return;

    const program = asm.program;
    let state = createCpuState(program);

    // 1. MOV AX, 0x0302
    state = step(state, program).state;
    expect(state.registers.AX).toBe(0x0302);

    // 2. PUSH AX
    state = step(state, program).state;

    // 3. POPF
    // At start of POPF, TF was 0.
    state = step(state, program).state;
    expect(state.flags.T).toBe(1);
    // Crucial check: single-step trap is NOT pending immediately after POPF!
    expect(state.singleStepPending).toBe(false);
    expect(state.registers.IP).toBe(3); // IP is pointing to `MOV BX, 0x1111`

    // 4. MOV BX, 0x1111
    // At start of MOV BX, TF is 1.
    const resMovBx = step(state, program);
    state = resMovBx.state;
    expect(state.registers.BX).toBe(0x1111);
    // Now single-step trap IS pending!
    expect(state.singleStepPending).toBe(true);
    // Instruction executed was MOV BX, not interrupt entry yet
    expect(resMovBx.record.instruction.mnemonic).toBe('MOV');

    // 5. Next boundary takes the single-step trap (Vector 1)!
    const resTrap = step(state, program);
    state = resTrap.state;
    expect(resTrap.record.interruptRecord).toBeDefined();
    expect(resTrap.record.interruptRecord?.vector).toBe(1);
    expect(resTrap.record.interruptRecord?.kind).toBe('single-step');
    // Handler entered: IP is step_isr (address 6)
    expect(state.registers.IP).toBe(6);
    // Crucial rule: entering handler CLEARS TF so handler is not single-stepped
    expect(state.flags.T).toBe(0);
    expect(state.singleStepPending).toBe(false);

    // 6. Execute handler instruction: MOV DX, 0x7777
    state = step(state, program).state;
    expect(state.registers.DX).toBe(0x7777);
    expect(state.flags.T).toBe(0);
    expect(state.singleStepPending).toBe(false); // Handler itself is NOT stepped!

    // 7. Execute IRET
    // IRET restores saved flags (including TF=1) and return IP (4: MOV CX, 0x2222)
    state = step(state, program).state;
    expect(state.registers.IP).toBe(4);
    expect(state.flags.T).toBe(1);
    // At start of IRET, TF was 0 in the handler, so single-step is NOT pending yet
    expect(state.singleStepPending).toBe(false);

    // 8. Execute MOV CX, 0x2222 (runs with TF=1 at start)
    state = step(state, program).state;
    expect(state.registers.CX).toBe(0x2222);
    // Single-step is pending again!
    expect(state.singleStepPending).toBe(true);
  });
});
