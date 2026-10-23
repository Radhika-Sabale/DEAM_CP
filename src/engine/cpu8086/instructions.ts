/**
 * @file instructions.ts
 * Execution dispatcher for the 8086 CPU instruction subset.
 *
 * ============================================================================
 * ARCHITECTURAL PRINCIPLES:
 * 1. ALU DELEGATION: All arithmetic/logic and flags derive strictly from execute().
 * 2. STACK ORDER: PUSH decrements SP then writes; POP reads then increments SP.
 * ============================================================================
 */

import { execute as aluExecute } from '../alu';
import { evaluateCondition } from './conditions';
import type {
  CpuFault,
  CpuFaultType,
  CpuFlags,
  CpuState,
  FlagChange,
  InstructionOutcome,
  RegisterChange,
  StackChange,
} from './cpuTypes';
import { readByte, readWord, writeByte, writeWord, type Memory, type MemoryWrite } from './memory';
import { getReg, setReg, type Registers } from './registers';
import type { Instruction, MemoryOperand, Operand, Program, RegisterName } from './types';

import { executeInterruptInstruction } from './interruptInstructions';
import type { InterruptRecord, IretRecord } from '../interrupts';

/** Computes the effective memory address for a memory operand, wrapping modulo 0x10000. */
export function computeEffectiveAddress(registers: Registers, mem: MemoryOperand): number {
  let addr = mem.disp;
  if (mem.base) addr += getReg(registers, mem.base);
  if (mem.index) addr += getReg(registers, mem.index);
  return ((addr % 0x10000) + 0x10000) % 0x10000;
}

function readOperandValue(state: CpuState, op: Operand, size: 8 | 16): number {
  switch (op.kind) {
    case 'reg': return getReg(state.registers, op.name);
    case 'imm': return op.value & (size === 8 ? 0xff : 0xffff);
    case 'label': return op.name in state.registers ? getReg(state.registers, op.name as RegisterName) : 0;
    case 'mem': {
      const ea = computeEffectiveAddress(state.registers, op);
      return size === 8 ? readByte(state.memory, ea) : readWord(state.memory, ea);
    }
  }
}

