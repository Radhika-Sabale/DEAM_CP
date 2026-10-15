import { describe, expect, it } from 'vitest';
import { assemble } from './assembler';

describe('8086 Assembler Valid Snippets - Part 2 (Jumps, Sections & Addressing)', () => {
  it('29. Conditional jumps canonical: JE, JNE, JC, JNC, JA, JBE', () => {
    const src = `
.code
loop:
JE loop
JNE loop
JC loop
JNC loop
JA loop
JBE loop
HLT`;
    const res = assemble(src);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const mnemonics = res.program.instructions.map((i) => i.mnemonic);
    expect(mnemonics).toEqual(['JE', 'JNE', 'JC', 'JNC', 'JA', 'JBE', 'HLT']);
  });

  it('30. Conditional jumps canonical: JG, JGE, JL, JLE, JS, JNS, JO, JNO', () => {
    const src = `
.code
target:
JG target
JGE target
JL target
JLE target
JS target
JNS target
JO target
JNO target
HLT`;
    const res = assemble(src);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const mnemonics = res.program.instructions.map((i) => i.mnemonic);
    expect(mnemonics).toEqual(['JG', 'JGE', 'JL', 'JLE', 'JS', 'JNS', 'JO', 'JNO', 'HLT']);
  });

  it('31. Jcc alias mappings: JZ -> JE, JNZ -> JNE', () => {
    const res = assemble('lbl: JZ lbl\nJNZ lbl\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.mnemonic).toBe('JE');
    expect(res.program.instructions[1]?.mnemonic).toBe('JNE');
  });

  it('32. Jcc alias mappings: JB/JNAE -> JC, JAE/JNB -> JNC', () => {
    const res = assemble('lbl: JB lbl\nJNAE lbl\nJAE lbl\nJNB lbl\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.mnemonic).toBe('JC');
    expect(res.program.instructions[1]?.mnemonic).toBe('JC');
    expect(res.program.instructions[2]?.mnemonic).toBe('JNC');
    expect(res.program.instructions[3]?.mnemonic).toBe('JNC');
  });

  it('33. Jcc alias mappings: JNBE -> JA, JNA -> JBE', () => {
    const res = assemble('lbl: JNBE lbl\nJNA lbl\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.mnemonic).toBe('JA');
    expect(res.program.instructions[1]?.mnemonic).toBe('JBE');
  });

  it('34. Jcc alias mappings: JNLE -> JG, JNL -> JGE, JNGE -> JL, JNG -> JLE', () => {
    const res = assemble('lbl: JNLE lbl\nJNL lbl\nJNGE lbl\nJNG lbl\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.mnemonic).toBe('JG');
    expect(res.program.instructions[1]?.mnemonic).toBe('JGE');
    expect(res.program.instructions[2]?.mnemonic).toBe('JL');
    expect(res.program.instructions[3]?.mnemonic).toBe('JLE');
  });

  it('35. .data section with DB numbers', () => {
    const src = `
.data
values: DB 10, 20, 30, 0xFF
.code
MOV AL, [values]
HLT`;
    const res = assemble(src);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.dataSegments.length).toBe(1);
    expect(res.program.dataSegments[0]?.bytes).toEqual([10, 20, 30, 255]);
    expect(res.program.dataSegments[0]?.address).toBe(0x0100);
  });

  it('36. .data section with DB string literal', () => {
    const src = `
.data
msg: DB "Hello", 0
.code
MOV AL, [msg]
HLT`;
    const res = assemble(src);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.dataSegments[0]?.bytes).toEqual([72, 101, 108, 108, 111, 0]);
  });

  it('37. .data section with DW little-endian words', () => {
    const src = `
.data
words: DW 0x1234, 0x0001
.code
MOV AX, [words]
HLT`;
    const res = assemble(src);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // 0x1234 -> low 0x34, high 0x12; 0x0001 -> low 0x01, high 0x00
    expect(res.program.dataSegments[0]?.bytes).toEqual([0x34, 0x12, 0x01, 0x00]);
  });

  it('38. .data section with custom ORG address', () => {
    const src = `
.data
ORG 0x0500
item: DB 42
.code
MOV AL, [item]
HLT`;
    const res = assemble(src);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.dataSegments[0]?.address).toBe(0x0500);
    expect(res.symbols['item']?.address).toBe(0x0500);
  });

  it('39. Bare data label as immediate address vs [label] as memory value', () => {
    const src = `
.data
ORG 0x0200
table: DW 1000
.code
MOV AX, table
MOV BX, [table]
HLT`;
    const res = assemble(src);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // MOV AX, table -> immediate 0x0200
    expect(res.program.instructions[0]?.operands[1]).toEqual({
      kind: 'imm', value: 0x0200, size: 16, label: 'table',
    });

    // MOV BX, [table] -> memory at disp 0x0200
    expect(res.program.instructions[1]?.operands[1]).toEqual({
      kind: 'mem', disp: 0x0200, size: 16, label: 'table',
    });
  });

  it('40. Memory addressing: [BX+SI]', () => {
    const res = assemble('MOV AX, [BX+SI]\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({
      kind: 'mem', base: 'BX', index: 'SI', disp: 0, size: 16,
    });
  });

  it('41. Memory addressing: [BX+DI]', () => {
    const res = assemble('MOV AX, [BX+DI]\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({
      kind: 'mem', base: 'BX', index: 'DI', disp: 0, size: 16,
    });
  });

  it('42. Memory addressing with positive and negative displacement: [BX+SI+8] & [BX-4]', () => {
    const res = assemble('MOV AX, [BX+SI+8]\nMOV DX, [BX-4]\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.instructions[0]?.operands[1]).toEqual({
      kind: 'mem', base: 'BX', index: 'SI', disp: 8, size: 16,
    });
    expect(res.program.instructions[1]?.operands[1]).toEqual({
      kind: 'mem', base: 'BX', disp: -4, size: 16,
    });
  });

  it('43. Entry point detection: explicit "start" label', () => {
    const src = `
.code
init: NOP
start:
MOV AX, 1
HLT`;
    const res = assemble(src);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.entryPoint).toBe(1);
  });

  it('44. Entry point detection: default instruction 0 when no "start" label', () => {
    const res = assemble('MOV AX, 1\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.entryPoint).toBe(0);
  });
});
