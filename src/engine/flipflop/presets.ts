/**
 * @file presets.ts
 * Curated educational scenario presets for laboratory walkthroughs, interactive demonstrations,
 * race-around hazards, timing violations, and asynchronous override verification.
 */

import type { FlipFlopConfig } from './models';
import type { FlipFlopScript } from './stepperRules';

/**
 * Educational preset scenario specification.
 */
export interface FlipFlopPreset {
  /** Unique scenario identifier */
  readonly id: string;
  /** Human-readable headline */
  readonly title: string;
  /** Detailed educational walkthrough description */
  readonly description: string;
  /** Component configuration */
  readonly config: FlipFlopConfig;
  /** Input stimulus timeline script */
  readonly script: FlipFlopScript;
}

/**
 * Authoritative list of standard educational flip-flop simulation presets.
 */
export const PRESET_SCENARIOS: readonly FlipFlopPreset[] = [
  {
    id: 'd-captures-on-edge',
    title: 'D Flip-Flop Data Capture on Active Clock Edge',
    description:
      'Demonstrates standard positive-edge data capture. Data signal D changes at t = 5, and is sampled at the rising clock edge at t = 10, updating Q to 1 after unit propagation delay.',
    config: {
      type: 'D',
      trigger: 'rising',
      asyncControls: false,
      asyncActiveLow: true,
      propagationDelay: 1,
      setupTime: 0,
      holdTime: 0,
    },
    script: {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { D: 0 },
      events: [
        { time: 5, signal: 'D', value: 1 },
        { time: 10, signal: 'CLK', value: 1 },
        { time: 20, signal: 'CLK', value: 0 },
      ],
      endTime: 30,
    },
  },
  {
    id: 't-divide-by-two',
    title: 'T Flip-Flop Frequency Divider (Divide-by-2)',
    description:
      'Demonstrates binary counter/divider behavior with T = 1. The output Q toggles on every rising clock edge, halving the input clock frequency.',
    config: {
      type: 'T',
      trigger: 'rising',
      asyncControls: false,
      asyncActiveLow: true,
      propagationDelay: 1,
      setupTime: 0,
      holdTime: 0,
    },
    script: {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { T: 1 },
      events: [
        { time: 10, signal: 'CLK', value: 1 },
        { time: 20, signal: 'CLK', value: 0 },
        { time: 30, signal: 'CLK', value: 1 },
        { time: 40, signal: 'CLK', value: 0 },
        { time: 50, signal: 'CLK', value: 1 },
        { time: 60, signal: 'CLK', value: 0 },
      ],
      endTime: 70,
    },
  },
  {
    id: 'jk-toggle-edge',
    title: 'JK Flip-Flop Edge-Triggered Toggle Mode',
    description:
      'Demonstrates positive edge-triggered toggle operation when J = 1 and K = 1 without race-around oscillation.',
    config: {
      type: 'JK',
      trigger: 'rising',
      asyncControls: false,
      asyncActiveLow: true,
      propagationDelay: 1,
      setupTime: 0,
      holdTime: 0,
    },
    script: {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { J: 1, K: 1 },
      events: [
        { time: 10, signal: 'CLK', value: 1 },
        { time: 20, signal: 'CLK', value: 0 },
        { time: 30, signal: 'CLK', value: 1 },
      ],
      endTime: 40,
    },
  },
  {
    id: 'sr-invalid-state',
    title: 'SR Flip-Flop Forbidden State (S = 1, R = 1)',
    description:
      'Demonstrates the forbidden condition on an SR flip-flop when both Set and Reset are asserted simultaneously, driving next state Q to indeterminate (X).',
    config: {
      type: 'SR',
      trigger: 'rising',
      asyncControls: false,
      asyncActiveLow: true,
      propagationDelay: 1,
      setupTime: 0,
      holdTime: 0,
    },
    script: {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { S: 1, R: 1 },
      events: [{ time: 10, signal: 'CLK', value: 1 }],
      endTime: 20,
    },
  },
  {
    id: 'level-jk-race-around',
    title: 'Level-Sensitive JK Latch Race-Around Hazard',
    description:
      'Demonstrates race-around oscillation in a level-high transparent JK latch with J = K = 1, pulse width 10, and propagation delay 2. The output toggles 5 times during the high clock window.',
    config: {
      type: 'JK',
      trigger: 'level-high',
      asyncControls: false,
      asyncActiveLow: true,
      propagationDelay: 2,
      setupTime: 0,
      holdTime: 0,
    },
    script: {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { J: 1, K: 1 },
      events: [
        { time: 5, signal: 'CLK', value: 1 }, // clock opens at t=5
        { time: 15, signal: 'CLK', value: 0 }, // clock closes at t=15 (pulse width = 10)
      ],
      endTime: 25,
    },
  },
  {
    id: 'edge-jk-no-race',
    title: 'Edge-Triggered JK Flip-Flop Immunity to Race-Around',
    description:
      'Demonstrates that converting the JK flip-flop to edge-triggering completely eliminates the race-around hazard under identical pulse width and delay conditions.',
    config: {
      type: 'JK',
      trigger: 'rising',
      asyncControls: false,
      asyncActiveLow: true,
      propagationDelay: 2,
      setupTime: 0,
      holdTime: 0,
    },
    script: {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { J: 1, K: 1 },
      events: [
        { time: 5, signal: 'CLK', value: 1 },
        { time: 15, signal: 'CLK', value: 0 },
      ],
      endTime: 25,
    },
  },
  {
    id: 'async-clear-overrides-clock',
    title: 'Asynchronous Active-Low Clear Priority Override',
    description:
      'Demonstrates that asserting active-low CLEAR (CLR = 0) immediately resets Q to 0 and overrides clock edge transitions.',
    config: {
      type: 'D',
      trigger: 'rising',
      asyncControls: true,
      asyncActiveLow: true,
      propagationDelay: 1,
      setupTime: 0,
      holdTime: 0,
    },
    script: {
      initialQ: 1,
      initialClock: 0,
      initialPreset: 1,
      initialClear: 1,
      initialInputs: { D: 1 },
      events: [
        { time: 5, signal: 'CLR', value: 0 }, // assert clear
        { time: 10, signal: 'CLK', value: 1 }, // active edge occurs but ignored
        { time: 20, signal: 'CLR', value: 1 }, // release clear
      ],
      endTime: 30,
    },
  },
  {
    id: 'async-conflict',
    title: 'Simultaneous Asynchronous PRESET and CLEAR Conflict',
    description:
      'Demonstrates illegal concurrent assertion of both PRESET and CLEAR pins, driving both complementary outputs Q and Qbar to logic 1.',
    config: {
      type: 'SR',
      trigger: 'rising',
      asyncControls: true,
      asyncActiveLow: true,
      propagationDelay: 1,
      setupTime: 0,
      holdTime: 0,
    },
    script: {
      initialQ: 0,
      initialPreset: 0, // asserted
      initialClear: 0, // asserted
      events: [],
      endTime: 10,
    },
  },
  {
    id: 'setup-violation',
    title: 'Data Setup Time Timing Violation',
    description:
      'Demonstrates metastability risk caused by data input D changing at t = 8 within the required 3-unit setup window before the clock edge at t = 10.',
    config: {
      type: 'D',
      trigger: 'rising',
      asyncControls: false,
      asyncActiveLow: true,
      propagationDelay: 1,
      setupTime: 3,
      holdTime: 0,
    },
    script: {
      initialQ: 0,
      initialClock: 0,
      initialInputs: { D: 0 },
      events: [
        { time: 8, signal: 'D', value: 1 }, // violates setup time [7, 10)
        { time: 10, signal: 'CLK', value: 1 },
      ],
      endTime: 20,
    },
  },
];

/**
 * Retrieves a preset scenario definition by its unique identifier.
 *
 * @param id Scenario identifier string
 * @returns FlipFlopPreset if found, or undefined
 */
export function getPresetScenario(id: string): FlipFlopPreset | undefined {
  return PRESET_SCENARIOS.find((p) => p.id === id);
}
