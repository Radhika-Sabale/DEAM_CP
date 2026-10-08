/**
 * @file presets.test.ts
 * Validation tests for all educational preset scenarios:
 * Ensures every preset runs cleanly in simulateTimeline and reproduces expected behavior.
 */

import { describe, expect, it } from 'vitest';
import { getPresetScenario, PRESET_SCENARIOS } from './presets';
import { simulateTimeline } from './stepper';

describe('Flip-Flop Scenario Presets Verification', () => {
  it('contains all 9 required educational presets', () => {
    expect(PRESET_SCENARIOS).toHaveLength(9);
    const requiredIds = [
      'd-captures-on-edge',
      't-divide-by-two',
      'jk-toggle-edge',
      'sr-invalid-state',
      'level-jk-race-around',
      'edge-jk-no-race',
      'async-clear-overrides-clock',
      'async-conflict',
      'setup-violation',
    ];
    for (const id of requiredIds) {
      expect(getPresetScenario(id)).toBeDefined();
    }
  });

  it('verifies d-captures-on-edge preset', () => {
    const preset = getPresetScenario('d-captures-on-edge');
    expect(preset).toBeDefined();
    if (!preset) return;

    const res = simulateTimeline(preset.config, preset.script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.finalState.q).toBe(1);
    expect(res.stats.activeEdgesCount).toBe(1);
  });

  it('verifies t-divide-by-two preset divides frequency and toggles 3 times', () => {
    const preset = getPresetScenario('t-divide-by-two');
    expect(preset).toBeDefined();
    if (!preset) return;

    const res = simulateTimeline(preset.config, preset.script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.stats.activeEdgesCount).toBe(3);
    expect(res.stats.qTogglesCount).toBe(3);
    expect(res.finalState.q).toBe(1);
  });

  it('verifies sr-invalid-state preset ends with Q = X and emits invalid-input event', () => {
    const preset = getPresetScenario('sr-invalid-state');
    expect(preset).toBeDefined();
    if (!preset) return;

    const res = simulateTimeline(preset.config, preset.script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.finalState.q).toBe('X');
    expect(res.events.some((e) => e.kind === 'invalid-input')).toBe(true);
  });

  it('verifies level-jk-race-around preset toggles exactly 5 times during pulse', () => {
    const preset = getPresetScenario('level-jk-race-around');
    expect(preset).toBeDefined();
    if (!preset) return;

    const res = simulateTimeline(preset.config, preset.script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.stats.qTogglesCount).toBe(5);
    const raceEvents = res.events.filter((e) => e.kind === 'race-around-toggle');
    expect(raceEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('verifies edge-jk-no-race preset toggles once and has no race-around', () => {
    const preset = getPresetScenario('edge-jk-no-race');
    expect(preset).toBeDefined();
    if (!preset) return;

    const res = simulateTimeline(preset.config, preset.script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.stats.qTogglesCount).toBe(1);
    expect(res.events.some((e) => e.kind === 'race-around-toggle')).toBe(false);
  });

  it('verifies async-clear-overrides-clock preset resets Q to 0 and ignores clock', () => {
    const preset = getPresetScenario('async-clear-overrides-clock');
    expect(preset).toBeDefined();
    if (!preset) return;

    const res = simulateTimeline(preset.config, preset.script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.finalState.q).toBe(0);
    expect(res.events.some((e) => e.kind === 'clock-ignored')).toBe(true);
  });

  it('verifies async-conflict preset forces both Q and Qbar to 1', () => {
    const preset = getPresetScenario('async-conflict');
    expect(preset).toBeDefined();
    if (!preset) return;

    const res = simulateTimeline(preset.config, preset.script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.finalState.q).toBe(1);
    expect(res.finalState.qBar).toBe(1);
    expect(res.events.some((e) => e.kind === 'async-conflict')).toBe(true);
  });

  it('verifies setup-violation preset detects violation and sets Q to X', () => {
    const preset = getPresetScenario('setup-violation');
    expect(preset).toBeDefined();
    if (!preset) return;

    const res = simulateTimeline(preset.config, preset.script);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.stats.timingViolationsCount).toBe(1);
    expect(res.finalState.q).toBe('X');
    expect(res.events.some((e) => e.kind === 'timing-violation')).toBe(true);
  });
});
