import { describe, expect, it } from 'vitest';
import { assemble } from './assembler';

describe('8086 Assembler Valid Snippets - Part 1 (Core Operations)', () => {
  it('1. MOV reg16, reg16', () => {
    const res = assemble('MOV AX, BX\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]).toEqual({
      address: 0, mnemonic: 'MOV', size: 16, sourceLine: 1, sourceText: 'MOV AX, BX',
      operands: [{ kind: 'reg', name: 'AX', size: 16 }, { kind: 'reg', name: 'BX', size: 16 }],
    });
  });

  it('2. MOV reg8, reg8', () => {
    const res = assemble('MOV AL, CH\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]).toEqual({
      address: 0, mnemonic: 'MOV', size: 8, sourceLine: 1, sourceText: 'MOV AL, CH',
      operands: [{ kind: 'reg', name: 'AL', size: 8 }, { kind: 'reg', name: 'CH', size: 8 }],
    });
  });

  it('3. MOV reg16, imm16 (decimal)', () => {
    const res = assemble('MOV DX, 1234\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({ kind: 'imm', value: 1234, size: 16 });
  });

  it('4. MOV reg8, imm8 (hex 0x)', () => {
    const res = assemble('MOV BL, 0x1F\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({ kind: 'imm', value: 31, size: 8 });
  });

  it('5. MOV reg8, imm8 (hex suffix h)', () => {
    const res = assemble('MOV DL, 0FFh\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({ kind: 'imm', value: 255, size: 8 });
  });

  it('6. MOV reg8, binary imm (b suffix)', () => {
    const res = assemble('MOV DH, 10101010b\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({ kind: 'imm', value: 170, size: 8 });
  });

  it('7. MOV reg8, char literal', () => {
    const res = assemble("MOV AH, 'Z'\nHLT");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({ kind: 'imm', value: 90, size: 8 });
  });

  it('8. MOV reg16, [BX]', () => {
    const res = assemble('MOV AX, [BX]\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({ kind: 'mem', base: 'BX', disp: 0, size: 16 });
  });

  it('9. MOV reg8, [SI+4]', () => {
    const res = assemble('MOV AL, [SI+4]\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({ kind: 'mem', index: 'SI', disp: 4, size: 8 });
  });

  it('10. MOV [DI-2], CX', () => {
    const res = assemble('MOV [DI-2], CX\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[0]).toEqual({ kind: 'mem', index: 'DI', disp: -2, size: 16 });
  });

  it('11. MOV BYTE PTR [BX], 42', () => {
    const res = assemble('MOV BYTE PTR [BX], 42\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]).toEqual({
      address: 0, mnemonic: 'MOV', size: 8, sourceLine: 1, sourceText: 'MOV BYTE PTR [BX], 42',
      operands: [{ kind: 'mem', base: 'BX', disp: 0, size: 8 }, { kind: 'imm', value: 42, size: 8 }],
    });
  });

  it('12. MOV WORD PTR [BX+SI], 0x1000', () => {
    const res = assemble('MOV WORD PTR [BX+SI], 0x1000\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]).toEqual({
      address: 0, mnemonic: 'MOV', size: 16, sourceLine: 1, sourceText: 'MOV WORD PTR [BX+SI], 0x1000',
      operands: [{ kind: 'mem', base: 'BX', index: 'SI', disp: 0, size: 16 }, { kind: 'imm', value: 4096, size: 16 }],
    });
  });

  it('13. ADD reg, imm & SUB reg, reg', () => {
    const res = assemble('ADD AX, 10\nSUB BX, CX\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.mnemonic).toBe('ADD');
    expect(res.program.instructions[1]?.mnemonic).toBe('SUB');
  });

  it('14. CMP reg8, reg8', () => {
    const res = assemble('CMP AL, BL\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.mnemonic).toBe('CMP');
    expect(res.program.instructions[0]?.size).toBe(8);
  });

  it('15. AND, OR, XOR bitwise operations', () => {
    const res = assemble('AND AX, 0xFF00\nOR BX, 0x00FF\nXOR CX, CX\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions.map((i) => i.mnemonic)).toEqual(['AND', 'OR', 'XOR', 'HLT']);
  });

  it('16. INC reg16 & DEC reg8', () => {
    const res = assemble('INC SI\nDEC DL\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]).toEqual({
      address: 0, mnemonic: 'INC', size: 16, sourceLine: 1, sourceText: 'INC SI',
      operands: [{ kind: 'reg', name: 'SI', size: 16 }],
    });
    expect(res.program.instructions[1]?.size).toBe(8);
  });

  it('17. INC BYTE PTR [BX+DI] & DEC WORD PTR [DI]', () => {
    const res = assemble('INC BYTE PTR [BX+DI]\nDEC WORD PTR [DI]\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.size).toBe(8);
    expect(res.program.instructions[1]?.size).toBe(16);
  });

  it('18. SHL reg, 1 & SHR reg, CL', () => {
    const res = assemble('SHL AX, 1\nSHR BL, CL\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({ kind: 'imm', value: 1 });
    expect(res.program.instructions[1]?.operands[1]).toEqual({ kind: 'reg', name: 'CL', size: 8 });
  });

  it('19. SHL BYTE PTR [BX], 1 & SHR WORD PTR [SI], CL', () => {
    const res = assemble('SHL BYTE PTR [BX], 1\nSHR WORD PTR [SI], CL\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.size).toBe(8);
    expect(res.program.instructions[1]?.size).toBe(16);
  });

  it('20. PUSH and POP 16-bit registers', () => {
    const res = assemble('PUSH AX\nPUSH SI\nPOP DI\nPOP BX\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions.length).toBe(5);
    expect(res.program.instructions[0]?.operands[0]).toEqual({ kind: 'reg', name: 'AX', size: 16 });
  });

  it('21. PUSH [BX] & POP WORD PTR [DI+2]', () => {
    const res = assemble('PUSH [BX]\nPOP WORD PTR [DI+2]\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.size).toBe(16);
    expect(res.program.instructions[1]?.size).toBe(16);
  });

  it('22. CALL and RET', () => {
    const res = assemble('CALL my_sub\nHLT\nmy_sub: NOP\nRET');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.mnemonic).toBe('CALL');
    expect(res.program.instructions[3]?.mnemonic).toBe('RET');
  });

  it('23. RET with 16-bit pop bytes immediate', () => {
    const res = assemble('RET 4\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[0]).toEqual({ kind: 'imm', value: 4 });
  });

  it('24. NOP and HLT alone', () => {
    const res = assemble('NOP\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]).toEqual({ address: 0, mnemonic: 'NOP', operands: [], sourceLine: 1, sourceText: 'NOP' });
    expect(res.program.instructions[1]).toEqual({ address: 1, mnemonic: 'HLT', operands: [], sourceLine: 2, sourceText: 'HLT' });
  });

  it('25. Negative immediate two\'s complement', () => {
    const res = assemble('MOV AL, -5\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({ kind: 'imm', value: 251, size: 8 });
  });

  it('26. Negative 16-bit immediate', () => {
    const res = assemble('MOV AX, -1\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({ kind: 'imm', value: 65535, size: 16 });
  });

  it('27. Case-insensitivity of mnemonics and registers', () => {
    const res = assemble('mov ax, bx\nadd cl, 5\nhlt');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.mnemonic).toBe('MOV');
    expect(res.program.instructions[0]?.operands[0]).toEqual({ kind: 'reg', name: 'AX', size: 16 });
  });

  it('28. Comments and blank lines ignored', () => {
    const res = assemble('; Starting comment\n\nMOV AX, 1 ; inline comment\n\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions.length).toBe(2);
  });
});
