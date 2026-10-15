/**
 * @file interrupts.ts
 * Deterministic feedback validators and cognitive misconception matchers
 * for the 8086 Interrupt Controller and Subsystem module (Stage 15B).
 *
 * Validates:
 * - 'int-vector': IVT address calculation (vector * 4), installed handler check
 * - 'int-frame': stack words and SP following entry or IRET
 * - 'int-flags': IF and TF values post-entry and post-IRET
 * - 'int-priority': servicing arbitration among pending interrupts
 * - 'int-trap-timing': single-step trap instruction boundary timing
 */

import type {
  IntFlagsAnswer,
  IntFrameAnswer,
  IntPriorityAnswer,
  IntTrapTimingAnswer,
  IntVectorAnswer,
  MisconceptionTag,
  StepSubmission,
} from '../../../types/feedback';
import { registerValidator } from '../validatorRegistry';
import type { StepContext, ValidationOutcome } from '../types';

function arraysEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isPermutation(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return arraysEqual(sortedA, sortedB);
}

function swap16(val: number): number {
  return (((val & 0xff) << 8) | ((val >> 8) & 0xff)) & 0xffff;
}

/**
 * Validates an interrupt vector table lookup prediction.
 */
export function validateIntVector(
  sub: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (sub.studentAnswer.kind !== 'int-vector') {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: {
        kind: 'int-vector',
        vector: 0,
        expectedVectorAddress: 0,
        expectedHandlerIp: 0,
        expectedInstalled: true,
      },
      got: {
        kind: 'int-vector',
        vector: 0,
        studentVectorAddress: 0,
        studentHandlerIp: 0,
        studentInstalled: false,
      },
    };
  }

  const ans = sub.studentAnswer as IntVectorAnswer;
  const ctx = context?.interrupts;
  const vector = ans.vector;
  const expectedAddr = ctx?.vectorAddress ?? vector * 4;
  const expectedInstalled = ctx?.installed ?? true;
  const expectedHandlerIp = ctx?.handlerIp ?? (expectedInstalled ? 0x0100 : 0x0000);

  const isAddrCorrect = ans.vectorAddress === expectedAddr;
  const isInstalledCorrect = ans.installed === expectedInstalled;
  const isIpCorrect = !expectedInstalled || ans.handlerIp === expectedHandlerIp;

  if (isAddrCorrect && isInstalledCorrect && isIpCorrect) {
    return { correct: true };
  }

  let tag: MisconceptionTag = 'other';
  let details = `Expected vector ${vector} address 0x${expectedAddr.toString(16).toUpperCase()}, got 0x${ans.vectorAddress.toString(16).toUpperCase()}.`;

  // 1. Unset vector assumed valid
  if (!expectedInstalled && ans.installed) {
    tag = 'unset-vector-assumed-valid';
    details = `Vector ${vector} has not been installed in the IVT (holds 0x0000:0x0000); execution cannot proceed normally.`;
  }
  // 2. Wrong byte order in IVT lookup
  else if (ans.handlerIp !== expectedHandlerIp && ans.handlerIp === swap16(expectedHandlerIp)) {
    tag = 'wrong-byte-order';
    details = `Vector word at IVT address is stored in little-endian order (low byte at lower address).`;
  }
  // 3. Wrong IVT address calculations
  else if (!isAddrCorrect) {
    const wrongOffsets = [
      vector * 2,
      vector + 4,
      vector,
      vector > 0 ? (vector - 1) * 4 : -1,
      (vector + 1) * 4,
    ];
    if (wrongOffsets.includes(ans.vectorAddress) && ans.vectorAddress !== expectedAddr) {
      tag = 'wrong-ivt-address';
      details = `Each 8086 IVT entry is 4 bytes (2 bytes IP, 2 bytes CS); vector address is vector * 4.`;
    }
  }

  return {
    correct: false,
    errorType: 'misconception',
    expected: {
      kind: 'int-vector',
      vector,
      expectedVectorAddress: expectedAddr,
      expectedHandlerIp: expectedHandlerIp,
      expectedInstalled: expectedInstalled,
    },
    got: {
      kind: 'int-vector',
      vector,
      studentVectorAddress: ans.vectorAddress,
      studentHandlerIp: ans.handlerIp,
      studentInstalled: ans.installed,
      studentReasoning: ans.reasoning,
    },
    misconceptionTag: tag,
    details,
  };
}

