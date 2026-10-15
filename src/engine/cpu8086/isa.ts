/**
 * @file isa.ts
 * Instruction Set Architecture (ISA) tables, register metadata, operand pattern rules,
 * and canonical mnemonic aliases for the 8086 CPU.
 */

import type { CanonicalMnemonic, Register8, Register16, RegisterName } from './types';

export interface InstructionRule {
  readonly mnemonic: CanonicalMnemonic;
  readonly minOperands: number;
  readonly maxOperands: number;
  readonly flagsAffected: readonly ('ZF' | 'CF' | 'SF' | 'OF')[];
  readonly allowedSizes: readonly (8 | 16)[];
  readonly description: string;
}

export const REGISTERS_16: readonly Register16[] = [
  'AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'SP', 'IP',
];

export const REGISTERS_8: readonly Register8[] = [
  'AH', 'AL', 'BH', 'BL', 'CH', 'CL', 'DH', 'DL',
];

export const REGISTER_SIZES: Readonly<Record<RegisterName, 8 | 16>> = {
  AX: 16, BX: 16, CX: 16, DX: 16, SI: 16, DI: 16, SP: 16, IP: 16,
  AH: 8, AL: 8, BH: 8, BL: 8, CH: 8, CL: 8, DH: 8, DL: 8,
};

export const MNEMONIC_ALIASES: Readonly<Record<string, CanonicalMnemonic>> = {
  // Direct canonicals
  MOV: 'MOV', PUSH: 'PUSH', POP: 'POP',
  ADD: 'ADD', SUB: 'SUB', INC: 'INC', DEC: 'DEC', CMP: 'CMP',
  AND: 'AND', OR: 'OR', XOR: 'XOR',
  SHL: 'SHL', SHR: 'SHR',
  JMP: 'JMP', CALL: 'CALL', RET: 'RET',
  JE: 'JE', JNE: 'JNE', JC: 'JC', JNC: 'JNC',
  JA: 'JA', JBE: 'JBE', JG: 'JG', JGE: 'JGE',
  JL: 'JL', JLE: 'JLE', JS: 'JS', JNS: 'JNS',
  JO: 'JO', JNO: 'JNO',
  HLT: 'HLT', NOP: 'NOP',
  INT: 'INT', IRET: 'IRET', CLI: 'CLI', STI: 'STI', PUSHF: 'PUSHF', POPF: 'POPF',

  // Canonical Aliases
  JZ: 'JE',
  JNZ: 'JNE',
  JB: 'JC',
  JNAE: 'JC',
  JAE: 'JNC',
  JNB: 'JNC',
  JNBE: 'JA',
  JNA: 'JBE',
  JNLE: 'JG',
  JNL: 'JGE',
  JNGE: 'JL',
  JNG: 'JLE',
};