/** Executes a single decoded instruction against the CPU state. */
export function executeInstruction(
  state: CpuState,
  inst: Instruction,
  program: Program
): InstructionOutcome {
  let currentRegs = state.registers;
  let currentFlags = state.flags;
  let currentMemory = state.memory;
  const memoryWrites: MemoryWrite[] = [];
  let stackChange: StackChange | undefined;
  let nextIP = (currentRegs.IP + 1) & 0xffff;
  let halted = false;
  let interruptRecord: InterruptRecord | undefined;
  let iretRecord: IretRecord | undefined;
  let nextStiShadowActive: boolean | undefined;

  const writeOperand = (op: Operand, val: number, size: 8 | 16) => {
    if (op.kind === 'reg') {
      currentRegs = setReg(currentRegs, op.name, val);
    } else if (op.kind === 'mem') {
      const ea = computeEffectiveAddress(currentRegs, op);
      if (size === 8) {
        const wr = writeByte(currentMemory, ea, val);
        currentMemory = wr.memory;
        memoryWrites.push(wr.write);
      } else {
        const wr = writeWord(currentMemory, ea, val);
        currentMemory = wr.memory;
        memoryWrites.push(wr.writes[0], wr.writes[1]);
      }
    }
  };

  const op0 = inst.operands[0];
  const op1 = inst.operands[1];
  const size: 8 | 16 = inst.size ?? (op0 && op0.kind === 'reg' ? op0.size : 16);

  switch (inst.mnemonic) {
    case 'HLT':
      halted = true;
      nextIP = currentRegs.IP;
      break;

    case 'NOP':
      break;

    case 'MOV':
      if (op0 && op1) writeOperand(op0, readOperandValue(state, op1, size), size);
      break;

    case 'XCHG':
      if (op0 && op1) {
        const left = readOperandValue(state, op0, size);
        const right = readOperandValue(state, op1, size);
        writeOperand(op0, right, size);
        writeOperand(op1, left, size);
      }
      break;

    case 'LEA':
      if (op0?.kind === 'reg' && op1?.kind === 'mem') currentRegs = setReg(currentRegs, op0.name, computeEffectiveAddress(currentRegs, op1));
      break;

    case 'CBW':
      currentRegs = setReg(currentRegs, 'AX', (getReg(currentRegs, 'AL') & 0x80) ? (getReg(currentRegs, 'AL') | 0xff00) : getReg(currentRegs, 'AL'));
      break;

    case 'CWD':
      currentRegs = setReg(currentRegs, 'DX', (getReg(currentRegs, 'AX') & 0x8000) ? 0xffff : 0);
      break;

    case 'ADD':
    case 'SUB':
    case 'CMP':
    case 'AND':
    case 'OR':
    case 'XOR': {
      if (op0 && op1) {
        const dVal = readOperandValue(state, op0, size);
        const sVal = readOperandValue(state, op1, size);
        const aluRes = aluExecute(inst.mnemonic, dVal, sVal, size);
        if (aluRes.ok) {
          if (inst.mnemonic !== 'CMP') writeOperand(op0, aluRes.result.unsigned, size);
          currentFlags = { ...currentFlags, ...aluRes.flags };
        }
      }
      break;
    }

    case 'INC':
    case 'DEC': {
      if (op0) {
        const dVal = readOperandValue(state, op0, size);
        const aluRes = aluExecute(inst.mnemonic, dVal, 0, size, { previousC: state.flags.C });
        if (aluRes.ok) {
          writeOperand(op0, aluRes.result.unsigned, size);
          currentFlags = { ...currentFlags, ...aluRes.flags, C: state.flags.C };
        }
      }
      break;
    }

    case 'NOT':
      if (op0) writeOperand(op0, ~readOperandValue(state, op0, size), size);
      break;

    case 'NEG': {
      if (op0) {
        const mask = size === 8 ? 0xff : 0xffff;
        const value = readOperandValue(state, op0, size) & mask;
        const result = (-value) & mask;
        const signBit = size === 8 ? 0x80 : 0x8000;
        const signedMin = signBit;
        writeOperand(op0, result, size);
        currentFlags = { ...currentFlags, Z: result === 0 ? 1 : 0, S: (result & signBit) ? 1 : 0, C: value === 0 ? 0 : 1, O: value === signedMin ? 1 : 0 };
      }
      break;
    }

    case 'MUL':
    case 'IMUL': {
      if (op0) {
        const operand = readOperandValue(state, op0, size);
        const mask = size === 8 ? 0xff : 0xffff;
        const low = getReg(currentRegs, size === 8 ? 'AL' : 'AX');
        const sign = (v: number) => (v & (size === 8 ? 0x80 : 0x8000)) ? v - (size === 8 ? 0x100 : 0x10000) : v;
        const product = inst.mnemonic === 'MUL' ? low * operand : sign(low) * sign(operand);
        const lowHalf = product & mask;
        const highHalf = Math.floor((product & (size === 8 ? 0xffff : 0xffffffff)) / (mask + 1)) & mask;
        if (size === 8) currentRegs = setReg(currentRegs, 'AX', (highHalf << 8) | lowHalf);
        else {
          currentRegs = setReg(currentRegs, 'AX', lowHalf);
          currentRegs = setReg(currentRegs, 'DX', highHalf);
        }
        const overflow = inst.mnemonic === 'MUL'
          ? highHalf !== 0
          : highHalf !== ((lowHalf & (size === 8 ? 0x80 : 0x8000)) ? mask : 0);
        currentFlags = { ...currentFlags, C: overflow ? 1 : 0, O: overflow ? 1 : 0 };
      }
      break;
    }

    case 'DIV':
    case 'IDIV': {
      if (op0) {
        const divisorRaw = readOperandValue(state, op0, size) & (size === 8 ? 0xff : 0xffff);
        const divisor = inst.mnemonic === 'IDIV'
          ? (divisorRaw & (size === 8 ? 0x80 : 0x8000)) ? divisorRaw - (size === 8 ? 0x100 : 0x10000) : divisorRaw
          : divisorRaw;
        const dividendRaw = size === 8
          ? getReg(currentRegs, 'AX')
          : ((getReg(currentRegs, 'DX') * 0x10000) + getReg(currentRegs, 'AX')) >>> 0;
        const dividend = inst.mnemonic === 'IDIV'
          ? size === 8
            ? (dividendRaw & 0x8000) ? dividendRaw - 0x10000 : dividendRaw
            : dividendRaw >= 0x80000000 ? dividendRaw - 0x100000000 : dividendRaw
          : dividendRaw;
        const quotient = divisor === 0 ? NaN : Math.trunc(dividend / divisor);
        const remainder = divisor === 0 ? NaN : dividend % divisor;
        const min = inst.mnemonic === 'IDIV' ? -(size === 8 ? 0x80 : 0x8000) : 0;
        const max = inst.mnemonic === 'IDIV' ? (size === 8 ? 0x7f : 0x7fff) : (size === 8 ? 0xff : 0xffff);
        if (divisor === 0 || !Number.isFinite(quotient) || quotient < min || quotient > max) {
          return fail('divide-error', inst, `Divide error on line ${inst.sourceLine}: ${divisor === 0 ? 'division by zero' : 'quotient overflow'}.`, 'The divisor is zero or the quotient does not fit in the destination register.', currentRegs, currentFlags, currentMemory, memoryWrites);
        }
        if (size === 8) {
          currentRegs = setReg(currentRegs, 'AL', quotient);
          currentRegs = setReg(currentRegs, 'AH', remainder);
        } else {
          currentRegs = setReg(currentRegs, 'AX', quotient);
          currentRegs = setReg(currentRegs, 'DX', remainder);
        }
        // 8086 leaves status flags undefined after DIV/IDIV; retain the model's prior values.
      }
      break;
    }

    case 'SHL':
    case 'SHR': {
      if (op0 && op1) {
        const dVal = readOperandValue(state, op0, size);
        const count = op1.kind === 'reg' && op1.name === 'CL'
          ? getReg(currentRegs, 'CL') & 0x1f
          : readOperandValue(state, op1, 8);
        if (count > 0) {
          const aluRes = aluExecute(inst.mnemonic, dVal, 0, size, { shiftCount: count });
          if (aluRes.ok) {
            writeOperand(op0, aluRes.result.unsigned, size);
            currentFlags = { ...currentFlags, ...aluRes.flags };
          } else {
            return fail('invalid-shift-count', inst, `Shift count ${count} invalid for ${size}-bit width.`, 'Shift count exceeds operand width.', currentRegs, currentFlags, currentMemory, memoryWrites);
          }
        }
      }
      break;
    }

    case 'JMP':
      nextIP = resolveTarget(op0, program);
      break;

    case 'JCXZ':
      if (getReg(currentRegs, 'CX') === 0) nextIP = resolveTarget(op0, program);
      break;

    case 'LOOP':
    case 'LOOPE':
    case 'LOOPNE': {
      const cx = (getReg(currentRegs, 'CX') - 1) & 0xffff;
      currentRegs = setReg(currentRegs, 'CX', cx);
      const condition = inst.mnemonic === 'LOOP' || (inst.mnemonic === 'LOOPE' && state.flags.Z === 1) || (inst.mnemonic === 'LOOPNE' && state.flags.Z === 0);
      if (cx !== 0 && condition) nextIP = resolveTarget(op0, program);
      break;
    }

    case 'CALL': {
      const target = resolveTarget(op0, program);
      const retAddr = nextIP;
      const spBefore = currentRegs.SP;
      const spAfter = (spBefore - 2) & 0xffff;
      if (spAfter < state.lowWaterMark) {
        return fail('stack-overflow', inst, `Stack pointer 0x${spAfter.toString(16)} below low-water mark 0x${state.lowWaterMark.toString(16)}.`, 'Stack has exceeded allocated memory bounds.', currentRegs, currentFlags, currentMemory, memoryWrites);
      }
      const wr = writeWord(currentMemory, spAfter, retAddr);
      currentMemory = wr.memory;
      memoryWrites.push(wr.writes[0], wr.writes[1]);
      currentRegs = setReg(currentRegs, 'SP', spAfter);
      stackChange = { type: 'push', value: retAddr, spBefore, spAfter };
      nextIP = target;
      break;
    }

    case 'RET': {
      const spBefore = currentRegs.SP;
      if (spBefore >= state.initialSp) {
        return fail('return-to-empty-stack', inst, `RET attempted with empty stack (SP=0x${spBefore.toString(16)} >= initial SP).`, 'Attempted to return with no return address on the stack.', currentRegs, currentFlags, currentMemory, memoryWrites);
      }
      const retAddr = readWord(currentMemory, spBefore);
      let spAfter = (spBefore + 2) & 0xffff;
      if (op0 && op0.kind === 'imm') spAfter = (spAfter + op0.value) & 0xffff;
      currentRegs = setReg(currentRegs, 'SP', spAfter);
      stackChange = { type: 'pop', value: retAddr, spBefore, spAfter };
      nextIP = retAddr;
      break;
    }

    case 'PUSH': {
      if (op0) {
        const val = readOperandValue(state, op0, 16);
        const spBefore = currentRegs.SP;
        const spAfter = (spBefore - 2) & 0xffff;
        if (spAfter < state.lowWaterMark) {
          return fail('stack-overflow', inst, `PUSH overflowed stack past low-water mark 0x${state.lowWaterMark.toString(16)}.`, 'Stack has grown downward into reserved memory.', currentRegs, currentFlags, currentMemory, memoryWrites);
        }
        const wr = writeWord(currentMemory, spAfter, val);
        currentMemory = wr.memory;
        memoryWrites.push(wr.writes[0], wr.writes[1]);
        currentRegs = setReg(currentRegs, 'SP', spAfter);
        stackChange = { type: 'push', value: val, spBefore, spAfter };
      }
      break;
    }

    case 'POP': {
      if (op0) {
        const spBefore = currentRegs.SP;
        const val = readWord(currentMemory, spBefore);
        const spAfter = (spBefore + 2) & 0xffff;
        writeOperand(op0, val, 16);
        currentRegs = setReg(currentRegs, 'SP', spAfter);
        stackChange = { type: 'pop', value: val, spBefore, spAfter };
      }
      break;
    }

    case 'CLI':
    case 'STI':
    case 'PUSHF':
    case 'POPF':
    case 'INT':
    case 'IRET': {
      const intRes = executeInterruptInstruction(inst.mnemonic, {
        state,
        inst,
        program,
        currentRegs,
        currentFlags,
        currentMemory,
        nextIP,
      });
      if (intRes.fault) {
        return assembleOutcome(
          state,
          intRes.nextRegs,
          intRes.nextFlags,
          intRes.nextMemory,
          intRes.memoryWrites,
          intRes.stackChange,
          intRes.nextRegs.IP,
          true,
          intRes.fault
        );
      }
      currentRegs = intRes.nextRegs;
      currentFlags = intRes.nextFlags;
      currentMemory = intRes.nextMemory;
      memoryWrites.push(...intRes.memoryWrites);
      stackChange = intRes.stackChange;
      nextIP = intRes.nextIP;
      interruptRecord = intRes.interruptRecord;
      iretRecord = intRes.iretRecord;
      nextStiShadowActive = intRes.nextStiShadowActive;
      break;
    }

    default: {
      const condRes = evaluateCondition(inst.mnemonic, state.flags, inst.sourceText);
      if (!condRes.ok) {
        return fail(condRes.fault, inst, condRes.message, condRes.explanation, currentRegs, currentFlags, currentMemory, memoryWrites);
      }
      if (condRes.taken) nextIP = resolveTarget(op0, program);
      break;
    }
  }

  currentRegs = setReg(currentRegs, 'IP', nextIP);
  return assembleOutcome(
    state,
    currentRegs,
    currentFlags,
    currentMemory,
    memoryWrites,
    stackChange,
    nextIP,
    halted,
    undefined,
    interruptRecord,
    iretRecord,
    nextStiShadowActive
  );
}

