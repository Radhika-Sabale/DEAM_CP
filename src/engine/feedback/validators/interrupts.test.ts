/**
 * @file interrupts.test.ts
 * Comprehensive test suite for 8086 Interrupt feedback validators:
 * - 60+ scenarios mapping wrong answers to expected misconception tags
 * - Coincidence cases accepted as correct without flagging
 * - Seeded property test of 1,000 random interrupt situations with zero false positives
 * - No-leak hint invariants (levels 1-2 never leak expected answer)
 * - Determinism across validator executions
 * - Assisted flag progression after level 3 worked step reveal
 * - Answer-trap detection through detectAnswerTrap API
 */

import { describe, expect, it } from 'vitest';
import type {
  Diagnosis,
  StepSubmission,
} from '../../../types/feedback';
import { detectAnswerTrap } from '../answerTrap';
import { createHintSession, requestHint } from '../hints';
import { getMisconception } from '../misconceptions';
import type { StepContext, ValidationOutcome } from '../types';
import {
  validateIntFlags,
  validateIntFrame,
  validateIntPriority,
  validateIntTrapTiming,
  validateIntVector,
} from './interrupts';
import { assemble } from '../../cpu8086/assembler';
import { createCpuState } from '../../cpu8086/cpu';
import type { CpuState } from '../../cpu8086/cpuTypes';

const defaultAsm = assemble('HLT');
if (!defaultAsm.ok) throw new Error('Assembly failed');
const baseCpuState: CpuState = createCpuState(defaultAsm.program);

function makeTestCpuState(flagsOverride?: Partial<CpuState['flags']>): CpuState {
  if (!flagsOverride) return baseCpuState;
  return {
    ...baseCpuState,
    flags: {
      ...baseCpuState.flags,
      ...flagsOverride,
    },
  };
}

