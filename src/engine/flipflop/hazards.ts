/**
 * @file hazards.ts
 * Analytical engines for sequential hazards, race-around conditions in level-sensitive
 * latches, invalid input state characterization, and asynchronous control conflicts.
 */

import type { LogicValue } from '../../types/ast';
import type { FlipFlopType } from '../../types/sequential';
import { inputNames, nextState, type FlipFlopConfig } from './models';

/**
 * Report of an invalid or forbidden input combination.
 */
export interface InvalidInputInfo {
  readonly inputs: Record<string, LogicValue>;
  readonly reason: string;
}

/**
 * Diagnostic analysis of race-around condition in a flip-flop configuration.
 */
export interface RaceAroundAnalysis {
  /** True if the architecture is level-sensitive and susceptible to race-around */
  readonly applicable: boolean;
  /** True if current inputs cause continuous toggling during an active clock pulse */
  readonly occurs: boolean;
  /** Estimated number of toggles during clock pulse, or "unbounded" if delay is 0 */
  readonly toggleCount: number | 'unbounded';
  /** Expected final settled state relative to starting state */
  readonly finalQRelation: 'same-as-before' | 'complemented' | 'unknown';
}

/**
 * Engineering remedy for eliminating race-around conditions.
 */
export interface HazardRemedy {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

/**
 * Diagnostic analysis of asynchronous PRESET and CLEAR pin valuations.
 */
export interface AsyncConflictAnalysis {
  readonly isConflict: boolean;
  readonly activeAssertion: 'none' | 'preset' | 'clear' | 'both';
  readonly outputQ: LogicValue;
  readonly outputQbar: LogicValue;
  readonly warning?: string;
}

/**
 * Returns any invalid or forbidden input combinations for a flip-flop architecture.
 *
 * @param type Flip-flop architecture
 * @returns Array of InvalidInputInfo descriptions (non-empty only for SR)
 */
export function invalidInputCombinations(
  type: FlipFlopType
): readonly InvalidInputInfo[] {
  if (type === 'SR') {
    return [
      {
        inputs: { S: 1, R: 1 },
        reason:
          'Simultaneous Set (S=1) and Reset (R=1) produces an indeterminate next state and violates the complementary Q/Qbar output invariant in basic latch circuits.',
      },
    ];
  }
  return [];
}

/**
 * Analyzes race-around susceptibility and calculates predicted toggle counts.
 *
 * A race-around condition occurs in level-sensitive latches when:
 * 1. Clock is held at its active level (pulse width t_w).
 * 2. Inputs cause the output to complement on each iteration (e.g. JK with J=K=1, T with T=1).
 * 3. Propagation delay t_pd < pulse width t_w, allowing output changes to race back to inputs.
 *
 * @param config Flip-flop configuration
 * @param inputs Current input logic values
 * @param pulseWidth Active clock pulse duration
 * @returns RaceAroundAnalysis breakdown
 */
export function analyzeRaceAround(
  config: FlipFlopConfig,
  inputs: Record<string, LogicValue>,
  pulseWidth: number
): RaceAroundAnalysis {
  const isLevel = config.trigger === 'level-high' || config.trigger === 'level-low';

  if (!isLevel) {
    return {
      applicable: false,
      occurs: false,
      toggleCount: 0,
      finalQRelation: 'same-as-before',
    };
  }

  const names = inputNames(config.type);
  const inVec = names.map((n) => inputs[n] ?? 0);

  // Check if inputs make Q always invert: nextState(0) === 1 and nextState(1) === 0
  const flipsFromZero = nextState(config.type, inVec, 0) === 1;
  const flipsFromOne = nextState(config.type, inVec, 1) === 0;
  const isAlwaysToggling = flipsFromZero && flipsFromOne;

  if (!isAlwaysToggling || pulseWidth <= 0) {
    return {
      applicable: true,
      occurs: false,
      toggleCount: 0,
      finalQRelation: 'same-as-before',
    };
  }

  if (config.propagationDelay === 0) {
    return {
      applicable: true,
      occurs: true,
      toggleCount: 'unbounded',
      finalQRelation: 'unknown',
    };
  }

  const toggleCount = Math.ceil(pulseWidth / config.propagationDelay);
  const finalQRelation = toggleCount % 2 === 0 ? 'same-as-before' : 'complemented';

  return {
    applicable: true,
    occurs: true,
    toggleCount,
    finalQRelation,
  };
}

/**
 * Standard engineering remedies to mitigate race-around conditions in sequential circuits.
 *
 * @param _config Component configuration
 * @returns Array of standard architectural remedies
 */
export function remedies(config: FlipFlopConfig): readonly HazardRemedy[] {
  // Remedies applicable to level-sensitive and sequential hazard prevention
  const remediesList: HazardRemedy[] = [
    {
      id: 'edge-triggering',
      title: 'Edge-Triggered Flip-Flop Conversion',
      description:
        'Transition from level-sensitive latching to edge-triggered flip-flops. Data is sampled only during brief voltage transitions (rising or falling edges), preventing multiple toggles within a single clock period.',
    },
    {
      id: 'master-slave',
      title: 'Master-Slave Architecture',
      description:
        'Use a dual-rank master-slave topology. The master latch captures input data while the clock is high, but output updates are isolated until the clock transitions low, breaking the feedback loop.',
    },
    {
      id: 'pulse-narrowing',
      title: 'Clock Pulse Width Reduction (tw < tpd)',
      description:
        'Ensure clock pulse duration tw is strictly less than the internal propagation delay tpd of the latch, so the clock disables before output feedback can reach the input gates.',
    },
  ];
  return config.type ? remediesList : remediesList;
}

/**
 * Evaluates asynchronous PRESET and CLEAR pins for active assertion or conflict.
 *
 * @param config Flip-flop configuration
 * @param preValue Logic level on PRE pin
 * @param clrValue Logic level on CLR pin
 * @returns AsyncConflictAnalysis report
 */
export function asyncConflict(
  config: FlipFlopConfig,
  preValue: LogicValue,
  clrValue: LogicValue
): AsyncConflictAnalysis {
  if (!config.asyncControls) {
    return {
      isConflict: false,
      activeAssertion: 'none',
      outputQ: 'X',
      outputQbar: 'X',
    };
  }

  const activeLevel = config.asyncActiveLow ? 0 : 1;
  const preAsserted = preValue === activeLevel;
  const clrAsserted = clrValue === activeLevel;

  if (preValue === 'X' || clrValue === 'X') {
    return {
      isConflict: false,
      activeAssertion: 'none',
      outputQ: 'X',
      outputQbar: 'X',
      warning: 'Asynchronous control pin is in an unknown (X) logic state.',
    };
  }

  if (preAsserted && clrAsserted) {
    return {
      isConflict: true,
      activeAssertion: 'both',
      outputQ: 1,
      outputQbar: 1,
      warning:
        'Both PRESET and CLEAR are asserted simultaneously. This forces both Q and Qbar to 1, violating complementary outputs.',
    };
  }

  if (preAsserted) {
    return {
      isConflict: false,
      activeAssertion: 'preset',
      outputQ: 1,
      outputQbar: 0,
    };
  }

  if (clrAsserted) {
    return {
      isConflict: false,
      activeAssertion: 'clear',
      outputQ: 0,
      outputQbar: 1,
    };
  }

  return {
    isConflict: false,
    activeAssertion: 'none',
    outputQ: 'X',
    outputQbar: 'X',
  };
}
