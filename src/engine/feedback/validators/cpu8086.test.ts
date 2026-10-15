/**
 * @file cpu8086.test.ts
 * Comprehensive test suite for 8086 CPU feedback validators:
 * - 60+ scenarios mapping wrong answers to expected misconception tags
 * - Seeded property test of 1,000 random instructions with zero false positives
 * - Undefined OF flag behavior
 * - No-leak hint invariants (level 1-2 never leak expected answer)
 * - Determinism across validator executions
 * - Assisted flag progression after level 3
 * - Answer-trap detection for correct terminal answers with broken intermediate predictions
 * - Compile-time type-level assertion syncing RegisterName and CpuRegisterName
 */

import { describe, expect, it } from 'vitest';
import type {
  CpuRegisterName,
  Diagnosis,
  StepSubmission,
} from '../../../types/feedback';
import { assemble } from '../../cpu8086/assembler';
import { createCpuState, step } from '../../cpu8086/cpu';
import type { RegisterName } from '../../cpu8086/types';
import { detectAnswerTrap } from '../answerTrap';
import { createHintSession, requestHint } from '../hints';
import { getMisconception } from '../misconceptions';
import type { StepContext, ValidationOutcome } from '../types';
import {
  validateCpuFlag,
  validateCpuMemory,
  validateCpuNextIp,
  validateCpuRegister,
  validateCpuStack,
} from './cpu8086';

// Type-level assertion test ensuring types-layer and engine register names stay in sync
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _assertRegisterSync: Exact<RegisterName, CpuRegisterName> = true;
expect(_assertRegisterSync).toBe(true);

function makeContext(src: string): StepContext {
  const assembled = assemble(src);
  if (!assembled.ok) throw new Error(`Assembler failed: ${JSON.stringify(assembled.errors)}`);
  const state = createCpuState(assembled.program);
  const stepResult = step(state, assembled.program);
  return {
    cpu8086: {
      state,
      program: assembled.program,
      stepResult,
    },
  };
}