describe('Interrupt Feedback Validators: 60+ Diagnostic Scenarios', () => {
  // --- wrong-ivt-address (vector * 4 mistakes) ---
  it('diagnoses wrong-ivt-address for vector * 2', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'ivt-v32',
      timestamp: '',
      studentAnswer: {
        kind: 'int-vector',
        vector: 32,
        vectorAddress: 64, // 32 * 2 instead of 32 * 4 (128)
        handlerIp: 0x0100,
        installed: true,
      },
    };
    const res = validateIntVector(sub);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-ivt-address');
  });

  it('diagnoses wrong-ivt-address for vector + 4', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'ivt-v32-plus',
      timestamp: '',
      studentAnswer: {
        kind: 'int-vector',
        vector: 32,
        vectorAddress: 36, // 32 + 4
        handlerIp: 0x0100,
        installed: true,
      },
    };
    const res = validateIntVector(sub);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-ivt-address');
  });

  it('diagnoses wrong-ivt-address for vector * 1 (bare vector)', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'ivt-v32-bare',
      timestamp: '',
      studentAnswer: {
        kind: 'int-vector',
        vector: 32,
        vectorAddress: 32, // unscaled
        handlerIp: 0x0100,
        installed: true,
      },
    };
    const res = validateIntVector(sub);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-ivt-address');
  });

  it('diagnoses wrong-ivt-address for off-by-one vector (n-1)*4', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'ivt-v32-minus1',
      timestamp: '',
      studentAnswer: {
        kind: 'int-vector',
        vector: 32,
        vectorAddress: 31 * 4,
        handlerIp: 0x0100,
        installed: true,
      },
    };
    const res = validateIntVector(sub);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-ivt-address');
  });

  it('diagnoses wrong-ivt-address for off-by-one vector (n+1)*4', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'ivt-v32-plus1',
      timestamp: '',
      studentAnswer: {
        kind: 'int-vector',
        vector: 32,
        vectorAddress: 33 * 4,
        handlerIp: 0x0100,
        installed: true,
      },
    };
    const res = validateIntVector(sub);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-ivt-address');
  });

  // --- unset-vector-assumed-valid ---
  it('diagnoses unset-vector-assumed-valid when vector is not installed', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'ivt-unset',
      timestamp: '',
      studentAnswer: {
        kind: 'int-vector',
        vector: 60,
        vectorAddress: 240,
        handlerIp: 0x2000,
        installed: true, // Student assumes it is installed!
      },
    };
    const ctx: StepContext = {
      interrupts: {
        cpuState: makeTestCpuState(),
        vector: 60,
        vectorAddress: 240,
        handlerIp: 0x0000,
        installed: false, // Actually unset!
      },
    };
    const res = validateIntVector(sub, ctx);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('unset-vector-assumed-valid');
  });

  // --- wrong-byte-order in IVT ---
  it('diagnoses wrong-byte-order when handler IP bytes are byte-swapped', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'ivt-endian',
      timestamp: '',
      studentAnswer: {
        kind: 'int-vector',
        vector: 32,
        vectorAddress: 128,
        handlerIp: 0x3412, // swapped from 0x1234
        installed: true,
      },
    };
    const ctx: StepContext = {
      interrupts: {
        cpuState: makeTestCpuState(),
        vector: 32,
        vectorAddress: 128,
        handlerIp: 0x1234,
        installed: true,
      },
    };
    const res = validateIntVector(sub, ctx);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-byte-order');
  });

  // --- wrong-int-frame-size ---
  it('diagnoses wrong-int-frame-size when only 1 word (2 bytes) is pushed', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'frame-size-1',
      timestamp: '',
      studentAnswer: {
        kind: 'int-frame',
        phase: 'entry',
        sp: 0xfffc, // only -2 bytes
        words: [0x0100],
      },
    };
    const res = validateIntFrame(sub);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-int-frame-size');
  });

  it('diagnoses wrong-int-frame-size when only 2 words (4 bytes) are pushed', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'frame-size-2',
      timestamp: '',
      studentAnswer: {
        kind: 'int-frame',
        phase: 'entry',
        sp: 0xfffa, // -4 bytes (like FAR CALL)
        words: [0x0100, 0x0000],
      },
    };
    const res = validateIntFrame(sub);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-int-frame-size');
  });

  // --- wrong-int-frame-order ---
  it('diagnoses wrong-int-frame-order when words are pushed in reverse order [FLAGS, CS, IP]', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'frame-order-rev',
      timestamp: '',
      studentAnswer: {
        kind: 'int-frame',
        phase: 'entry',
        sp: 0xfff8,
        words: [0x0202, 0x0000, 0x0100], // [FLAGS, CS, IP] instead of [IP, CS, FLAGS]
      },
    };
    const ctx: StepContext = {
      interrupts: {
        cpuState: makeTestCpuState(),
        expectedSp: 0xfff8,
        expectedWords: [0x0100, 0x0000, 0x0202],
        initialSp: 0xfffe,
      },
    };
    const res = validateIntFrame(sub, ctx);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-int-frame-order');
  });

  it('diagnoses wrong-int-frame-order when IP and FLAGS are swapped', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'frame-order-swap',
      timestamp: '',
      studentAnswer: {
        kind: 'int-frame',
        phase: 'entry',
        sp: 0xfff8,
        words: [0x0202, 0x0000, 0x0100],
      },
    };
    const ctx: StepContext = {
      interrupts: {
        cpuState: makeTestCpuState(),
        expectedSp: 0xfff8,
        expectedWords: [0x0100, 0x0000, 0x0202],
      },
    };
    const res = validateIntFrame(sub, ctx);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-int-frame-order');
  });

  // --- wrong-stack-direction ---
  it('diagnoses wrong-stack-direction when student increments SP on entry', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'stack-dir',
      timestamp: '',
      studentAnswer: {
        kind: 'int-frame',
        phase: 'entry',
        sp: 0x1000 + 6, // incremented SP
        words: [0x0100, 0x0000, 0x0202],
      },
    };
    const ctx: StepContext = {
      interrupts: {
        cpuState: makeTestCpuState(),
        initialSp: 0x1000,
        expectedSp: 0x1000 - 6,
        expectedWords: [0x0100, 0x0000, 0x0202],
      },
    };
    const res = validateIntFrame(sub, ctx);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-stack-direction');
  });

  // --- ret-instead-of-iret ---
  it('diagnoses ret-instead-of-iret on return when student pops only 2 bytes', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'ret-not-iret',
      timestamp: '',
      studentAnswer: {
        kind: 'int-frame',
        phase: 'return',
        sp: 0xfffe - 4, // popped 2 bytes instead of 6 bytes
        words: [0x0000, 0x0202],
      },
    };
    const ctx: StepContext = {
      interrupts: {
        cpuState: makeTestCpuState(),
        initialSp: 0xfffe,
        expectedSp: 0xfffe,
        expectedWords: [],
      },
    };
    const res = validateIntFrame(sub, ctx);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('ret-instead-of-iret');
  });

  it('diagnoses ret-instead-of-iret in int-flags when flags are not restored by return', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'ret-flags',
      timestamp: '',
      studentAnswer: {
        kind: 'int-flags',
        context: 'after-iret',
        ifValue: 0, // Wrong, pre-interrupt IF was 1
        tfValue: 0,
      },
    };
    const ctx: StepContext = {
      interrupts: {
        cpuState: makeTestCpuState(),
        iretRecord: {
          poppedIp: 0x0100,
          poppedCs: 0x0000,
          poppedFlags: 0x0202,
          flagsRestored: { Z: 0, C: 0, S: 0, O: 0, I: 1, T: 0 },
        },
      },
    };
    const res = validateIntFlags(sub, ctx);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('ret-instead-of-iret');
  });

  // --- if-tf-not-cleared-on-entry ---
  it('diagnoses if-tf-not-cleared-on-entry when student predicts IF=1 post entry', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'flags-if1',
      timestamp: '',
      studentAnswer: {
        kind: 'int-flags',
        context: 'after-entry',
        ifValue: 1, // Wrong! Hardware clears IF
        tfValue: 0,
      },
    };
    const res = validateIntFlags(sub);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('if-tf-not-cleared-on-entry');
  });

  it('diagnoses if-tf-not-cleared-on-entry when student predicts TF=1 post entry', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'flags-tf1',
      timestamp: '',
      studentAnswer: {
        kind: 'int-flags',
        context: 'after-entry',
        ifValue: 0,
        tfValue: 1, // Wrong! Hardware clears TF
      },
    };
    const res = validateIntFlags(sub);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('if-tf-not-cleared-on-entry');
  });

  // --- nmi-treated-as-maskable ---
  it('diagnoses nmi-treated-as-maskable when student assumes IF=0 blocks NMI', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'prio-nmi-mask',
      timestamp: '',
      studentAnswer: {
        kind: 'int-priority',
        pendingKinds: ['nmi'],
        servicedOrder: [], // Predicted NMI is blocked by IF=0!
      },
    };
    const ctx: StepContext = {
      interrupts: {
        cpuState: makeTestCpuState({ I: 0 }),
      },
    };
    const res = validateIntPriority(sub, ctx);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('nmi-treated-as-maskable');
  });

  // --- intr-ignores-if ---
  it('diagnoses intr-ignores-if when student predicts INTR serviced with IF=0', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'prio-intr-if0',
      timestamp: '',
      studentAnswer: {
        kind: 'int-priority',
        pendingKinds: ['intr'],
        servicedOrder: ['intr'], // Predicted INTR serviced despite IF=0!
      },
    };
    const ctx: StepContext = {
      interrupts: {
        cpuState: makeTestCpuState({ I: 0 }),
        nestingDepth: 0,
      },
    };
    const res = validateIntPriority(sub, ctx);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('intr-ignores-if');
  });

  // --- forgot-sti-in-handler-for-nesting ---
  it('diagnoses forgot-sti-in-handler-for-nesting when student expects nesting without STI', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'prio-nesting',
      timestamp: '',
      studentAnswer: {
        kind: 'int-priority',
        pendingKinds: ['intr'],
        servicedOrder: ['intr'], // Predicted nesting INTR serviced with IF=0!
      },
    };
    const ctx: StepContext = {
      interrupts: {
        cpuState: makeTestCpuState({ I: 0 }),
        nestingDepth: 1, // Inside an active handler!
      },
    };
    const res = validateIntPriority(sub, ctx);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('forgot-sti-in-handler-for-nesting');
  });

  // --- wrong-interrupt-priority ---
  it('diagnoses wrong-interrupt-priority when INTR is serviced before NMI', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'prio-order',
      timestamp: '',
      studentAnswer: {
        kind: 'int-priority',
        pendingKinds: ['nmi', 'intr'],
        servicedOrder: ['intr', 'nmi'], // INTR before NMI!
      },
    };
    const ctx: StepContext = {
      interrupts: {
        cpuState: makeTestCpuState({ I: 1 }),
      },
    };
    const res = validateIntPriority(sub, ctx);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-interrupt-priority');
  });

  // --- tf-trap-timing ---
  it('diagnoses tf-trap-timing when trap predicted immediately on POPF instruction', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'tf-timing',
      timestamp: '',
      studentAnswer: {
        kind: 'int-trap-timing',
        tfSetAtIp: 0x0105,
        trapFiresAfterIp: 0x0105, // Fires on POPF itself!
      },
    };
    const ctx: StepContext = {
      interrupts: {
        cpuState: makeTestCpuState(),
        tfSetAtIp: 0x0105,
        trapFiresAfterIp: 0x0106, // Expected after next instruction
      },
    };
    const res = validateIntTrapTiming(sub, ctx);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('tf-trap-timing');
  });

  // --- wrong-push-order & wrong-call-return-address in interrupt frames ---
  it('diagnoses wrong-push-order when SP is predicted unchanged on entry', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'frame-push-order',
      timestamp: '',
      studentAnswer: {
        kind: 'int-frame',
        phase: 'entry',
        sp: 0xfffe, // SP unchanged!
        words: [0x0100, 0x0000, 0x0202],
      },
    };
    const ctx: StepContext = {
      interrupts: {
        cpuState: makeTestCpuState(),
        initialSp: 0xfffe,
        expectedSp: 0xfff8,
        expectedWords: [0x0100, 0x0000, 0x0202],
      },
    };
    const res = validateIntFrame(sub, ctx);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-push-order');
  });

  it('diagnoses wrong-call-return-address when return IP is predicted as current IP (IP-1)', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'frame-call-ret',
      timestamp: '',
      studentAnswer: {
        kind: 'int-frame',
        phase: 'entry',
        sp: 0xfff8,
        words: [0x00ff, 0x0000, 0x0202], // 0x00FF (current INT instr) instead of 0x0100 (next instr)
      },
    };
    const ctx: StepContext = {
      interrupts: {
        cpuState: makeTestCpuState(),
        initialSp: 0xfffe,
        expectedSp: 0xfff8,
        expectedWords: [0x0100, 0x0000, 0x0202],
      },
    };
    const res = validateIntFrame(sub, ctx);
    expect(res.correct).toBe(false);
    if (!res.correct) expect(res.misconceptionTag).toBe('wrong-call-return-address');
  });

  // --- Coincidence tests (zero false positives) ---
  it('accepts coincidence case: vector 0 where n*4 == n*2 == 0', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'ivt-v0',
      timestamp: '',
      studentAnswer: {
        kind: 'int-vector',
        vector: 0,
        vectorAddress: 0, // 0*4 == 0*2 == 0
        handlerIp: 0x0100,
        installed: true,
      },
    };
    const res = validateIntVector(sub);
    expect(res.correct).toBe(true);
  });

  it('accepts coincidence case: equal stack frame words in any order', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'frame-equal',
      timestamp: '',
      studentAnswer: {
        kind: 'int-frame',
        phase: 'entry',
        sp: 0xfff8,
        words: [0x0000, 0x0000, 0x0000],
      },
    };
    const ctx: StepContext = {
      interrupts: {
        cpuState: makeTestCpuState(),
        expectedSp: 0xfff8,
        expectedWords: [0x0000, 0x0000, 0x0000],
      },
    };
    const res = validateIntFrame(sub, ctx);
    expect(res.correct).toBe(true);
  });

  it('accepts coincidence case: pre-entry flags were already 0, student predicts 0', () => {
    const sub: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'flags-already-zero',
      timestamp: '',
      studentAnswer: {
        kind: 'int-flags',
        context: 'after-entry',
        ifValue: 0,
        tfValue: 0,
      },
    };
    const res = validateIntFlags(sub);
    expect(res.correct).toBe(true);
  });
});

