/**
 * @file feedback.test.ts
 * Comprehensive test suite for the deterministic pedagogical feedback engine:
 * misconception catalog, hints progressive ladder, no-leak invariants,
 * answer trap detector, determinism, validator registry, and 300-case property test.
 */

import { describe, expect, it } from 'vitest';
import type { MisconceptionTag, StepSubmission } from '../../types/feedback';
import {
  MISCONCEPTION_ENTRIES,
  getMisconception,
  listMisconceptions,
  renderCatalogMarkdown,
} from './misconceptions';
import {
  createHintSession,
  requestHint,
  hintsUsedSummary,
} from './hints';
import { detectAnswerTrap } from './answerTrap';
import {
  evaluateStep,
  summarizeForLog,
} from './feedbackEngine';
import {
  registerValidator,
} from './validatorRegistry';
import { generateRepeatedDivisionSteps } from '../numberSystems/steps';

describe('Misconception Catalog Integrity', () => {
  const REQUIRED_TAGS: MisconceptionTag[] = [
    'forgot-wraparound-grouping',
    'grouped-non-power-of-two',
    'group-not-rectangle',
    'group-not-maximal',
    'redundant-group',
    'missed-minterm',
    'covered-a-zero',
    'missed-dont-cares',
    'wrong-excitation-table',
    'confused-q-and-qnext',
    'ignored-lockout-state',
    'wrong-complement',
    'wrong-radix-weight',
    'demorgan-misapplied',
    'wrong-carry-propagation',
    'wrong-bit-order',
    'wrong-remainder-order',
    'wrong-overflow-rule',
    'wrong-borrow-convention',
    'forgot-invert-b-in-subtract',
    'wrong-shift-carry-out',
    'wrong-sign-flag',
    'wrong-zero-flag',
    'wrong-cmp-relation',
    'inc-dec-changes-carry',
    'wrong-law-applied',
    'algebra-sign-error',
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
    'other',
  ];

  it('every required tag has an entry in the catalog', () => {
    expect(MISCONCEPTION_ENTRIES.length).toBe(REQUIRED_TAGS.length);
    for (const tag of REQUIRED_TAGS) {
      const entry = getMisconception(tag);
      expect(entry).toBeDefined();
      expect(entry.tag).toBe(tag);
    }
  });

  it('every entry has all three hint templates and at least one affected module', () => {
    for (const entry of MISCONCEPTION_ENTRIES) {
      expect(entry.affectedModules.length).toBeGreaterThan(0);
      expect(typeof entry.hints.level1).toBe('function');
      expect(typeof entry.hints.level2).toBe('function');
      expect(typeof entry.hints.level3).toBe('function');
      expect(entry.description.length).toBeGreaterThan(20);
      expect(entry.example.length).toBeGreaterThan(10);
    }
  });

  it('listMisconceptions filters correctly by module', () => {
    const kmapEntries = listMisconceptions('kmap');
    expect(kmapEntries.length).toBeGreaterThan(0);
    expect(kmapEntries.every((e) => e.affectedModules.includes('kmap'))).toBe(true);

    const allEntries = listMisconceptions();
    expect(allEntries.length).toBe(MISCONCEPTION_ENTRIES.length);
  });

  it('renderCatalogMarkdown contains every misconception tag and title', () => {
    const md = renderCatalogMarkdown();
    for (const tag of REQUIRED_TAGS) {
      expect(md).toContain(`\`${tag}\``);
    }
  });
});