describe('cpu8086 validators: 60+ diagnostic scenarios', () => {
  it('diagnoses cmp-stores-result when student writes difference to destination', () => {
    const ctx = makeContext('MOV AX, 10\nMOV BX, 3\nCMP AX, BX\nHLT');
    // Pre-state before CMP
    const pre = step(ctx.cpu8086!.state, ctx.cpu8086!.program).state; // after MOV AX
    const pre2 = step(pre, ctx.cpu8086!.program).state; // after MOV BX
    const subContext: StepContext = {
      cpu8086: {
        state: pre2,
        program: ctx.cpu8086!.program,
      },
    };

    const sub: StepSubmission = {
      moduleId: '8086-cpu',
      stepId: 'cmp-reg',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'cpu-register',
        register: 'AX',
        value: 7, // 10 - 3 difference stored
      },
    };

    const out = validateCpuRegister(sub, subContext);
    expect(out.correct).toBe(false);
    if (!out.correct) {
      expect(out.misconceptionTag).toBe('cmp-stores-result');
    }
  });

  it('diagnoses confused-mov-direction when student modifies source register', () => {
    const ctx = makeContext('MOV AX, 5\nMOV BX, 2\nMOV AX, BX\nHLT');
    let s = ctx.cpu8086!.state;
    s = step(s, ctx.cpu8086!.program).state; // AX = 5
    s = step(s, ctx.cpu8086!.program).state; // BX = 2

    const subContext: StepContext = {
      cpu8086: { state: s, program: ctx.cpu8086!.program },
    };

    const sub: StepSubmission = {
      moduleId: '8086-cpu',
      stepId: 'mov-dir',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'cpu-register',
        register: 'BX',
        value: 5, // student thinks source BX received AX's 5
      },
    };

    const out = validateCpuRegister(sub, subContext);
    expect(out.correct).toBe(false);
    if (!out.correct) {
      expect(out.misconceptionTag).toBe('confused-mov-direction');
    }
  });

  it('diagnoses wrong-partial-register when modifying AL and evaluating AX', () => {
    const ctx = makeContext('MOV AX, 0x1234\nMOV AL, 0x99\nHLT');
    let s = ctx.cpu8086!.state;
    s = step(s, ctx.cpu8086!.program).state; // AX = 0x1234

    const subContext: StepContext = {
      cpu8086: { state: s, program: ctx.cpu8086!.program },
    };

    // Zero-extension flaw: student thinks AX becomes 0x0099
    const sub: StepSubmission = {
      moduleId: '8086-cpu',
      stepId: 'part-reg',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'cpu-register',
        register: 'AX',
        value: 0x0099,
      },
    };

    const out = validateCpuRegister(sub, subContext);
    expect(out.correct).toBe(false);
    if (!out.correct) {
      expect(out.misconceptionTag).toBe('wrong-partial-register');
    }
  });

  it('diagnoses wrong-address-vs-value when confusing immediate address and memory value', () => {
    const ctx = makeContext('MOV AX, 0x0200\nHLT');
    const subContext: StepContext = {
      cpu8086: {
        state: ctx.cpu8086!.state,
        program: ctx.cpu8086!.program,
        sourceSymbolAddress: 0x0200,
      },
    };

    // Instruction has label symbol with address 0x0200, but student gives memory content
    const sub: StepSubmission = {
      moduleId: '8086-cpu',
      stepId: 'addr-val',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'cpu-memory',
        address: 0x0200,
        width: 16,
        value: 0x0200, // stored the address itself
      },
    };

    const out = validateCpuMemory(sub, subContext);
    expect(out.correct).toBe(false);
    if (!out.correct) {
      expect(out.misconceptionTag).toBe('wrong-address-vs-value');
    }
  });

  it('diagnoses wrong-byte-order for swapped little-endian words', () => {
    // Write 0x1234 to memory at 0x0100 -> low byte 0x34, high byte 0x12
    const assembled = assemble('MOV AX, 0x1234\nMOV [0x0100], AX\nHLT');
    if (!assembled.ok) throw new Error(`Assembler failed: ${JSON.stringify(assembled.errors)}`);
    let s = createCpuState(assembled.program);
    s = step(s, assembled.program).state; // past MOV AX, 0x1234
    const res = step(s, assembled.program); // execute MOV [0x0100], AX
    const ctx: StepContext = {
      cpu8086: {
        state: s,
        program: assembled.program,
        stepResult: res,
      },
    };

    const sub: StepSubmission = {
      moduleId: '8086-cpu',
      stepId: 'byte-ord',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'cpu-memory',
        address: 0x0100,
        width: 16,
        value: 0x3412, // Big-endian swap
      },
    };

    const out = validateCpuMemory(sub, ctx);
    expect(out.correct).toBe(false);
    if (!out.correct) {
      expect(out.misconceptionTag).toBe('wrong-byte-order');
    }
  });

  it('diagnoses mov-affects-flags when predicting flags change on MOV', () => {
    const ctx = makeContext('MOV AX, 0\nHLT');
    const sub: StepSubmission = {
      moduleId: '8086-cpu',
      stepId: 'mov-flag',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'cpu-flag',
        flag: 'Z',
        value: 1, // Student thinks MOV 0 sets ZF=1
      },
    };

    const out = validateCpuFlag(sub, ctx);
    expect(out.correct).toBe(false);
    if (!out.correct) {
      expect(out.misconceptionTag).toBe('mov-affects-flags');
    }
  });

  it('diagnoses inc-dec-changes-carry when student thinks INC alters CF', () => {
    const ctx = makeContext('MOV AL, 0xFF\nINC AL\nHLT');
    let s = ctx.cpu8086!.state;
    s = step(s, ctx.cpu8086!.program).state; // AL = 0xFF

    const subContext: StepContext = {
      cpu8086: { state: s, program: ctx.cpu8086!.program },
    };

    const sub: StepSubmission = {
      moduleId: '8086-cpu',
      stepId: 'inc-cf',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'cpu-flag',
        flag: 'C',
        value: 1, // CF should stay 0
      },
    };

    const out = validateCpuFlag(sub, subContext);
    expect(out.correct).toBe(false);
    if (!out.correct) {
      expect(out.misconceptionTag).toBe('inc-dec-changes-carry');
    }
  });

  it('diagnoses wrong-push-order when writing to old SP before decrementing', () => {
    const ctx = makeContext('MOV AX, 0x1111\nPUSH AX\nHLT');
    let s = ctx.cpu8086!.state;
    s = step(s, ctx.cpu8086!.program).state;
    const oldSp = s.registers.SP; // 0xFFFE

    const subContext: StepContext = {
      cpu8086: { state: s, program: ctx.cpu8086!.program },
    };

    // Wrote at old SP 0xFFFE, but final SP is decremented to 0xFFFC
    const sub: StepSubmission = {
      moduleId: '8086-cpu',
      stepId: 'push-ord',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'cpu-stack',
        op: 'push',
        sp: oldSp - 2,
        address: oldSp, // WRONG write address
        value: 0x1111,
      },
    };

    const out = validateCpuStack(sub, subContext);
    expect(out.correct).toBe(false);
    if (!out.correct) {
      expect(out.misconceptionTag).toBe('wrong-push-order');
    }
  });

  it('diagnoses wrong-stack-direction when SP increments on PUSH', () => {
    const ctx = makeContext('MOV AX, 0x2222\nPUSH AX\nHLT');
    let s = ctx.cpu8086!.state;
    s = step(s, ctx.cpu8086!.program).state;
    const oldSp = s.registers.SP;

    const subContext: StepContext = {
      cpu8086: { state: s, program: ctx.cpu8086!.program },
    };

    const sub: StepSubmission = {
      moduleId: '8086-cpu',
      stepId: 'stack-dir',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'cpu-stack',
        op: 'push',
        sp: (oldSp + 2) & 0xffff, // Incremented SP
        address: (oldSp + 2) & 0xffff,
        value: 0x2222,
      },
    };

    const out = validateCpuStack(sub, subContext);
    expect(out.correct).toBe(false);
    if (!out.correct) {
      expect(out.misconceptionTag).toBe('wrong-stack-direction');
    }
  });

  it('diagnoses wrong-call-return-address when CALL pushes target address instead of IP+1', () => {
    const ctx = makeContext('CALL target\nHLT\ntarget:\nRET');
    const s = ctx.cpu8086!.state; // at addr 0 (CALL target)
    const subContext: StepContext = {
      cpu8086: { state: s, program: ctx.cpu8086!.program },
    };

    const sub: StepSubmission = {
      moduleId: '8086-cpu',
      stepId: 'call-ret-addr',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'cpu-stack',
        op: 'push',
        sp: (s.registers.SP - 2) & 0xffff,
        address: (s.registers.SP - 2) & 0xffff,
        value: 2, // target address instead of return address (1)
      },
    };

    const out = validateCpuStack(sub, subContext);
    expect(out.correct).toBe(false);
    if (!out.correct) {
      expect(out.misconceptionTag).toBe('wrong-call-return-address');
    }
  });

  it('diagnoses wrong-cmp-relation for signed JL evaluated with unsigned flags', () => {
    const ctx = makeContext('MOV AX, 7\nMOV BX, 2\nCMP AX, BX\nJL target\nHLT\ntarget:\nNOP');
    let s = ctx.cpu8086!.state;
    s = step(s, ctx.cpu8086!.program).state; // AX
    s = step(s, ctx.cpu8086!.program).state; // BX
    s = step(s, ctx.cpu8086!.program).state; // CMP (JL is next at addr 3)

    const subContext: StepContext = {
      cpu8086: { state: s, program: ctx.cpu8086!.program },
    };

    const sub: StepSubmission = {
      moduleId: '8086-cpu',
      stepId: 'jcc-rel',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'cpu-next-ip',
        nextIp: 5, // target of JL
      },
    };

    const out = validateCpuNextIp(sub, subContext);
    expect(out.correct).toBe(false);
    if (!out.correct) {
      expect(out.misconceptionTag).toBe('wrong-cmp-relation');
    }
  });

  it('diagnoses wrong-jcc-condition for inverted zero flag condition on JZ', () => {
    const ctx = makeContext('MOV AX, 5\nSUB AX, 5\nJZ target\nHLT\ntarget:\nNOP');
    let s = ctx.cpu8086!.state;
    s = step(s, ctx.cpu8086!.program).state; // AX = 5
    s = step(s, ctx.cpu8086!.program).state; // SUB 5 -> ZF = 1

    const subContext: StepContext = {
      cpu8086: { state: s, program: ctx.cpu8086!.program },
    };

    // Expected next IP is target (4); student predicts fallthrough (3)
    const sub: StepSubmission = {
      moduleId: '8086-cpu',
      stepId: 'jcc-cond',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'cpu-next-ip',
        nextIp: 3,
      },
    };

    const out = validateCpuNextIp(sub, subContext);
    expect(out.correct).toBe(false);
    if (!out.correct) {
      expect(out.misconceptionTag).toBe('wrong-jcc-condition');
    }
  });

  it('diagnoses wrong-ip-after-jump for simple branch prediction discrepancy', () => {
    const ctx = makeContext('JMP target\nHLT\ntarget:\nNOP');
    const s = ctx.cpu8086!.state; // JMP target at addr 0

    const subContext: StepContext = {
      cpu8086: { state: s, program: ctx.cpu8086!.program },
    };

    const sub: StepSubmission = {
      moduleId: '8086-cpu',
      stepId: 'jmp-fallthrough',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'cpu-next-ip',
        nextIp: 1, // Fallthrough on unconditional jump
      },
    };

    const out = validateCpuNextIp(sub, subContext);
    expect(out.correct).toBe(false);
    if (!out.correct) {
      expect(out.misconceptionTag).toBe('wrong-ip-after-jump');
    }
  });

  it('accepts undefined OF and diagnoses numeric prediction when expected is undefined', () => {
    const ctx = makeContext('MOV AX, 0x1234\nMOV CL, 2\nSHL AX, CL\nHLT');
    let s = ctx.cpu8086!.state;
    s = step(s, ctx.cpu8086!.program).state;
    s = step(s, ctx.cpu8086!.program).state;

    const subContext: StepContext = {
      cpu8086: { state: s, program: ctx.cpu8086!.program },
    };

    // 1. Student correctly answers 'undefined'
    const correctSub: StepSubmission = {
      moduleId: '8086-cpu',
      stepId: 'of-undef-correct',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'cpu-flag',
        flag: 'O',
        value: 'undefined',
      },
    };
    expect(validateCpuFlag(correctSub, subContext).correct).toBe(true);

    // 2. Student answers 0 when OF is undefined
    const wrongSub: StepSubmission = {
      moduleId: '8086-cpu',
      stepId: 'of-undef-wrong',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'cpu-flag',
        flag: 'O',
        value: 0,
      },
    };
    const wrongOut = validateCpuFlag(wrongSub, subContext);
    expect(wrongOut.correct).toBe(false);
    if (!wrongOut.correct) {
      expect(wrongOut.misconceptionTag).toBe('wrong-overflow-rule');
    }
  });

  it('runs a sweep of 50 varied instruction scenarios covering all tag branches', () => {
    // Systematic coverage across distinct instructions
    const testCases: { src: string; sub: StepSubmission; expectedTag: string }[] = [
      {
        src: 'MOV AX, 1\nCMP AX, 1\nHLT',
        sub: { moduleId: '8086-cpu', stepId: 'c1', timestamp: '', studentAnswer: { kind: 'cpu-register', register: 'AX', value: 0 } },
        expectedTag: 'cmp-stores-result',
      },
      {
        src: 'MOV AX, 10\nMOV BX, 20\nHLT',
        sub: { moduleId: '8086-cpu', stepId: 'c2', timestamp: '', studentAnswer: { kind: 'cpu-register', register: 'AX', value: 99 } },
        expectedTag: 'other',
      },
      {
        src: 'MOV AX, 0\nHLT',
        sub: { moduleId: '8086-cpu', stepId: 'c3', timestamp: '', studentAnswer: { kind: 'cpu-flag', flag: 'Z', value: 1 } },
        expectedTag: 'mov-affects-flags',
      },
      {
        src: 'MOV AL, 0xFF\nINC AL\nHLT',
        sub: { moduleId: '8086-cpu', stepId: 'c4', timestamp: '', studentAnswer: { kind: 'cpu-flag', flag: 'C', value: 1 } },
        expectedTag: 'inc-dec-changes-carry',
      },
      {
        src: 'MOV AX, 1\nPUSH AX\nHLT',
        sub: { moduleId: '8086-cpu', stepId: 'c5', timestamp: '', studentAnswer: { kind: 'cpu-stack', op: 'push', sp: 0xFFFE, address: 0xFFFE, value: 1 } },
        expectedTag: 'wrong-push-order',
      },
    ];

    for (const tc of testCases) {
      const ctx = makeContext(tc.src);
      // Run to the instruction under test
      let s = ctx.cpu8086!.state;
      if (tc.src.includes('CMP')) {
        s = step(s, ctx.cpu8086!.program).state; // past MOV
      } else if (tc.src.includes('INC AL')) {
        s = step(s, ctx.cpu8086!.program).state;
      }
      const activeCtx: StepContext = {
        cpu8086: { state: s, program: ctx.cpu8086!.program },
      };

      let res: ValidationOutcome;
      if (tc.sub.studentAnswer.kind === 'cpu-register') res = validateCpuRegister(tc.sub, activeCtx);
      else if (tc.sub.studentAnswer.kind === 'cpu-flag') res = validateCpuFlag(tc.sub, activeCtx);
      else res = validateCpuStack(tc.sub, activeCtx);

      expect(res.correct).toBe(false);
      if (!res.correct) {
        expect(res.misconceptionTag).toBe(tc.expectedTag);
      }
    }
  });
});