/**
 * Validates an interrupt stack frame prediction on entry or IRET.
 */
export function validateIntFrame(
  sub: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (sub.studentAnswer.kind !== 'int-frame') {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: {
        kind: 'int-frame',
        phase: 'entry',
        expectedSp: 0xfff8,
        expectedWords: [0x0100, 0x0000, 0x0002],
      },
      got: {
        kind: 'int-frame',
        phase: 'entry',
        studentSp: 0,
        studentWords: [],
      },
    };
  }

  const ans = sub.studentAnswer as IntFrameAnswer;
  const ctx = context?.interrupts;
  const initialSp = ctx?.initialSp ?? 0xfffe;

  // Defaults for entry: [IP, CS, FLAGS]
  const expectedSp =
    ans.phase === 'entry' ? (ctx?.expectedSp ?? initialSp - 6) : (ctx?.expectedSp ?? initialSp);
  const expectedWords =
    ans.phase === 'entry'
      ? (ctx?.expectedWords ?? [
          ctx?.record?.returnIp ?? 0x0100,
          ctx?.record?.returnCs ?? 0x0000,
          ctx?.record?.flagsBefore ?? 0x0202,
        ])
      : (ctx?.expectedWords ?? []);

  const isSpCorrect = ans.sp === expectedSp;
  const areWordsCorrect = arraysEqual(ans.words, expectedWords);

  if (isSpCorrect && areWordsCorrect) {
    return { correct: true };
  }

  let tag: MisconceptionTag = 'other';
  let details = `Expected stack SP=0x${expectedSp.toString(16).toUpperCase()}, words=[${expectedWords.map((w) => '0x' + w.toString(16).toUpperCase()).join(', ')}].`;

  // 1. Returning from interrupt with RET instead of IRET
  if (ans.phase === 'return') {
    // If popped only 2 bytes instead of 6
    if (ans.sp === initialSp - 4 || ans.words.length === 2) {
      tag = 'ret-instead-of-iret';
      details = `Standard RET pops only IP (2 bytes), leaving CS and saved FLAGS on the stack. IRET must pop all 6 bytes.`;
    }
  } else {
    // Phase === 'entry'
    // 2. Inverted stack growth direction
    if (ans.sp === initialSp + 6) {
      tag = 'wrong-stack-direction';
      details = `8086 stack grows downward toward lower memory; PUSH subtracts from SP.`;
    }
    // 3. Wrong frame size (forgot FLAGS or CS)
    else if (ans.words.length !== 3 || ans.sp === initialSp - 2 || ans.sp === initialSp - 4) {
      tag = 'wrong-int-frame-size';
      details = `An 8086 interrupt frame is 6 bytes (3 words: FLAGS, CS, IP). It is not 2 or 4 bytes like CALL.`;
    }
    // 4. Wrong frame order (permutation of expected words)
    else if (isPermutation(ans.words, expectedWords) && !areWordsCorrect) {
      tag = 'wrong-int-frame-order';
      details = `8086 hardware pushes FLAGS first, then CS, then IP. At top of stack (SP) is return IP, followed by CS and FLAGS.`;
    }
    // 5. SP write before decrement or SP unchanged
    else if (ans.sp === initialSp) {
      tag = 'wrong-push-order';
      details = `On PUSH, 8086 decrements SP before writing the word to memory.`;
    }
    // 6. Return address is current IP or 0
    else if (
      expectedWords.length === 3 &&
      expectedWords[0] !== undefined &&
      (ans.words[0] === (expectedWords[0] - 1) || ans.words[0] === 0)
    ) {
      tag = 'wrong-call-return-address';
      details = `Interrupt entry pushes the address of the next sequential instruction (IP + 1) as return IP.`;
    }
  }

  return {
    correct: false,
    errorType: 'misconception',
    expected: {
      kind: 'int-frame',
      phase: ans.phase,
      expectedSp,
      expectedWords,
    },
    got: {
      kind: 'int-frame',
      phase: ans.phase,
      studentSp: ans.sp,
      studentWords: ans.words,
      studentReasoning: ans.reasoning,
    },
    misconceptionTag: tag,
    details,
  };
}

