/**
 * @file interruptInstructions.ts
 * Handlers for Stage 15A interrupt-related instructions:
 * CLI, STI, PUSHF, POPF, INT n, and IRET.
 */

import {
  buildEntrySequence,
  flagsToWord,
  readVector,
  wordToFlags,
  type InterruptRecord,
  type IretRecord,
} from '../interrupts';
import type {
  CpuFault,
  CpuFlags,
  CpuState,
  StackChange,
} from './cpuTypes';
import { readByte, readWord, writeByte, writeWord, type Memory, type MemoryWrite } from './memory';
import { setReg, type Registers } from './registers';
import type { Instruction, Program } from './types';

export interface InterruptExecParams {
  readonly state: CpuState;
  readonly inst: Instruction;
  readonly program: Program;
  readonly currentRegs: Registers;
  readonly currentFlags: CpuFlags;
  readonly currentMemory: Memory;
  readonly nextIP: number;
}

export interface InterruptExecResult {
  readonly nextRegs: Registers;
  readonly nextFlags: CpuFlags;
  readonly nextMemory: Memory;
  readonly memoryWrites: readonly MemoryWrite[];
  readonly stackChange?: StackChange;
  readonly nextIP: number;
  readonly fault?: CpuFault;
  readonly interruptRecord?: InterruptRecord;
  readonly iretRecord?: IretRecord;
  readonly nextStiShadowActive?: boolean;
}

/**
 * Executes an interrupt-specific instruction (CLI, STI, PUSHF, POPF, INT, IRET).
 */
