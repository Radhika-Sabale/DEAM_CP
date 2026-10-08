/**
 * @file hazards.test.ts
 * Tests for race-around hazard analysis, invalid input identification,
 * asynchronous control conflicts, and engineering remedies.
 */

import { describe, expect, it } from 'vitest';
import { createPrng, prngInt } from '../common/seededRandom';
import {
  analyzeRaceAround,
  asyncConflict,
  invalidInputCombinations,
  remedies,
} from './hazards';
import { defaultConfig, type FlipFlopConfig } from './models';
import { simulateTimeline, type FlipFlopScript } from './stepper';

describe('1. Invalid Input Combinations and Hazard Remedies', () => {
  it('reports S=1, R=1 as the sole invalid combination for SR flip-flop', () => {
    const srInvalids = invalidInputCombinations('SR');
    expect(srInvalids).toHaveLength(1);
    expect(srInvalids[0]?.inputs).toEqual({ S: 1, R: 1 });
    expect(srInvalids[0]?.reason).toContain('indeterminate');

    expect(invalidInputCombinations('JK')).toHaveLength(0);
    expect(invalidInputCombinations('D')).toHaveLength(0);
    expect(invalidInputCombinations('T')).toHaveLength(0);
  });

  it('provides all three standard engineering remedies against race-around', () => {
    const list = remedies(defaultConfig('JK'));
    expect(list).toHaveLength(3);
    const ids = list.map((r) => r.id);
    expect(ids).toContain('edge-triggering');
    expect(ids).toContain('master-slave');
    expect(ids).toContain('pulse-narrowing');
  });
});

describe('2. Asynchronous Control Conflict Analysis', () => {
  it('evaluates active-low PRESET and CLEAR pins correctly', () => {
    const config: FlipFlopConfig = {
      ...defaultConfig('D'),
      asyncControls: true,
      asyncActiveLow: true,
    };

    // Both inactive (1, 1)
    expect(asyncConflict(config, 1, 1).activeAssertion).toBe('none');

    // PRE asserted (0, 1)
    const preRes = asyncConflict(config, 0, 1);
    expect(preRes.activeAssertion).toBe('preset');
    expect(preRes.outputQ).toBe(1);
    expect(preRes.outputQbar).toBe(0);

    // CLR asserted (1, 0)
    const clrRes = asyncConflict(config, 1, 0);
    expect(clrRes.activeAssertion).toBe('clear');
    expect(clrRes.outputQ).toBe(0);
    expect(clrRes.outputQbar).toBe(1);

    // Conflict (0, 0)
    const conflictRes = asyncConflict(config, 0, 0);
    expect(conflictRes.isConflict).toBe(true);
    expect(conflictRes.activeAssertion).toBe('both');
    expect(conflictRes.outputQ).toBe(1);
    expect(conflictRes.outputQbar).toBe(1);
  });
});

describe('3. Race-Around Hazard Prediction vs Simulator Trace', () => {
  it('edge-triggered JK flip-flop never reports race-around hazard even with J=K=1', () => {
    const edgeConfig: FlipFlopConfig = {
      ...defaultConfig('JK'),
      trigger: 'rising',
      propagationDelay: 2,
    };

    const analysis = analyzeRaceAround(edgeConfig, { J: 1, K: 1 }, 20);
    expect(analysis.applicable).toBe(false);
    expect(analysis.occurs).toBe(false);
    expect(analysis.toggleCount).toBe(0);
  });

  it('zero-delay level-triggered configuration reports unbounded toggle count', () => {
    const zeroDelayConfig: FlipFlopConfig = {
      ...defaultConfig('JK'),
      trigger: 'level-high',
      propagationDelay: 0,
    };

    const analysis = analyzeRaceAround(zeroDelayConfig, { J: 1, K: 1 }, 10);
    expect(analysis.applicable).toBe(true);
    expect(analysis.occurs).toBe(true);
    expect(analysis.toggleCount).toBe('unbounded');
    expect(analysis.finalQRelation).toBe('unknown');
  });

  it('matches simulated toggle counts across 200 seeded (pulseWidth, delay) pairs', () => {
    const prng = createPrng(12345678);

    for (let i = 0; i < 200; i++) {
      const delay = prngInt(prng, 1, 5); // t_pd in [1, 5]
      const pulseWidth = prngInt(prng, 2, 25); // t_w in [2, 25]

      const config: FlipFlopConfig = {
        ...defaultConfig('JK'),
        trigger: 'level-high',
        propagationDelay: delay,
      };

      const analysis = analyzeRaceAround(config, { J: 1, K: 1 }, pulseWidth);
      expect(analysis.applicable).toBe(true);
      expect(analysis.occurs).toBe(true);

      const expectedToggles = Math.ceil(pulseWidth / delay);
      expect(analysis.toggleCount).toBe(expectedToggles);

      // Verify against simulateTimeline
      const script: FlipFlopScript = {
        initialQ: 0,
        initialClock: 0,
        initialInputs: { J: 1, K: 1 },
        events: [
          { time: 5, signal: 'CLK', value: 1 }, // clock opens at t=5
          { time: 5 + pulseWidth, signal: 'CLK', value: 0 }, // clock closes
        ],
        endTime: 5 + pulseWidth + delay + 5,
      };

      const simRes = simulateTimeline(config, script);
      expect(simRes.ok).toBe(true);
      if (!simRes.ok) continue;

      // The simulator counts Q updates triggered during the pulse
      expect(simRes.stats.qTogglesCount).toBe(expectedToggles);
    }
  });
});