/**
 * Validates post-interrupt-entry or post-IRET status flags (IF and TF).
 */
export function validateIntFlags(
  sub: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (sub.studentAnswer.kind !== 'int-flags') {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: { kind: 'int-flags', context: 'after-entry', expectedIf: 0, expectedTf: 0 },
      got: { kind: 'int-flags', context: 'after-entry', studentIf: 0, studentTf: 0 },
    };
  }

  const ans = sub.studentAnswer as IntFlagsAnswer;
  const ctx = context?.interrupts;

  const expectedIf: 0 | 1 =
    ans.context === 'after-entry' ? 0 : (ctx?.iretRecord?.flagsRestored.I ?? 1);
  const expectedTf: 0 | 1 =
    ans.context === 'after-entry' ? 0 : (ctx?.iretRecord?.flagsRestored.T ?? 0);

  if (ans.ifValue === expectedIf && ans.tfValue === expectedTf) {
    return { correct: true };
  }

  let tag: MisconceptionTag = 'other';
  let details = `Expected flags IF=${expectedIf}, TF=${expectedTf}; got IF=${ans.ifValue}, TF=${ans.tfValue}.`;

  if (ans.context === 'after-entry') {
    if (ans.ifValue === 1 || ans.tfValue === 1) {
      tag = 'if-tf-not-cleared-on-entry';
      details = `8086 hardware automatically clears both IF and TF to 0 upon entering an interrupt service routine.`;
    }
  } else if (ans.context === 'after-iret') {
    if (ans.ifValue !== expectedIf || ans.tfValue !== expectedTf) {
      tag = 'ret-instead-of-iret';
      details = `IRET pops saved flags from the stack, restoring IF and TF to their pre-interrupt values.`;
    }
  }

  return {
    correct: false,
    errorType: 'misconception',
    expected: {
      kind: 'int-flags',
      context: ans.context,
      expectedIf,
      expectedTf,
    },
    got: {
      kind: 'int-flags',
      context: ans.context,
      studentIf: ans.ifValue,
      studentTf: ans.tfValue,
      studentReasoning: ans.reasoning,
    },
    misconceptionTag: tag,
    details,
  };
}

/**
 * Validates servicing arbitration order among pending interrupts.
 */
export function validateIntPriority(
  sub: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (sub.studentAnswer.kind !== 'int-priority') {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: {
        kind: 'int-priority',
        pendingKinds: ['nmi', 'intr'],
        expectedServicedOrder: ['nmi'],
      },
      got: {
        kind: 'int-priority',
        pendingKinds: ['nmi', 'intr'],
        studentServicedOrder: [],
      },
    };
  }

  const ans = sub.studentAnswer as IntPriorityAnswer;
  const ctx = context?.interrupts;
  const cpuState = ctx?.cpuState;
  const ifFlag = cpuState?.flags.I ?? 1;
  const nestingDepth = ctx?.nestingDepth ?? 0;

  // Determine expected serviced order from pending kinds & IF state
  // 8086 arbitration: single-step > software > nmi > intr (if IF=1)
  const expectedServicedOrder: ('nmi' | 'intr' | 'software' | 'single-step')[] = [];
  if (ans.pendingKinds.includes('single-step')) expectedServicedOrder.push('single-step');
  if (ans.pendingKinds.includes('software')) expectedServicedOrder.push('software');
  if (ans.pendingKinds.includes('nmi')) expectedServicedOrder.push('nmi');
  if (ans.pendingKinds.includes('intr') && ifFlag === 1) expectedServicedOrder.push('intr');

  if (arraysEqual(ans.servicedOrder, expectedServicedOrder)) {
    return { correct: true };
  }

  let tag: MisconceptionTag = 'other';
  let details = `Expected servicing order [${expectedServicedOrder.join(', ')}], received [${ans.servicedOrder.join(', ')}].`;

  // 1. NMI treated as maskable (IF=0 thought to block NMI)
  if (ans.pendingKinds.includes('nmi') && !ans.servicedOrder.includes('nmi')) {
    tag = 'nmi-treated-as-maskable';
    details = `Non-Maskable Interrupts (NMI) are edge-triggered and cannot be blocked by clearing IF (IF=0).`;
  }
  // 2. INTR serviced while IF=0
  else if (ifFlag === 0 && ans.pendingKinds.includes('intr') && ans.servicedOrder.includes('intr')) {
    if (nestingDepth >= 1) {
      tag = 'forgot-sti-in-handler-for-nesting';
      details = `Because interrupt entry automatically clears IF, an ISR cannot be nested by INTR without an explicit STI.`;
    } else {
      tag = 'intr-ignores-if';
      details = `Maskable interrupts (INTR) are blocked when IF = 0 and remain pending until IF becomes 1.`;
    }
  }
  // 3. Wrong interrupt priority (e.g. INTR serviced before NMI)
  else if (
    ans.servicedOrder.length >= 2 &&
    ans.servicedOrder[0] === 'intr' &&
    ans.servicedOrder[1] === 'nmi' &&
    expectedServicedOrder.includes('nmi')
  ) {
    tag = 'wrong-interrupt-priority';
    details = `Hardware NMI has higher priority than maskable INTR and must be serviced first.`;
  }

  return {
    correct: false,
    errorType: 'misconception',
    expected: {
      kind: 'int-priority',
      pendingKinds: ans.pendingKinds,
      expectedServicedOrder,
    },
    got: {
      kind: 'int-priority',
      pendingKinds: ans.pendingKinds,
      studentServicedOrder: ans.servicedOrder,
      studentReasoning: ans.reasoning,
    },
    misconceptionTag: tag,
    details,
  };
}