function resolveTarget(op: Operand | undefined, program: Program): number {
  if (!op) return 0;
  if (op.kind === 'label') return program.symbols[op.name]?.address ?? 0;
  if (op.kind === 'imm') return op.value & 0xffff;
  return 0;
}

function assembleOutcome(
  before: CpuState,
  nextRegs: Registers,
  nextFlags: CpuFlags,
  nextMemory: Memory,
  memoryWrites: readonly MemoryWrite[],
  stackChange: StackChange | undefined,
  ipAfter: number,
  halted: boolean,
  fault?: CpuFault,
  interruptRecord?: InterruptRecord,
  iretRecord?: IretRecord,
  nextStiShadowActive?: boolean
): InstructionOutcome {
  const regNames: readonly RegisterName[] = ['AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'SP', 'IP'];
  const registersChanged: RegisterChange[] = [];
  for (const name of regNames) {
    const o = getReg(before.registers, name);
    const n = getReg(nextRegs, name);
    if (o !== n) registersChanged.push({ name, old: o, new: n });
  }

  const flagNames: readonly ('Z' | 'C' | 'S' | 'O' | 'I' | 'T')[] = ['Z', 'C', 'S', 'O', 'I', 'T'];
  const flagsChanged: FlagChange[] = [];
  for (const f of flagNames) {
    if (before.flags[f] !== nextFlags[f]) {
      flagsChanged.push({ name: f, old: before.flags[f], new: nextFlags[f] });
    }
  }

  return {
    nextRegisters: nextRegs,
    nextFlags,
    nextMemory,
    registersChanged,
    flagsChanged,
    memoryWrites,
    stackChange,
    ipAfter,
    halted,
    fault,
    interruptRecord,
    iretRecord,
    nextStiShadowActive,
  };
}

function fail(
  type: CpuFaultType,
  inst: Instruction,
  message: string,
  explanation: string,
  regs: Registers,
  flags: CpuFlags,
  mem: Memory,
  writes: readonly MemoryWrite[]
): InstructionOutcome {
  const fault: CpuFault = { type, address: inst.address, sourceLine: inst.sourceLine, message, explanation };
  const dummyBefore: CpuState = {
    registers: regs,
    flags,
    memory: mem,
    halted: true,
    initialSp: regs.SP,
    lowWaterMark: 0x0100,
    ticks: 0,
    pendingNmi: false,
    pendingIntr: null,
    singleStepPending: false,
    stiShadowActive: false,
    tfAtInstructionStart: 0,
  };
  return assembleOutcome(dummyBefore, regs, flags, mem, writes, undefined, regs.IP, true, fault);
}
