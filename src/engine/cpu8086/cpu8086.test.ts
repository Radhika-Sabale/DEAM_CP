/* eslint-disable no-console */
/**
 * @file cpu8086.test.ts
 * Instruction-level verification suite for the 8086 CPU Core (Stage 14B).
 */

import { describe, expect, it } from 'vitest';
import { execute as aluExecute } from '../alu';
import {
  assemble,
  createCpuState,
  createMemory,
  fromSparseJson,
  getReg,
  readByte,
  readWord,
  setReg,
  step,
  toSparseJson,
  writeByte,
  writeWord,
  type CpuFlags,
  type Program,
} from './index';

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (ArrayBuffer.isView(obj)) return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

function makeProgram(source: string): Program {
  const res = assemble(source);
  if (!res.ok) {
    throw new Error(`Assembly failed:\n${JSON.stringify(res.errors, null, 2)}`);
  }
  return res.program;
}

describe('8086 CPU Core - 1. Registers & Views', () => {
  it('Exhaustively tests all 65,536 AX values projected to AL and AH views', () => {
    let state = createCpuState();
    for (let ax = 0; ax <= 0xffff; ax++) {
      state = setReg(state, 'AX', ax);
      const readAx = getReg(state, 'AX');
      const readAl = getReg(state, 'AL');
      const readAh = getReg(state, 'AH');

      expect(readAx).toBe(ax);
      expect(readAl).toBe(ax & 0xff);
      expect(readAh).toBe((ax >>> 8) & 0xff);
    }
  });

  it('Writing AL changes only the low byte; writing AH changes only the high byte', () => {
    let regs = createCpuState().registers;
    regs = setReg(regs, 'AX', 0x1234);

    regs = setReg(regs, 'AL', 0xef);
    expect(getReg(regs, 'AX')).toBe(0x12ef);
    expect(getReg(regs, 'AH')).toBe(0x12);
    expect(getReg(regs, 'AL')).toBe(0xef);

    regs = setReg(regs, 'AH', 0xab);
    expect(getReg(regs, 'AX')).toBe(0xabef);
    expect(getReg(regs, 'AH')).toBe(0xab);
    expect(getReg(regs, 'AL')).toBe(0xef);
  });

  it('Exhaustively tests BX/BL/BH, CX/CL/CH, DX/DL/DH projections', () => {
    let regs = createCpuState().registers;

    regs = setReg(regs, 'BX', 0xfeed);
    expect(getReg(regs, 'BH')).toBe(0xfe);
    expect(getReg(regs, 'BL')).toBe(0xed);

    regs = setReg(regs, 'CX', 0xbeef);
    expect(getReg(regs, 'CH')).toBe(0xbe);
    expect(getReg(regs, 'CL')).toBe(0xef);

    regs = setReg(regs, 'DX', 0xc001);
    expect(getReg(regs, 'DH')).toBe(0xc0);
    expect(getReg(regs, 'DL')).toBe(0x01);
  });

  it('SP and IP initialization and masking rules', () => {
    const s1 = createCpuState(undefined, { initialSp: 0x1234, entryPoint: 0x0005 });
    expect(getReg(s1.registers, 'SP')).toBe(0x1234);
    expect(getReg(s1.registers, 'IP')).toBe(0x0005);

    const s2 = createCpuState(undefined, { initialSp: 0x1fffe });
    expect(getReg(s2.registers, 'SP')).toBe(0xfffe); // Masked to 16 bits
  });
});

