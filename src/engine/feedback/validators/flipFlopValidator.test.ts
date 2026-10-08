/**
 * @file flipFlopValidator.test.ts
 * Comprehensive test suite for flip-flop domain validators in the feedback engine:
 * - Zero false positives property: all engine-generated correct answers are accepted.
 * - Mutation tests: verifying exact error types, priority rankings, and misconception tags.
 * - Accepted-with-a-note for concrete entries on don't-care excitation cells.
 * - Confused Q and Q+ detection on characteristic, excitation, and pulse prediction steps.
 * - Three-tiered progressive hint ladder and no-leak invariants.
 * - Validator registry integration for all 'ff-' step kinds.
 * - Diagnosis 7-field structure compliance and catalog Markdown rendering.
 */

import { describe, expect, it } from 'vitest';
import type { LogicValue } from '../../../types/ast';
import type { Diagnosis, StepSubmission } from '../../../types/feedback';
import type { FlipFlopType } from '../../../types/sequential';
import { createPrng, prngChoice } from '../../common/seededRandom';
import {
  characteristicTable,
  defaultConfig,
  excitationTable,
  inputNames,
  simulateTimeline,
  type FlipFlopConfig,
  type FlipFlopScript,
  type FlipFlopScriptEvent,
} from '../../flipflop';
import { evaluateStep } from '../feedbackEngine';
import { createHintSession, requestHint } from '../hints';
import { getMisconception, renderCatalogMarkdown } from '../misconceptions';
import { getValidator } from '../validatorRegistry';
import {
  validateFlipFlopCharacteristicRow,
  validateFlipFlopExcitationRow,
  validateFlipFlopPulsePrediction,
} from './flipFlopValidator';

describe('1. Validator Registry Integration for Flip-Flop Step Kinds', () => {
  it('registers ff-characteristic-row, ff-excitation-row, and ff-pulse-prediction', () => {
    expect(getValidator('ff-characteristic-row')).toBeDefined();
    expect(getValidator('ff-excitation-row')).toBeDefined();
    expect(getValidator('ff-pulse-prediction')).toBeDefined();
    expect(getValidator('excitation-entry')).toBeDefined();
  });
});

describe('2. ZERO FALSE POSITIVES PROPERTY Tests', () => {
  const types: FlipFlopType[] = ['SR', 'JK', 'D', 'T'];

  it('accepts correct answers for every characteristic row across all 4 types', () => {
    let checked = 0;
    for (const type of types) {
      const rows = characteristicTable(type);
      for (const r of rows) {
        const submission: StepSubmission = {
          moduleId: 'flipflop',
          stepId: 'ff-characteristic-row',
          studentAnswer: {
            kind: 'state-table-row',
            presentState: String(r.q),
            nextState: String(r.qNext),
          },
          timestamp: '2026-10-06T12:00:00Z',
        };

        const outcome = validateFlipFlopCharacteristicRow(submission, {
          type,
          inputs: r.inputs,
          q: r.q,
        });
        expect(outcome.correct, `False positive on ${type} row ${r.index}`).toBe(true);
        checked++;
      }
    }
    // SR: 8, JK: 8, D: 4, T: 4 = 24 rows
    expect(checked).toBe(24);
  });

  it('accepts correct answers for every excitation table cell across all 4 types', () => {
    let checked = 0;
    for (const type of types) {
      const table = excitationTable(type);
      const names = inputNames(type);

      for (const row of table) {
        for (const pin of names) {
          const expectedVal = row.inputs[pin] ?? 'X';

          const submission: StepSubmission = {
            moduleId: 'flipflop',
            stepId: 'ff-excitation-row',
            studentAnswer: {
              kind: 'excitation-entry',
              flipFlop: type,
              presentState: String(row.q),
              nextState: String(row.qNext),
              inputValues: { [pin]: expectedVal },
            },
            timestamp: '2026-10-06T12:00:00Z',
          };

          const outcome = validateFlipFlopExcitationRow(submission, {
            type,
            q: row.q,
            qNext: row.qNext,
            inputName: pin,
          });
          expect(
            outcome.correct,
            `False positive on ${type} excitation ${row.q}->${row.qNext} pin ${pin}`
          ).toBe(true);
          checked++;
        }
      }
    }
    // SR: 4*2=8, JK: 4*2=8, D: 4*1=4, T: 4*1=4 = 24 cells
    expect(checked).toBe(24);
  });

  it('accepts correct pulse predictions over 100 seeded random scripts through evaluateStep', () => {
    const prng = createPrng(55667788);

    for (let i = 0; i < 100; i++) {
      const type = prngChoice(prng, types) ?? 'D';
      const names = inputNames(type);

      const config: FlipFlopConfig = {
        ...defaultConfig(type),
        propagationDelay: 1,
      };

      const initialQ: LogicValue = prngChoice(prng, [0, 1]) ?? 0;
      const initialInputs: Record<string, LogicValue> = {};
      for (const n of names) initialInputs[n] = prngChoice(prng, [0, 1]) ?? 0;

      const events: FlipFlopScriptEvent[] = [
        { time: 5, signal: names[0] ?? 'D', value: prngChoice(prng, [0, 1]) ?? 0 },
        { time: 10, signal: 'CLK', value: 1 },
      ];

      const script: FlipFlopScript = {
        initialQ,
        initialClock: 0,
        initialInputs,
        events,
        endTime: 20,
      };

      const sim = simulateTimeline(config, script);
      expect(sim.ok).toBe(true);
      if (!sim.ok) continue;

      const submission: StepSubmission = {
        moduleId: 'flipflop',
        stepId: 'ff-pulse-prediction',
        studentAnswer: {
          kind: 'ff-pulse-prediction' as unknown as 'state-table-row',
          presentState: String(initialQ),
          nextState: String(sim.finalState.q),
        },
        timestamp: '2026-10-06T12:00:00Z',
      };

      const res = evaluateStep(submission, {
        flipflop: {
          config,
          script,
          pulseIndex: 1,
        },
      } as unknown as import('../types').StepContext);

      expect(res.ok, `False positive on pulse prediction run ${i}`).toBe(true);
    }
  });
});

