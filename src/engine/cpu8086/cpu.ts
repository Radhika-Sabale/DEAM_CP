/**
 * @file cpu.ts
 * 8086 CPU execution engine and single-step state transition controller.
 *
 * ============================================================================
 * PURE STATE TRANSITIONS & DETERMINISM (STAGE 15A INTERRUPT ENGINE):
 * 1. PURE FUNCTIONS: `step(state, program, options)` takes an immutable state snapshot
 *    and produces a brand-new state and an audit StepRecord.
 * 2. BOUNDARY ARBITRATION: External hardware lines (NMI, INTR) and the single-step
 *    trap (TF) are evaluated strictly at instruction boundaries in priority order.
 * 3. TICKS: Time advances by 1 tick on every executed instruction or idle wait cycle.
 * 4. IVT & LOW-WATER MARK: Automatically loads VECTOR directives into IVT memory
 *    (0x0000-0x03FF) and defaults stack low-water mark to 0x0400 for interrupt programs.
 * ============================================================================
 */

import {
  arbitrateInterrupt,
  buildEntrySequence,
  eventsDueAt,
  readVector,
  writeVector,
} from '../interrupts';
import type {
  CpuFault,
  CpuFlags,
  CpuOptions,
  CpuState,
  InstructionOutcome,
  StepRecord,
  StepResult,
} from './cpuTypes';
import { executeInstruction } from './instructions';
import { createMemory, loadImage, readByte, writeByte, type Memory, type MemoryWrite } from './memory';
import { createRegisters, setReg, type Registers } from './registers';
import type { Instruction, Program } from './types';

export * from './cpuTypes';

/**
 * Creates and initializes a new 8086 CPU state for the given program.
 */
export function createCpuState(program?: Program, options: CpuOptions = {}): CpuState {
  const initialSp = (options.initialSp ?? 0xfffe) & 0xffff;
  const entryPoint = (options.entryPoint ?? program?.entryPoint ?? 0) & 0xffff;
  const defaultLwm = program?.usesInterrupts ? 0x0400 : 0x0100;
  const lowWaterMark = options.lowWaterMark ?? defaultLwm;

  const registers: Registers = createRegisters({ initialSp, entryPoint });
  const flags: CpuFlags = { Z: 0, C: 0, S: 0, O: 0, I: 0, T: 0 };

  let memory: Memory = createMemory();
  if (program && program.dataSegments.length > 0) {
    memory = loadImage(memory, program.dataSegments);
  }

  // Pre-install vector table directives into IVT memory (0x0000..0x03FF)
  if (program?.installedVectors && program.installedVectors.length > 0) {
    for (const iv of program.installedVectors) {
      writeVector(
        (addr, val) => {
          const wr = writeByte(memory, addr, val);
          memory = wr.memory;
        },
        iv.vector,
        iv.handlerAddress,
        0x0000
      );
    }
  }

  return {
    registers,
    flags,
    memory,
    halted: false,
    initialSp,
    lowWaterMark,
    ticks: 0,
    pendingNmi: false,
    pendingIntr: null,
    singleStepPending: false,
    stiShadowActive: false,
    tfAtInstructionStart: 0,
  };
}

/**
 * Executes a single instruction step of the 8086 CPU with boundary interrupt arbitration.
 */
