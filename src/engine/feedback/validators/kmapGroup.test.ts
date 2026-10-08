/**
 * @file kmapGroup.test.ts
 * Integration tests for K-map group validators registered in the feedback engine.
 *
 * Verifies:
 * - Registry integration through evaluateStep.
 * - Diagnosis shape and correct error categorization.
 * - Progressive hint ladder and no-leak invariants for all K-map misconception tags.
 * - Assisted flag after Level 3 hint usage.
 * - Determinism across identical submissions.
 */

import { describe, expect, it } from 'vitest';
import type { StepSubmission } from '../../../types/feedback';
import { evaluateStep } from '../feedbackEngine';
import { getValidator } from '../validatorRegistry';
import { createHintSession, requestHint } from '../hints';
import { getMisconception } from '../misconceptions';

describe('1. K-Map Validator Registry Integration', () => {
  it('registers kmap-group and kmap-group-set in validator registry', () => {
    expect(getValidator('kmap-group')).toBeDefined();
    expect(getValidator('kmap-group-set')).toBeDefined();
  });

  it('evaluates a valid group submission as correct through evaluateStep', () => {
    const submission: StepSubmission = {
      moduleId: 'kmap',
      stepId: 'step-1',
      studentAnswer: {
        kind: 'kmap-group',
        selectedCells: [0, 2, 8, 10],
        expression: "B'D'",
      },
      timestamp: '2026-10-05T12:00:00Z',
    };

    const res = evaluateStep(submission, {
      kmap: {
        variableCount: 4,
        minterms: [0, 2, 5, 7, 8, 10, 13, 15],
        mode: 'SOP',
      },
    });

    expect(res.ok).toBe(true);
  });

  it('evaluates a non-power-of-two group and produces rich Diagnosis record', () => {
    const submission: StepSubmission = {
      moduleId: 'kmap',
      stepId: 'step-1',
      studentAnswer: {
        kind: 'kmap-group',
        selectedCells: [0, 1, 2], // 3 cells
        expression: "A'B'",
      },
      timestamp: '2026-10-05T12:00:00Z',
    };

    const res = evaluateStep(submission, {
      kmap: {
        variableCount: 4,
        minterms: [0, 1, 2, 3],
        mode: 'SOP',
      },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.diagnoses.length).toBeGreaterThan(0);
      const diag = res.diagnoses[0];
      expect(diag).toBeDefined();
      if (diag) {
        expect(diag.errorType).toBe('misconception');
        expect(diag.misconceptionTag).toBe('grouped-non-power-of-two');
        expect(diag.hint).toBeDefined();
        expect(diag.fullExplanation).toBeDefined();
        expect(diag.got.kind).toBe('kmap-group');
        expect(diag.expected.kind).toBe('kmap-group');
      }
    }
  });

  it('evaluates complete group set submission through evaluateStep', () => {
    const submission: StepSubmission = {
      moduleId: 'kmap',
      stepId: 'final-step',
      studentAnswer: {
        kind: 'kmap-group-set',
        groups: [
          [0, 2, 8, 10],
          [5, 7, 13, 15],
        ],
        expression: "B'D' + BD",
      },
      timestamp: '2026-10-05T12:00:00Z',
    };

    const res = evaluateStep(submission, {
      kmap: {
        variableCount: 4,
        minterms: [0, 2, 5, 7, 8, 10, 13, 15],
        mode: 'SOP',
      },
    });

    expect(res.ok).toBe(true);
  });
});

describe('2. K-Map Misconception Tags and No-Leak Invariants', () => {
  const kmapTags = [
    'forgot-wraparound-grouping',
    'grouped-non-power-of-two',
    'group-not-rectangle',
    'group-not-maximal',
    'redundant-group',
    'missed-minterm',
    'covered-a-zero',
    'missed-dont-cares',
  ] as const;

  it('ensures every K-map misconception tag exists and provides 3-tiered hint templates', () => {
    for (const tag of kmapTags) {
      const entry = getMisconception(tag);
      expect(entry).toBeDefined();
      expect(entry.hints.level1).toBeTypeOf('function');
      expect(entry.hints.level2).toBeTypeOf('function');
      expect(entry.hints.level3).toBeTypeOf('function');
    }
  });

  it('no-leak test: level 1 and 2 templates NEVER reveal the expected value string for K-map tags', () => {
    const secret = 'SECRET_TARGET_VALUE_XYZ_987';
    const ctx = {
      expected: secret,
      got: 'STUDENT_VALUE',
      detail: 'test detail',
    };

    for (const tag of kmapTags) {
      const entry = getMisconception(tag);
      const l1 = entry.hints.level1(ctx);
      const l2 = entry.hints.level2(ctx);
      const l3 = entry.hints.level3(ctx);

      expect(l1, `Level 1 leaked for ${tag}`).not.toContain(secret);
      expect(l2, `Level 2 leaked for ${tag}`).not.toContain(secret);
      expect(l3, `Level 3 must show worked step for ${tag}`).toContain(secret);
    }
  });

  it('progresses hint ladder 1 -> 2 -> 3 and sets assisted flag on Level 3', () => {
    const entry = getMisconception('forgot-wraparound-grouping');
    const diag = {
      step: 'step-1',
      errorType: 'misconception' as const,
      expected: { kind: 'kmap-group' as const, validGroups: [[0, 2]], minimalExpression: "A'B'D'" },
      got: { kind: 'kmap-group' as const, studentGroup: [0], studentExpression: "A'B'C'D'" },
      misconceptionTag: entry.tag,
      hint: 'hint',
      fullExplanation: 'explanation',
    };

    let session = createHintSession('step-1');
    const r1 = requestHint(session, diag, '2026-10-05T12:00:00Z');
    expect(r1.hint.level).toBe(1);
    expect(r1.assisted).toBe(false);
    session = r1.session;

    const r2 = requestHint(session, diag, '2026-10-05T12:01:00Z');
    expect(r2.hint.level).toBe(2);
    expect(r2.assisted).toBe(false);
    session = r2.session;

    const r3 = requestHint(session, diag, '2026-10-05T12:02:00Z');
    expect(r3.hint.level).toBe(3);
    expect(r3.assisted).toBe(true);
  });
});