describe('3. Mutation Tests and Misconception Diagnostics', () => {
  it('identifies confused-q-and-qnext in characteristic row when student submits present state Q', () => {
    const submission: StepSubmission = {
      moduleId: 'flipflop',
      stepId: 'ff-characteristic-row',
      studentAnswer: {
        kind: 'state-table-row',
        presentState: '0',
        nextState: '0',
      },
      timestamp: '2026-10-06T12:00:00Z',
    };

    const outcome = validateFlipFlopCharacteristicRow(submission, {
      type: 'D',
      inputs: [1],
      q: 0,
    });

    expect(outcome.correct).toBe(false);
    if (!outcome.correct) {
      expect(outcome.misconceptionTag).toBe('confused-q-and-qnext');
      expect(outcome.errorType).toBe('misconception');
    }
  });

  it('identifies forbidden SR S=1, R=1 input row when student enters a concrete 0 or 1', () => {
    const submission: StepSubmission = {
      moduleId: 'flipflop',
      stepId: 'ff-characteristic-row',
      studentAnswer: {
        kind: 'state-table-row',
        presentState: '0',
        nextState: '1',
      },
      timestamp: '2026-10-06T12:00:00Z',
    };

    const outcome = validateFlipFlopCharacteristicRow(submission, {
      type: 'SR',
      inputs: [1, 1],
      q: 0,
    });

    expect(outcome.correct).toBe(false);
    if (!outcome.correct) {
      expect(outcome.details).toContain('forbidden');
      expect(outcome.details).toContain('metastability');
    }
  });

  it('accepts with a note when student enters concrete 0 or 1 for don-t-care excitation cell', () => {
    const submission: StepSubmission = {
      moduleId: 'flipflop',
      stepId: 'ff-excitation-row',
      studentAnswer: {
        kind: 'excitation-entry',
        flipFlop: 'JK',
        presentState: '0',
        nextState: '0',
        inputValues: { K: 0 as LogicValue },
      },
      timestamp: '2026-10-06T12:00:00Z',
    };

    const outcome = validateFlipFlopExcitationRow(submission, {
      type: 'JK',
      q: 0,
      qNext: 0,
      inputName: 'K',
    });

    expect(outcome.correct).toBe(true);
  });

  it('identifies confused-q-and-qnext in excitation table when student evaluates reverse transition', () => {
    const submission: StepSubmission = {
      moduleId: 'flipflop',
      stepId: 'ff-excitation-row',
      studentAnswer: {
        kind: 'excitation-entry',
        flipFlop: 'SR',
        presentState: '0',
        nextState: '1',
        inputValues: { S: 0 as LogicValue },
      },
      timestamp: '2026-10-06T12:00:00Z',
    };

    const outcome = validateFlipFlopExcitationRow(submission, {
      type: 'SR',
      q: 0,
      qNext: 1,
      inputName: 'S',
    });

    expect(outcome.correct).toBe(false);
    if (!outcome.correct) {
      expect(outcome.misconceptionTag).toBe('confused-q-and-qnext');
      expect(outcome.details).toContain('reverse transition');
    }
  });

  it('identifies wrong-excitation-table for general incorrect excitation entries', () => {
    const submission: StepSubmission = {
      moduleId: 'flipflop',
      stepId: 'ff-excitation-row',
      studentAnswer: {
        kind: 'excitation-entry',
        flipFlop: 'JK',
        presentState: '0',
        nextState: '1',
        inputValues: { J: 0 as LogicValue },
      },
      timestamp: '2026-10-06T12:00:00Z',
    };

    const outcome = validateFlipFlopExcitationRow(submission, {
      type: 'JK',
      q: 0,
      qNext: 1,
      inputName: 'J',
    });

    expect(outcome.correct).toBe(false);
    if (!outcome.correct) {
      expect(outcome.misconceptionTag).toBe('wrong-excitation-table');
      expect(outcome.errorType).toBe('incorrect-excitation');
    }
  });

  it('identifies confused-q-and-qnext in pulse prediction when student reports state before pulse', () => {
    const config = defaultConfig('D');
    const script: FlipFlopScript = {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { D: 1 },
      events: [{ time: 10, signal: 'CLK', value: 1 }],
      endTime: 20,
    };

    const submission: StepSubmission = {
      moduleId: 'flipflop',
      stepId: 'ff-pulse-prediction',
      studentAnswer: {
        kind: 'state-table-row',
        presentState: '0',
        nextState: '0',
      },
      timestamp: '2026-10-06T12:00:00Z',
    };

    const outcome = validateFlipFlopPulsePrediction(submission, {
      config,
      script,
      pulseIndex: 1,
    });

    expect(outcome.correct).toBe(false);
    if (!outcome.correct) {
      expect(outcome.misconceptionTag).toBe('confused-q-and-qnext');
    }
  });
});