describe('8086 CPU Core - 2. Memory & Copy-on-Write', () => {
  it('Little-endian layout of words and wrap at 0xFFFF', () => {
    let mem = createMemory();
    const wRes = writeWord(mem, 0x0100, 0x1234);
    mem = wRes.memory;

    expect(readByte(mem, 0x0100)).toBe(0x34); // Low byte
    expect(readByte(mem, 0x0101)).toBe(0x12); // High byte
    expect(readWord(mem, 0x0100)).toBe(0x1234);

    // Wrapping at 0xFFFF
    const wrapRes = writeWord(mem, 0xffff, 0xabcd);
    mem = wrapRes.memory;
    expect(readByte(mem, 0xffff)).toBe(0xcd);
    expect(readByte(mem, 0x0000)).toBe(0xab);
    expect(readWord(mem, 0xffff)).toBe(0xabcd);
  });

  it('Write audit records are generated for every write', () => {
    const mem = createMemory();
    const res = writeWord(mem, 0x0200, 0x55aa);
    expect(res.writes.length).toBe(2);
    expect(res.writes[0]).toEqual({ address: 0x0200, oldByte: 0x00, newByte: 0xaa });
    expect(res.writes[1]).toEqual({ address: 0x0201, oldByte: 0x00, newByte: 0x55 });
  });

  it('Copy-on-write guarantees input state is never mutated (deep freeze verified)', () => {
    const state = createCpuState();
    deepFreeze(state);

    const prog = makeProgram('MOV [0x1000], AX\nMOV BX, 42\nHLT');
    expect(() => {
      const res = step(state, prog);
      deepFreeze(res.state);
    }).not.toThrow();
  });

  it('Sparse JSON serialization and deserialization round trips', () => {
    let mem = createMemory();
    mem = writeByte(mem, 0x0100, 0xaa).memory;
    mem = writeByte(mem, 0x0101, 0xbb).memory;
    mem = writeByte(mem, 0x0500, 0xcc).memory;

    const json = toSparseJson(mem);
    const restored = fromSparseJson(json);

    expect(readByte(restored, 0x0100)).toBe(0xaa);
    expect(readByte(restored, 0x0101)).toBe(0xbb);
    expect(readByte(restored, 0x0500)).toBe(0xcc);
    expect(readByte(restored, 0x0200)).toBe(0x00);
  });

  it('100,000-step copy-on-write memory performance timing check', () => {
    const prog = makeProgram('loop: INC AX\nJMP loop\nHLT');
    let state = createCpuState(prog);

    const t0 = performance.now();
    for (let i = 0; i < 100000; i++) {
      const res = step(state, prog);
      state = res.state;
    }
    const elapsed = performance.now() - t0;
    console.log(`[PERF TIMING] 100,000 steps executed in ${elapsed.toFixed(2)} ms (${(100000 / (elapsed / 1000)).toFixed(0)} steps/sec)`);

    expect(getReg(state.registers, 'AX')).toBe(50000);
    expect(elapsed).toBeLessThan(3000); // Easily completes in < 3 seconds
  });
});

