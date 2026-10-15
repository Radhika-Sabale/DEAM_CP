/**
 * @file samplePrograms.test.ts
 * Verifies all 8 curated sample programs assemble without errors,
 * execute to HLT, and reach their expected architectural states.
 */

import { describe, expect, it } from 'vitest';
import { SAMPLE_PROGRAMS } from './samplePrograms';
import { assemble } from '../../engine/cpu8086/assembler';
import { createCpuState } from '../../engine/cpu8086/cpu';
import { runToHalt } from '../../engine/cpu8086/runner';
import { readByte, readWord } from '../../engine/cpu8086/memory';

describe('samplePrograms', () => {
  it('contains exactly 8 curated sample programs', () => {
    expect(SAMPLE_PROGRAMS).toHaveLength(8);
  });

  it('verifies sum-loop computes sum(1..10) = 55 in AX', () => {
    const sample = SAMPLE_PROGRAMS.find((p) => p.id === 'sum-loop')!;
    const res = assemble(sample.source);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const cpu = createCpuState(res.program);
    const runRes = runToHalt(cpu, res.program);
    expect(runRes.stopReason).toBe('halted');
    expect(runRes.state.registers.AX).toBe(55);
    expect(runRes.state.registers.CX).toBe(0);
  });

  it('verifies array-max finds 104 in AL', () => {
    const sample = SAMPLE_PROGRAMS.find((p) => p.id === 'array-max')!;
    const res = assemble(sample.source);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const cpu = createCpuState(res.program);
    const runRes = runToHalt(cpu, res.program);
    expect(runRes.stopReason).toBe('halted');
    // AL should hold maximum (104)
    expect(runRes.state.registers.AX & 0xff).toBe(104);
  });

  it('verifies fibonacci generates the sequence in memory', () => {
    const sample = SAMPLE_PROGRAMS.find((p) => p.id === 'fibonacci')!;
    const res = assemble(sample.source);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const cpu = createCpuState(res.program);
    const runRes = runToHalt(cpu, res.program);
    expect(runRes.stopReason).toBe('halted');

    const fibAddr = res.program.symbols['fib']!.address;
    const expected = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
    for (let i = 0; i < expected.length; i++) {
      expect(readByte(runRes.state.memory, fibAddr + i)).toBe(expected[i]);
    }
  });

  it('verifies reverse-stack reverses 16-bit array in memory', () => {
    const sample = SAMPLE_PROGRAMS.find((p) => p.id === 'reverse-stack')!;
    const res = assemble(sample.source);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const cpu = createCpuState(res.program);
    const runRes = runToHalt(cpu, res.program);
    expect(runRes.stopReason).toBe('halted');

    const arrAddr = res.program.symbols['arr']!.address;
    const expected = [55, 44, 33, 22, 11];
    for (let i = 0; i < expected.length; i++) {
      expect(readWord(runRes.state.memory, arrAddr + i * 2)).toBe(expected[i]);
    }
  });

  it('verifies subroutine-call calculates ((1+1)*2+1)*2+1)*2 = 22 in AX', () => {
    const sample = SAMPLE_PROGRAMS.find((p) => p.id === 'subroutine-call')!;
    const res = assemble(sample.source);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const cpu = createCpuState(res.program);
    const runRes = runToHalt(cpu, res.program);
    expect(runRes.stopReason).toBe('halted');
    expect(runRes.state.registers.AX).toBe(22);
  });

  it('verifies bubble-sort sorts bytes in ascending order', () => {
    const sample = SAMPLE_PROGRAMS.find((p) => p.id === 'bubble-sort')!;
    const res = assemble(sample.source);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const cpu = createCpuState(res.program);
    const runRes = runToHalt(cpu, res.program);
    expect(runRes.stopReason).toBe('halted');

    const arrAddr = res.program.symbols['arr']!.address;
    const expected = [11, 12, 22, 25, 34, 64, 88, 90];
    for (let i = 0; i < expected.length; i++) {
      expect(readByte(runRes.state.memory, arrAddr + i)).toBe(expected[i]);
    }
  });

  it('verifies signed-vs-unsigned handles JL and JB correctly', () => {
    const sample = SAMPLE_PROGRAMS.find((p) => p.id === 'signed-vs-unsigned')!;
    const res = assemble(sample.source);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const cpu = createCpuState(res.program);
    const runRes = runToHalt(cpu, res.program);
    expect(runRes.stopReason).toBe('halted');
    // -1 < 1 is signed less (CX = 1)
    expect(runRes.state.registers.CX).toBe(1);
    // 0xFFFF < 1 is unsigned false (DX = 0)
    expect(runRes.state.registers.DX).toBe(0);
  });

  it('verifies shift-carry-count counts set bits in 0xB5 as 5', () => {
    const sample = SAMPLE_PROGRAMS.find((p) => p.id === 'shift-carry-count')!;
    const res = assemble(sample.source);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const cpu = createCpuState(res.program);
    const runRes = runToHalt(cpu, res.program);
    expect(runRes.stopReason).toBe('halted');
    // BL holds population count of 0xB5 (5)
    expect(runRes.state.registers.BX & 0xff).toBe(5);
  });
});