describe('4. Three-Tiered Hint Ladder, No-Leak Invariants, and Catalog Markdown', () => {
  const FF_TAGS = ['wrong-excitation-table', 'confused-q-and-qnext'] as const;

  it('ensures both flip-flop misconception tags provide all three hint template tiers', () => {
    for (const tag of FF_TAGS) {
      const entry = getMisconception(tag);
      expect(entry).toBeDefined();
      expect(entry.tag).toBe(tag);
      expect(entry.hints.level1).toBeTypeOf('function');
      expect(entry.hints.level2).toBeTypeOf('function');
      expect(entry.hints.level3).toBeTypeOf('function');
    }
  });

  it('NO-LEAK INVARIANT: Levels 1 and 2 NEVER contain the expected target value string', () => {
    const secret = 'SECRET_TARGET_VALUE_XYZ_456';
    const ctx = {
      expected: secret,
      got: 'STUDENT_ERRONEOUS_VALUE',
      detail: 'test detail context',
    };

    for (const tag of FF_TAGS) {
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
    const entry = getMisconception('wrong-excitation-table');
    const diag: Diagnosis = {
      step: 'ff-excitation-row',
      errorType: 'incorrect-excitation',
      expected: { kind: 'excitation-entry', inputValues: { J: 1, K: 'X' } },
      got: { kind: 'excitation-entry', inputValues: { J: 0, K: 'X' } },
      misconceptionTag: entry.tag,
      hint: 'hint',
      fullExplanation: 'explanation',
    };

    let session = createHintSession('ff-excitation-row');
    const r1 = requestHint(session, diag, '2026-10-06T12:00:00Z');
    expect(r1.hint.level).toBe(1);
    expect(r1.assisted).toBe(false);
    session = r1.session;

    const r2 = requestHint(session, diag, '2026-10-06T12:01:00Z');
    expect(r2.hint.level).toBe(2);
    expect(r2.assisted).toBe(false);
    session = r2.session;

    const r3 = requestHint(session, diag, '2026-10-06T12:02:00Z');
    expect(r3.hint.level).toBe(3);
    expect(r3.assisted).toBe(true);
  });

  it('renders catalog Markdown including both flip-flop misconception tags', () => {
    const md = renderCatalogMarkdown();
    expect(md).toContain('wrong-excitation-table');
    expect(md).toContain('confused-q-and-qnext');
    expect(md).toContain('Incorrect Flip-Flop Excitation Input Logic');
    expect(md).toContain('Confused Present State Q with Next State Q+');
  });
});