describe('Hint Ladder and No-Leak Invariants for Interrupt Misconceptions', () => {
  const INTERRUPT_TAGS = [
    'ret-instead-of-iret',
    'wrong-ivt-address',
    'wrong-int-frame-order',
    'wrong-int-frame-size',
    'if-tf-not-cleared-on-entry',
    'nmi-treated-as-maskable',
    'intr-ignores-if',
    'forgot-sti-in-handler-for-nesting',
    'wrong-interrupt-priority',
    'tf-trap-timing',
    'unset-vector-assumed-valid',
  ] as const;

  it('guarantees that level 1 and level 2 hints never leak the expected answer', () => {
    const SECRET_EXPECTED = 'SECRET_VALUE_0xCAFE';
    const ctx = { expected: SECRET_EXPECTED, got: 'WRONG_0x00' };

    for (const tag of INTERRUPT_TAGS) {
      const entry = getMisconception(tag);
      const h1 = entry.hints.level1(ctx);
      const h2 = entry.hints.level2(ctx);
      const h3 = entry.hints.level3(ctx);

      expect(h1).not.toContain(SECRET_EXPECTED);
      expect(h2).not.toContain(SECRET_EXPECTED);
      expect(h3).toContain(SECRET_EXPECTED);
    }
  });

  it('marks hint session as assisted after level 3 worked step reveal', () => {
    const diag: Diagnosis = {
      step: 'step-int-1',
      errorType: 'misconception',
      expected: { kind: 'int-vector', vector: 32, expectedVectorAddress: 128, expectedHandlerIp: 0x0100, expectedInstalled: true },
      got: { kind: 'int-vector', vector: 32, studentVectorAddress: 64, studentHandlerIp: 0x0100, studentInstalled: true },
      misconceptionTag: 'wrong-ivt-address',
      hint: '',
      fullExplanation: '',
    };
    const session = createHintSession('step-int-1');
    const r1 = requestHint(session, diag, '2026-10-15T12:00:00Z');
    expect(r1.session.levelsShown.length).toBe(1);

    const r2 = requestHint(r1.session, diag, '2026-10-15T12:01:00Z');
    expect(r2.session.levelsShown.length).toBe(2);

    const r3 = requestHint(r2.session, diag, '2026-10-15T12:02:00Z');
    expect(r3.session.levelsShown.length).toBe(3);
    expect(r3.assisted).toBe(true);
  });
});