describe('Hint Ladder and No-Leak Invariants', () => {
  it('no-leak test: level 1 and 2 templates NEVER reveal the expected value string across all 21 entries', () => {
    const testSecret = 'SECRET_TARGET_VALUE_XYZ_987';
    const ctx = {
      expected: testSecret,
      got: 'STUDENT_GOT_VALUE',
      detail: 'additional details',
    };

    for (const entry of MISCONCEPTION_ENTRIES) {
      const l1 = entry.hints.level1(ctx);
      const l2 = entry.hints.level2(ctx);
      const l3 = entry.hints.level3(ctx);

      expect(l1, `Level 1 leaked expected value for tag ${entry.tag}`).not.toContain(testSecret);
      expect(l2, `Level 2 leaked expected value for tag ${entry.tag}`).not.toContain(testSecret);
      expect(l3, `Level 3 should show worked step for tag ${entry.tag}`).toContain(testSecret);
    }
  });

  it('requestHint progresses 1 -> 2 -> 3 and repeats level 3, setting assisted flag at level 3', () => {
    let session = createHintSession('step-42');
    const mockDiagnosis = {
      step: 'step-42',
      errorType: 'misconception' as const,
      expected: { kind: 'number-conversion-step' as const, targetValue: '1101', intermediateSteps: ['1101'] },
      got: { kind: 'number-conversion-step' as const, studentValue: '1011', intermediateWork: ['1011'] },
      misconceptionTag: 'wrong-remainder-order' as const,
      hint: 'initial hint',
      fullExplanation: 'explanation',
    };

    const r1 = requestHint(session, mockDiagnosis, '2026-10-05T12:00:00Z');
    expect(r1.hint.level).toBe(1);
    expect(r1.assisted).toBe(false);
    session = r1.session;

    const r2 = requestHint(session, mockDiagnosis, '2026-10-05T12:01:00Z');
    expect(r2.hint.level).toBe(2);
    expect(r2.assisted).toBe(false);
    session = r2.session;

    const r3 = requestHint(session, mockDiagnosis, '2026-10-05T12:02:00Z');
    expect(r3.hint.level).toBe(3);
    expect(r3.assisted).toBe(true);
    expect(r3.hint.content).toContain('1101');
    session = r3.session;

    const r4 = requestHint(session, mockDiagnosis, '2026-10-05T12:03:00Z');
    expect(r4.hint.level).toBe(3);
    expect(r4.assisted).toBe(true);
    session = r4.session;
    expect(session.levelsShown.length).toBe(4);

    const summary = hintsUsedSummary({ [session.stepKey]: session });
    expect(summary.totalHints).toBe(4);
    expect(summary.levelCounts[1]).toBe(1);
    expect(summary.levelCounts[2]).toBe(1);
    expect(summary.levelCounts[3]).toBe(2);
    expect(summary.assistedSteps).toContain('step-42');
  });
});

describe('Answer Trap Detection', () => {
  it('flags right final answer with wrong intermediate step', () => {
    const steps: StepSubmission[] = [
      {
        moduleId: 'boolean',
        stepId: 'step-1',
        timestamp: '2026-10-05T00:00:00Z',
        studentAnswer: { kind: 'boolean-step', appliedLaw: 'bad-law', resultingExpression: 'A + B' },
      },
    ];
    const outcomes = [
      {
        correct: false as const,
        errorType: 'misconception' as const,
        expected: { kind: 'boolean-step' as const, validExpressions: ['A'], validLaws: [] },
        got: { kind: 'boolean-step' as const, studentExpression: 'A + B', studentLaw: 'bad-law' },
      },
    ];
    const trap = detectAnswerTrap({
      steps,
      outcomes,
      finalAnswer: 'A',
      expectedFinalAnswer: 'A',
    });
    expect(trap).not.toBeNull();
    expect(trap?.finalAnswerCorrect).toBe(true);
    expect(trap?.inconsistentSteps).toContain('step-1');
  });

  it('flags step sequence when final answer was assisted by level 3 hint', () => {
    const steps: StepSubmission[] = [
      {
        moduleId: 'boolean',
        stepId: 'step-1',
        timestamp: '2026-10-05T00:00:00Z',
        studentAnswer: { kind: 'boolean-step', appliedLaw: 'identity', resultingExpression: 'A' },
      },
    ];
    const outcomes = [{ correct: true as const }];
    const trap = detectAnswerTrap({
      steps,
      outcomes,
      finalAnswer: 'A',
      expectedFinalAnswer: 'A',
      assistedSteps: ['step-1'],
    });
    expect(trap).not.toBeNull();
    expect(trap?.notes).toContain('Level 3 worked hint');
  });

  it('fully clean attempt gives no trap flag', () => {
    const steps: StepSubmission[] = [
      {
        moduleId: 'boolean',
        stepId: 'step-1',
        timestamp: '2026-10-05T00:00:00Z',
        studentAnswer: { kind: 'boolean-step', appliedLaw: 'identity', resultingExpression: 'A' },
      },
    ];
    const outcomes = [{ correct: true as const }];
    const trap = detectAnswerTrap({
      steps,
      outcomes,
      finalAnswer: 'A',
      expectedFinalAnswer: 'A',
      assistedSteps: [],
    });
    expect(trap).toBeNull();
  });
});

