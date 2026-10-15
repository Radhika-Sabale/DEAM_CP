/**
 * @file interruptController.ts
 * Pure arbitration logic, interrupt priority resolution, and 5-stage micro-step generation.
 *
 * DESIGN DECISIONS:
 * 1. Priority at instruction boundary (highest first):
 *    (1) NMI (Vector 2, non-maskable, unaffected by IF or STI shadow)
 *    (2) INTR (Maskable, accepted only if IF=1 and not in STI shadow)
 *    (3) Single-Step Trap (Vector 1, accepted only if TF was 1 at instruction start and not in STI shadow)
 * 2. Only ONE interrupt is accepted per boundary; other pending events stay pending.
 * 3. NMI is edge-triggered & latched (1 pending max). INTR is level-triggered & maskable.
 * 4. STI shadow: inhibits INTR and single-step trap during the single instruction following STI.
 * 5. buildEntrySequence produces 5 ordered micro-steps:
 *    (1) push FLAGS word
 *    (2) clear IF and TF
 *    (3) push CS (0x0000)
 *    (4) push return IP
 *    (5) load handler IP from vector
 */

import { flagsToWord, type ModeledFlags } from './flagsWord';
import type {
  InterruptKind,
  InterruptMicroStep,
  InterruptRecord,
  InterruptSource,
  MicroStepFlagChange,
} from './types';

export interface ArbitrateInterruptInput {
  readonly pendingNmi: boolean;
  readonly pendingIntr: { readonly vector: number } | null;
  readonly singleStepPending: boolean;
  readonly ifFlag: 0 | 1;
  readonly stiShadowActive: boolean;
}

export type RecognisedInterrupt =
  | { readonly kind: 'nmi'; readonly vector: 2; readonly source: 'hardware-nmi' }
  | { readonly kind: 'intr'; readonly vector: number; readonly source: 'hardware-intr' }
  | { readonly kind: 'single-step'; readonly vector: 1; readonly source: 'single-step-trap' };

export interface ArbitrateInterruptOutcome {
  readonly recognised: RecognisedInterrupt | null;
  readonly nextPendingNmi: boolean;
  readonly nextPendingIntr: { readonly vector: number } | null;
  readonly nextSingleStepPending: boolean;
}

/**
 * Arbitrates between pending interrupt lines and traps according to 8086 hardware priority rules.
 *
 * @param input Current pending lines, flags, and shadow state
 * @returns ArbitrateInterruptOutcome containing recognized interrupt (if any) and next pending state
 */
export function arbitrateInterrupt(input: ArbitrateInterruptInput): ArbitrateInterruptOutcome {
  // 1. Highest Priority: Non-Maskable Interrupt (NMI)
  // NMI is non-maskable: IF has no effect, and textbook STI shadow does not block NMI.
  if (input.pendingNmi) {
    return {
      recognised: { kind: 'nmi', vector: 2, source: 'hardware-nmi' },
      nextPendingNmi: false, // Edge acknowledged and unlatched
      nextPendingIntr: input.pendingIntr, // Stays asserted on line
      nextSingleStepPending: input.singleStepPending, // Stays pending for next boundary
    };
  }

  // 2. Second Priority: Maskable External Interrupt (INTR)
  // Requires IF=1 and that we are not in the single-instruction shadow following STI.
  if (input.pendingIntr && input.ifFlag === 1 && !input.stiShadowActive) {
    return {
      recognised: { kind: 'intr', vector: input.pendingIntr.vector, source: 'hardware-intr' },
      nextPendingNmi: false,
      nextPendingIntr: null, // Acknowledged: device releases line
      nextSingleStepPending: input.singleStepPending, // Stays pending
    };
  }

  // 3. Third Priority: Single-Step Debug Trap (TF)
  // Requires TF was 1 at start of completed instruction and not in STI shadow.
  if (input.singleStepPending && !input.stiShadowActive) {
    return {
      recognised: { kind: 'single-step', vector: 1, source: 'single-step-trap' },
      nextPendingNmi: false,
      nextPendingIntr: input.pendingIntr, // Stays asserted
      nextSingleStepPending: false, // Consumed
    };
  }

  // 4. None recognized: all pending lines remain unchanged
  return {
    recognised: null,
    nextPendingNmi: input.pendingNmi,
    nextPendingIntr: input.pendingIntr,
    nextSingleStepPending: input.singleStepPending,
  };
}

export interface EntrySequenceParams {
  readonly kind: InterruptKind;
  readonly vector: number;
  readonly source: InterruptSource;
  readonly currentSp: number;
  readonly currentFlags: ModeledFlags;
  readonly returnIp: number;
  readonly handlerIp: number;
  readonly readMemoryByte: (addr: number) => number;
}