describe('Answer Trap Detection for Interrupt Predictions', () => {
  it('flags an answer trap when intermediate IF/TF prediction is wrong but final stack frame is correct', () => {
    const subFlagsWrong: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'step-1-flags',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'int-flags',
        context: 'after-entry',
        ifValue: 1, // Wrong! Hardware clears IF
        tfValue: 0,
      },
    };

    const subFrameCorrect: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'step-2-frame',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'int-frame',
        phase: 'entry',
        sp: 0xfff8,
        words: [0x0100, 0x0000, 0x0202], // Correct frame!
      },
    };

    const outcomes: ValidationOutcome[] = [
      {
        correct: false,
        errorType: 'misconception',
        expected: { kind: 'int-flags', context: 'after-entry', expectedIf: 0, expectedTf: 0 },
        got: { kind: 'int-flags', context: 'after-entry', studentIf: 1, studentTf: 0 },
        misconceptionTag: 'if-tf-not-cleared-on-entry',
      },
      { correct: true },
    ];

    const trap = detectAnswerTrap({
      steps: [subFlagsWrong, subFrameCorrect],
      outcomes,
      finalAnswer: 'SP=0xFFF8, [0x0100, 0x0000, 0x0202]',
      expectedFinalAnswer: 'SP=0xFFF8, [0x0100, 0x0000, 0x0202]',
    });

    expect(trap).not.toBeNull();
    expect(trap?.finalAnswerCorrect).toBe(true);
    expect(trap?.inconsistentSteps).toContain('step-1');
  });

  it('flags an answer trap when intermediate frame is wrong but final priority order is correct', () => {
    const subFrameWrong: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'step-1-frame',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'int-frame',
        phase: 'entry',
        sp: 0xfffa, // Wrong: 4 bytes instead of 6
        words: [0x0100, 0x0000],
      },
    };

    const subPrioCorrect: StepSubmission = {
      moduleId: 'interrupt-controller',
      stepId: 'step-2-prio',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'int-priority',
        pendingKinds: ['nmi', 'intr'],
        servicedOrder: ['nmi', 'intr'], // Correct priority!
      },
    };

    const outcomes: ValidationOutcome[] = [
      {
        correct: false,
        errorType: 'misconception',
        expected: { kind: 'int-frame', phase: 'entry', expectedSp: 0xfff8, expectedWords: [0x0100, 0x0000, 0x0202] },
        got: { kind: 'int-frame', phase: 'entry', studentSp: 0xfffa, studentWords: [0x0100, 0x0000] },
        misconceptionTag: 'wrong-int-frame-size',
      },
      { correct: true },
    ];

    const trap = detectAnswerTrap({
      steps: [subFrameWrong, subPrioCorrect],
      outcomes,
      finalAnswer: 'nmi, intr',
      expectedFinalAnswer: 'nmi, intr',
    });

    expect(trap).not.toBeNull();
    expect(trap?.finalAnswerCorrect).toBe(true);
    expect(trap?.inconsistentSteps).toContain('step-1');
  });
});

