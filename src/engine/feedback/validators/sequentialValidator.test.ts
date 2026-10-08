/**
 * @file sequentialValidator.test.ts
 * Comprehensive test suite for sequential domain validators in the feedback engine (Stage 10C):
 * - Zero false positives property: all engine-generated correct answers are accepted.
 * - Mutation tests: verifying exact error types, priority rankings, and misconception tags.
 * - Confused Q and Q+ detection on state table rows.
 * - Ignored lockout state detection when students omit locked unused states.
 * - Three-tiered progressive hint ladder and no-leak invariants.
 * - Validator registry integration for all 'seq-' step kinds.
 * - Diagnosis 7-field structure compliance and catalog Markdown rendering.
 */

import { describe, expect, it } from 'vitest';
import type { Diagnosis, StepSubmission } from '../../../types/feedback';
import type { FlipFlopType, SequentialSpec } from '../../../types/sequential';
import { designSequential } from '../../sequential/counterDesigner';
import { analyzeLockout } from '../../sequential/lockout';
import { evaluateStep } from '../feedbackEngine';
import { createHintSession, requestHint } from '../hints';
import { getMisconception, renderCatalogMarkdown } from '../misconceptions';
import type { StepContext } from '../types';
import { getValidator } from '../validatorRegistry';
import {
  validateSeqEquation,
  validateSeqLockoutClaim,
  validateSeqStateTableCell,
} from './sequentialValidator';

describe('1. Validator Registry Integration for Sequential Step Kinds', () => {
  it('registers seq-state-table-cell, seq-equation, and seq-lockout-claim', () => {
    expect(getValidator('seq-state-table-cell')).toBeDefined();
    expect(getValidator('seq-equation')).toBeDefined();
    expect(getValidator('seq-lockout-claim')).toBeDefined();
  });
});

describe('2. ZERO FALSE POSITIVES across Stage 10B Matrix', () => {
  const flipFlops: FlipFlopType[] = ['SR', 'JK', 'D', 'T'];
  const specs: SequentialSpec[] = [
    { kind: 'counter', direction: 'up', modulus: 5, flipFlop: 'D', style: 'sync' },
    { kind: 'counter', direction: 'down', modulus: 8, flipFlop: 'T', style: 'sync' },
    { kind: 'counter', direction: 'up', modulus: 10, flipFlop: 'JK', style: 'sync' },
    { kind: 'counter', direction: 'up-down', modulus: 6, flipFlop: 'SR', style: 'sync' },
    { kind: 'detector', pattern: '1011', machine: 'mealy', overlapping: true, flipFlop: 'D' },
    { kind: 'detector', pattern: '110', machine: 'moore', overlapping: false, flipFlop: 'JK' },
  ];

  it('accepts correct answers for every state table cell, equation, and lockout claim', () => {
    let checkedCells = 0;
    let checkedEquations = 0;
    let checkedLockouts = 0;

    for (const spec of specs) {
      for (const ff of flipFlops) {
        const fullSpec: SequentialSpec = { ...spec, flipFlop: ff };
        const dRes = designSequential(fullSpec);
        expect(dRes.ok).toBe(true);
        if (!dRes.ok) continue;

        const design = dRes.design;

        // 1. Verify every cell of reference state table
        for (const row of design.table.rows) {
          if (!row.valid) continue;

          // Next state cell
          const subNext: StepSubmission = {
            moduleId: 'sequential',
            stepId: `state-${row.code}-next`,
            studentAnswer: {
              kind: 'state-table-row',
              presentState: String(row.code),
              nextState: String(row.nextCode),
            },
            timestamp: '2026-10-07T12:00:00Z',
          };
          const outNext = validateSeqStateTableCell(subNext, {
            spec: fullSpec,
            code: row.code,
            input: row.inputValue,
            field: 'next',
          });
          expect(outNext.correct, `False positive on next state for ${spec.kind} state ${row.code}`).toBe(true);
          checkedCells++;

          // Output cell if applicable
          if (design.table.machineKind !== 'counter') {
            const outVal = design.table.machineKind === 'moore' ? row.mooreOutput : row.mealyOutput;
            const subOut: StepSubmission = {
              moduleId: 'sequential',
              stepId: `state-${row.code}-output`,
              studentAnswer: {
                kind: 'state-table-row',
                presentState: String(row.code),
                nextState: String(row.nextCode),
                output: String(outVal),
              },
              timestamp: '2026-10-07T12:00:00Z',
            };
            const outOut = validateSeqStateTableCell(subOut, {
              spec: fullSpec,
              code: row.code,
              input: row.inputValue,
              field: 'output',
            });
            expect(outOut.correct, `False positive on output for ${spec.kind} state ${row.code}`).toBe(true);
            checkedCells++;
          }
        }

        // 2. Verify every derived equation
        for (const eq of design.equations) {
          const subEq: StepSubmission = {
            moduleId: 'sequential',
            stepId: `eq-${eq.name}`,
            studentAnswer: {
              kind: 'boolean-step',
              appliedLaw: '',
              resultingExpression: eq.text,
            },
            timestamp: '2026-10-07T12:00:00Z',
          };
          const outEq = validateSeqEquation(subEq, {
            spec: fullSpec,
            functionName: eq.name,
          });
          expect(outEq.correct, `False positive on equation ${eq.name}`).toBe(true);
          checkedEquations++;
        }

        // 3. Verify lockout claim
        const lockAnalysis = analyzeLockout({
          table: design.table,
          equations: design.equations,
          flipFlop: ff,
        });
        const trueLockout = Array.from(new Set([...lockAnalysis.lockedStates, ...lockAnalysis.indeterminateStates]));
        const subLock: StepSubmission = {
          moduleId: 'sequential',
          stepId: 'lockout-claim',
          studentAnswer: {
            kind: 'state-table-row',
            presentState: '',
            nextState: '',
            value: trueLockout,
          } as unknown as StepSubmission['studentAnswer'],
          timestamp: '2026-10-07T12:00:00Z',
        };
        const outLock = validateSeqLockoutClaim(subLock, { spec: fullSpec });
        expect(outLock.correct, 'False positive on lockout claim').toBe(true);
        checkedLockouts++;
      }
    }

    expect(checkedCells).toBeGreaterThan(50);
    expect(checkedEquations).toBeGreaterThan(40);
    expect(checkedLockouts).toBeGreaterThan(15);
  });
});