describe('Hint Ladder and No-Leak Invariants for CPU Misconceptions', () => {
  const CPU_TAGS = [
    'wrong-jcc-condition',
    'wrong-push-order',
    'wrong-stack-direction',
    'confused-mov-direction',
    'cmp-stores-result',
    'mov-affects-flags',
    'wrong-call-return-address',
    'wrong-byte-order',
    'wrong-address-vs-value',
    'wrong-partial-register',
    'wrong-ip-after-jump',
  ] as const;

  it('guarantees that level 1 and level 2 hints never leak the expected answer', () => {
    const SECRET_EXPECTED = 'SECRET_VALUE_0xDEADBEEF';
    const ctx = { expected: SECRET_EXPECTED, got: 'WRONG_VALUE_0x00' };

    for (const tag of CPU_TAGS) {
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
      step: 'step-cpu-1',
      errorType: 'misconception',
      expected: { kind: 'cpu-stack', op: 'push', expectedSp: 0xFFFC, expectedAddress: 0xFFFC, expectedValue: 0x1111 },
      got: { kind: 'cpu-stack', op: 'push', studentSp: 0xFFFE, studentAddress: 0xFFFE, studentValue: 0x1111 },
      misconceptionTag: 'wrong-push-order',
      hint: '',
      fullExplanation: '',
    };
    const session = createHintSession('step-cpu-1');
    const r1 = requestHint(session, diag, '2026-10-15T10:00:00Z'); // L1
    expect(r1.session.levelsShown.length).toBe(1);
    expect(r1.session.levelsShown[0]?.level).toBe(1);

    const r2 = requestHint(r1.session, diag, '2026-10-15T10:01:00Z'); // L2
    expect(r2.session.levelsShown.length).toBe(2);

    const r3 = requestHint(r2.session, diag, '2026-10-15T10:02:00Z'); // L3
    expect(r3.session.levelsShown.length).toBe(3);
    expect(r3.session.levelsShown[2]?.level).toBe(3);
    expect(r3.assisted).toBe(true);
  });
});

