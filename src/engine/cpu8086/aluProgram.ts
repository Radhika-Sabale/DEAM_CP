/**
 * @file aluProgram.ts
 * Generates valid 8086 assembly source code from an ALU operation specification,
 * together with the expected register and flag state.
 */

import { execute as aluExecute, type AluOp } from '../alu';

export interface AluOperationSpec {
  readonly op: string;
  readonly width: number;
  readonly a: number;
  readonly b: number;
  readonly shiftCount?: number;
  readonly previousC?: 0 | 1;
}

export interface ExpectedProgramState {
  readonly registers: Record<string, number>;
  readonly flags: {
    readonly Z: 0 | 1;
    readonly C: 0 | 1;
    readonly S: 0 | 1;
    readonly O: 0 | 1 | 'undefined';
  };
}

export type AluTo8086Result =
  | {
      readonly available: true;
      readonly source: string;
      readonly expectedState: ExpectedProgramState;
    }
  | {
      readonly available: false;
      readonly reason: string;
    };

const SUPPORTED_OPS = new Set([
  'ADD',
  'SUB',
  'CMP',
  'AND',
  'OR',
  'XOR',
  'INC',
  'DEC',
  'SHL',
  'SHR',
]);

const EXPLICIT_UNAVAILABLE_REASONS: Record<string, string> = {
  SAR: 'Arithmetic right shift (SAR) is not included in the educational 8086 subset.',
  ROL: 'Rotate left (ROL) is not included in the educational 8086 subset.',
  ROR: 'Rotate right (ROR) is not included in the educational 8086 subset.',
  NOT: 'Bitwise NOT is not modeled in the educational 8086 instruction set; use XOR with all-ones or compute in the ALU.',
};

/**
 * Translates an ALU operation into an assembled 8086 assembly program and expected outcome.
 */
export function programFromAluOperation(
  spec: AluOperationSpec | null | undefined
): AluTo8086Result {
  if (!spec) {
    return {
      available: false,
      reason:
        'Please configure an ALU operation before exporting it as an 8086 assembly program.',
    };
  }

  const opUpper = spec.op.toUpperCase();

  if (EXPLICIT_UNAVAILABLE_REASONS[opUpper]) {
    return {
      available: false,
      reason: EXPLICIT_UNAVAILABLE_REASONS[opUpper] ?? 'Operation not supported in 8086.',
    };
  }

  if (!SUPPORTED_OPS.has(opUpper)) {
    return {
      available: false,
      reason: `Operation "${spec.op}" is not available in the 8086 educational instruction subset.`,
    };
  }

  if (spec.width !== 8 && spec.width !== 16) {
    return {
      available: false,
      reason: `The 8086 microprocessor supports 8-bit and 16-bit register operand widths; width ${spec.width} cannot be mapped directly.`,
    };
  }

  const is8 = spec.width === 8;
  const regA = is8 ? 'AL' : 'AX';
  const regB = is8 ? 'BL' : 'BX';
  const mask = is8 ? 0xff : 0xffff;
  const aVal = spec.a & mask;
  const bVal = spec.b & mask;
  const count = spec.shiftCount ?? 1;

  // Execute in ALU engine for reference
  const aluRes = aluExecute(opUpper as AluOp, aVal, bVal, spec.width, {
    shiftCount: count,
    previousC: spec.previousC ?? 0,
  });

  if (!aluRes.ok) {
    return {
      available: false,
      reason: `ALU evaluation error: ${aluRes.error.message}`,
    };
  }

  const lines: string[] = [];
  const expectedRegs: Record<string, number> = {};

  if (opUpper === 'INC' || opUpper === 'DEC') {
    lines.push(`MOV ${regA}, ${aVal}`);
    lines.push(`${opUpper} ${regA}`);
    lines.push('HLT');
    expectedRegs[regA] = aluRes.result.unsigned;
  } else if (opUpper === 'SHL' || opUpper === 'SHR') {
    lines.push(`MOV ${regA}, ${aVal}`);
    if (count === 1) {
      lines.push(`${opUpper} ${regA}, 1`);
    } else {
      lines.push(`MOV CL, ${count}`);
      lines.push(`${opUpper} ${regA}, CL`);
      expectedRegs['CL'] = count;
    }
    lines.push('HLT');
    expectedRegs[regA] = aluRes.result.unsigned;
  } else if (opUpper === 'CMP') {
    lines.push(`MOV ${regA}, ${aVal}`);
    lines.push(`MOV ${regB}, ${bVal}`);
    lines.push(`CMP ${regA}, ${regB}`);
    lines.push('HLT');
    expectedRegs[regA] = aVal;
    expectedRegs[regB] = bVal;
  } else {
    // Binary arithmetic/logic: ADD, SUB, AND, OR, XOR
    lines.push(`MOV ${regA}, ${aVal}`);
    lines.push(`MOV ${regB}, ${bVal}`);
    lines.push(`${opUpper} ${regA}, ${regB}`);
    lines.push('HLT');
    expectedRegs[regA] = aluRes.result.unsigned;
    expectedRegs[regB] = bVal;
  }

  return {
    available: true,
    source: lines.join('\n'),
    expectedState: {
      registers: expectedRegs,
      flags: {
        Z: aluRes.flags.Z,
        C: aluRes.flags.C,
        S: aluRes.flags.S,
        O: aluRes.flags.O,
      },
    },
  };
}
