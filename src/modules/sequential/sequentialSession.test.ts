/**
 * @file sequentialSession.test.ts
 * Unit tests for sequentialSession reducer, locking rules, spec invalidation, and reload re-derivation.
 */

import { describe, expect, it } from 'vitest';
import type { DesignProject } from '../../types/designProject';
import type { CounterSpec, DetectorSpec } from '../../types/sequential';
import {
  createInitialSequentialSession,
  deriveSessionFromProject,
  getStepLockReason,
  hasLaterDrafts,
  isStepUnlocked,
  sequentialSessionReducer,
  type SequentialSessionState,
} from './sequentialSession';

describe('sequentialSession reducer', () => {
  it('initializes in counter mode with flipflop as first unlocked step', () => {
    const s = createInitialSequentialSession('counter');
    expect(s.kind).toBe('counter');
    expect(s.currentStep).toBe('flipflop');
    expect(isStepUnlocked(s, 'flipflop')).toBe(true);
    expect(isStepUnlocked(s, 'define')).toBe(false);
    expect(getStepLockReason(s, 'define')).toBe('Choose a flip-flop first');
  });

  it('unlocks subsequent steps only when previous step is verified or assisted', () => {
    let s = createInitialSequentialSession();
    // Cannot select locked step
    s = sequentialSessionReducer(s, { type: 'selectStep', stepId: 'define' });
    expect(s.currentStep).toBe('flipflop');

    // Mark flipflop verified
    s = sequentialSessionReducer(s, {
      type: 'markVerified',
      stepId: 'flipflop',
      draft: 'D',
    });
    expect(isStepUnlocked(s, 'define')).toBe(true);
    expect(getStepLockReason(s, 'define')).toBeNull();

    // Now define can be selected
    s = sequentialSessionReducer(s, { type: 'selectStep', stepId: 'define' });
    expect(s.currentStep).toBe('define');

    // Diagram remains locked until define is verified or assisted
    expect(isStepUnlocked(s, 'diagram')).toBe(false);
    expect(getStepLockReason(s, 'diagram')).toBe(
      'Define the machine specification first'
    );

    // Mark define assisted
    s = sequentialSessionReducer(s, {
      type: 'markAssisted',
      stepId: 'define',
      draft: { kind: 'counter', modulus: 4 },
    });
    expect(isStepUnlocked(s, 'diagram')).toBe(true);
  });

  it('invalidates downstream steps and drops drafts when spec changes', () => {
    const spec1: CounterSpec = {
      kind: 'counter',
      flipFlop: 'D',
      style: 'sync',
      direction: 'up',
      modulus: 4,
    };
    let s = createInitialSequentialSession();
    s = sequentialSessionReducer(s, {
      type: 'markVerified',
      stepId: 'flipflop',
      draft: 'D',
    });
    s = sequentialSessionReducer(s, { type: 'setSpec', spec: spec1 });
    expect(s.steps.define.status).toBe('verified');

    // Populate drafts downstream
    s = sequentialSessionReducer(s, {
      type: 'updateDraft',
      stepId: 'diagram',
      draft: { transitions: [1, 2] },
    });
    s = sequentialSessionReducer(s, {
      type: 'markVerified',
      stepId: 'diagram',
    });
    s = sequentialSessionReducer(s, {
      type: 'updateDraft',
      stepId: 'table',
      draft: { rows: ['row1'] },
    });

    expect(hasLaterDrafts(s, 'define')).toBe(true);
    expect(s.steps.diagram.status).toBe('verified');
    expect(s.steps.table.draft).toEqual({ rows: ['row1'] });

    // Change spec to Mod-5
    const spec2: CounterSpec = {
      kind: 'counter',
      flipFlop: 'D',
      style: 'sync',
      direction: 'up',
      modulus: 5,
    };
    s = sequentialSessionReducer(s, { type: 'setSpec', spec: spec2 });

    // Downstream steps must be reset to not-started and drafts dropped
    expect(s.steps.diagram.status).toBe('not-started');
    expect(s.steps.diagram.draft).toBeNull();
    expect(s.steps.table.status).toBe('not-started');
    expect(s.steps.table.draft).toBeNull();
    expect(hasLaterDrafts(s, 'define')).toBe(false);
  });

  it('skips state diagram for asynchronous ripple counter specs', () => {
    const asyncSpec: CounterSpec = {
      kind: 'counter',
      flipFlop: 'JK',
      style: 'async',
      direction: 'up',
      modulus: 4,
    };
    let s = createInitialSequentialSession();
    s = sequentialSessionReducer(s, { type: 'setSpec', spec: asyncSpec });

    expect(s.steps.diagram.status).toBe('verified');
    expect(typeof s.steps.diagram.draft).toBe('string');
    expect(s.steps.diagram.draft).toContain(
      'Asynchronous ripple counters follow a fixed pattern'
    );
  });

  it('survives JSON round trip faithfully and remains deterministic', () => {
    let s = createInitialSequentialSession();
    s = sequentialSessionReducer(s, {
      type: 'markVerified',
      stepId: 'flipflop',
      draft: 'JK',
    });
    s = sequentialSessionReducer(s, {
      type: 'updateDraft',
      stepId: 'define',
      draft: { modulus: 8 },
    });

    const json = JSON.stringify(s);
    const parsed: SequentialSessionState = JSON.parse(json);
    expect(parsed).toEqual(s);

    // Reducer is deterministic
    const action = {
      type: 'markVerified' as const,
      stepId: 'define' as const,
      draft: { modulus: 8 },
    };
    const s1 = sequentialSessionReducer(s, action);
    const s2 = sequentialSessionReducer(s, action);
    expect(s1).toEqual(s2);
  });

  it('re-derives session from project on reload restoring only matching verified artifacts', () => {
    const detSpec: DetectorSpec = {
      kind: 'detector',
      flipFlop: 'T',
      pattern: '101',
      machine: 'mealy',
      overlapping: true,
    };

    const project: DesignProject = {
      schemaVersion: 2,
      id: 'proj-123',
      name: 'Detector Project',
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:05:00Z',
      flipFlopType: 'T',
      sequentialSpec: detSpec,
      stateTable: {
        rows: [],
      },
    };

    const reloaded = deriveSessionFromProject(project);
    expect(reloaded.kind).toBe('detector');
    expect(reloaded.spec).toEqual(detSpec);
    expect(reloaded.steps.flipflop.status).toBe('verified');
    expect(reloaded.steps.flipflop.draft).toBe('T');
    expect(reloaded.steps.define.status).toBe('verified');
    expect(reloaded.steps.table.status).toBe('verified');
    expect(reloaded.steps.excitation.status).toBe('not-started');
  });
});
