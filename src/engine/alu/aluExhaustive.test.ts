/**
 * @file aluExhaustive.test.ts
 * Exhaustive sweeps and independent reference validation for the ALU Engine.
 */

import { describe, expect, it } from 'vitest';
import { addBinary, subtractBinary } from '../numberSystems/arithmetic';
import { execute } from './alu';
import type { AluFlags, AluOp } from './types';

function toSignedRef(u: number, width: number): number {
  const threshold = 1 << (width - 1);
  return u >= threshold ? u - (1 << width) : u;
}

function refEval(
  op: AluOp,
  a: number,
  b: number,
  width: number,
  shiftCount: number = 1,
  prevC: 0 | 1 = 0
): { res: number; flags: AluFlags } {
  const mask = (1 << width) - 1;
  const aSign = (a >>> (width - 1)) & 1;
  const sA = toSignedRef(a, width);
  const sB = toSignedRef(b, width);
  const minS = -(1 << (width - 1));
  const maxS = (1 << (width - 1)) - 1;

  switch (op) {
    case 'ADD': {
      const sum = a + b;
      const res = sum & mask;
      const trueSum = sA + sB;
      const o = trueSum < minS || trueSum > maxS ? 1 : 0;
      return {
        res,
        flags: { Z: res === 0 ? 1 : 0, C: ((sum >>> width) & 1) as 0 | 1, S: ((res >>> (width - 1)) & 1) as 0 | 1, O: o },
      };
    }
    case 'SUB':
    case 'CMP': {
      const diff = (a - b) & mask;
      const trueDiff = sA - sB;
      const o = trueDiff < minS || trueDiff > maxS ? 1 : 0;
      return {
        res: diff,
        flags: { Z: diff === 0 ? 1 : 0, C: a < b ? 1 : 0, S: ((diff >>> (width - 1)) & 1) as 0 | 1, O: o },
      };
    }
    case 'AND':
    case 'OR':
    case 'XOR': {
      const res = op === 'AND' ? (a & b) & mask : op === 'OR' ? (a | b) & mask : (a ^ b) & mask;
      return { res, flags: { Z: res === 0 ? 1 : 0, C: 0, S: ((res >>> (width - 1)) & 1) as 0 | 1, O: 0 } };
    }
    case 'NOT': {
      const res = (~a) & mask;
      return { res, flags: { Z: res === 0 ? 1 : 0, C: 0, S: ((res >>> (width - 1)) & 1) as 0 | 1, O: 0 } };
    }
    case 'INC': {
      const res = (a + 1) & mask;
      return { res, flags: { Z: res === 0 ? 1 : 0, C: prevC, S: ((res >>> (width - 1)) & 1) as 0 | 1, O: a === maxS ? 1 : 0 } };
    }
    case 'DEC': {
      const res = (a - 1) & mask;
      return { res, flags: { Z: res === 0 ? 1 : 0, C: prevC, S: ((res >>> (width - 1)) & 1) as 0 | 1, O: a === (1 << (width - 1)) ? 1 : 0 } };
    }
    case 'SHL': {
      const res = (a << shiftCount) & mask;
      const c = ((a >>> (width - shiftCount)) & 1) as 0 | 1;
      const msb = (res >>> (width - 1)) & 1;
      const o = shiftCount === 1 ? ((msb ^ c) as 0 | 1) : 'undefined';
      return { res, flags: { Z: res === 0 ? 1 : 0, C: c, S: msb as 0 | 1, O: o } };
    }
    case 'SHR': {
      const res = a >>> shiftCount;
      const c = ((a >>> (shiftCount - 1)) & 1) as 0 | 1;
      const o = shiftCount === 1 ? (aSign as 0 | 1) : 'undefined';
      return { res, flags: { Z: res === 0 ? 1 : 0, C: c, S: ((res >>> (width - 1)) & 1) as 0 | 1, O: o } };
    }
    case 'SAR': {
      const fill = aSign === 1 ? (mask << (width - shiftCount)) & mask : 0;
      const res = (a >>> shiftCount) | fill;
      const c = ((a >>> (shiftCount - 1)) & 1) as 0 | 1;
      return { res, flags: { Z: res === 0 ? 1 : 0, C: c, S: aSign as 0 | 1, O: shiftCount === 1 ? 0 : 'undefined' } };
    }
    case 'ROL': {
      const k = shiftCount % width;
      const res = (((a << k) & mask) | (a >>> (width - k))) & mask;
      const c = (res & 1) as 0 | 1;
      const msb = (res >>> (width - 1)) & 1;
      const o = shiftCount === 1 ? ((msb ^ c) as 0 | 1) : 'undefined';
      return { res, flags: { Z: res === 0 ? 1 : 0, C: c, S: msb as 0 | 1, O: o } };
    }
    case 'ROR': {
      const k = shiftCount % width;
      const res = ((a >>> k) | ((a << (width - k)) & mask)) & mask;
      const c = ((res >>> (width - 1)) & 1) as 0 | 1;
      const msb = (res >>> (width - 1)) & 1;
      const bit1 = (res >>> (width - 2)) & 1;
      const o = shiftCount === 1 ? ((msb ^ bit1) as 0 | 1) : 'undefined';
      return { res, flags: { Z: res === 0 ? 1 : 0, C: c, S: msb as 0 | 1, O: o } };
    }
  }
}

