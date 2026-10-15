/**
 * @file runner.test.ts
 * Unit tests for 8086 run control: stepOnce, stepOver, stepOut, runUntil,
 * runToHalt, breakpoints, watchpoints, step-cap trace, and fault diagnosis.
 */

import { describe, expect, it } from 'vitest';
import { assemble } from './assembler';
import { createCpuState } from './cpu';
import {
  runToHalt,
  runUntil,
  stepOnce,
  stepOut,
  stepOver,
} from './runner';

describe('runner: run control', () => {
  it('executes stepOnce for single instruction', () => {
    const prog = assemble('MOV AX, 10\nMOV BX, 20\nHLT');
    expect(prog.ok).toBe(true);
    if (!prog.ok) return;

    const s0 = createCpuState(prog.program);
    const r1 = stepOnce(s0, prog.program);
    expect(r1.state.registers.AX).toBe(10);
    expect(r1.state.registers.IP).toBe(1);
    expect(r1.record.instruction.mnemonic).toBe('MOV');
  });

  it('runs to HLT with runToHalt', () => {
    const prog = assemble('MOV AX, 5\nADD AX, 3\nHLT');
    expect(prog.ok).toBe(true);
    if (!prog.ok) return;

    const s0 = createCpuState(prog.program);
    const result = runToHalt(s0, prog.program);
    expect(result.stopReason).toBe('halted');
    expect(result.stepsExecuted).toBe(3);
    expect(result.state.registers.AX).toBe(8);
    expect(result.state.halted).toBe(true);
  });

  it('hits instruction address breakpoint and resumes without re-triggering', () => {
    const src = [
      'MOV AX, 1',
      'MOV BX, 2',
      'MOV CX, 3',
      'HLT',
    ].join('\n');
    const prog = assemble(src);
    expect(prog.ok).toBe(true);
    if (!prog.ok) return;

    const s0 = createCpuState(prog.program);
    // Breakpoint at address 1 (MOV BX, 2)
    const res1 = runUntil(s0, prog.program, { breakpoints: [1] });
    expect(res1.stopReason).toBe('breakpoint');
    expect(res1.state.registers.IP).toBe(1);
    expect(res1.state.registers.AX).toBe(1);
    expect(res1.state.registers.BX).toBe(0);

    // Resume execution from the breakpointed address
    const res2 = runUntil(res1.state, prog.program, { breakpoints: [1] });
    expect(res2.stopReason).toBe('halted');
    expect(res2.state.registers.CX).toBe(3);
  });

  it('translates 1-based source line breakpoints', () => {
    const src = [
      '; line 1 is comment',
      'MOV AX, 1', // line 2, address 0
      'MOV BX, 2', // line 3, address 1
      'HLT',        // line 4, address 2
    ].join('\n');
    const prog = assemble(src);
    expect(prog.ok).toBe(true);
    if (!prog.ok) return;

    const s0 = createCpuState(prog.program);
    const res = runUntil(s0, prog.program, { breakpointLines: [3] });
    expect(res.stopReason).toBe('breakpoint');
    expect(res.state.registers.IP).toBe(1);
  });

  it('triggers register watchpoint when register value changes', () => {
    const src = [
      'MOV AX, 0',
      'MOV BX, 5',
      'MOV AX, 10', // AX modified
      'HLT',
    ].join('\n');
    const prog = assemble(src);
    expect(prog.ok).toBe(true);
    if (!prog.ok) return;

    const s0 = createCpuState(prog.program);
    const res = runUntil(s0, prog.program, {
      watchpoints: [{ type: 'register', register: 'AX' }],
    });
    // First step modifies AX from 0 to 0 (register set) or step 3 from 0 to 10
    expect(res.stopReason).toBe('watch-triggered');
    expect(res.lastRecord?.registersChanged.some((r) => r.name === 'AX')).toBe(true);
  });

  it('triggers flag watchpoint when flag is updated', () => {
    const src = [
      'MOV AX, 5',
      'SUB AX, 5', // sets ZF = 1
      'HLT',
    ].join('\n');
    const prog = assemble(src);
    expect(prog.ok).toBe(true);
    if (!prog.ok) return;

    const s0 = createCpuState(prog.program);
    const res = runUntil(s0, prog.program, {
      watchpoints: [{ type: 'flag', flag: 'Z' }],
    });
    expect(res.stopReason).toBe('watch-triggered');
    expect(res.state.flags.Z).toBe(1);
  });

  it('triggers memory watchpoint on write to watched address', () => {
    const src = [
      'MOV AX, 0x1234',
      'MOV [0x0200], AX',
      'HLT',
    ].join('\n');
    const prog = assemble(src);
    expect(prog.ok).toBe(true);
    if (!prog.ok) return;

    const s0 = createCpuState(prog.program);
    const res = runUntil(s0, prog.program, {
      watchpoints: [{ type: 'memory', address: 0x0200 }],
    });
    expect(res.stopReason).toBe('watch-triggered');
    expect(res.state.memory.pages[2]?.[0]).toBe(0x34);
  });

  it('stops at step-cap with diagnostic 20-step trace for infinite loops', () => {
    const src = [
      'loop:',
      'INC AX',
      'JMP loop',
    ].join('\n');
    const prog = assemble(src);
    expect(prog.ok).toBe(true);
    if (!prog.ok) return;

    const s0 = createCpuState(prog.program);
    const res = runUntil(s0, prog.program, { maxSteps: 50 });
    expect(res.stopReason).toBe('step-cap');
    expect(res.stepsExecuted).toBe(50);
    expect(res.explanation).toContain('50 steps');
    expect(res.recentTrace).toBeDefined();
    expect(res.recentTrace?.length).toBe(20);
  });

  it('handles stepOver through nested CALL subroutines', () => {
    const src = [
      'CALL outer', // addr 0
      'HLT',        // addr 1
      'outer:',
      'CALL inner', // addr 2
      'RET',        // addr 3
      'inner:',
      'MOV CX, 42', // addr 4
      'RET',        // addr 5
    ].join('\n');
    const prog = assemble(src);
    expect(prog.ok).toBe(true);
    if (!prog.ok) return;

    const s0 = createCpuState(prog.program);
    // stepOver on addr 0 (CALL outer) executes outer and inner, returning to addr 1 (HLT)
    const res = stepOver(s0, prog.program);
    expect(res.state.registers.IP).toBe(1);
    expect(res.state.registers.CX).toBe(42);
    expect(res.stepsExecuted).toBe(5); // CALL outer, CALL inner, MOV, RET inner, RET outer
  });

  it('handles stepOut from inside a subroutine', () => {
    const src = [
      'CALL mySub',   // addr 0
      'HLT',          // addr 1
      'mySub:',
      'MOV DX, 99',   // addr 2
      'INC DX',       // addr 3
      'RET',          // addr 4
    ].join('\n');
    const prog = assemble(src);
    expect(prog.ok).toBe(true);
    if (!prog.ok) return;

    let state = createCpuState(prog.program);
    // Step into mySub
    state = stepOnce(state, prog.program).state; // inside mySub at addr 2
    expect(state.registers.IP).toBe(2);

    // StepOut completes mySub and returns to caller (addr 1)
    const outRes = stepOut(state, prog.program);
    expect(outRes.state.registers.IP).toBe(1);
    expect(outRes.state.registers.DX).toBe(100);
  });

  it('is completely deterministic across repeated runs', () => {
    const src = [
      'MOV AX, 1',
      'MOV BX, 2',
      'ADD AX, BX',
      'HLT',
    ].join('\n');
    const prog = assemble(src);
    expect(prog.ok).toBe(true);
    if (!prog.ok) return;

    const s0A = createCpuState(prog.program);
    const s0B = createCpuState(prog.program);

    const rA = runToHalt(s0A, prog.program);
    const rB = runToHalt(s0B, prog.program);

    expect(rA.state.registers).toEqual(rB.state.registers);
    expect(rA.state.flags).toEqual(rB.state.flags);
    expect(rA.stepsExecuted).toBe(rB.stepsExecuted);
  });

  it('reports fault stop reason when a runtime fault occurs', () => {
    // RET with empty stack triggers return-to-empty-stack fault
    const prog = assemble('RET');
    expect(prog.ok).toBe(true);
    if (!prog.ok) return;

    const s0 = createCpuState(prog.program);
    const res = runToHalt(s0, prog.program);
    expect(res.stopReason).toBe('fault');
    expect(res.state.fault?.type).toBe('return-to-empty-stack');
  });
});