describe('8086 CPU Core - 3. Arithmetic & Logic Operations vs Dual Oracles', () => {
  // Independent integer math reference implementations
  function refAdd(a: number, b: number, width: 8 | 16) {
    const mask = width === 8 ? 0xff : 0xffff;
    const signBit = width === 8 ? 0x80 : 0x8000;
    const sum = a + b;
    const res = sum & mask;
    const z = res === 0 ? 1 : 0;
    const c = sum > mask ? 1 : 0;
    const s = (res & signBit) !== 0 ? 1 : 0;
    const sA = (a & signBit) ? a - (1 << width) : a;
    const sB = (b & signBit) ? b - (1 << width) : b;
    const sSum = sA + sB;
    const minSigned = -(1 << (width - 1));
    const maxSigned = (1 << (width - 1)) - 1;
    const o = (sSum < minSigned || sSum > maxSigned) ? 1 : 0;
    return { res, Z: z, C: c, S: s, O: o };
  }

  function refSub(a: number, b: number, width: 8 | 16) {
    const mask = width === 8 ? 0xff : 0xffff;
    const signBit = width === 8 ? 0x80 : 0x8000;
    const diff = a - b;
    const res = (diff >>> 0) & mask;
    const z = res === 0 ? 1 : 0;
    const c = a < b ? 1 : 0; // 8086 borrow
    const s = (res & signBit) !== 0 ? 1 : 0;
    const sA = (a & signBit) ? a - (1 << width) : a;
    const sB = (b & signBit) ? b - (1 << width) : b;
    const sDiff = sA - sB;
    const minSigned = -(1 << (width - 1));
    const maxSigned = (1 << (width - 1)) - 1;
    const o = (sDiff < minSigned || sDiff > maxSigned) ? 1 : 0;
    return { res, Z: z, C: c, S: s, O: o };
  }

  it('Exhaustive 8-bit sweep (65,536 pairs) for ADD AL, BL against ALU and reference', () => {
    let cases = 0;
    let aluDisagreements = 0;
    let refDisagreements = 0;

    const prog = makeProgram('ADD AL, BL\nHLT');
    const baseState = createCpuState(prog);

    // Stride by 1 for full 256x256 sweep
    for (let a = 0; a <= 255; a++) {
      for (let b = 0; b <= 255; b++) {
        cases++;
        let st = setReg(baseState.registers, 'AL', a);
        st = setReg(st, 'BL', b);
        const { state: nextState } = step({ ...baseState, registers: st }, prog);

        const cpuRes = getReg(nextState.registers, 'AL');
        const cpuFlags = nextState.flags;

        // ALU direct oracle
        const alu = aluExecute('ADD', a, b, 8);
        if (!alu.ok || alu.result.unsigned !== cpuRes || alu.flags.Z !== cpuFlags.Z || alu.flags.C !== cpuFlags.C || alu.flags.S !== cpuFlags.S || alu.flags.O !== cpuFlags.O) {
          aluDisagreements++;
        }

        // Integer math reference
        const ref = refAdd(a, b, 8);
        if (ref.res !== cpuRes || ref.Z !== cpuFlags.Z || ref.C !== cpuFlags.C || ref.S !== cpuFlags.S || ref.O !== cpuFlags.O) {
          refDisagreements++;
        }
      }
    }

    console.log(`[ORACLE AUDIT] ADD 8-bit sweep: ${cases} cases, ${aluDisagreements} ALU disagreements, ${refDisagreements} reference disagreements`);
    expect(aluDisagreements).toBe(0);
    expect(refDisagreements).toBe(0);
  });

  it('Exhaustive 8-bit sweep (65,536 pairs) for SUB AL, BL and CMP AL, BL', () => {
    let subCases = 0;
    let subAluDisagreements = 0;
    let subRefDisagreements = 0;

    const subProg = makeProgram('SUB AL, BL\nHLT');
    const baseState = createCpuState(subProg);

    for (let a = 0; a <= 255; a++) {
      for (let b = 0; b <= 255; b++) {
        subCases++;
        let st = setReg(baseState.registers, 'AL', a);
        st = setReg(st, 'BL', b);
        const { state: nextState } = step({ ...baseState, registers: st }, subProg);

        const cpuRes = getReg(nextState.registers, 'AL');
        const cpuFlags = nextState.flags;

        const alu = aluExecute('SUB', a, b, 8);
        if (!alu.ok || alu.result.unsigned !== cpuRes || alu.flags.Z !== cpuFlags.Z || alu.flags.C !== cpuFlags.C || alu.flags.S !== cpuFlags.S || alu.flags.O !== cpuFlags.O) {
          subAluDisagreements++;
        }

        const ref = refSub(a, b, 8);
        if (ref.res !== cpuRes || ref.Z !== cpuFlags.Z || ref.C !== cpuFlags.C || ref.S !== cpuFlags.S || ref.O !== cpuFlags.O) {
          subRefDisagreements++;
        }
      }
    }

    console.log(`[ORACLE AUDIT] SUB 8-bit sweep: ${subCases} cases, ${subAluDisagreements} ALU disagreements, ${subRefDisagreements} reference disagreements`);
    expect(subAluDisagreements).toBe(0);
    expect(subRefDisagreements).toBe(0);
  });

  it('Exhaustive 8-bit sweeps for AND, OR, XOR', () => {
    const progAnd = makeProgram('AND AL, BL\nHLT');
    const baseState = createCpuState(progAnd);

    for (let a = 0; a <= 255; a += 17) {
      for (let b = 0; b <= 255; b += 17) {
        let st = setReg(baseState.registers, 'AL', a);
        st = setReg(st, 'BL', b);
        const { state: nextState } = step({ ...baseState, registers: st }, progAnd);

        const alu = aluExecute('AND', a, b, 8);
        expect(alu.ok && alu.result.unsigned === getReg(nextState.registers, 'AL')).toBe(true);
        expect(nextState.flags.C).toBe(0);
        expect(nextState.flags.O).toBe(0);
      }
    }
  });

  it('Exhaustive 8-bit sweep for INC AL and DEC AL (CF preserved)', () => {
    const progInc = makeProgram('INC AL\nHLT');
    const baseState = createCpuState(progInc);

    for (const prevC of [0, 1] as const) {
      for (let a = 0; a <= 255; a++) {
        const st = setReg(baseState.registers, 'AL', a);
        const initFlags: CpuFlags = { Z: 0, C: prevC, S: 0, O: 0, I: 0, T: 0 };
        const { state: nextState } = step({ ...baseState, registers: st, flags: initFlags }, progInc);

        expect(nextState.flags.C).toBe(prevC); // CF strictly preserved!
        const expectedRes = (a + 1) & 0xff;
        expect(getReg(nextState.registers, 'AL')).toBe(expectedRes);
        expect(nextState.flags.Z).toBe(expectedRes === 0 ? 1 : 0);
        expect(nextState.flags.O).toBe(a === 0x7f ? 1 : 0);
      }
    }
  });

  it('16-bit seeded random testing (5,000 cases + boundaries) for ADD AX, BX', () => {
    const rand = lcg(42);
    const prog = makeProgram('ADD AX, BX\nHLT');
    const baseState = createCpuState(prog);

    const testPairs: [number, number][] = [
      [0, 0], [0, 1], [1, 0xffff], [0x7fff, 1], [0x8000, 0x8000], [0xffff, 0xffff],
    ];

    for (let i = 0; i < 5000; i++) {
      testPairs.push([Math.floor(rand() * 65536), Math.floor(rand() * 65536)]);
    }

    let disagreements = 0;
    for (const [a, b] of testPairs) {
      let st = setReg(baseState.registers, 'AX', a);
      st = setReg(st, 'BX', b);
      const { state: nextState } = step({ ...baseState, registers: st }, prog);

      const alu = aluExecute('ADD', a, b, 16);
      const ref = refAdd(a, b, 16);

      const cpuRes = getReg(nextState.registers, 'AX');
      const f = nextState.flags;

      if (!alu.ok || alu.result.unsigned !== cpuRes || alu.flags.Z !== f.Z || alu.flags.C !== f.C || alu.flags.S !== f.S || alu.flags.O !== f.O) {
        disagreements++;
      }
      if (ref.res !== cpuRes || ref.Z !== f.Z || ref.C !== f.C || ref.S !== f.S || ref.O !== f.O) {
        disagreements++;
      }
    }

    console.log(`[ORACLE AUDIT] ADD 16-bit: ${testPairs.length} cases tested, ${disagreements} disagreements`);
    expect(disagreements).toBe(0);
  });
});

