/* eslint-disable no-console */
import { describe, expect, it } from 'vitest';
import { assemble } from './assembler';
import type { AssemblerResult } from './types';

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('8086 Assembler Fuzzing & Performance Benchmark', () => {
  it('Fuzz test: 2,000 seeded random inputs never throw and return typed result', () => {
    const rand = lcg(12345);
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.,:;[]+-*#@"\'/\\ \t\r\n\0';

    const basePrograms = [
      'MOV AX, 1\nHLT',
      'MOV AL, [BX]\nADD AL, 5\nHLT',
      '.data\nval: DB 10\n.code\nMOV AX, val\nHLT',
      'start: NOP\nJMP start\nHLT',
      'PUSH AX\nPOP BX\nRET\nHLT',
      'SHL AX, 1\nSHR BX, CL\nHLT',
    ];

    // Part A: 1,000 completely random junk strings
    for (let i = 0; i < 1000; i++) {
      const len = Math.floor(rand() * 50);
      let str = '';
      for (let j = 0; j < len; j++) {
        str += chars[Math.floor(rand() * chars.length)];
      }

      let res!: AssemblerResult;
      expect(() => {
        res = assemble(str);
      }).not.toThrow();

      const outcome = res as AssemblerResult;
      expect(outcome).toBeDefined();
      expect(typeof outcome.ok).toBe('boolean');
      if (!outcome.ok) {
        expect(Array.isArray(outcome.errors)).toBe(true);
      }
    }

    // Part B: 1,000 mutations of valid programs
    for (let i = 0; i < 1000; i++) {
      const base = basePrograms[Math.floor(rand() * basePrograms.length)] ?? 'HLT';
      const mutationType = Math.floor(rand() * 4);
      let mutated = base;

      if (mutationType === 0) {
        // Insert random char
        const pos = Math.floor(rand() * base.length);
        const ch = chars[Math.floor(rand() * chars.length)] ?? '!';
        mutated = base.slice(0, pos) + ch + base.slice(pos);
      } else if (mutationType === 1 && base.length > 1) {
        // Delete random char
        const pos = Math.floor(rand() * base.length);
        mutated = base.slice(0, pos) + base.slice(pos + 1);
      } else if (mutationType === 2) {
        // Replace random char
        const pos = Math.floor(rand() * base.length);
        const ch = chars[Math.floor(rand() * chars.length)] ?? '?';
        mutated = base.slice(0, pos) + ch + base.slice(pos + 1);
      } else {
        // Append junk
        mutated += '\n' + chars[Math.floor(rand() * chars.length)];
      }

      let res!: AssemblerResult;
      expect(() => {
        res = assemble(mutated);
      }).not.toThrow();

      const outcome = res as AssemblerResult;
      expect(outcome).toBeDefined();
      expect(typeof outcome.ok).toBe('boolean');
      if (!outcome.ok) {
        expect(Array.isArray(outcome.errors)).toBe(true);
      }
    }
  });

  it('Performance benchmark: assembles a 4,000-line program rapidly', () => {
    const lines: string[] = [];
    // 3,999 instructions + 1 HLT = 4,000 instructions
    for (let i = 0; i < 3999; i++) {
      const mod = i % 4;
      if (mod === 0) lines.push('MOV AX, 1');
      else if (mod === 1) lines.push('ADD BX, 2');
      else if (mod === 2) lines.push('INC CX');
      else lines.push('XOR DX, DX');
    }
    lines.push('HLT');

    const bigProgram = lines.join('\n');
    const start = performance.now();
    const res = assemble(bigProgram);
    const elapsedMs = performance.now() - start;

    console.log(`[PERF BENCHMARK] 4,000-line assemble time: ${elapsedMs.toFixed(2)} ms`);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions.length).toBe(4000);
    // Should complete in well under 1,000 ms on any modern machine
    expect(elapsedMs).toBeLessThan(1000);
  });
});