describe('Registry and Determinism', () => {
  it('registering a kind twice throws an error', () => {
    expect(() => {
      registerValidator('boolean-step', () => ({ correct: true }));
    }).toThrow(/already registered/);
  });

  it('evaluating an unknown step kind returns a typed error without throwing', () => {
    const sub: StepSubmission = {
      moduleId: 'unknown',
      stepId: 'step-unk',
      timestamp: '2026-10-05T00:00:00Z',
      // @ts-expect-error testing unknown kind
      studentAnswer: { kind: 'unknown-kind' },
    };
    const res = evaluateStep(sub);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.diagnoses[0]?.fullExplanation).toContain('Unknown step submission kind');
    }
  });

  it('determinism: running 50 submissions twice yields 100% identical outputs', () => {
    const submissions: StepSubmission[] = [];
    for (let i = 1; i <= 50; i++) {
      submissions.push({
        moduleId: 'numberSystems',
        stepId: `step-${i}`,
        timestamp: '2026-10-05T00:00:00Z',
        studentAnswer: {
          kind: 'number-conversion-step',
          sourceValue: i.toString(),
          sourceRadix: 10,
          targetRadix: 2,
          intermediateWork: [],
          finalAnswer: (i % 2 === 0 ? i.toString(2) : 'wrong-ans'),
        },
      });
    }

    const run1 = submissions.map((s) => evaluateStep(s));
    const run2 = submissions.map((s) => evaluateStep(s));

    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });

  it('summarizeForLog formats output cleanly for telemetry', () => {
    const successRes = { ok: true as const, message: 'Correct' };
    expect(summarizeForLog(successRes)).toEqual({ isCorrect: true });

    const failRes = {
      ok: false as const,
      diagnoses: [
        {
          step: 's1',
          errorType: 'misconception' as const,
          expected: { kind: 'number-conversion-step' as const, targetValue: '0', intermediateSteps: [] },
          got: { kind: 'number-conversion-step' as const, studentValue: '1', intermediateWork: [] },
          misconceptionTag: 'wrong-complement' as const,
          hint: 'hint',
          fullExplanation: 'explanation',
        },
      ],
    };
    expect(summarizeForLog(failRes)).toEqual({
      isCorrect: false,
      misconceptionTag: 'wrong-complement',
    });
  });
});

describe('Seeded Property Test (300 cases, zero false positives)', () => {
  it('property: 300 engine-generated correct steps always yield correct: true', () => {
    // Seeded linear congruential generator for reproducible property tests
    let seed = 123456789;
    function rand(): number {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    }

    let successCount = 0;
    const testCases = 300;

    for (let i = 0; i < testCases; i++) {
      const decValue = Math.floor(rand() * 1000) + 1; // 1 to 1000
      const targetRadix = Math.floor(rand() * 15) + 2; // 2 to 16
      const engineResult = generateRepeatedDivisionSteps(decValue, targetRadix);

      const submission: StepSubmission = {
        moduleId: 'numberSystems',
        stepId: `prop-step-${i}`,
        timestamp: '2026-10-05T00:00:00Z',
        studentAnswer: {
          kind: 'number-conversion-step',
          sourceValue: decValue.toString(),
          sourceRadix: 10,
          targetRadix,
          intermediateWork: [],
          finalAnswer: engineResult.result,
        },
      };

      const evalResult = evaluateStep(submission);
      expect(evalResult.ok, `False positive on step ${i}: decimal ${decValue} to base ${targetRadix}`).toBe(true);
      if (evalResult.ok) {
        successCount++;
      }
    }

    expect(successCount).toBe(testCases);
  });
});