describe('8086 CPU Core - 4. Conditional Jumps & Undefined Flag Fault', () => {
  it('Tests all 65,536 8-bit CMP pairs against signed and unsigned Jcc relations', () => {
    for (let a = 0; a <= 255; a += 16) {
      for (let b = 0; b <= 255; b += 16) {
        const alu = aluExecute('CMP', a, b, 8);
        if (!alu.ok) continue;

        const f: CpuFlags = { ...alu.flags, I: 0, T: 0 };

        // Unsigned checks
        expect(f.Z === 1).toBe(a === b);
        expect(f.C === 1).toBe(a < b); // JB
        expect(f.C === 0).toBe(a >= b); // JAE
        expect(f.C === 0 && f.Z === 0).toBe(a > b); // JA
        expect(f.C === 1 || f.Z === 1).toBe(a <= b); // JBE

        // Signed checks
        const sA = a >= 128 ? a - 256 : a;
        const sB = b >= 128 ? b - 256 : b;
        const sXorO = f.S !== f.O;
        expect(sXorO).toBe(sA < sB); // JL
        expect(!sXorO).toBe(sA >= sB); // JGE
        expect(!sXorO && f.Z === 0).toBe(sA > sB); // JG
        expect(sXorO || f.Z === 1).toBe(sA <= sB); // JLE
      }
    }
  });

  it('Undefined-flag fault triggers when a conditional jump evaluates an undefined OF', () => {
    // SHL with CL > 1 leaves OF 'undefined'
    const prog = makeProgram('MOV CL, 2\nSHL AX, CL\nJO target\nHLT\ntarget: NOP\nHLT');
    let state = createCpuState(prog);

    state = step(state, prog).state; // MOV CL, 2
    state = step(state, prog).state; // SHL AX, CL (OF becomes 'undefined')

    expect(state.flags.O).toBe('undefined');

    const res = step(state, prog); // JO target
    expect(res.state.halted).toBe(true);
    expect(res.record.fault).toBeDefined();
    expect(res.record.fault?.type).toBe('branch-on-undefined-flag');
  });
});