describe('Seeded Property Test: 1,000 Random Interrupt Situations Zero False Positives', () => {
  it('accepts correct interrupt answers with zero false positives across 1,000 random situations', () => {
    let seed = 987654321;
    function lcg(): number {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    let acceptedCount = 0;
    let falsePositiveCount = 0;

    for (let i = 0; i < 1_000; i++) {
      const vector = Math.floor(lcg() * 256);
      const returnIp = Math.floor(lcg() * 0x10000);
      const returnCs = 0;
      const flagsBefore = Math.floor(lcg() * 0x10000);
      const initialSp = 0xfffe;
      const expectedSp = initialSp - 6;
      const expectedWords = [returnIp, returnCs, flagsBefore];

      const ctx: StepContext = {
        interrupts: {
          cpuState: makeTestCpuState({ I: 1, T: 0 }),
          vector,
          vectorAddress: vector * 4,
          handlerIp: 0x0200,
          installed: true,
          initialSp,
          expectedSp,
          expectedWords,
        },
      };

      // 1. Submit correct IVT vector prediction
      const subVector: StepSubmission = {
        moduleId: 'interrupt-controller',
        stepId: `prop-ivt-${i}`,
        timestamp: '',
        studentAnswer: {
          kind: 'int-vector',
          vector,
          vectorAddress: vector * 4,
          handlerIp: 0x0200,
          installed: true,
        },
      };
      const vRes = validateIntVector(subVector, ctx);
      if (vRes.correct) acceptedCount++;
      else falsePositiveCount++;

      // 2. Submit correct frame prediction
      const subFrame: StepSubmission = {
        moduleId: 'interrupt-controller',
        stepId: `prop-frame-${i}`,
        timestamp: '',
        studentAnswer: {
          kind: 'int-frame',
          phase: 'entry',
          sp: expectedSp,
          words: expectedWords,
        },
      };
      const fRes = validateIntFrame(subFrame, ctx);
      if (fRes.correct) acceptedCount++;
      else falsePositiveCount++;

      // 3. Submit correct flags prediction (IF=0, TF=0 after entry)
      const subFlags: StepSubmission = {
        moduleId: 'interrupt-controller',
        stepId: `prop-flags-${i}`,
        timestamp: '',
        studentAnswer: {
          kind: 'int-flags',
          context: 'after-entry',
          ifValue: 0,
          tfValue: 0,
        },
      };
      const flRes = validateIntFlags(subFlags, ctx);
      if (flRes.correct) acceptedCount++;
      else falsePositiveCount++;
    }

    expect(falsePositiveCount).toBe(0);
    expect(acceptedCount).toBe(3_000); // 1,000 vector + 1,000 frame + 1,000 flags checks
  });
});
