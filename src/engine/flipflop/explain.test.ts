/**
 * @file explain.test.ts
 * Tests for plain-language pedagogical explanations:
 * - Checks every FlipFlopEvent kind.
 * - Asserts presence of required key phrases.
 * - Verifies absence of formatting corruptions like "undefined" or "[object".
 * - Tests trigger, invalid state, and race-around explainers.
 */

import { describe, expect, it } from 'vitest';
import {
  explainEvent,
  explainInvalidState,
  explainRaceAround,
  explainTrigger,
} from './explain';
import { defaultConfig } from './models';
import type { FlipFlopEvent } from './stepperRules';

describe('1. FlipFlopEvent Explanation Generators', () => {
  const config = defaultConfig('JK');

  const sampleEvents: FlipFlopEvent[] = [
    {
      kind: 'active-edge',
      time: 10,
      edge: 'rising',
      sampledInputs: { J: 1, K: 0 },
      operation: 'Set',
      qBefore: 0,
      qAfter: 1,
    },
    {
      kind: 'level-open',
      time: 5,
      level: 'high',
      sampledInputs: { D: 1 },
    },
    {
      kind: 'level-close',
      time: 15,
      level: 'high',
    },
    {
      kind: 'q-update',
      time: 11,
      qBefore: 0,
      qAfter: 1,
      source: 'clock',
    },
    {
      kind: 'invalid-input',
      time: 8,
      inputs: { S: 1, R: 1 },
      message: 'Invalid S=1, R=1.',
    },
    {
      kind: 'async-set',
      time: 4,
      qBefore: 0,
    },
    {
      kind: 'async-clear',
      time: 6,
      qBefore: 1,
    },
    {
      kind: 'async-conflict',
      time: 7,
      message: 'Conflict.',
    },
    {
      kind: 'async-release',
      time: 9,
      releasedPins: ['PRE', 'CLR'],
      resultingQ: 'X',
    },
    {
      kind: 'clock-ignored',
      time: 10,
      reason: 'Async active.',
    },
    {
      kind: 'race-around-toggle',
      time: 12,
      toggleIndex: 2,
      qBefore: 1,
      qAfter: 0,
    },
    {
      kind: 'race-around-unbounded',
      time: 13,
      message: 'Unbounded loop.',
    },
    {
      kind: 'timing-violation',
      time: 14,
      violationType: 'setup',
      signal: 'D',
      edgeTime: 14,
      eventTime: 12,
    },
    {
      kind: 'unknown-clock',
      time: 16,
      message: 'Clock is X.',
    },
  ];

  it('generates non-empty explanations for every known FlipFlopEvent kind', () => {
    for (const ev of sampleEvents) {
      const explanations = explainEvent(ev, config);
      expect(explanations.length).toBeGreaterThan(0);
      for (const item of explanations) {
        expect(item.code).toBeDefined();
        expect(item.severity).toBeDefined();
        expect(item.text).toBeTruthy();
        expect(item.text).not.toContain('undefined');
        expect(item.text).not.toContain('[object');
        expect(item.text).not.toContain('null');
      }
    }
  });

  it('active-edge explanation contains exact time, sampled inputs, and delay description', () => {
    const ev: FlipFlopEvent = {
      kind: 'active-edge',
      time: 10,
      edge: 'rising',
      sampledInputs: { J: 1, K: 0 },
      operation: 'Set',
      qBefore: 0,
      qAfter: 1,
    };
    const explanations = explainEvent(ev, { ...config, propagationDelay: 2 });
    expect(explanations[0]?.text).toContain('t = 10');
    expect(explanations[0]?.text).toContain('clock rose');
    expect(explanations[0]?.text).toContain('J = 1, K = 0');
    expect(explanations[0]?.text).toContain('Set');
    expect(explanations[0]?.text).toContain('after 2 time units');
  });
});

describe('2. Invalid State, Race-Around, and Trigger Explanations', () => {
  it('explains SR forbidden state with metastability warning', () => {
    const srExplain = explainInvalidState('SR');
    expect(srExplain.title).toContain('SR Latch Forbidden State');
    expect(srExplain.explanation).toContain('metastable');
    expect(srExplain.explanation).not.toContain('undefined');
    expect(srExplain.consequences.length).toBeGreaterThan(0);

    const jkExplain = explainInvalidState('JK');
    expect(jkExplain.consequences[0]).toContain('No forbidden');
  });

  it('explains race-around for edge, level bounded, and level unbounded', () => {
    const edgeExp = explainRaceAround(
      { applicable: false, occurs: false, toggleCount: 0, finalQRelation: 'same-as-before' },
      defaultConfig('JK')
    );
    expect(edgeExp).toContain('not applicable');

    const boundedExp = explainRaceAround(
      { applicable: true, occurs: true, toggleCount: 5, finalQRelation: 'complemented' },
      { ...defaultConfig('JK'), trigger: 'level-high' }
    );
    expect(boundedExp).toContain('toggles 5 time(s)');
    expect(boundedExp).toContain('complemented');

    const unboundedExp = explainRaceAround(
      { applicable: true, occurs: true, toggleCount: 'unbounded', finalQRelation: 'unknown' },
      { ...defaultConfig('JK'), trigger: 'level-high', propagationDelay: 0 }
    );
    expect(unboundedExp).toContain('oscillates indefinitely');
  });

  it('explains all four trigger modes and their sampling rules', () => {
    for (const mode of ['rising', 'falling', 'level-high', 'level-low'] as const) {
      const exp = explainTrigger(mode);
      expect(exp.title).toBeTruthy();
      expect(exp.description).toBeTruthy();
      expect(exp.samplingRule).toBeTruthy();
      expect(exp.samplingRule).not.toContain('undefined');
    }
  });
});