describe('3. MUTATION TESTS & MISCONCEPTION PRIORITIES', () => {
  const spec: SequentialSpec = { kind: 'counter', flipFlop: 'D', style: 'sync', direction: 'up', modulus: 5 };

  it('diagnoses confused-q-and-qnext when student enters present state Q instead of next state', () => {
    // In Mod-5 counter, state 0 -> next is 1. If student says 0:
    const sub: StepSubmission = {
      moduleId: 'sequential',
      stepId: 'state-0-next',
      studentAnswer: {
        kind: 'state-table-row',
        presentState: '0',
        nextState: '0', // Same as present state 0, expected is 1
      },
      timestamp: '2026-10-07T12:00:00Z',
    };

    const outcome = validateSeqStateTableCell(sub, {
      spec,
      code: 0,
      field: 'next',
    });

    expect(outcome.correct).toBe(false);
    if (!outcome.correct) {
      expect(outcome.errorType).toBe('misconception');
      expect(outcome.misconceptionTag).toBe('confused-q-and-qnext');
    }
  });

  it('diagnoses general incorrect-transition when student gives an arbitrary wrong state', () => {
    // In Mod-5 counter, state 0 -> next is 1. If student says 3:
    const sub: StepSubmission = {
      moduleId: 'sequential',
      stepId: 'state-0-next',
      studentAnswer: {
        kind: 'state-table-row',
        presentState: '0',
        nextState: '3',
      },
      timestamp: '2026-10-07T12:00:00Z',
    };

    const outcome = validateSeqStateTableCell(sub, {
      spec,
      code: 0,
      field: 'next',
    });

    expect(outcome.correct).toBe(false);
    if (!outcome.correct) {
      expect(outcome.errorType).toBe('incorrect-transition');
    }
  });

  it('equation mutations: flags parse errors, unknown variables, and mismatches', () => {
    // Function D0 for Mod-5 counter is Q0' & Q2' (or similar)
    const ctx = { spec, functionName: 'D0' };

    // 1. Parse error
    const subSyntax: StepSubmission = {
      moduleId: 'sequential',
      stepId: 'eq-D0',
      studentAnswer: { kind: 'boolean-step', appliedLaw: '', resultingExpression: 'Q0 &' },
      timestamp: '2026-10-07T12:00:00Z',
    };
    const outSyntax = validateSeqEquation(subSyntax, ctx);
    expect(outSyntax.correct).toBe(false);
    if (!outSyntax.correct) {
      expect(outSyntax.errorType).toBe('syntax-error');
    }

    // 2. Unknown variable
    const subUnknown: StepSubmission = {
      moduleId: 'sequential',
      stepId: 'eq-D0',
      studentAnswer: { kind: 'boolean-step', appliedLaw: '', resultingExpression: "Q0' & Z" },
      timestamp: '2026-10-07T12:00:00Z',
    };
    const outUnknown = validateSeqEquation(subUnknown, ctx);
    expect(outUnknown.correct).toBe(false);
    if (!outUnknown.correct) {
      expect(outUnknown.errorType).toBe('syntax-error');
      expect(outUnknown.details).toContain('unrecognized variable');
    }

    // 3. Care row mismatch
    const subMismatch: StepSubmission = {
      moduleId: 'sequential',
      stepId: 'eq-D0',
      studentAnswer: { kind: 'boolean-step', appliedLaw: '', resultingExpression: 'Q0' },
      timestamp: '2026-10-07T12:00:00Z',
    };
    const outMismatch = validateSeqEquation(subMismatch, ctx);
    expect(outMismatch.correct).toBe(false);
    if (!outMismatch.correct) {
      expect(outMismatch.errorType).toBe('misconception');
    }
  });

  it('diagnoses ignored-lockout-state when student omits locked unused states', () => {
    // Hand-crafted spec for custom sequence that has locked states
    const customSpec: SequentialSpec = {
      kind: 'counter',
      flipFlop: 'SR',
      style: 'sync',
      direction: 'custom',
      sequence: [0, 1, 2],
      stateBits: 3,
    };

    // Student claims NO lockout states ([])
    const sub: StepSubmission = {
      moduleId: 'sequential',
      stepId: 'seq-lockout-claim',
      studentAnswer: {
        kind: 'state-table-row',
        presentState: '',
        nextState: '',
        value: [],
      } as unknown as StepSubmission['studentAnswer'],
      timestamp: '2026-10-07T12:00:00Z',
    };

    const outcome = validateSeqLockoutClaim(sub, { spec: customSpec });
    expect(outcome.correct).toBe(false);
    if (!outcome.correct) {
      expect(outcome.misconceptionTag).toBe('ignored-lockout-state');
      expect(outcome.errorType).toBe('misconception');
    }
  });
});

