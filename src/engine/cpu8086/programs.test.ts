/* eslint-disable no-console */
/**
 * @file programs.test.ts
 * End-to-end program execution test suite for the 8086 CPU Core (Stage 14B).
 *
 * Assembles complete multi-line programs from source text, executes them to HLT
 * with a step cap, and asserts correctness against independent TypeScript reference models.
 */

import { describe, expect, it } from 'vitest';
import {
  assemble,
  createCpuState,
  getReg,
  readByte,
  readWord,
  setReg,
  step,
  type CpuState,
  type Program,
  type StepRecord,
} from './index';

function makeProgram(source: string): Program {
  const res = assemble(source);
  if (!res.ok) {
    throw new Error(`Assembly failed:\n${JSON.stringify(res.errors, null, 2)}`);
  }
  return res.program;
}

function runToHalt(program: Program, initialState?: CpuState, maxSteps = 10000): { state: CpuState; steps: number; lastRecord: StepRecord } {
  let state = initialState ?? createCpuState(program);
  let steps = 0;
  let lastRecord: StepRecord | undefined;

  while (!state.halted && steps < maxSteps) {
    const res = step(state, program);
    state = res.state;
    lastRecord = res.record;
    steps++;
  }

  if (!lastRecord) {
    throw new Error('Program did not execute any steps');
  }

  return { state, steps, lastRecord };
}

