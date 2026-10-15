/**
 * @file cpu8086.ts
 * Deterministic feedback validators and misconception matchers for the 8086 CPU module.
 *
 * Validates:
 * - 'cpu-register': post-instruction register value, partial register overlap, CMP/MOV direction
 * - 'cpu-flag': status flags (Z, C, S, O including 'undefined'), MOV preserving flags, INC/DEC CF
 * - 'cpu-memory': little-endian memory layout, byte-swapping, immediate address vs dereferenced value
 * - 'cpu-stack': SP, read/write addresses, PUSH/POP sequencing, CALL return address
 * - 'cpu-next-ip': branch outcomes, conditional jump flag conditions, signed vs unsigned relations
 */

import { execute as aluExecute } from '../../alu';
import { getReg, is8BitRegister, is16BitRegister } from '../../cpu8086/registers';
import type { RegisterName } from '../../cpu8086/types';
import type {
  CpuFlagAnswer,
  CpuRegisterAnswer,
  MisconceptionTag,
  StepSubmission,
} from '../../../types/feedback';
import { registerValidator } from '../validatorRegistry';
import type { StepContext, ValidationOutcome } from '../types';
import { getCpuRun } from './cpu8086Run';
import {
  validateCpuMemory,
  validateCpuNextIp,
  validateCpuStack,
} from './cpu8086Rules';

export { validateCpuMemory, validateCpuNextIp, validateCpuStack };

export function validateCpuRegister(
  sub: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (sub.studentAnswer.kind !== 'cpu-register') {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: { kind: 'cpu-register', register: 'AX', expectedValue: 0 },
      got: { kind: 'cpu-register', register: 'AX', studentValue: 0 },
    };
  }
  const ans = sub.studentAnswer as CpuRegisterAnswer;
  const run = getCpuRun(context);
  if (!run) return { correct: true };

  const { preState, postState, instr } = run;
  const expectedVal = getReg(postState.registers, ans.register as RegisterName);

  if (ans.value === expectedVal) return { correct: true };

  let tag: MisconceptionTag = 'other';
  let details = `Expected register ${ans.register} to be 0x${expectedVal.toString(16).toUpperCase()}, received 0x${ans.value.toString(16).toUpperCase()}.`;

  const op0 = instr.operands[0];
  const op1 = instr.operands[1];

  // 1. CMP stores result misconception
  if (instr.mnemonic === 'CMP' && op0?.kind === 'reg' && op0.name === ans.register) {
    const dVal = getReg(preState.registers, op0.name);
    const sVal =
      op1?.kind === 'reg'
        ? getReg(preState.registers, op1.name)
        : op1?.kind === 'imm'
          ? op1.value
          : 0;
    const subRes = aluExecute('SUB', dVal, sVal, instr.size);
    if (subRes.ok && ans.value === subRes.result.unsigned) {
      tag = 'cmp-stores-result';
      details =
        'CMP updates status flags based on subtraction, but discards the difference without modifying the destination register.';
    }
  }

  // 2. Confused MOV direction (source received dest value, or dest preserved)
  if (instr.mnemonic === 'MOV' && op0?.kind === 'reg' && op1?.kind === 'reg') {
    const destValOld = getReg(preState.registers, op0.name);
    if (ans.register === op1.name && ans.value === destValOld) {
      tag = 'confused-mov-direction';
      details =
        'In Intel 8086 syntax (MOV dest, src), data moves from source to destination, not destination to source.';
    }
  }

  // 3. Partial register overlap (AL/AH and AX)
  if (is16BitRegister(ans.register) && op0?.kind === 'reg' && is8BitRegister(op0.name)) {
    const writtenByte =
      op1?.kind === 'imm'
        ? op1.value & 0xff
        : op1?.kind === 'reg'
          ? getReg(preState.registers, op1.name) & 0xff
          : 0;
    if (
      ans.value === writtenByte ||
      ans.value === (writtenByte << 8) ||
      ans.value === getReg(preState.registers, ans.register)
    ) {
      tag = 'wrong-partial-register';
      details = `Modifying 8-bit register ${op0.name} alters only one byte of ${ans.register}, preserving the other byte.`;
    }
  }

  // 4. Immediate address vs dereferenced value
  const symAddr = context?.cpu8086?.sourceSymbolAddress;
  if (symAddr !== undefined) {
    if (op1?.kind === 'imm' && op1.label && ans.value !== symAddr) {
      tag = 'wrong-address-vs-value';
      details =
        'MOV reg, label loads the immediate address of the label, not the memory contents stored at that address.';
    } else if (op1?.kind === 'mem' && op1.label && ans.value === symAddr) {
      tag = 'wrong-address-vs-value';
      details =
        'MOV reg, [label] loads the dereferenced memory content, not the address of the label.';
    }
  }

  // 5. Wrong byte order in register load
  if (tag === 'other' && instr.size === 16 && op1?.kind === 'mem') {
    const low = expectedVal & 0xff;
    const high = (expectedVal >>> 8) & 0xff;
    if (low !== high && ans.value === ((low << 8) | high)) {
      tag = 'wrong-byte-order';
      details =
        '8086 loads memory words in little-endian order (low byte into bits 0..7, high byte into bits 8..15).';
    }
  }

  return {
    correct: false,
    errorType: 'misconception',
    expected: { kind: 'cpu-register', register: ans.register, expectedValue: expectedVal },
    got: {
      kind: 'cpu-register',
      register: ans.register,
      studentValue: ans.value,
      studentReasoning: ans.reasoning,
    },
    misconceptionTag: tag,
    details,
  };
}