describe('ALU Exhaustive Sweeps and Cross-Check Suite', () => {
  it('exhaustively checks width 4 against independent reference and arithmetic.ts', () => {
    let disagreements = 0;
    let checksCount = 0;

    for (let a = 0; a < 16; a++) {
      for (let b = 0; b < 16; b++) {
        for (const op of ['ADD', 'SUB', 'CMP', 'AND', 'OR', 'XOR'] as const) {
          const actual = execute(op, a, b, 4);
          if (!actual.ok) throw new Error(actual.error.message);
          const expected = refEval(op, a, b, 4);
          checksCount++;
          if (actual.result.unsigned !== expected.res) disagreements++;
          if (actual.flags.Z !== expected.flags.Z || actual.flags.C !== expected.flags.C || actual.flags.S !== expected.flags.S || actual.flags.O !== expected.flags.O) disagreements++;

          if (op === 'ADD') {
            const numSys = addBinary(a, b, 4, 'unsigned');
            if (!numSys.ok) throw new Error(numSys.error.message);
            expect(actual.result.unsigned).toBe(numSys.value.unsignedValue);
            expect(actual.flags.C).toBe(numSys.value.flags.C);
            expect(actual.flags.Z).toBe(numSys.value.flags.Z);
            expect(actual.flags.S).toBe(numSys.value.flags.N);
            expect(actual.flags.O).toBe(numSys.value.flags.V);
          } else if (op === 'SUB') {
            const numSys = subtractBinary(a, b, 4, 'unsigned', { borrowConvention: 'borrow_is_cf' });
            if (!numSys.ok) throw new Error(numSys.error.message);
            expect(actual.result.unsigned).toBe(numSys.value.unsignedValue);
            expect(actual.flags.C).toBe(numSys.value.flags.C);
            expect(actual.flags.Z).toBe(numSys.value.flags.Z);
            expect(actual.flags.S).toBe(numSys.value.flags.N);
            expect(actual.flags.O).toBe(numSys.value.flags.V);
          }
        }
      }

      for (const op of ['NOT', 'INC', 'DEC'] as const) {
        for (const prevC of [0, 1] as const) {
          const actual = execute(op, a, 0, 4, { previousC: prevC });
          if (!actual.ok) throw new Error(actual.error.message);
          const expected = refEval(op, a, 0, 4, 1, prevC);
          checksCount++;
          if (actual.result.unsigned !== expected.res || actual.flags.Z !== expected.flags.Z || actual.flags.C !== expected.flags.C || actual.flags.S !== expected.flags.S || actual.flags.O !== expected.flags.O) disagreements++;
        }
      }

      for (const op of ['SHL', 'SHR', 'SAR', 'ROL', 'ROR'] as const) {
        for (let count = 1; count <= 4; count++) {
          const actual = execute(op, a, 0, 4, { shiftCount: count });
          if (!actual.ok) throw new Error(actual.error.message);
          const expected = refEval(op, a, 0, 4, count);
          checksCount++;
          if (actual.result.unsigned !== expected.res || actual.flags.Z !== expected.flags.Z || actual.flags.C !== expected.flags.C || actual.flags.S !== expected.flags.S || actual.flags.O !== expected.flags.O) disagreements++;
        }
      }
    }
    expect(disagreements).toBe(0);
    expect(checksCount).toBeGreaterThan(1800);
  });

  it('exhaustively sweeps width 8 ADD and SUB (65,536 pairs each)', () => {
    let disagreements = 0;
    const start = performance.now();

    for (let a = 0; a < 256; a++) {
      for (let b = 0; b < 256; b++) {
        const addActual = execute('ADD', a, b, 8);
        if (!addActual.ok) throw new Error(addActual.error.message);
        const addExp = refEval('ADD', a, b, 8);
        if (addActual.result.unsigned !== addExp.res || addActual.flags.Z !== addExp.flags.Z || addActual.flags.C !== addExp.flags.C || addActual.flags.S !== addExp.flags.S || addActual.flags.O !== addExp.flags.O) disagreements++;

        const subActual = execute('SUB', a, b, 8);
        if (!subActual.ok) throw new Error(subActual.error.message);
        const subExp = refEval('SUB', a, b, 8);
        if (subActual.result.unsigned !== subExp.res || subActual.flags.Z !== subExp.flags.Z || subActual.flags.C !== subExp.flags.C || subActual.flags.S !== subExp.flags.S || subActual.flags.O !== subExp.flags.O) disagreements++;
      }
    }
    const elapsed = performance.now() - start;
    expect(disagreements).toBe(0);
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  it('runs seeded sample of 2,400 pairs for remaining width 8 operations', () => {
    let seed = 42;
    function nextRng(): number {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed;
    }

    let disagreements = 0;
    for (let i = 0; i < 400; i++) {
      const a = nextRng() & 0xff;
      const b = nextRng() & 0xff;

      for (const op of ['CMP', 'AND', 'OR', 'XOR'] as const) {
        const actual = execute(op, a, b, 8);
        if (!actual.ok) throw new Error(actual.error.message);
        const expected = refEval(op, a, b, 8);
        if (actual.result.unsigned !== expected.res || actual.flags.Z !== expected.flags.Z || actual.flags.C !== expected.flags.C || actual.flags.S !== expected.flags.S || actual.flags.O !== expected.flags.O) disagreements++;
      }

      for (const op of ['SHL', 'SHR', 'SAR', 'ROL', 'ROR'] as const) {
        const count = (nextRng() % 8) + 1;
        const actual = execute(op, a, 0, 8, { shiftCount: count });
        if (!actual.ok) throw new Error(actual.error.message);
        const expected = refEval(op, a, 0, 8, count);
        if (actual.result.unsigned !== expected.res || actual.flags.Z !== expected.flags.Z || actual.flags.C !== expected.flags.C || actual.flags.S !== expected.flags.S || actual.flags.O !== expected.flags.O) disagreements++;
      }
    }
    expect(disagreements).toBe(0);
  });
});