export interface EntrySequenceResult {
  readonly microSteps: readonly InterruptMicroStep[];
  readonly record: InterruptRecord;
  readonly finalSp: number;
  readonly finalFlags: ModeledFlags;
}

/**
 * Builds the exact 5-stage architectural micro-step sequence for 8086 interrupt entry.
 */
export function buildEntrySequence(params: EntrySequenceParams): EntrySequenceResult {
  const {
    kind,
    vector,
    source,
    currentSp,
    currentFlags,
    returnIp,
    handlerIp,
    readMemoryByte,
  } = params;

  const microSteps: InterruptMicroStep[] = [];
  const flagsBefore = flagsToWord(currentFlags);

  // Micro-Step 1: Push FLAGS register word
  const sp1 = (currentSp - 2) & 0xffff;
  const flagsWord = flagsBefore;
  const flLow = flagsWord & 0xff;
  const flHigh = (flagsWord >> 8) & 0xff;
  microSteps.push({
    stepNumber: 1,
    kind: 'push-flags',
    description: `Push FLAGS (0x${flagsWord.toString(16).padStart(4, '0').toUpperCase()}) to stack at [0x${sp1.toString(16).padStart(4, '0').toUpperCase()}]`,
    registersChanged: [{ name: 'SP', old: currentSp, new: sp1 }],
    flagsChanged: [],
    memoryWrites: [
      { address: sp1, oldByte: readMemoryByte(sp1), newByte: flLow },
      { address: (sp1 + 1) & 0xffff, oldByte: readMemoryByte((sp1 + 1) & 0xffff), newByte: flHigh },
    ],
  });

  // Micro-Step 2: Clear IF and TF
  const flagChanges: MicroStepFlagChange[] = [];
  if (currentFlags.I !== 0) flagChanges.push({ name: 'I', old: currentFlags.I, new: 0 });
  if (currentFlags.T !== 0) flagChanges.push({ name: 'T', old: currentFlags.T, new: 0 });
  const finalFlags: ModeledFlags = { ...currentFlags, I: 0, T: 0 };
  const flagsAfter = flagsToWord(finalFlags);

  microSteps.push({
    stepNumber: 2,
    kind: 'clear-if-tf',
    description: 'Clear Interrupt Flag (IF=0) and Trap Flag (TF=0)',
    registersChanged: [],
    flagsChanged: flagChanges,
    memoryWrites: [],
  });

  // Micro-Step 3: Push CS (fixed 0x0000 in this model)
  const sp2 = (sp1 - 2) & 0xffff;
  microSteps.push({
    stepNumber: 3,
    kind: 'push-cs',
    description: `Push Code Segment CS (0x0000) to stack at [0x${sp2.toString(16).padStart(4, '0').toUpperCase()}]`,
    registersChanged: [{ name: 'SP', old: sp1, new: sp2 }],
    flagsChanged: [],
    memoryWrites: [
      { address: sp2, oldByte: readMemoryByte(sp2), newByte: 0x00 },
      { address: (sp2 + 1) & 0xffff, oldByte: readMemoryByte((sp2 + 1) & 0xffff), newByte: 0x00 },
    ],
  });

  // Micro-Step 4: Push Return IP
  const sp3 = (sp2 - 2) & 0xffff;
  const ipLow = returnIp & 0xff;
  const ipHigh = (returnIp >> 8) & 0xff;
  microSteps.push({
    stepNumber: 4,
    kind: 'push-ip',
    description: `Push Return IP (${returnIp}) to stack at [0x${sp3.toString(16).padStart(4, '0').toUpperCase()}]`,
    registersChanged: [{ name: 'SP', old: sp2, new: sp3 }],
    flagsChanged: [],
    memoryWrites: [
      { address: sp3, oldByte: readMemoryByte(sp3), newByte: ipLow },
      { address: (sp3 + 1) & 0xffff, oldByte: readMemoryByte((sp3 + 1) & 0xffff), newByte: ipHigh },
    ],
  });

  // Micro-Step 5: Read vector entry at n*4 into IP
  const vectorAddress = vector * 4;
  microSteps.push({
    stepNumber: 5,
    kind: 'read-vector',
    description: `Load vector ${vector} entry at [0x${vectorAddress.toString(16).padStart(4, '0').toUpperCase()}]: IP <- ${handlerIp}`,
    registersChanged: [{ name: 'IP', old: returnIp, new: handlerIp }],
    flagsChanged: [],
    memoryWrites: [],
  });

  const record: InterruptRecord = {
    kind,
    vector,
    source,
    flagsBefore,
    flagsAfter,
    returnIp,
    returnCs: 0x0000,
    vectorAddress,
    handlerIp,
    microSteps,
  };

  return {
    microSteps,
    record,
    finalSp: sp3,
    finalFlags,
  };
}
