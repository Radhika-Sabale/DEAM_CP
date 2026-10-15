/**
 * @file alu.test.ts
 * Hand-checked edge cases, flag derivations, carry chain integrity, circuit simulation, and error tests.
 */

import { describe, expect, it } from 'vitest';
import { CircuitSimulator } from '../circuit/simulator';
import { validateCircuit } from '../circuit/validate';
import { compareSigned, compareUnsigned, execute } from './alu';
import { buildAdderSubtractorCircuit, getGateCorrespondence } from './adderCircuit';
import { buildCarryChain, verifyChain } from './carryChain';
import type { AluOp } from './types';

describe('ALU Engine Hand-Checked Edge Cases and Flag Rules', () => {
  it('correctly calculates 127 + 1 signed overflow in 8-bit arithmetic', () => {
    const res = execute('ADD', 127, 1, 8);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.unsigned).toBe(128);
    expect(res.result.signed).toBe(-128);
    expect(res.flags).toEqual({ Z: 0, C: 0, S: 1, O: 1 });
  });

  it('correctly calculates -128 - 1 (128 - 1) signed underflow in 8-bit arithmetic', () => {
    const res = execute('SUB', 128, 1, 8);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.unsigned).toBe(127);
    expect(res.result.signed).toBe(127);
    expect(res.flags).toEqual({ Z: 0, C: 0, S: 0, O: 1 });
  });

  it('correctly calculates 255 + 1 unsigned carry out in 8-bit arithmetic', () => {
    const res = execute('ADD', 255, 1, 8);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.unsigned).toBe(0);
    expect(res.flags).toEqual({ Z: 1, C: 1, S: 0, O: 0 });
  });

  it('correctly calculates 0 - 1 borrow in 8-bit arithmetic', () => {
    const res = execute('SUB', 0, 1, 8);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.unsigned).toBe(255);
    expect(res.flags).toEqual({ Z: 0, C: 1, S: 1, O: 0 });
    expect(res.borrowConvention).toBe('cf-is-borrow');
  });

  it('correctly calculates 0x80 - 0x01 in 8-bit arithmetic', () => {
    const res = execute('SUB', 0x80, 0x01, 8);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.unsigned).toBe(0x7f);
    expect(res.flags).toEqual({ Z: 0, C: 0, S: 0, O: 1 });
  });

  it('correctly calculates 7 + 5 in 4-bit signed arithmetic', () => {
    const res = execute('ADD', 7, 5, 4);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result.unsigned).toBe(12);
    expect(res.result.signed).toBe(-4);
    expect(res.flags).toEqual({ Z: 0, C: 0, S: 1, O: 1 });
  });

  it('verifies INC 0xFF and DEC 0x00 preserve CF', () => {
    const incRes = execute('INC', 0xff, 0, 8, { previousC: 1 });
    expect(incRes.ok).toBe(true);
    if (!incRes.ok) return;
    expect(incRes.result.unsigned).toBe(0);
    expect(incRes.flags).toEqual({ Z: 1, C: 1, S: 0, O: 0 });

    const decRes = execute('DEC', 0x00, 0, 8, { previousC: 0 });
    expect(decRes.ok).toBe(true);
    if (!decRes.ok) return;
    expect(decRes.result.unsigned).toBe(0xff);
    expect(decRes.flags).toEqual({ Z: 0, C: 0, S: 1, O: 0 });
  });

  it('verifies SHL by 1 on 0x80 and 0x40', () => {
    const shl80 = execute('SHL', 0x80, 0, 8, { shiftCount: 1 });
    expect(shl80.ok).toBe(true);
    if (!shl80.ok) return;
    expect(shl80.result.unsigned).toBe(0);
    expect(shl80.flags).toEqual({ Z: 1, C: 1, S: 0, O: 1 });

    const shl40 = execute('SHL', 0x40, 0, 8, { shiftCount: 1 });
    expect(shl40.ok).toBe(true);
    if (!shl40.ok) return;
    expect(shl40.result.unsigned).toBe(0x80);
    expect(shl40.flags).toEqual({ Z: 0, C: 0, S: 1, O: 1 });
  });

  it('verifies SAR on negative values, ROL/ROR, and shift count > 1 undefined OF', () => {
    const sarRes = execute('SAR', 0x80, 0, 8, { shiftCount: 1 });
    expect(sarRes.ok).toBe(true);
    if (!sarRes.ok) return;
    expect(sarRes.result.unsigned).toBe(0xc0);
    expect(sarRes.flags).toEqual({ Z: 0, C: 0, S: 1, O: 0 });

    const rolRes = execute('ROL', 0x81, 0, 8, { shiftCount: 1 });
    expect(rolRes.ok).toBe(true);
    if (!rolRes.ok) return;
    expect(rolRes.result.unsigned).toBe(0x03);
    expect(rolRes.flags).toEqual({ Z: 0, C: 1, S: 0, O: 1 });

    const rorRes = execute('ROR', 0x81, 0, 8, { shiftCount: 1 });
    expect(rorRes.ok).toBe(true);
    if (!rorRes.ok) return;
    expect(rorRes.result.unsigned).toBe(0xc0);
    expect(rorRes.flags).toEqual({ Z: 0, C: 1, S: 1, O: 0 });

    const multiShift = execute('SHL', 0x05, 0, 8, { shiftCount: 2 });
    expect(multiShift.ok).toBe(true);
    if (!multiShift.ok) return;
    expect(multiShift.flags.O).toBe('undefined');
  });

  it('proves Jcc conditional relations derived from flags equal integer comparisons for all 4-bit pairs', () => {
    for (let a = 0; a < 16; a++) {
      for (let b = 0; b < 16; b++) {
        const uRels = compareUnsigned(a, b, 4);
        expect(uRels.equal).toBe(a === b);
        expect(uRels.notEqual).toBe(a !== b);
        expect(uRels.below).toBe(a < b);
        expect(uRels.belowOrEqual).toBe(a <= b);
        expect(uRels.above).toBe(a > b);
        expect(uRels.aboveOrEqual).toBe(a >= b);

        const sRels = compareSigned(a, b, 4);
        const sA = a >= 8 ? a - 16 : a;
        const sB = b >= 8 ? b - 16 : b;
        expect(sRels.less).toBe(sA < sB);
        expect(sRels.lessOrEqual).toBe(sA <= sB);
        expect(sRels.greater).toBe(sA > sB);
        expect(sRels.greaterOrEqual).toBe(sA >= sB);
      }
    }
  });

  it('verifies carry chain structural consistency and tampering detection', () => {
    const chain = buildCarryChain(7, 5, 4, false);
    expect(chain.carryVector.length).toBe(5);
    expect(chain.delayLevels).toBe(8);
    expect(verifyChain(chain).valid).toBe(true);

    const subChain = buildCarryChain(5, 7, 4, true);
    expect(subChain.carryVector[0]).toBe(1);
    expect(verifyChain(subChain).valid).toBe(true);

    const tamperedGates = chain.gates.map((g) =>
      g.id === 'g_or1_2' ? { ...g, output: { ...g.output, value: (1 - g.output.value) as 0 | 1 } } : g
    );
    const tamperedResult = verifyChain({ ...chain, gates: tamperedGates });
    expect(tamperedResult.valid).toBe(false);
    if (!tamperedResult.valid) {
      expect(tamperedResult.failedGateId).toBe('g_or1_2');
    }
  });

  it('verifies adder/subtractor circuit topology and simulator execution equivalence', () => {
    const circuit = buildAdderSubtractorCircuit(4);
    const validation = validateCircuit(circuit);
    expect(validation.diagnostics.length).toBe(0);

    const correspondence = getGateCorrespondence(4);
    expect(correspondence.length).toBe(24);

    const sim = new CircuitSimulator(circuit);
    for (let sub = 0; sub <= 1; sub++) {
      for (let a = 0; a < 16; a++) {
        for (let b = 0; b < 16; b++) {
          sim.setInput('in_sub', sub as 0 | 1);
          for (let bit = 0; bit < 4; bit++) {
            sim.setInput(`in_a_${bit}`, ((a >>> bit) & 1) as 0 | 1);
            sim.setInput(`in_b_${bit}`, ((b >>> bit) & 1) as 0 | 1);
          }
          sim.settle();

          let circuitSum = 0;
          for (let bit = 0; bit < 4; bit++) {
            const bitVal = sim.getNodeValue(`out_s_${bit}`);
            if (bitVal === 1) circuitSum |= 1 << bit;
          }
          const circuitCout = sim.getNodeValue('out_cout');

          const expectedOp = sub === 1 ? 'SUB' : 'ADD';
          const aluRes = execute(expectedOp, a, b, 4);
          if (!aluRes.ok) throw new Error(aluRes.error.message);

          expect(circuitSum).toBe(aluRes.result.unsigned);
          const expHwCout = aluRes.carryChain?.carryVector[4] ?? 0;
          expect(circuitCout).toBe(expHwCout);
        }
      }
    }
  });

  it('tests width 8 circuit on seeded sample of 500 combinations', () => {
    const circuit8 = buildAdderSubtractorCircuit(8);
    expect(validateCircuit(circuit8).diagnostics.length).toBe(0);

    const sim8 = new CircuitSimulator(circuit8);
    let seed = 12345;
    for (let i = 0; i < 500; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const sub = (seed & 1) as 0 | 1;
      const a = (seed >>> 8) & 0xff;
      const b = (seed >>> 16) & 0xff;

      sim8.setInput('in_sub', sub);
      for (let bit = 0; bit < 8; bit++) {
        sim8.setInput(`in_a_${bit}`, ((a >>> bit) & 1) as 0 | 1);
        sim8.setInput(`in_b_${bit}`, ((b >>> bit) & 1) as 0 | 1);
      }
      sim8.settle();

      let circuitSum = 0;
      for (let bit = 0; bit < 8; bit++) {
        if (sim8.getNodeValue(`out_s_${bit}`) === 1) circuitSum |= 1 << bit;
      }
      const circuitCout = sim8.getNodeValue('out_cout');

      const aluRes = execute(sub === 1 ? 'SUB' : 'ADD', a, b, 8);
      if (!aluRes.ok) throw new Error(aluRes.error.message);

      expect(circuitSum).toBe(aluRes.result.unsigned);
      expect(circuitCout).toBe(aluRes.carryChain?.carryVector[8] ?? 0);
    }
  });

  it('handles user errors deterministically without throwing exceptions', () => {
    const badWidth = execute('ADD', 1, 1, 1);
    expect(badWidth.ok ? null : badWidth.error.code).toBe('INVALID_WIDTH');

    const badOperand = execute('ADD', 16, 1, 4);
    expect(badOperand.ok ? null : badOperand.error.code).toBe('OPERAND_OUT_OF_RANGE');

    const badOp = execute('UNKNOWN' as never, 1, 1, 4);
    expect(badOp.ok ? null : badOp.error.code).toBe('UNKNOWN_OP');

    const badShift = execute('SHL', 1, 0, 4, { shiftCount: 5 });
    expect(badShift.ok ? null : badShift.error.code).toBe('INVALID_SHIFT_COUNT');
  });

  it('proves AluOp in engine stays in sync with AluOpId in types', () => {
    type AssertEqual<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;
    const _sync: AssertEqual<AluOp, import('../../types/designProject').AluOpId> = true;
    expect(_sync).toBe(true);
  });
});