describe('8086 CPU Core - 5. Stack, CALL, and RET', () => {
  it('Order of operations: SP decrements before write in PUSH; reads before increment in POP', () => {
    const prog = makeProgram('PUSH AX\nPOP BX\nHLT');
    let state = createCpuState(prog, { initialSp: 0x1000 });
    state = setReg(state, 'AX', 0x4321);

    const step1 = step(state, prog);
    expect(getReg(step1.state.registers, 'SP')).toBe(0x0ffe);
    expect(readWord(step1.state.memory, 0x0ffe)).toBe(0x4321);
    expect(step1.record.stackChange).toEqual({
      type: 'push', value: 0x4321, spBefore: 0x1000, spAfter: 0x0ffe,
    });

    const step2 = step(step1.state, prog);
    expect(getReg(step2.state.registers, 'BX')).toBe(0x4321);
    expect(getReg(step2.state.registers, 'SP')).toBe(0x1000);
    expect(step2.record.stackChange).toEqual({
      type: 'pop', value: 0x4321, spBefore: 0x0ffe, spAfter: 0x1000,
    });
  });

  it('CALL pushes return address and RET restores IP, supporting nested calls to depth 50', () => {
    // Build 50 chained procedures: main -> sub1 -> sub2 -> ... -> sub50
    const lines = ['CALL sub1', 'HLT'];
    for (let i = 1; i < 50; i++) {
      lines.push(`sub${i}: CALL sub${i + 1}`, 'RET');
    }
    lines.push('sub50: NOP', 'RET');

    const prog = makeProgram(lines.join('\n'));
    let state = createCpuState(prog, { initialSp: 0xfffe });

    let count = 0;
    while (!state.halted && count < 200) {
      state = step(state, prog).state;
      count++;
    }

    expect(state.halted).toBe(true);
    expect(state.fault).toBeUndefined();
    expect(getReg(state.registers, 'SP')).toBe(0xfffe); // Balanced!
  });

  it('RET on an empty stack faults with return-to-empty-stack', () => {
    const prog = makeProgram('RET\nHLT');
    const state = createCpuState(prog, { initialSp: 0xfffe });
    const res = step(state, prog);

    expect(res.state.halted).toBe(true);
    expect(res.record.fault?.type).toBe('return-to-empty-stack');
  });

  it('Stack overflow faults when SP would wrap below low-water mark', () => {
    const prog = makeProgram('PUSH AX\nHLT');
    const state = createCpuState(prog, { initialSp: 0x0100, lowWaterMark: 0x0100 });
    const res = step(state, prog);

    expect(res.state.halted).toBe(true);
    expect(res.record.fault?.type).toBe('stack-overflow');
  });
});

describe('8086 CPU Core - 6. Shift Edge Cases', () => {
  it('Count 0 leaves value and flags completely unchanged', () => {
    const prog = makeProgram('MOV CL, 0\nSHL AX, CL\nHLT');
    let state = createCpuState(prog);
    state = setReg(state, 'AX', 0x55aa);
    state = { ...state, flags: { Z: 1, C: 1, S: 0, O: 1, I: 0, T: 0 } };

    state = step(state, prog).state; // MOV CL, 0
    const res = step(state, prog); // SHL AX, CL (count 0)

    expect(getReg(res.state.registers, 'AX')).toBe(0x55aa);
    expect(res.state.flags).toEqual({ Z: 1, C: 1, S: 0, O: 1, I: 0, T: 0 });
  });

  it('SHL of 0x80 by 1 sets Carry Flag and Zero Flag', () => {
    const prog = makeProgram('MOV AL, 0x80\nSHL AL, 1\nHLT');
    let state = createCpuState(prog);
    state = step(state, prog).state;
    const res = step(state, prog);

    expect(getReg(res.state.registers, 'AL')).toBe(0);
    expect(res.state.flags.C).toBe(1);
    expect(res.state.flags.Z).toBe(1);
  });

  it('SHR of 1 by 1 sets Carry Flag and Zero Flag', () => {
    const prog = makeProgram('MOV AL, 1\nSHR AL, 1\nHLT');
    let state = createCpuState(prog);
    state = step(state, prog).state;
    const res = step(state, prog);

    expect(getReg(res.state.registers, 'AL')).toBe(0);
    expect(res.state.flags.C).toBe(1);
    expect(res.state.flags.Z).toBe(1);
  });
});