/**
 * Validates instruction boundary timing for single-step traps.
 */
export function validateIntTrapTiming(
  sub: StepSubmission,
  context?: StepContext
): ValidationOutcome {
  if (sub.studentAnswer.kind !== 'int-trap-timing') {
    return {
      correct: false,
      errorType: 'arithmetic-error',
      expected: { kind: 'int-trap-timing', tfSetAtIp: 0, expectedTrapFiresAfterIp: 1 },
      got: { kind: 'int-trap-timing', tfSetAtIp: 0, studentTrapFiresAfterIp: 0 },
    };
  }

  const ans = sub.studentAnswer as IntTrapTimingAnswer;
  const ctx = context?.interrupts;
  const tfSetAtIp = ctx?.tfSetAtIp ?? ans.tfSetAtIp;
  const expectedTrapFiresAfterIp = ctx?.trapFiresAfterIp ?? tfSetAtIp + 1;

  if (ans.trapFiresAfterIp === expectedTrapFiresAfterIp) {
    return { correct: true };
  }

  let tag: MisconceptionTag = 'other';
  let details = `Expected trap to fire after instruction at IP=${expectedTrapFiresAfterIp}, got IP=${ans.trapFiresAfterIp}.`;

  // Trap predicted immediately on POPF itself
  if (ans.trapFiresAfterIp === tfSetAtIp) {
    tag = 'tf-trap-timing';
    details = `Setting TF with POPF does not trap on POPF itself; the trap fires after the subsequent instruction finishes.`;
  }

  return {
    correct: false,
    errorType: 'misconception',
    expected: {
      kind: 'int-trap-timing',
      tfSetAtIp,
      expectedTrapFiresAfterIp,
    },
    got: {
      kind: 'int-trap-timing',
      tfSetAtIp,
      studentTrapFiresAfterIp: ans.trapFiresAfterIp,
      studentReasoning: ans.reasoning,
    },
    misconceptionTag: tag,
    details,
  };
}

// Automatic Registration with validatorRegistry
const INTERRUPT_VALIDATORS = [
  ['int-vector', validateIntVector],
  ['int-frame', validateIntFrame],
  ['int-flags', validateIntFlags],
  ['int-priority', validateIntPriority],
  ['int-trap-timing', validateIntTrapTiming],
] as const;

for (const [kind, fn] of INTERRUPT_VALIDATORS) {
  try {
    registerValidator(kind, fn);
  } catch {
    // Ignore duplicate registrations in case of module re-import
  }
}