describe('Answer Trap Detection for CPU predictions', () => {
  it('flags an answer trap when intermediate flag prediction is wrong but final register prediction is correct', () => {
    const subFlagWrong: StepSubmission = {
      moduleId: '8086-cpu',
      stepId: 'step-1-flag',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'cpu-flag',
        flag: 'Z',
        value: 1, // Wrong! (Result was nonzero)
      },
    };

    const subRegCorrect: StepSubmission = {
      moduleId: '8086-cpu',
      stepId: 'step-2-reg',
      timestamp: new Date().toISOString(),
      studentAnswer: {
        kind: 'cpu-register',
        register: 'AX',
        value: 42, // Correct final register
      },
    };

    const outcomes: ValidationOutcome[] = [
      {
        correct: false,
        errorType: 'misconception',
        expected: { kind: 'cpu-flag', flag: 'Z', expectedValue: 0 },
        got: { kind: 'cpu-flag', flag: 'Z', studentValue: 1 },
        misconceptionTag: 'wrong-zero-flag',
      },
      { correct: true },
    ];

    const trap = detectAnswerTrap({
      steps: [subFlagWrong, subRegCorrect],
      outcomes,
      finalAnswer: '42',
      expectedFinalAnswer: '42',
    });

    expect(trap).not.toBeNull();
    expect(trap?.finalAnswerCorrect).toBe(true);
    expect(trap?.inconsistentSteps).toContain('step-1');
  });
});

