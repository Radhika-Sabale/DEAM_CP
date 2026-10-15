/**
 * @file aluProgram.test.ts
 * Unit tests for aluProgram: 1,000-operation seeded sweep comparing 8086 execution
 * against the ALU engine (8-bit, 16-bit, all flags Z/C/S/O, undefined OF),
 * and verification of typed rejection for unavailable operations.
 */

import { describe, expect, it } from 'vitest';
import { execute as aluExecute, type AluOp } from '../alu';
import { assemble } from './assembler';
import { programFromAluOperation } from './aluProgram';
import { createCpuState } from './cpu';
import { getReg } from './registers';
import { runToHalt } from './runner';
import type { RegisterName } from './types';

describe('aluProgram: translation of ALU operations to 8086 programs', () => {
  it('returns typed unavailable result for unsupported ops and invalid widths', () => {
    const unsupp = ['SAR', 'ROL', 'ROR', 'NOT'];
    for (const op of unsupp) {
      const res = programFromAluOperation({ op, width: 8, a: 10, b: 2 });
      expect(res.available).toBe(false);
      if (!res.available) {
        expect(res.reason.length).toBeGreaterThan(0);
      }
    }

    // Width 4 is not natively supported by 8086 registers
    const w4 = programFromAluOperation({ op: 'ADD', width: 4, a: 5, b: 3 });
    expect(w4.available).toBe(false);
    if (!w4.available) {
      expect(w4.reason).toContain('width 4');
    }
  });

  it('generates correct 8-bit ADD program and matches expected register and flags', () => {
    const res = programFromAluOperation({ op: 'ADD', width: 8, a: 0x20, b: 0x30 });
    expect(res.available).toBe(true);
    if (!res.available) return;

    expect(res.source).toBe('MOV AL, 32\nMOV BL, 48\nADD AL, BL\nHLT');
    expect(res.expectedState.registers['AL']).toBe(0x50);
    expect(res.expectedState.flags.Z).toBe(0);
    expect(res.expectedState.flags.C).toBe(0);
    expect(res.expectedState.flags.S).toBe(0);
    expect(res.expectedState.flags.O).toBe(0);

    const assembled = assemble(res.source);
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;

    const s0 = createCpuState(assembled.program);
    const run = runToHalt(s0, assembled.program);
    expect(run.stopReason).toBe('halted');
    expect(getReg(run.state.registers, 'AL')).toBe(0x50);
    expect(run.state.flags.Z).toBe(0);
    expect(run.state.flags.C).toBe(0);
    expect(run.state.flags.S).toBe(0);
    expect(run.state.flags.O).toBe(0);
  });

  it('generates correct 16-bit SUB program with borrow', () => {
    const res = programFromAluOperation({ op: 'SUB', width: 16, a: 5, b: 10 });
    expect(res.available).toBe(true);
    if (!res.available) return;

    expect(res.source).toBe('MOV AX, 5\nMOV BX, 10\nSUB AX, BX\nHLT');
    expect(res.expectedState.flags.C).toBe(1); // Borrow occurred (5 < 10)

    const assembled = assemble(res.source);
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;

    const s0 = createCpuState(assembled.program);
    const run = runToHalt(s0, assembled.program);
    expect(run.state.flags.C).toBe(1);
    expect(getReg(run.state.registers, 'AX')).toBe((5 - 10) & 0xffff);
  });

  it('generates correct multi-bit shift with CL and handles undefined OF', () => {
    const res = programFromAluOperation({
      op: 'SHL',
      width: 8,
      a: 0x05,
      b: 0,
      shiftCount: 3,
    });
    expect(res.available).toBe(true);
    if (!res.available) return;

    expect(res.source).toBe('MOV AL, 5\nMOV CL, 3\nSHL AL, CL\nHLT');
    // Multi-bit shift leaves OF undefined in 8086
    expect(res.expectedState.flags.O).toBe('undefined');

    const assembled = assemble(res.source);
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;

    const s0 = createCpuState(assembled.program);
    const run = runToHalt(s0, assembled.program);
    expect(getReg(run.state.registers, 'AL')).toBe((0x05 << 3) & 0xff);
    expect(run.state.flags.O).toBe('undefined');
  });

  it('completes a seeded 1,000-operation sweep across all supported ops, matching ALU flags and result', () => {
    const ops: readonly AluOp[] = [
      'ADD',
      'SUB',
      'CMP',
      'AND',
      'OR',
      'XOR',
      'INC',
      'DEC',
      'SHL',
      'SHR',
    ];

    let seed = 987654321;
    function lcg(): number {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    let sweepCount = 0;

    for (let i = 0; i < 1_000; i++) {
      const op = ops[Math.floor(lcg() * ops.length)] ?? 'ADD';
      const width = lcg() < 0.5 ? 8 : 16;
      const mask = width === 8 ? 0xff : 0xffff;
      const a = Math.floor(lcg() * (mask + 1));
      const b = Math.floor(lcg() * (mask + 1));
      const shiftCount = Math.floor(lcg() * (width - 1)) + 1; // 1 to width-1

      const progResult = programFromAluOperation({
        op,
        width,
        a,
        b,
        shiftCount,
      });

      expect(progResult.available).toBe(true);
      if (!progResult.available) continue;

      const assembled = assemble(progResult.source);
      expect(
        assembled.ok,
        `Assembling failed for op ${op} (width ${width}, a=${a}, b=${b}): ${assembled.ok ? '' : JSON.stringify(assembled.errors)}`
      ).toBe(true);
      if (!assembled.ok) continue;

      const s0 = createCpuState(assembled.program);
      const run = runToHalt(s0, assembled.program);
      expect(run.stopReason).toBe('halted');

      // Reference ALU execution
      const ref = aluExecute(op, a, b, width, { shiftCount });
      expect(ref.ok).toBe(true);
      if (!ref.ok) continue;

      // 1. Compare result value in destination register
      const is8 = width === 8;
      const reg: RegisterName = is8 ? 'AL' : 'AX';
      const expectedRegVal =
        op === 'CMP' ? a : ref.result.unsigned;
      expect(getReg(run.state.registers, reg)).toBe(expectedRegVal);

      // 2. Compare status flags: Z, C, S, O
      expect(run.state.flags.Z).toBe(ref.flags.Z);
      expect(run.state.flags.C).toBe(ref.flags.C);
      expect(run.state.flags.S).toBe(ref.flags.S);
      expect(run.state.flags.O).toBe(ref.flags.O);

      sweepCount++;
    }

    expect(sweepCount).toBe(1_000);
  });
});
