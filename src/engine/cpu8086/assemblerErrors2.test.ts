import { describe, expect, it } from 'vitest';
import { assemble } from './assembler';

describe('8086 Assembler Invalid Snippets - Part 2', () => {
  it('27. String literals in DW not allowed', () => {
    const res = assemble('.data\nwords: DW "String"');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 2, code: 'invalid-operand-form' });
    expect(res.errors[0]?.message).toContain('DW');
  });

  it('28. Undefined label in jump', () => {
    const res = assemble('JMP missing_target\nHLT');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'undefined-label' });
    expect(res.errors[0]?.message).toContain('missing_target');
  });

  it('29. Undefined label in source operand', () => {
    const res = assemble('MOV AX, missing_var\nHLT');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'undefined-label' });
    expect(res.errors[0]?.message).toContain('missing_var');
  });

  it('30. Jump target is a data label', () => {
    const src = `
.data
my_data: DB 1, 2
.code
JMP my_data
HLT`;
    const res = assemble(src);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 5, code: 'jump-target-is-data-label' });
    expect(res.errors[0]?.message).toContain('my_data');
  });

  it('31. Duplicate label in code', () => {
    const res = assemble('lbl:\nNOP\nlbl:\nHLT');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 3, code: 'duplicate-label' });
    expect(res.errors[0]?.message).toContain('lbl');
  });

  it('32. Label defined as both code and data', () => {
    const src = `
.data
conflict: DB 1
.code
conflict: NOP
HLT`;
    const res = assemble(src);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 5, code: 'label-code-and-data' });
    expect(res.errors[0]?.message).toContain('conflict');
  });

  it('33. Label cannot be register name', () => {
    const res = assemble('AX: NOP\nHLT');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'duplicate-label' });
    expect(res.errors[0]?.message).toContain('AX');
  });

  it('34. Label cannot be mnemonic name', () => {
    const res = assemble('MOV: NOP\nHLT');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'duplicate-label' });
    expect(res.errors[0]?.message).toContain('MOV');
  });

  it('35. Boundary 255/256: 256 exceeds 8-bit range', () => {
    const res = assemble('MOV AL, 256\nHLT');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'immediate-out-of-range' });
    expect(res.errors[0]?.message).toContain('256');
  });

  it('36. Boundary 65535/65536: 65536 exceeds 16-bit range', () => {
    const res = assemble('MOV AX, 65536\nHLT');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'immediate-out-of-range' });
    expect(res.errors[0]?.message).toContain('65536');
  });

  it('37. Hex literal without leading digit (FFh)', () => {
    const res = assemble('.data\nval: DB FFh');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 2, code: 'bad-number-syntax' });
    expect(res.errors[0]?.message).toContain('FFh');
  });

  it('38. Invalid hex digits in 0x literal', () => {
    const res = assemble('MOV AX, 0x12G\nHLT');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'bad-number-syntax' });
  });

  it('39. Invalid binary digits in binary literal', () => {
    const res = assemble('.data\nval: DB 102b');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 2, code: 'bad-number-syntax' });
  });

  it('40. Bad character literal (multiple characters)', () => {
    const res = assemble("MOV AL, 'AB'\nHLT");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'bad-character-literal' });
    expect(res.errors[0]?.message).toContain("'AB'");
  });

  it('41. Unterminated string literal', () => {
    const res = assemble('.data\nmsg: DB "Unterminated');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 2, code: 'unterminated-string' });
  });

  it('42. Unterminated bracket', () => {
    const res = assemble('MOV AX, [BX+SI\nHLT');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'unterminated-bracket' });
  });

  it('43. Misplaced directive: DB in .code', () => {
    const res = assemble('.code\nDB 10\nHLT');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 2, code: 'misplaced-directive' });
    expect(res.errors[0]?.message).toContain('DB');
  });

  it('44. Misplaced directive: instruction in .data', () => {
    const res = assemble('.data\nMOV AX, 1');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 2, code: 'misplaced-directive' });
    expect(res.errors[0]?.message).toContain('MOV');
  });

  it('45. Misplaced ORG directive', () => {
    const res = assemble('.data\nitem: DB 1\nORG 0x0200');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 3, code: 'misplaced-org' });
  });

  it('46. Program too large (over 4096 instructions)', () => {
    const lines = Array.from({ length: 4100 }, () => 'NOP').join('\n');
    const res = assemble(lines);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.some((e) => e.code === 'program-too-large')).toBe(true);
  });

  it('47. Data overflow (over 64 KB)', () => {
    const res = assemble('.data\nORG 0xFFF0\noverflow: DW 1, 2, 3, 4, 5, 6, 7, 8, 9, 10');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ code: 'data-overflow' });
  });

  it('48. Multi-error program reports all errors in source order', () => {
    const src = `
FOO AX, 1
MOV AL, BX
INC 10
HLT`;
    const res = assemble(src);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.length).toBeGreaterThanOrEqual(3);
    expect(res.errors[0]?.line).toBe(2);
    expect(res.errors[1]?.line).toBe(3);
    expect(res.errors[2]?.line).toBe(4);
  });

  it('49. Error capping at exactly 50 errors', () => {
    const lines = Array.from({ length: 70 }, (_, i) => `BAD_INSTR_${i}`).join('\n');
    const res = assemble(lines);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.length).toBe(50);
  });

  it('50. Warning: immediate truncated on negative overflow', () => {
    const res = assemble('MOV AL, -200\nHLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.warnings.some((w) => w.code === 'immediate-truncated')).toBe(true);
  });

  it('51. Warning: unreachable code after JMP', () => {
    const res = assemble('JMP end\nMOV AX, 1\nend: HLT');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.warnings.some((w) => w.code === 'unreachable-code')).toBe(true);
  });

  it('52. Warning: missing HLT at end of program', () => {
    const res = assemble('MOV AX, 1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.warnings.some((w) => w.code === 'missing-hlt')).toBe(true);
  });
});