export const INSTRUCTION_TABLE: Readonly<Record<CanonicalMnemonic, InstructionRule>> = {
  MOV: { mnemonic: 'MOV', minOperands: 2, maxOperands: 2, flagsAffected: [], allowedSizes: [8, 16], description: 'Move byte or word' },
  PUSH: { mnemonic: 'PUSH', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Push 16-bit word onto stack' },
  POP: { mnemonic: 'POP', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Pop 16-bit word from stack' },

  ADD: { mnemonic: 'ADD', minOperands: 2, maxOperands: 2, flagsAffected: ['ZF', 'CF', 'SF', 'OF'], allowedSizes: [8, 16], description: 'Add' },
  SUB: { mnemonic: 'SUB', minOperands: 2, maxOperands: 2, flagsAffected: ['ZF', 'CF', 'SF', 'OF'], allowedSizes: [8, 16], description: 'Subtract' },
  INC: { mnemonic: 'INC', minOperands: 1, maxOperands: 1, flagsAffected: ['ZF', 'SF', 'OF'], allowedSizes: [8, 16], description: 'Increment by 1 (preserves CF)' },
  DEC: { mnemonic: 'DEC', minOperands: 1, maxOperands: 1, flagsAffected: ['ZF', 'SF', 'OF'], allowedSizes: [8, 16], description: 'Decrement by 1 (preserves CF)' },
  CMP: { mnemonic: 'CMP', minOperands: 2, maxOperands: 2, flagsAffected: ['ZF', 'CF', 'SF', 'OF'], allowedSizes: [8, 16], description: 'Compare (A - B, updates flags only)' },

  AND: { mnemonic: 'AND', minOperands: 2, maxOperands: 2, flagsAffected: ['ZF', 'CF', 'SF', 'OF'], allowedSizes: [8, 16], description: 'Bitwise AND' },
  OR: { mnemonic: 'OR', minOperands: 2, maxOperands: 2, flagsAffected: ['ZF', 'CF', 'SF', 'OF'], allowedSizes: [8, 16], description: 'Bitwise OR' },
  XOR: { mnemonic: 'XOR', minOperands: 2, maxOperands: 2, flagsAffected: ['ZF', 'CF', 'SF', 'OF'], allowedSizes: [8, 16], description: 'Bitwise XOR' },

  SHL: { mnemonic: 'SHL', minOperands: 2, maxOperands: 2, flagsAffected: ['ZF', 'CF', 'SF', 'OF'], allowedSizes: [8, 16], description: 'Shift Logical Left by 1 or CL' },
  SHR: { mnemonic: 'SHR', minOperands: 2, maxOperands: 2, flagsAffected: ['ZF', 'CF', 'SF', 'OF'], allowedSizes: [8, 16], description: 'Shift Logical Right by 1 or CL' },

  JMP: { mnemonic: 'JMP', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Unconditional jump' },
  CALL: { mnemonic: 'CALL', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Call procedure' },
  RET: { mnemonic: 'RET', minOperands: 0, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Return from procedure' },

  JE: { mnemonic: 'JE', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Jump if equal (ZF=1)' },
  JNE: { mnemonic: 'JNE', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Jump if not equal (ZF=0)' },
  JC: { mnemonic: 'JC', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Jump if carry / below (CF=1)' },
  JNC: { mnemonic: 'JNC', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Jump if not carry / above or equal (CF=0)' },
  JA: { mnemonic: 'JA', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Jump if above (CF=0 and ZF=0)' },
  JBE: { mnemonic: 'JBE', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Jump if below or equal (CF=1 or ZF=1)' },
  JG: { mnemonic: 'JG', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Jump if greater (SF=OF and ZF=0)' },
  JGE: { mnemonic: 'JGE', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Jump if greater or equal (SF=OF)' },
  JL: { mnemonic: 'JL', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Jump if less (SF!=OF)' },
  JLE: { mnemonic: 'JLE', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Jump if less or equal (SF!=OF or ZF=1)' },
  JS: { mnemonic: 'JS', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Jump if sign negative (SF=1)' },
  JNS: { mnemonic: 'JNS', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Jump if sign non-negative (SF=0)' },
  JO: { mnemonic: 'JO', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Jump if overflow (OF=1)' },
  JNO: { mnemonic: 'JNO', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [16], description: 'Jump if no overflow (OF=0)' },

  HLT: { mnemonic: 'HLT', minOperands: 0, maxOperands: 0, flagsAffected: [], allowedSizes: [], description: 'Halt CPU execution' },
  NOP: { mnemonic: 'NOP', minOperands: 0, maxOperands: 0, flagsAffected: [], allowedSizes: [], description: 'No operation' },

  INT: { mnemonic: 'INT', minOperands: 1, maxOperands: 1, flagsAffected: [], allowedSizes: [8], description: 'Software interrupt (vector 0-255)' },
  IRET: { mnemonic: 'IRET', minOperands: 0, maxOperands: 0, flagsAffected: ['ZF', 'CF', 'SF', 'OF'], allowedSizes: [], description: 'Interrupt return (restores IP, CS, FLAGS)' },
  CLI: { mnemonic: 'CLI', minOperands: 0, maxOperands: 0, flagsAffected: [], allowedSizes: [], description: 'Clear Interrupt Flag (IF=0)' },
  STI: { mnemonic: 'STI', minOperands: 0, maxOperands: 0, flagsAffected: [], allowedSizes: [], description: 'Set Interrupt Flag (IF=1)' },
  PUSHF: { mnemonic: 'PUSHF', minOperands: 0, maxOperands: 0, flagsAffected: [], allowedSizes: [16], description: 'Push 16-bit FLAGS word onto stack' },
  POPF: { mnemonic: 'POPF', minOperands: 0, maxOperands: 0, flagsAffected: ['ZF', 'CF', 'SF', 'OF'], allowedSizes: [16], description: 'Pop 16-bit FLAGS word from stack' },
};

/**
 * Resolves a raw mnemonic or alias string (case-insensitive) to its CanonicalMnemonic.
 */
export function resolveMnemonic(raw: string): CanonicalMnemonic | undefined {
  const upper = raw.trim().toUpperCase();
  return MNEMONIC_ALIASES[upper];
}

/**
 * Checks whether a token is a known 8086 register name (case-insensitive).
 */
export function isRegister(name: string): boolean {
  return name.toUpperCase() in REGISTER_SIZES;
}

/**
 * Retrieves the canonical register name (uppercase) if valid.
 */
export function getRegisterName(name: string): RegisterName | undefined {
  const upper = name.toUpperCase();
  return isRegister(upper) ? (upper as RegisterName) : undefined;
}

/**
 * Retrieves the bit width (8 or 16) of a valid register name.
 */
export function getRegisterSize(name: string): 8 | 16 | undefined {
  const upper = name.toUpperCase();
  return REGISTER_SIZES[upper as RegisterName];
}

/**
 * Returns true if the instruction is an unconditional branch, call, return, or halt.
 */
export function isTerminatingInstruction(mnemonic: CanonicalMnemonic): boolean {
  return mnemonic === 'JMP' || mnemonic === 'RET' || mnemonic === 'HLT' || mnemonic === 'IRET';
}

/**
 * Returns true if the instruction is any conditional or unconditional jump.
 */
export function isJumpInstruction(mnemonic: CanonicalMnemonic): boolean {
  return mnemonic.startsWith('J');
}