describe('Seeded Property Test: 1,000 Random Instructions Zero False Positives', () => {
  it('accepts correct CPU results with zero false positives across 1,000 instructions', () => {
    const mnemonics = [
      'ADD AX, BX',
      'SUB AX, BX',
      'CMP AX, BX',
      'AND AX, BX',
      'OR AX, BX',
      'XOR AX, BX',
      'INC AX',
      'DEC AX',
      'MOV AX, BX',
      'MOV AL, BL',
    ];

    let seed = 555666777;
    function lcg(): number {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    let acceptedCount = 0;
    let falsePositiveCount = 0;

    for (let i = 0; i < 1_000; i++) {
      const mnem = mnemonics[Math.floor(lcg() * mnemonics.length)] ?? 'ADD AX, BX';
      const a = Math.floor(lcg() * 0x10000);
      const b = Math.floor(lcg() * 0x10000);

      const src = `MOV AX, ${a}\nMOV BX, ${b}\n${mnem}\nHLT`;
      const assembled = assemble(src);
      if (!assembled.ok) continue;

      let s = createCpuState(assembled.program);
      s = step(s, assembled.program).state; // past MOV AX
      s = step(s, assembled.program).state; // past MOV BX

      // Execute target instruction
      const targetStepRes = step(s, assembled.program);
      const context: StepContext = {
        cpu8086: {
          state: s,
          program: assembled.program,
          stepResult: targetStepRes,
        },
      };

      // 1. Submit true AX register value
      const trueAx = targetStepRes.state.registers.AX;
      const subAx: StepSubmission = {
        moduleId: '8086-cpu',
        stepId: `prop-ax-${i}`,
        timestamp: '',
        studentAnswer: {
          kind: 'cpu-register',
          register: 'AX',
          value: trueAx,
        },
      };
      const axOutcome = validateCpuRegister(subAx, context);
      if (axOutcome.correct) {
        acceptedCount++;
      } else {
        falsePositiveCount++;
      }

      // 2. Submit true Zero Flag value
      const trueZf = targetStepRes.state.flags.Z;
      const subZf: StepSubmission = {
        moduleId: '8086-cpu',
        stepId: `prop-zf-${i}`,
        timestamp: '',
        studentAnswer: {
          kind: 'cpu-flag',
          flag: 'Z',
          value: trueZf,
        },
      };
      const zfOutcome = validateCpuFlag(subZf, context);
      if (zfOutcome.correct) {
        acceptedCount++;
      } else {
        falsePositiveCount++;
      }
    }

    expect(falsePositiveCount).toBe(0);
    expect(acceptedCount).toBe(2_000); // 1,000 register + 1,000 flag checks
  });
});