export function executeInterruptInstruction(
  mnemonic: 'CLI' | 'STI' | 'PUSHF' | 'POPF' | 'INT' | 'IRET',
  params: InterruptExecParams
): InterruptExecResult {
  const { state, inst, program, currentMemory } = params;
  let regs = params.currentRegs;
  let flags = params.currentFlags;
  let mem = currentMemory;
  const memoryWrites: MemoryWrite[] = [];
  let nextIP = params.nextIP;
  let stackChange: StackChange | undefined;
  let interruptRecord: InterruptRecord | undefined;
  let iretRecord: IretRecord | undefined;
  let nextStiShadowActive: boolean | undefined;

  switch (mnemonic) {
    case 'CLI':
      flags = { ...flags, I: 0 };
      break;

    case 'STI':
      flags = { ...flags, I: 1 };
      nextStiShadowActive = true;
      break;

    case 'PUSHF': {
      const spBefore = regs.SP;
      const spAfter = (spBefore - 2) & 0xffff;
      if (spAfter < state.lowWaterMark) {
        return {
          nextRegs: regs,
          nextFlags: flags,
          nextMemory: mem,
          memoryWrites,
          nextIP: regs.IP,
          fault: {
            type: 'stack-overflow',
            address: inst.address,
            sourceLine: inst.sourceLine,
            message: `PUSHF overflowed stack past low-water mark 0x${state.lowWaterMark.toString(16)}.`,
            explanation: 'Stack has grown downward into reserved memory.',
          },
        };
      }
      const word = flagsToWord(flags);
      const wr = writeWord(mem, spAfter, word);
      mem = wr.memory;
      memoryWrites.push(wr.writes[0], wr.writes[1]);
      regs = setReg(regs, 'SP', spAfter);
      stackChange = { type: 'push', value: word, spBefore, spAfter };
      break;
    }

    case 'POPF': {
      const spBefore = regs.SP;
      const word = readWord(mem, spBefore);
      const spAfter = (spBefore + 2) & 0xffff;
      const restored = wordToFlags(word);
      flags = { ...flags, ...restored };
      regs = setReg(regs, 'SP', spAfter);
      stackChange = { type: 'pop', value: word, spBefore, spAfter };
      break;
    }

    case 'INT': {
      const op0 = inst.operands[0];
      const vector = (op0 && op0.kind === 'imm' ? op0.value : 0) & 0xff;
      const entry = readVector((addr) => readByte(mem, addr), vector);

      if (!entry.isInstalled) {
        return {
          nextRegs: regs,
          nextFlags: flags,
          nextMemory: mem,
          memoryWrites,
          nextIP: regs.IP,
          fault: {
            type: 'unset-vector',
            address: inst.address,
            sourceLine: inst.sourceLine,
            message: `Interrupt vector ${vector} at address 0x${entry.address.toString(16).padStart(4, '0').toUpperCase()} is unset.`,
            explanation: 'The interrupt vector table entry contains all zeros.',
          },
        };
      }

      if (entry.ip >= program.instructions.length) {
        return {
          nextRegs: regs,
          nextFlags: flags,
          nextMemory: mem,
          memoryWrites,
          nextIP: regs.IP,
          fault: {
            type: 'invalid-vector-target',
            address: inst.address,
            sourceLine: inst.sourceLine,
            message: `Interrupt vector ${vector} target instruction address ${entry.ip} out of bounds.`,
            explanation: 'Handler address exceeds the loaded program length.',
          },
        };
      }

      const spBefore = regs.SP;
      const spAfter = (spBefore - 6) & 0xffff;
      if (spAfter < state.lowWaterMark) {
        return {
          nextRegs: regs,
          nextFlags: flags,
          nextMemory: mem,
          memoryWrites,
          nextIP: regs.IP,
          fault: {
            type: 'stack-overflow',
            address: inst.address,
            sourceLine: inst.sourceLine,
            message: `INT ${vector} overflowed stack past low-water mark 0x${state.lowWaterMark.toString(16)}.`,
            explanation: 'Stack frame exceeds memory low-water mark.',
          },
        };
      }

      const seq = buildEntrySequence({
        kind: 'software',
        vector,
        source: 'software-int',
        currentSp: spBefore,
        currentFlags: flags,
        returnIp: nextIP,
        handlerIp: entry.ip,
        readMemoryByte: (addr) => readByte(mem, addr),
      });

      for (const step of seq.microSteps) {
        for (const mw of step.memoryWrites) {
          const wr = writeByte(mem, mw.address, mw.newByte);
          mem = wr.memory;
          memoryWrites.push(wr.write);
        }
      }

      regs = setReg(regs, 'SP', seq.finalSp);
      flags = seq.finalFlags;
      nextIP = entry.ip;
      interruptRecord = seq.record;
      stackChange = { type: 'push', value: entry.ip, spBefore, spAfter: seq.finalSp };
      break;
    }

    case 'IRET': {
      const spBefore = regs.SP;
      if (spBefore >= state.initialSp || ((spBefore + 6) & 0xffff) > state.initialSp) {
        return {
          nextRegs: regs,
          nextFlags: flags,
          nextMemory: mem,
          memoryWrites,
          nextIP: regs.IP,
          fault: {
            type: 'iret-on-empty-stack',
            address: inst.address,
            sourceLine: inst.sourceLine,
            message: `IRET attempted with empty or incomplete stack frame (SP=0x${spBefore.toString(16).padStart(4, '0')}).`,
            explanation: 'Stack does not contain a full 6-byte interrupt frame.',
          },
        };
      }

      const poppedIp = readWord(mem, spBefore);
      const poppedCs = readWord(mem, (spBefore + 2) & 0xffff);

      if (poppedCs !== 0x0000) {
        return {
          nextRegs: regs,
          nextFlags: flags,
          nextMemory: mem,
          memoryWrites,
          nextIP: regs.IP,
          fault: {
            type: 'corrupted-interrupt-frame',
            address: inst.address,
            sourceLine: inst.sourceLine,
            message: `Corrupted interrupt frame: popped CS 0x${poppedCs.toString(16).padStart(4, '0')} is not 0x0000.`,
            explanation: 'The CS word in the interrupt return frame must be 0x0000.',
          },
        };
      }

      const poppedFlagsWord = readWord(mem, (spBefore + 4) & 0xffff);
      const restored = wordToFlags(poppedFlagsWord);
      flags = { ...flags, ...restored };
      const spAfter = (spBefore + 6) & 0xffff;
      regs = setReg(regs, 'SP', spAfter);
      nextIP = poppedIp;

      iretRecord = {
        poppedIp,
        poppedCs,
        poppedFlags: poppedFlagsWord,
        flagsRestored: restored,
      };
      stackChange = { type: 'pop', value: poppedIp, spBefore, spAfter };
      break;
    }
  }

  return {
    nextRegs: regs,
    nextFlags: flags,
    nextMemory: mem,
    memoryWrites,
    stackChange,
    nextIP,
    interruptRecord,
    iretRecord,
    nextStiShadowActive,
  };
}