export function step(state: CpuState, program: Program, options: CpuOptions = {}): StepResult {
  const currentTick = state.ticks;
  let pendingNmi = state.pendingNmi;
  let pendingIntr = state.pendingIntr;

  // 1. Sample scenario events due at currentTick
  if (options.scenario) {
    const dueEvents = eventsDueAt(options.scenario, currentTick);
    for (const ev of dueEvents) {
      if (ev.kind === 'nmi') pendingNmi = true;
      else if (ev.kind === 'intr') pendingIntr = { vector: ev.vector ?? 0 };
    }
  }

  // 2. Handle HALTED state and interrupt wake-up
  if (state.halted) {
    const canWakeNmi = pendingNmi;
    const canWakeIntr = pendingIntr !== null && state.flags.I === 1;

    if (canWakeNmi || canWakeIntr) {
      // Waking up: un-halt and enter waking interrupt handler
      // Waking return IP is the instruction following HLT, so execution resumes on IRET
      const returnIp = (state.registers.IP + 1) & 0xffff;
      const wakingState: CpuState = {
        ...state,
        halted: false,
        registers: { ...state.registers, IP: returnIp },
        pendingNmi,
        pendingIntr,
      };
      return performInterruptEntry(wakingState, program, options);
    }

    const dummyInst: Instruction = {
      address: state.registers.IP,
      mnemonic: 'HLT',
      operands: [],
      sourceLine: -1,
      sourceText: 'HLT',
    };
    const record: StepRecord = {
      address: state.registers.IP,
      instruction: dummyInst,
      sourceLine: -1,
      registersChanged: [],
      flagsChanged: [],
      memoryWrites: [],
      ipAfter: state.registers.IP,
      fault: state.fault,
      halted: true,
      cycles: 1,
    };
    return {
      state: { ...state, ticks: currentTick + 1, pendingNmi, pendingIntr },
      record,
    };
  }

  // 3. Instruction boundary arbitration
  const arbitration = arbitrateInterrupt({
    pendingNmi,
    pendingIntr,
    singleStepPending: state.singleStepPending,
    ifFlag: state.flags.I,
    stiShadowActive: state.stiShadowActive && (options.stiShadow ?? true),
  });

  if (arbitration.recognised !== null) {
    const arbitratedState: CpuState = { ...state, pendingNmi, pendingIntr };
    return performInterruptEntry(arbitratedState, program, options, arbitration);
  }

  // 4. Regular instruction execution (no boundary interrupt recognised)
  const currentIP = state.registers.IP;

  if (currentIP < 0 || currentIP >= program.instructions.length) {
    const faultInst: Instruction = {
      address: currentIP,
      mnemonic: 'HLT',
      operands: [],
      sourceLine: -1,
      sourceText: 'OUT_OF_BOUNDS',
    };
    const fault: CpuFault = {
      type: 'ip-out-of-program',
      address: currentIP,
      sourceLine: -1,
      message: `Instruction pointer IP (address ${currentIP}) is outside program bounds (0..${program.instructions.length - 1}).`,
      explanation: 'The program reached the end of instructions without encountering a HLT instruction.',
    };
    const nextState: CpuState = { ...state, halted: true, fault, ticks: currentTick + 1 };
    const record: StepRecord = {
      address: currentIP,
      instruction: faultInst,
      sourceLine: -1,
      registersChanged: [],
      flagsChanged: [],
      memoryWrites: [],
      ipAfter: currentIP,
      fault,
      halted: true,
      cycles: 1,
    };
    return { state: nextState, record };
  }

  const inst = program.instructions[currentIP];
  if (!inst) throw new Error(`Instruction at IP ${currentIP} is undefined.`);

  const tfAtStart = state.flags.T;
  const outcome: InstructionOutcome = executeInstruction(state, inst, program);

  const nextSingleStepPending = !outcome.fault && inst.mnemonic !== 'INT' ? tfAtStart === 1 : false;
  const nextStiShadowActive = outcome.nextStiShadowActive ?? false;

  const nextState: CpuState = {
    registers: outcome.nextRegisters,
    flags: outcome.nextFlags,
    memory: outcome.nextMemory,
    halted: outcome.halted,
    initialSp: state.initialSp,
    lowWaterMark: state.lowWaterMark,
    fault: outcome.fault,
    ticks: currentTick + 1,
    pendingNmi,
    pendingIntr,
    singleStepPending: nextSingleStepPending,
    stiShadowActive: nextStiShadowActive,
    tfAtInstructionStart: outcome.nextFlags.T,
  };

  const record: StepRecord = {
    address: currentIP,
    instruction: inst,
    sourceLine: inst.sourceLine,
    registersChanged: outcome.registersChanged,
    flagsChanged: outcome.flagsChanged,
    memoryWrites: outcome.memoryWrites,
    stackChange: outcome.stackChange,
    ipAfter: outcome.ipAfter,
    fault: outcome.fault,
    halted: outcome.halted,
    cycles: 1,
    interruptRecord: outcome.interruptRecord,
    iretRecord: outcome.iretRecord,
  };

  return { state: nextState, record };
}

