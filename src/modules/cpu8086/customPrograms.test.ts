import { describe, expect, it } from 'vitest';
import { assemble } from '../../engine/cpu8086/assembler';
import { createCpuState } from '../../engine/cpu8086/cpu';
import { readByte, readWord } from '../../engine/cpu8086/memory';
import { runToHalt } from '../../engine/cpu8086/runner';

function execute(source: string) {
  const assembled = assemble(source);
  expect(assembled.ok, assembled.ok ? '' : JSON.stringify(assembled.errors)).toBe(true);
  if (!assembled.ok) throw new Error('Custom program failed to assemble');
  const result = runToHalt(createCpuState(assembled.program), assembled.program);
  expect(result.stopReason).toBe('halted');
  return { program: assembled.program, ...result };
}

describe('8086 user-written programs', () => {
  it('executes immediate and register operands with mixed case, spacing, blanks, and comments', () => {
    const { state } = execute('; custom source\n\n mov\t ax, 10 ; decimal\nMOV BX, 0FFh\nADD AX, bx\nSUB AX, 0x10\nHLT');
    expect(state.registers).toMatchObject({ AX: 249, BX: 255 });
  });

  it('reads and writes memory and parses character, hex, and binary values', () => {
    const { state, program } = execute(`.data\nletters: DB 'A', 0FFh\nnumber: DB 1010b\n.code\nMOV BX, letters\nMOV AL, [BX]\nINC BX\nMOV DL, [BX]\nMOV BX, number\nMOV CL, [BX]\nHLT`);
    expect(state.registers.AX & 0xff).toBe(65);
    expect(state.registers.DX & 0xff).toBe(255);
    expect(state.registers.CX & 0xff).toBe(10);
    expect(readByte(state.memory, program.symbols.letters!.address)).toBe(65);
  });

  it('executes bitwise operations and shifts', () => {
    const { state } = execute('MOV AX, 0x0081\nAND AX, 0x00FF\nOR AX, 0x0010\nXOR AX, 0x0010\nSHL AX, 1\nSHR AX, 1\nHLT');
    expect(state.registers.AX).toBe(0x81);
  });

  it('takes signed, greater-than, JE, and JZ branches to forward labels', () => {
    const { state } = execute(`MOV AX, 3\nMOV BX, 5\nCMP AX, BX\nJL less\nMOV CX, 99\nJMP check_equal\nless: MOV CX, 1\ncheck_equal: CMP AX, AX\nJE equal\nMOV DX, 99\nJMP check_zero\nequal: MOV DX, 2\ncheck_zero: JZ zero\nMOV SI, 99\nJMP check_greater\nzero: MOV SI, 1\ncheck_greater: CMP BX, AX\nJG greater\nMOV DI, 99\nJMP done\ngreater: MOV DI, 2\ndone: HLT`);
    expect(state.registers).toMatchObject({ CX: 1, DX: 2, SI: 1, DI: 2 });
  });

  it('takes the carry branch after unsigned subtraction', () => {
    const { state } = execute('MOV AL, 1\nSUB AL, 2\nJC carry\nMOV BL, 0\nJMP done\ncarry: MOV BL, 1\ndone: HLT');
    expect(state.registers.BX & 0xff).toBe(1);
  });

  it('handles a backward label and JNE loop', () => {
    const { state } = execute('MOV CX, 4\nagain:\nDEC CX\nJNE again\nHLT');
    expect(state.registers.CX).toBe(0);
  });

  it('pushes and pops register values on the modeled stack', () => {
    const { state } = execute('MOV AX, 0x1234\nPUSH AX\nMOV AX, 0\nPOP BX\nHLT');
    expect(state.registers).toMatchObject({ AX: 0, BX: 0x1234 });
  });

  it('honors ORG and .data/.code with label references', () => {
    const { state, program } = execute('.data\nORG 0x0200\nvalue: DB 1010b\n.code\nMOV BX, value\nMOV AL, [BX]\nHLT');
    expect(program.symbols.value?.address).toBe(0x200);
    expect(state.registers.AX & 0xff).toBe(10);
  });

  it('executes a forward jump without executing skipped user code', () => {
    const { state } = execute('JMP entry\nMOV AX, 99\nentry: MOV AX, 42\nHLT');
    expect(state.registers.AX).toBe(42);
  });

  it('reports remaining unsupported instructions and directives on their source line', () => {
    for (const unsupportedSource of ['AAA', 'SEGMENT']) {
      const assembled = assemble(`NOP\n${unsupportedSource}\nHLT`);
      expect(assembled.ok).toBe(false);
      if (!assembled.ok) {
        expect(assembled.errors[0]).toMatchObject({ line: 2, code: 'unknown-mnemonic' });
        expect(assembled.errors[0]?.message).toContain(unsupportedSource.split(' ')[0]);
      }
    }
  });

  it('computes factorial of five with MUL and LOOP', () => {
    const { state } = execute('MOV AX, 1\nMOV CX, 5\nfact: MUL CX\nLOOP fact\nHLT');
    expect(state.registers).toMatchObject({ AX: 120, CX: 0, DX: 0 });
  });

  it('divides 100 by 7 into AL quotient 14 and AH remainder 2', () => {
    const { state } = execute('MOV AX, 100\nMOV BL, 7\nDIV BL\nHLT');
    expect(state.registers.AX).toBe(0x020e);
  });

  it('reports divide by zero with the source line and without hanging', () => {
    const assembled = assemble('MOV AX, 100\nMOV BL, 0\nDIV BL\nHLT');
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;
    const result = runToHalt(createCpuState(assembled.program), assembled.program);
    expect(result.stopReason).toBe('fault');
    expect(result.state.fault).toMatchObject({ type: 'divide-error', sourceLine: 3 });
    expect(result.state.fault?.message).toMatch(/divide error.*line 3/i);
  });

  it('sums a byte array using LOOP and leaves the sum in AX', () => {
    const { state, program } = execute('.data\narr: DB 1, 2, 3, 4\n.code\nMOV BX, arr\nMOV CX, 4\nMOV AX, 0\nadd_next: ADD AL, [BX]\nINC BX\nLOOP add_next\nHLT');
    expect(state.registers).toMatchObject({ AX: 10, CX: 0 });
    expect(readByte(state.memory, program.symbols.arr!.address + 3)).toBe(4);
  });

  it('executes NOT and NEG for byte and word operands with 8086 flags', () => {
    const { state } = execute('MOV AL, 0x0F\nNOT AL\nNEG AL\nMOV DX, 1\nNOT DX\nNEG DX\nHLT');
    expect(state.registers).toMatchObject({ AX: 0x0010, DX: 2 });
    expect(state.flags.C).toBe(1);
    expect(state.flags.O).toBe(0);
  });

  it('executes NOT and NEG directly on byte and word memory operands', () => {
    const { state, program } = execute('.data\nvalues: DB 0x0F\nwordValue: DW 1\n.code\nMOV BX, values\nNOT BYTE PTR [BX]\nNEG WORD PTR [BX+1]\nHLT');
    expect(readByte(state.memory, program.symbols.values!.address)).toBe(0xf0);
    expect(readWord(state.memory, program.symbols.wordValue!.address)).toBe(0xffff);
  });

  it('uses END as a stop directive and optional entry point', () => {
    const assembled = assemble('start: MOV AX, 7\nHLT\nEND start\nNOT_A_MNEMONIC');
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;
    expect(assembled.program.entryPoint).toBe(0);
    expect(assembled.program.instructions).toHaveLength(2);
    const result = runToHalt(createCpuState(assembled.program), assembled.program);
    expect(result.state.registers.AX).toBe(7);
  });

  it('supports IMUL, IDIV, XCHG, LEA, CBW and CWD', () => {
    const { state, program } = execute('.data\nvalue: DW 0\n.code\nMOV AL, -3\nCBW\nMOV BL, 2\nIMUL BL\nMOV AX, -100\nCWD\nMOV BX, 7\nIDIV BX\nXCHG AX, DX\nLEA SI, [value]\nHLT');
    expect(state.registers).toMatchObject({ AX: 0xfffe, DX: 0xfff2, SI: program.symbols.value!.address });
  });

  it('supports LOOP condition aliases and JCXZ without changing flags', () => {
    const { state } = execute('MOV CX, 2\nMOV AX, 0\nrepeat: INC BX\nCMP AX, AX\nLOOPZ repeat\nJCXZ zero\nMOV DX, 99\nJMP done\nzero: MOV DX, 1\ndone: HLT');
    expect(state.registers).toMatchObject({ BX: 2, CX: 0, DX: 1 });
    expect(state.flags.Z).toBe(1);
  });
});