describe('4. Three-Tiered Hint Ladder, No-Leak Invariants, and Catalog Markdown', () => {
  const SEQ_TAGS = ['ignored-lockout-state', 'confused-q-and-qnext', 'wrong-excitation-table'] as const;

  it('ensures all sequential misconception tags provide all three hint template tiers', () => {
    for (const tag of SEQ_TAGS) {
      const entry = getMisconception(tag);
      expect(entry).toBeDefined();
      expect(entry.tag).toBe(tag);
      expect(entry.hints.level1).toBeTypeOf('function');
      expect(entry.hints.level2).toBeTypeOf('function');
      expect(entry.hints.level3).toBeTypeOf('function');
    }
  });

  it('NO-LEAK INVARIANT: Levels 1 and 2 NEVER contain the expected target value string', () => {
    const secret = 'SECRET_TARGET_VALUE_XYZ_999';
    const ctx = {
      expected: secret,
      got: 'STUDENT_ERRONEOUS_VALUE',
      detail: 'test detail context',
    };

    for (const tag of SEQ_TAGS) {
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
    const entry = getMisconception('ignored-lockout-state');
    const diag: Diagnosis = {
      step: 'seq-lockout-claim',
      errorType: 'misconception',
      expected: { kind: 'state-table-row', nextState: '[5, 6]' },
      got: { kind: 'state-table-row', nextState: '[]' },
      misconceptionTag: entry.tag,
      hint: 'hint',
      fullExplanation: 'explanation',
    };

    let session = createHintSession('seq-lockout-claim');
    const r1 = requestHint(session, diag, '2026-10-07T12:00:00Z');
    expect(r1.hint.level).toBe(1);
    expect(r1.assisted).toBe(false);
    session = r1.session;

    const r2 = requestHint(session, diag, '2026-10-07T12:01:00Z');
    expect(r2.hint.level).toBe(2);
    expect(r2.assisted).toBe(false);
    session = r2.session;

    const r3 = requestHint(session, diag, '2026-10-07T12:02:00Z');
    expect(r3.hint.level).toBe(3);
    expect(r3.assisted).toBe(true);
  });

  it('renders catalog Markdown including ignored-lockout-state tag', () => {
    const md = renderCatalogMarkdown();
    expect(md).toContain('ignored-lockout-state');
    expect(md).toContain('Ignored Unused State Lockout / Deadlock');
  });

  it('evaluates end-to-end through evaluateStep with 7-field Diagnosis', () => {
    const sub: StepSubmission = {
      moduleId: 'sequential',
      stepId: 'seq-state-table-cell',
      studentAnswer: {
        kind: 'seq-state-table-cell',
        presentState: '0',
        nextState: '0', // Error on Mod-4 counter
      } as unknown as StepSubmission['studentAnswer'],
      timestamp: '2026-10-07T12:00:00Z',
    };

    const res = evaluateStep(sub, {
      sequential: {
        spec: { kind: 'counter', flipFlop: 'D', style: 'sync', direction: 'up', modulus: 4 },
        code: 0,
        field: 'next',
      },
    } as unknown as StepContext);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      const diag = res.diagnoses[0];
      expect(diag).toBeDefined();
      if (!diag) return;
      // 7-field structure compliance
      expect(diag.step).toBe('seq-state-table-cell');
      expect(diag.errorType).toBe('misconception');
      expect(diag.expected).toBeDefined();
      expect(diag.got).toBeDefined();
      expect(diag.misconceptionTag).toBe('confused-q-and-qnext');
      expect(diag.hint).toBeDefined();
      expect(diag.fullExplanation).toBeDefined();
    }
  });
});