function performInterruptEntry(
  state: CpuState,
  program: Program,
  options: CpuOptions,
  arbitration = arbitrateInterrupt({
    pendingNmi: state.pendingNmi,
    pendingIntr: state.pendingIntr,
    singleStepPending: state.singleStepPending,
    ifFlag: state.flags.I,
    stiShadowActive: state.stiShadowActive && (options.stiShadow ?? true),
  })
): StepResult {
  const rec = arbitration.recognised;
  if (!rec) throw new Error('performInterruptEntry called with no recognised interrupt');

  const vector = rec.vector;
  const currentTick = state.ticks;
  const currentIP = state.registers.IP;

  const entry = readVector((addr) => readByte(state.memory, addr), vector);

  let fault: CpuFault | undefined;
  if (!entry.isInstalled) {
    fault = {
      type: 'unset-vector',
      address: currentIP,
      sourceLine: program.instructions[currentIP]?.sourceLine ?? -1,
      message: `Interrupt vector ${vector} at address 0x${entry.address.toString(16).padStart(4, '0').toUpperCase()} is unset (all zeros).`,
      explanation: 'The interrupt vector table entry contains all zeros.',
    };
  } else if (entry.ip >= program.instructions.length) {
    fault = {
      type: 'invalid-vector-target',
      address: currentIP,
      sourceLine: program.instructions[currentIP]?.sourceLine ?? -1,
      message: `Interrupt vector ${vector} target instruction address ${entry.ip} out of bounds (0..${program.instructions.length - 1}).`,
      explanation: 'Handler address exceeds the loaded program length.',
    };
  } else if (((state.registers.SP - 6) & 0xffff) < state.lowWaterMark) {
    fault = {
      type: 'stack-overflow',
      address: currentIP,
      sourceLine: program.instructions[currentIP]?.sourceLine ?? -1,
      message: `Interrupt ${vector} overflowed stack past low-water mark 0x${state.lowWaterMark.toString(16)}.`,
      explanation: 'Stack has grown downward into reserved memory.',
    };
  }

  const faultInst: Instruction = {
    address: currentIP,
    mnemonic: 'INT',
    operands: [{ kind: 'imm', value: vector, size: 8 }],
    sourceLine: program.instructions[currentIP]?.sourceLine ?? -1,
    sourceText: rec.source === 'hardware-nmi' ? 'NMI' : rec.source === 'single-step-trap' ? 'SINGLE-STEP' : `INTR ${vector}`,
  };

  if (fault) {
    const nextState: CpuState = {
      ...state,
      halted: true,
      fault,
      ticks: currentTick + 1,
      pendingNmi: arbitration.nextPendingNmi,
      pendingIntr: arbitration.nextPendingIntr,
      singleStepPending: arbitration.nextSingleStepPending,
    };
    const record: StepRecord = {
      address: currentIP,
      instruction: faultInst,
      sourceLine: faultInst.sourceLine,
      registersChanged: [],
      flagsChanged: [],
      memoryWrites: [],
      ipAfter: currentIP,
      fault,
      halted: true,
      cycles: 1,
    };
    return { state: nextState, record };
  }

  const seq = buildEntrySequence({
    kind: rec.kind,
    vector,
    source: rec.source,
    currentSp: state.registers.SP,
    currentFlags: state.flags,
    returnIp: currentIP,
    handlerIp: entry.ip,
    readMemoryByte: (addr) => readByte(state.memory, addr),
  });

  let currentMemory = state.memory;
  const memoryWrites: MemoryWrite[] = [];
  for (const s of seq.microSteps) {
    for (const mw of s.memoryWrites) {
      const wr = writeByte(currentMemory, mw.address, mw.newByte);
      currentMemory = wr.memory;
      memoryWrites.push(wr.write);
    }
  }

  let nextRegs = setReg(state.registers, 'SP', seq.finalSp);
  nextRegs = setReg(nextRegs, 'IP', entry.ip);

  const nextState: CpuState = {
    registers: nextRegs,
    flags: seq.finalFlags,
    memory: currentMemory,
    halted: false,
    initialSp: state.initialSp,
    lowWaterMark: state.lowWaterMark,
    ticks: currentTick + 1,
    pendingNmi: arbitration.nextPendingNmi,
    pendingIntr: arbitration.nextPendingIntr,
    singleStepPending: arbitration.nextSingleStepPending,
    stiShadowActive: false,
    tfAtInstructionStart: 0,
  };

  const record: StepRecord = {
    address: currentIP,
    instruction: faultInst,
    sourceLine: faultInst.sourceLine,
    registersChanged: [
      { name: 'SP', old: state.registers.SP, new: seq.finalSp },
      { name: 'IP', old: currentIP, new: entry.ip },
    ],
    flagsChanged: seq.microSteps[1]?.flagsChanged.map((fc) => ({ name: fc.name, old: fc.old, new: fc.new })) ?? [],
    memoryWrites,
    stackChange: { type: 'push', value: currentIP, spBefore: state.registers.SP, spAfter: seq.finalSp },
    ipAfter: entry.ip,
    halted: false,
    cycles: 1,
    interruptRecord: seq.record,
  };

  return { state: nextState, record };
}
