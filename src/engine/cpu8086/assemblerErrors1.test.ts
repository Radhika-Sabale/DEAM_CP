import { describe, expect, it } from 'vitest';
import { assemble } from './assembler';

describe('8086 Assembler Invalid Snippets - Part 1', () => {
  it('1. Unknown mnemonic', () => {
    const res = assemble('FOOBAR AX, 1');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, column: 1, code: 'unknown-mnemonic' });
    expect(res.errors[0]?.message).toContain('FOOBAR');
  });

  it('2. Unknown register in operand', () => {
    const res = assemble('MOV EX, 1');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'invalid-operand-form' });
    expect(res.errors[0]?.message).toContain('EX');
  });

  it('3. Unmodeled register BP', () => {
    const res = assemble('MOV BP, 1');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'unknown-register' });
    expect(res.errors[0]?.message).toContain('BP');
  });

  it('4. Unmodeled segment register CS', () => {
    const res = assemble('MOV CS, AX');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'unknown-register' });
    expect(res.errors[0]?.message).toContain('CS');
  });

  it('5. Wrong operand count: too many for HLT', () => {
    const res = assemble('HLT AX');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, column: 1, code: 'wrong-operand-count' });
    expect(res.errors[0]?.message).toContain('HLT');
  });

  it('6. Wrong operand count: too few for MOV', () => {
    const res = assemble('MOV AX');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, column: 1, code: 'wrong-operand-count' });
    expect(res.errors[0]?.message).toContain('MOV');
  });

  it('7. Wrong operand count: too many for ADD', () => {
    const res = assemble('ADD AX, BX, CX');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, column: 1, code: 'wrong-operand-count' });
  });

  it('8. Immediate destination error', () => {
    const res = assemble('MOV 10, AX');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'invalid-operand-form' });
    expect(res.errors[0]?.message).toContain('10');
  });

  it('9. Memory-to-memory move not supported', () => {
    const res = assemble('MOV [BX], [SI]');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'invalid-operand-form' });
    expect(res.errors[0]?.message).toContain('Memory-to-memory');
  });

  it('10. PUSH immediate not allowed in 8086', () => {
    const res = assemble('PUSH 5');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'invalid-operand-form' });
    expect(res.errors[0]?.message).toContain('PUSH');
  });

  it('11. PUSH 8-bit register', () => {
    const res = assemble('PUSH AL');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'size-mismatch' });
    expect(res.errors[0]?.message).toContain('AL');
  });

  it('12. POP immediate not allowed', () => {
    const res = assemble('POP 10');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'invalid-operand-form' });
    expect(res.errors[0]?.message).toContain('POP');
  });

  it('13. POP 8-bit register', () => {
    const res = assemble('POP BL');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'size-mismatch' });
    expect(res.errors[0]?.message).toContain('BL');
  });

  it('14. POP into IP not allowed', () => {
    const res = assemble('POP IP');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'invalid-operand-form' });
    expect(res.errors[0]?.message).toContain('IP');
  });

  it('15. Jump target must be a label, not register', () => {
    const res = assemble('JMP AX');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'invalid-operand-form' });
    expect(res.errors[0]?.message).toContain('JMP');
  });

  it('16. INC immediate not allowed', () => {
    const res = assemble('INC 5');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'invalid-operand-form' });
    expect(res.errors[0]?.message).toContain('INC');
  });

  it('17. Invalid shift count (immediate 2)', () => {
    const res = assemble('SHL AX, 2');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'invalid-shift-count' });
    expect(res.errors[0]?.message).toContain('2');
  });

  it('18. Invalid shift count register (DX)', () => {
    const res = assemble('SHR BX, DX');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'invalid-shift-count' });
    expect(res.errors[0]?.message).toContain('DX');
  });

  it('19. Invalid register in memory brackets [AX]', () => {
    const res = assemble('MOV [AX], 1');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'invalid-operand-form' });
    expect(res.errors[0]?.message).toContain('AX');
  });

  it('20. Unmodeled register in memory brackets [BP]', () => {
    const res = assemble('MOV [BP], 1');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'unknown-register' });
    expect(res.errors[0]?.message).toContain('BP');
  });

  it('21. Two index registers in memory brackets [SI+DI]', () => {
    const res = assemble('MOV AX, [SI+DI]');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'invalid-operand-form' });
  });

  it('22. Size mismatch: 8-bit dest with 16-bit src', () => {
    const res = assemble('MOV AL, BX');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'size-mismatch' });
    expect(res.errors[0]?.message).toContain('mismatch');
  });

  it('23. Size mismatch: 16-bit dest with 8-bit src', () => {
    const res = assemble('MOV AX, CL');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'size-mismatch' });
  });

  it('24. Ambiguous operand size for MOV [BX], 5', () => {
    const res = assemble('MOV [BX], 5');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'ambiguous-operand-size' });
  });

  it('25. Ambiguous operand size for INC [DI]', () => {
    const res = assemble('INC [DI]');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 1, code: 'ambiguous-operand-size' });
  });

  it('26. DUP syntax not supported in DB', () => {
    const res = assemble('.data\nbuf: DB 10 DUP(0)');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toMatchObject({ line: 2, code: 'invalid-operand-form' });
    expect(res.errors[0]?.message).toContain('DUP');
  });
});
