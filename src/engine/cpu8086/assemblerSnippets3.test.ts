import { describe, expect, it } from 'vitest';
import { assemble } from './assembler';

describe('8086 Assembler Valid Snippets - Part 3 (Comprehensive Combinations)', () => {
  it('45. MOV [imm], reg16 & MOV reg16, [imm]', () => {
    const res = assemble('MOV [0x1000], AX\nMOV BX, [0x1000]\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[0]).toEqual({ kind: 'mem', disp: 4096, size: 16 });
    expect(res.program.instructions[1]?.operands[1]).toEqual({ kind: 'mem', disp: 4096, size: 16 });
  });

  it('46. MOV [imm], reg8 & MOV reg8, [imm]', () => {
    const res = assemble('MOV [500], CL\nMOV DH, [500]\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[0]).toEqual({ kind: 'mem', disp: 500, size: 8 });
    expect(res.program.instructions[1]?.operands[1]).toEqual({ kind: 'mem', disp: 500, size: 8 });
  });

  it('47. MOV BYTE PTR [disp], imm8 & MOV WORD PTR [disp], imm16', () => {
    const res = assemble('MOV BYTE PTR [0x0200], 7\nMOV WORD PTR [0x0202], 0x55AA\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.size).toBe(8);
    expect(res.program.instructions[1]?.size).toBe(16);
  });

  it('48. MOV [table], reg16 in .data', () => {
    const src = `
.data
table: DW 0
.code
MOV [table], AX
HLT`;
    const res = assemble(src);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[0]).toEqual({ kind: 'mem', disp: 0x0100, size: 16, label: 'table' });
  });

  it('49. MOV [table], reg8 in .data', () => {
    const src = `
.data
val: DB 0
.code
MOV [val], CH
HLT`;
    const res = assemble(src);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[0]).toEqual({ kind: 'mem', disp: 0x0100, size: 8, label: 'val' });
  });

  it('50. MOV BYTE PTR [table], imm & MOV WORD PTR [table], imm', () => {
    const src = `
.data
buf: DB 0, 0
.code
MOV BYTE PTR [buf], 1
MOV WORD PTR [buf], 0x0201
HLT`;
    const res = assemble(src);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.size).toBe(8);
    expect(res.program.instructions[1]?.size).toBe(16);
  });

  it('51. ADD reg16, [mem] & SUB [mem], reg16', () => {
    const res = assemble('ADD AX, [BX]\nSUB [BX+SI], CX\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.mnemonic).toBe('ADD');
    expect(res.program.instructions[0]?.size).toBe(16);
    expect(res.program.instructions[1]?.mnemonic).toBe('SUB');
    expect(res.program.instructions[1]?.size).toBe(16);
  });

  it('52. CMP [DI+4], DX', () => {
    const res = assemble('CMP [DI+4], DX\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[0]).toEqual({ kind: 'mem', index: 'DI', disp: 4, size: 16 });
  });

  it('53. AND BYTE PTR [BX], 0x0F', () => {
    const res = assemble('AND BYTE PTR [BX], 0x0F\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.size).toBe(8);
  });

  it('54. OR WORD PTR [SI], 0x8000', () => {
    const res = assemble('OR WORD PTR [SI], 0x8000\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.size).toBe(16);
  });

  it('55. XOR AL, [BX+DI-1]', () => {
    const res = assemble('XOR AL, [BX+DI-1]\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({ kind: 'mem', base: 'BX', index: 'DI', disp: -1, size: 8 });
  });

  it('56. JMP forward target', () => {
    const res = assemble('JMP done\nNOP\ndone: HLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.mnemonic).toBe('JMP');
    expect(res.program.instructions[0]?.operands[0]).toEqual({ kind: 'label', name: 'done' });
  });

  it('57. Stack ops with SP and DI', () => {
    const res = assemble('PUSH SP\nPOP DI\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[0]).toEqual({ kind: 'reg', name: 'SP', size: 16 });
    expect(res.program.instructions[1]?.operands[0]).toEqual({ kind: 'reg', name: 'DI', size: 16 });
  });

  it('58. Hex number with lowercase letters: 0xab and 0ffh', () => {
    const res = assemble('MOV AL, 0xab\nMOV BL, 0ffh\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({ kind: 'imm', value: 171, size: 8 });
    expect(res.program.instructions[1]?.operands[1]).toEqual({ kind: 'imm', value: 255, size: 8 });
  });

  it('59. Binary numbers: 11110000b and 0b', () => {
    const res = assemble('MOV AL, 11110000b\nMOV AH, 0b\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({ kind: 'imm', value: 240, size: 8 });
    expect(res.program.instructions[1]?.operands[1]).toEqual({ kind: 'imm', value: 0, size: 8 });
  });

  it('60. Decimal zero', () => {
    const res = assemble('MOV CX, 0\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({ kind: 'imm', value: 0, size: 16 });
  });

  it('61. Multiple labels on consecutive lines', () => {
    const src = `
label1:
label2:
MOV AX, 10
HLT`;
    const res = assemble(src);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.symbols['label1']?.address).toBe(0);
    expect(res.symbols['label2']?.address).toBe(0);
  });

  it('62. Commutative memory operands [SI+BX]', () => {
    const res = assemble('MOV AX, [SI+BX]\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({ kind: 'mem', base: 'BX', index: 'SI', disp: 0, size: 16 });
  });

  it('63. Character escape newline and tab in immediate', () => {
    const res = assemble("MOV AL, '\\n'\nMOV BL, '\\t'\nHLT");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({ kind: 'imm', value: 10, size: 8 });
    expect(res.program.instructions[1]?.operands[1]).toEqual({ kind: 'imm', value: 9, size: 8 });
  });

  it('64. Subroutine calling and return flow', () => {
    const src = `
start:
CALL compute
HLT
compute:
ADD AX, 1
RET`;
    const res = assemble(src);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions.length).toBe(4);
  });
});