describe('8086 CPU Core - End-to-End Programs', () => {
  it('1. Sum of 1..N with a loop (N = 10, N = 100)', () => {
    const src10 = `
      MOV AX, 0
      MOV CX, 10
    loop:
      ADD AX, CX
      DEC CX
      JNZ loop
      HLT
    `;
    const { state: s10, steps: steps10 } = runToHalt(makeProgram(src10));
    expect(s10.halted).toBe(true);
    expect(getReg(s10.registers, 'AX')).toBe(55); // 10*11/2 = 55
    expect(getReg(s10.registers, 'SP')).toBe(s10.initialSp); // Balanced stack
    expect(steps10).toBeGreaterThan(0);

    const src100 = `
      MOV AX, 0
      MOV CX, 100
    loop:
      ADD AX, CX
      DEC CX
      JNZ loop
      HLT
    `;
    const { state: s100 } = runToHalt(makeProgram(src100));
    expect(getReg(s100.registers, 'AX')).toBe(5050); // 100*101/2 = 5050
    expect(getReg(s100.registers, 'SP')).toBe(s100.initialSp);
  });

  it('2. Factorial of 1..8 using repeated addition', () => {
    // Computes factorial of DX (1..8)
    const src = `
      MOV AX, 1
      MOV BX, 1
    outer:
      CMP BX, DX
      JE done
      INC BX
      MOV SI, AX
      MOV CX, BX
      DEC CX
    inner:
      ADD AX, SI
      DEC CX
      JNZ inner
      JMP outer
    done:
      HLT
    `;
    const prog = makeProgram(src);

    const factorials = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];
    for (let n = 1; n <= 8; n++) {
      let state = createCpuState(prog);
      state = setReg(state, 'DX', n);
      const { state: finalState } = runToHalt(prog, state);

      expect(finalState.halted).toBe(true);
      expect(getReg(finalState.registers, 'AX')).toBe(factorials[n]);
      expect(getReg(finalState.registers, 'SP')).toBe(finalState.initialSp);
    }
  });

  it('3. Fibonacci first 12 values stored in memory', () => {
    const src = `
      .data
      fib: DB 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
      .code
      MOV BX, fib
      MOV BYTE PTR [BX], 0
      INC BX
      MOV BYTE PTR [BX], 1
      MOV CX, 10
    loop:
      MOV AL, [BX-1]
      ADD AL, [BX]
      INC BX
      MOV [BX], AL
      DEC CX
      JNZ loop
      HLT
    `;
    const prog = makeProgram(src);
    const { state } = runToHalt(prog);

    const expectedFib = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
    const fibAddr = prog.symbols['fib']?.address ?? 0x0100;

    for (let i = 0; i < 12; i++) {
      expect(readByte(state.memory, fibAddr + i)).toBe(expectedFib[i]);
    }
    expect(getReg(state.registers, 'SP')).toBe(state.initialSp);
  });

  it('4. Find maximum of an array in .data', () => {
    const src = `
      .data
      arr: DB 23, 89, 12, 104, 55, 9, 78, 42
      .code
      MOV BX, arr
      MOV CX, 8
      MOV AL, [BX]
      INC BX
      DEC CX
    loop:
      MOV DL, [BX]
      CMP DL, AL
      JBE skip
      MOV AL, DL
    skip:
      INC BX
      DEC CX
      JNZ loop
      HLT
    `;
    const prog = makeProgram(src);
    const { state } = runToHalt(prog);

    expect(state.halted).toBe(true);
    expect(getReg(state.registers, 'AL')).toBe(104); // Maximum element
    expect(getReg(state.registers, 'SP')).toBe(state.initialSp);
  });

  it('5. Reverse an array in memory using the stack', () => {
    const src = `
      .data
      arr: DW 11, 22, 33, 44, 55
      .code
      MOV BX, arr
      MOV CX, 5
    push_loop:
      PUSH WORD PTR [BX]
      ADD BX, 2
      DEC CX
      JNZ push_loop

      MOV BX, arr
      MOV CX, 5
    pop_loop:
      POP WORD PTR [BX]
      ADD BX, 2
      DEC CX
      JNZ pop_loop
      HLT
    `;
    const prog = makeProgram(src);
    const { state } = runToHalt(prog);

    const arrAddr = prog.symbols['arr']?.address ?? 0x0100;
    const expected = [55, 44, 33, 22, 11];

    for (let i = 0; i < 5; i++) {
      expect(readWord(state.memory, arrAddr + i * 2)).toBe(expected[i]);
    }
    expect(getReg(state.registers, 'SP')).toBe(state.initialSp); // Stack balanced!
  });

  it('6. Bubble sort of 8 bytes in memory', () => {
    const src = `
      .data
      arr: DB 64, 25, 12, 22, 11, 90, 88, 34
      .code
      MOV CX, 7
    outer:
      MOV BX, arr
      MOV DX, CX
    inner:
      MOV AL, [BX]
      MOV AH, [BX+1]
      CMP AL, AH
      JBE no_swap
      MOV [BX], AH
      MOV [BX+1], AL
    no_swap:
      INC BX
      DEC DX
      JNZ inner
      DEC CX
      JNZ outer
      HLT
    `;
    const prog = makeProgram(src);
    const { state } = runToHalt(prog, undefined, 50000);

    const arrAddr = prog.symbols['arr']?.address ?? 0x0100;
    const expected = [11, 12, 22, 25, 34, 64, 88, 90];

    for (let i = 0; i < 8; i++) {
      expect(readByte(state.memory, arrAddr + i)).toBe(expected[i]);
    }
    expect(getReg(state.registers, 'SP')).toBe(state.initialSp);
  });

  it('7. 16-bit addition of two 32-bit numbers with carry propagation (ADD with JNC / INC)', () => {
    const src = `
      ; low part: AX + BX
      ADD AX, BX
      JNC no_carry
      INC DX
    no_carry:
      ADD DX, CX
      HLT
    `;
    const prog = makeProgram(src);

    // Case A: With carry propagation
    // 0x0001FFFF + 0x00030002 = 0x00050001
    let stateA = createCpuState(prog);
    stateA = setReg(stateA, 'AX', 0xffff);
    stateA = setReg(stateA, 'DX', 0x0001);
    stateA = setReg(stateA, 'BX', 0x0002);
    stateA = setReg(stateA, 'CX', 0x0003);

    const { state: finalA } = runToHalt(prog, stateA);
    expect(getReg(finalA.registers, 'AX')).toBe(0x0001);
    expect(getReg(finalA.registers, 'DX')).toBe(0x0005);

    // Case B: Without carry propagation
    // 0x00020010 + 0x00010020 = 0x00030030
    let stateB = createCpuState(prog);
    stateB = setReg(stateB, 'AX', 0x0010);
    stateB = setReg(stateB, 'DX', 0x0002);
    stateB = setReg(stateB, 'BX', 0x0020);
    stateB = setReg(stateB, 'CX', 0x0001);

    const { state: finalB } = runToHalt(prog, stateB);
    expect(getReg(finalB.registers, 'AX')).toBe(0x0030);
    expect(getReg(finalB.registers, 'DX')).toBe(0x0003);
  });

  it('8. A subroutine called from three places (CALL / RET)', () => {
    const src = `
      MOV AX, 1
      CALL double_and_inc
      CALL double_and_inc
      CALL double_and_inc
      HLT

    double_and_inc:
      INC AX
      SHL AX, 1
      RET
    `;
    // Trace:
    // start: AX = 1
    // call 1: (1 + 1) * 2 = 4
    // call 2: (4 + 1) * 2 = 10
    // call 3: (10 + 1) * 2 = 22
    const prog = makeProgram(src);
    const { state } = runToHalt(prog);

    expect(state.halted).toBe(true);
    expect(getReg(state.registers, 'AX')).toBe(22);
    expect(getReg(state.registers, 'SP')).toBe(state.initialSp);
  });

  it('9. Recursive-style countdown using the stack', () => {
    const src = `
      MOV AX, 10
      CALL countdown
      HLT

    countdown:
      CMP AX, 0
      JE base_case
      DEC AX
      CALL countdown
      INC AX
    base_case:
      RET
    `;
    const prog = makeProgram(src);
    const { state, steps } = runToHalt(prog, undefined, 5000);

    expect(state.halted).toBe(true);
    expect(getReg(state.registers, 'AX')).toBe(10);
    expect(getReg(state.registers, 'SP')).toBe(state.initialSp); // Fully unwound stack!
    expect(steps).toBeGreaterThan(50);
  });

  it('10. Multiplication by repeated addition and by shifts', () => {
    // Multiply 13 by 10:
    // Method 1: Repeated addition
    // Method 2: Shifts: (13 << 3) + (13 << 1) = 104 + 26 = 130
    const src = `
      ; Method 1: AX = 13 * 10 via addition
      MOV AX, 0
      MOV CX, 10
    mult_loop:
      ADD AX, 13
      DEC CX
      JNZ mult_loop

      ; Method 2: BX = 13 * 10 via shifts
      MOV BX, 13
      MOV DX, 13
      MOV CL, 3
      SHL BX, CL      ; BX = 13 << 3 = 104
      SHL DX, 1       ; DX = 13 << 1 = 26
      ADD BX, DX      ; BX = 104 + 26 = 130
      HLT
    `;
    const prog = makeProgram(src);
    const { state } = runToHalt(prog);

    expect(getReg(state.registers, 'AX')).toBe(130);
    expect(getReg(state.registers, 'BX')).toBe(130);
    expect(getReg(state.registers, 'SP')).toBe(state.initialSp);
  });

  it('11. Count of set bits in a byte using SHR and CF', () => {
    // Population count of 0xB5 (binary 10110101 = 5 set bits)
    const src = `
      MOV AL, 0xB5
      MOV CX, 8
      MOV BL, 0
    pop_loop:
      SHR AL, 1
      JNC skip_inc
      INC BL
    skip_inc:
      DEC CX
      JNZ pop_loop
      HLT
    `;
    const prog = makeProgram(src);
    const { state } = runToHalt(prog);

    expect(getReg(state.registers, 'BL')).toBe(5);
    expect(getReg(state.registers, 'SP')).toBe(state.initialSp);
  });

  it('12. Infinite loop hits step cap and asserts not halted', () => {
    const src = `
    loop:
      NOP
      JMP loop
      HLT
    `;
    const prog = makeProgram(src);
    const { state, steps } = runToHalt(prog, undefined, 250);

    expect(state.halted).toBe(false);
    expect(steps).toBe(250);
  });

  it('13. Print required StepRecord JSONs (Requirement 4)', () => {
    // 1. ADD AX, BX with carry
    const progAdd = makeProgram('ADD AX, BX\nHLT');
    let sAdd = createCpuState(progAdd);
    sAdd = setReg(sAdd, 'AX', 0xffff);
    sAdd = setReg(sAdd, 'BX', 0x0001);
    const recAdd = step(sAdd, progAdd).record;
    console.log('--- StepRecord 1: ADD AX, BX with carry ---');
    console.log(JSON.stringify(recAdd, null, 2));

    // 2. PUSH AX
    const progPush = makeProgram('PUSH AX\nHLT');
    let sPush = createCpuState(progPush);
    sPush = setReg(sPush, 'AX', 0x1234);
    const recPush = step(sPush, progPush).record;
    console.log('--- StepRecord 2: PUSH AX ---');
    console.log(JSON.stringify(recPush, null, 2));

    // 3. CALL
    const progCall = makeProgram('CALL target\nHLT\ntarget: NOP\nRET');
    const sCall = createCpuState(progCall);
    const recCall = step(sCall, progCall).record;
    console.log('--- StepRecord 3: CALL ---');
    console.log(JSON.stringify(recCall, null, 2));

    // 4. CMP followed by JL
    const progCmpJl = makeProgram('CMP AX, BX\nJL target\nHLT\ntarget: NOP\nHLT');
    let sCmpJl = createCpuState(progCmpJl);
    sCmpJl = setReg(sCmpJl, 'AX', 5);
    sCmpJl = setReg(sCmpJl, 'BX', 10);
    const stepCmp = step(sCmpJl, progCmpJl);
    const recJl = step(stepCmp.state, progCmpJl).record;
    console.log('--- StepRecord 4: CMP followed by JL ---');
    console.log(JSON.stringify(recJl, null, 2));

    expect(recAdd.flagsChanged.some((f) => f.name === 'C' && f.new === 1)).toBe(true);
    expect(recPush.stackChange?.type).toBe('push');
    expect(recCall.stackChange?.type).toBe('push');
    expect(recJl.ipAfter).toBe(3); // target address
  });
});
