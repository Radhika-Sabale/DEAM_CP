import { describe, expect, it } from 'vitest';
import { assemble } from './assembler';
import { disassemble } from './disassembler';
import type { Instruction } from './types';

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function stripSourceMeta(instructions: readonly Instruction[]) {
  return instructions.map((i) => ({
    address: i.address,
    mnemonic: i.mnemonic,
    operands: i.operands,
    size: i.size,
  }));
}

const SAMPLE_PROGRAMS: readonly string[] = [
  'MOV AX, 1\nHLT',
  'MOV AL, 5\nADD AL, 10\nHLT',
  'MOV BX, 0x1000\nMOV AX, [BX]\nHLT',
  'MOV [0x0200], CX\nMOV DX, [0x0200]\nHLT',
  'MOV BYTE PTR [BX], 42\nHLT',
  'MOV WORD PTR [SI], 0x1234\nHLT',
  'XOR AX, AX\nINC AX\nDEC AX\nHLT',
  'AND BL, 0x0F\nOR BH, 0xF0\nHLT',
  'SHL AX, 1\nSHR DX, CL\nHLT',
  'PUSH AX\nPUSH BX\nPOP CX\nPOP DX\nHLT',
  'NOP\nNOP\nHLT',
  'start: MOV AX, 100\nHLT',
  'loop: INC CX\nCMP CX, 10\nJNE loop\nHLT',
  'CALL subr\nHLT\nsubr: NOP\nRET',
  'RET 4\nHLT',
  'MOV AX, [BX+SI]\nHLT',
  'MOV AX, [BX+DI+4]\nHLT',
  'MOV DX, [BX-8]\nHLT',
  'CMP AX, 500\nJE done\ndone: HLT',
  'SUB DX, 1\nJC underflow\nunderflow: HLT',
  'MOV AL, 0xFF\nMOV BL, 0x7F\nADD AL, BL\nHLT',
  'MOV CX, 5\nagain: DEC CX\nJNZ again\nHLT',
  'MOV AH, 0\nMOV AL, 10\nHLT',
  'PUSH SI\nPUSH DI\nPOP DI\nPOP SI\nHLT',
  'MOV WORD PTR [BX+DI], 0\nHLT',
  'SHL BYTE PTR [BX], 1\nHLT',
  'SHR WORD PTR [SI+2], CL\nHLT',
  'ADD AX, BX\nSUB CX, DX\nAND SI, DI\nHLT',
  'MOV AX, 0\nMOV BX, 1\nMOV CX, 2\nHLT',
  'start: NOP\nCALL fn\nHLT\nfn: RET',
];

describe('8086 Assembler Round Trip', () => {
  it('Round trips 30 representative hand-crafted sample programs', () => {
    for (const [idx, code] of SAMPLE_PROGRAMS.entries()) {
      const res1 = assemble(code);
      expect(res1.ok, `Sample ${idx} failed pass 1: ${code}`).toBe(true);
      if (!res1.ok) continue;

      const dis = disassemble(res1.program);
      const res2 = assemble(dis);
      expect(res2.ok, `Sample ${idx} failed round trip with dis:\n${dis}`).toBe(true);
      if (!res2.ok) continue;

      expect(stripSourceMeta(res2.program.instructions)).toEqual(
        stripSourceMeta(res1.program.instructions)
      );
      expect(res2.program.dataSegments).toEqual(res1.program.dataSegments);
      expect(res2.program.entryPoint).toEqual(res1.program.entryPoint);
    }
  });

  it('Round trips 300 seeded random programs generated from the ISA table', () => {
    const rand = lcg(42);
    const regs16 = ['AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'SP'];
    const regs8 = ['AH', 'AL', 'BH', 'BL', 'CH', 'CL', 'DH', 'DL'];
    const binaryOps = ['MOV', 'ADD', 'SUB', 'CMP', 'AND', 'OR', 'XOR'] as const;

    for (let p = 0; p < 300; p++) {
      const lines: string[] = [];
      const numLines = 3 + Math.floor(rand() * 5); // 3 to 7 instructions

      for (let l = 0; l < numLines; l++) {
        const choice = Math.floor(rand() * 8);
        if (choice === 0) {
          // 16-bit reg, reg
          const op = binaryOps[Math.floor(rand() * binaryOps.length)];
          const r1 = regs16[Math.floor(rand() * regs16.length)];
          const r2 = regs16[Math.floor(rand() * regs16.length)];
          lines.push(`${op} ${r1}, ${r2}`);
        } else if (choice === 1) {
          // 8-bit reg, reg
          const op = binaryOps[Math.floor(rand() * binaryOps.length)];
          const r1 = regs8[Math.floor(rand() * regs8.length)];
          const r2 = regs8[Math.floor(rand() * regs8.length)];
          lines.push(`${op} ${r1}, ${r2}`);
        } else if (choice === 2) {
          // 16-bit reg, imm
          const op = binaryOps[Math.floor(rand() * binaryOps.length)];
          const r1 = regs16[Math.floor(rand() * regs16.length)];
          const imm = Math.floor(rand() * 1000);
          lines.push(`${op} ${r1}, ${imm}`);
        } else if (choice === 3) {
          // 8-bit reg, imm
          const op = binaryOps[Math.floor(rand() * binaryOps.length)];
          const r1 = regs8[Math.floor(rand() * regs8.length)];
          const imm = Math.floor(rand() * 255);
          lines.push(`${op} ${r1}, ${imm}`);
        } else if (choice === 4) {
          // memory operand [BX] or [SI]
          const r = regs16[Math.floor(rand() * 4)];
          const base = rand() > 0.5 ? 'BX' : 'SI';
          lines.push(`MOV ${r}, [${base}]`);
        } else if (choice === 5) {
          // INC or DEC reg
          const op = rand() > 0.5 ? 'INC' : 'DEC';
          const r = regs16[Math.floor(rand() * regs16.length)];
          lines.push(`${op} ${r}`);
        } else if (choice === 6) {
          // SHL / SHR by 1 or CL
          const op = rand() > 0.5 ? 'SHL' : 'SHR';
          const r = regs16[Math.floor(rand() * 4)];
          const cnt = rand() > 0.5 ? '1' : 'CL';
          lines.push(`${op} ${r}, ${cnt}`);
        } else {
          lines.push('NOP');
        }
      }

      lines.push('HLT');
      const progText = lines.join('\n');
      const res1 = assemble(progText);
      expect(res1.ok, `Random prog ${p} failed assemble:\n${progText}`).toBe(true);
      if (!res1.ok) continue;

      const dis = disassemble(res1.program);
      const res2 = assemble(dis);
      expect(res2.ok, `Random prog ${p} failed round trip:\n${dis}`).toBe(true);
      if (!res2.ok) continue;

      expect(stripSourceMeta(res2.program.instructions)).toEqual(
        stripSourceMeta(res1.program.instructions)
      );
    }
  });
});