export function validateCpuFlag(
  sub: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (sub.studentAnswer.kind !== 'cpu-flag') {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: { kind: 'cpu-flag', flag: 'Z', expectedValue: 0 },
      got: { kind: 'cpu-flag', flag: 'Z', studentValue: 0 },
    };
  }
  const ans = sub.studentAnswer as CpuFlagAnswer;
  const run = getCpuRun(context);
  if (!run) return { correct: true };

  const { postState, instr } = run;
  const expectedVal = postState.flags[ans.flag];

  if (ans.value === expectedVal) return { correct: true };

  let tag: MisconceptionTag = 'other';
  let details = `Expected flag ${ans.flag} to be ${expectedVal}, received ${ans.value}.`;

  // 1. MOV / PUSH / POP affects flags
  if (['MOV', 'PUSH', 'POP'].includes(instr.mnemonic)) {
    const val =
      instr.operands[0]?.kind === 'reg'
        ? getReg(postState.registers, instr.operands[0].name)
        : 0;
    const size = instr.size;
    const wouldBeZ = (val & (size === 8 ? 0xff : 0xffff)) === 0 ? 1 : 0;
    const wouldBeS = (val & (size === 8 ? 0x80 : 0x8000)) !== 0 ? 1 : 0;
    if (
      (ans.flag === 'Z' && ans.value === wouldBeZ) ||
      (ans.flag === 'S' && ans.value === wouldBeS) ||
      (ans.flag === 'C' && ans.value === 0) ||
      (ans.flag === 'O' && ans.value === 0)
    ) {
      tag = 'mov-affects-flags';
      details = `${instr.mnemonic} is a data transfer instruction and strictly preserves all status flags untouched.`;
    }
  } else if ((instr.mnemonic === 'INC' || instr.mnemonic === 'DEC') && ans.flag === 'C') {
    tag = 'inc-dec-changes-carry';
    details =
      'INC and DEC preserve the Carry Flag to support multi-precision arithmetic loops.';
  } else if (ans.flag === 'C' && ['SHL', 'SHR'].includes(instr.mnemonic)) {
    tag = 'wrong-shift-carry-out';
    details =
      instr.mnemonic === 'SHL'
        ? 'SHL shifts the former MSB into the Carry Flag.'
        : 'SHR shifts the former LSB into the Carry Flag.';
  } else if (ans.flag === 'C' && ['SUB', 'CMP'].includes(instr.mnemonic)) {
    tag = 'wrong-borrow-convention';
    details =
      'In 8086 architecture, the Carry Flag acts as an active-high borrow indicator (CF = 1 when A < B unsigned).';
  } else if (ans.flag === 'O') {
    tag = 'wrong-overflow-rule';
    details =
      expectedVal === 'undefined'
        ? 'Overflow Flag is undefined following multi-bit shift operations in 8086.'
        : 'Signed overflow occurs when two operands of identical sign yield an opposing sign result.';
  } else if (ans.flag === 'S') {
    tag = 'wrong-sign-flag';
    details = 'The Sign Flag strictly mirrors the Most Significant Bit (MSB) of the result.';
  } else if (ans.flag === 'Z') {
    tag = 'wrong-zero-flag';
    details = 'The Zero Flag asserts if and only if all bits of the result are zero.';
  }

  return {
    correct: false,
    errorType: 'misconception',
    expected: { kind: 'cpu-flag', flag: ans.flag, expectedValue: expectedVal },
    got: {
      kind: 'cpu-flag',
      flag: ans.flag,
      studentValue: ans.value,
      studentReasoning: ans.reasoning,
    },
    misconceptionTag: tag,
    details,
  };
}

// Automatic Registration with validatorRegistry
const CPU_VALIDATORS = [
  ['cpu-register', validateCpuRegister],
  ['cpu-flag', validateCpuFlag],
  ['cpu-memory', validateCpuMemory],
  ['cpu-stack', validateCpuStack],
  ['cpu-next-ip', validateCpuNextIp],
] as const;

for (const [kind, fn] of CPU_VALIDATORS) {
  try {
    registerValidator(kind, fn);
  } catch {
    // Ignore duplicate registrations in case of module re-import
  }
}
