/**
 * @file explain.ts
 * Deterministic plain-language pedagogical explanation generators for flip-flop events,
 * timing transitions, invalid operational states, race-around hazards, and trigger modes.
 */

import type { FlipFlopType, TriggerMode } from '../../types/sequential';
import type { RaceAroundAnalysis } from './hazards';
import type { FlipFlopConfig } from './models';
import type { FlipFlopEvent } from './stepperRules';

/** Diagnostic message item generated from a simulation event. */
export interface EventExplanation {
  readonly code: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly text: string;
}

/** Pedagogical summary of a trigger mode. */
export interface TriggerExplanation {
  readonly title: string;
  readonly description: string;
  readonly samplingRule: string;
}

/** Pedagogical breakdown of invalid or forbidden operational states. */
export interface InvalidStateExplanation {
  readonly title: string;
  readonly explanation: string;
  readonly consequences: readonly string[];
}

function formatInputs(inputs: Record<string, unknown>): string {
  const entries = Object.entries(inputs);
  return entries.length === 0 ? 'none' : entries.map(([k, v]) => `${k} = ${String(v)}`).join(', ');
}

/**
 * Generates plain-language explanatory messages for a discrete-event timeline event.
 */
export function explainEvent(
  event: FlipFlopEvent,
  config: FlipFlopConfig
): readonly EventExplanation[] {
  const delay = config.propagationDelay;
  const delayText = delay === 0 ? 'immediately' : `after ${delay} time unit${delay === 1 ? '' : 's'}`;

  switch (event.kind) {
    case 'active-edge': {
      const edgeWord = event.edge === 'rising' ? 'rose' : 'fell';
      const inputsStr = formatInputs(event.sampledInputs);
      return [{
        code: 'ACTIVE_EDGE',
        severity: 'info',
        text: `At t = ${event.time} the clock ${edgeWord}, so the flip-flop used the values it saw just before the edge (${inputsStr}). That means ${event.operation}, so Q changes from ${String(event.qBefore)} to ${String(event.qAfter)} ${delayText}.`,
      }];
    }
    case 'level-open': {
      const lvlStr = event.level === 'high' ? 'HIGH (1)' : 'LOW (0)';
      return [{
        code: 'LEVEL_OPEN',
        severity: 'info',
        text: `At t = ${event.time} the clock entered active ${lvlStr} level. The latch is now transparent and continuously tracks inputs (${formatInputs(event.sampledInputs)}).`,
      }];
    }
    case 'level-close': {
      const lvlStr = event.level === 'high' ? 'LOW (0)' : 'HIGH (1)';
      return [{
        code: 'LEVEL_CLOSE',
        severity: 'info',
        text: `At t = ${event.time} the clock transitioned to ${lvlStr}. The latch is now opaque and retains its last stored output.`,
      }];
    }
    case 'q-update':
      return [{
        code: 'Q_UPDATE',
        severity: 'info',
        text: `At t = ${event.time} the output Q updated from ${String(event.qBefore)} to ${String(event.qAfter)} (source: ${event.source}).`,
      }];
    case 'invalid-input':
      return [{
        code: 'INVALID_INPUT',
        severity: 'error',
        text: `At t = ${event.time} an invalid input combination was present (${formatInputs(event.inputs)}). ${event.message}`,
      }];
    case 'async-set':
      return [{
        code: 'ASYNC_SET',
        severity: 'info',
        text: `At t = ${event.time} the asynchronous PRESET pin was asserted, overriding the clock to force Q = 1 and Qbar = 0 ${delayText}.`,
      }];
    case 'async-clear':
      return [{
        code: 'ASYNC_CLEAR',
        severity: 'info',
        text: `At t = ${event.time} the asynchronous CLEAR pin was asserted, overriding the clock to force Q = 0 and Qbar = 1 ${delayText}.`,
      }];
    case 'async-conflict':
      return [{
        code: 'ASYNC_CONFLICT',
        severity: 'error',
        text: `At t = ${event.time} both PRESET and CLEAR pins were asserted simultaneously. Both Q and Qbar are forced to 1, violating complementary outputs.`,
      }];
    case 'async-release':
      return [{
        code: 'ASYNC_RELEASE',
        severity: 'info',
        text: `At t = ${event.time} asynchronous control ${event.releasedPins.join(' and ')} was released. Output settled to Q = ${String(event.resultingQ)}.`,
      }];
    case 'clock-ignored':
      return [{
        code: 'CLOCK_IGNORED',
        severity: 'warning',
        text: `At t = ${event.time} the clock transition had no effect because an asynchronous control (PRESET or CLEAR) is currently active.`,
      }];
    case 'race-around-toggle':
      return [{
        code: 'RACE_AROUND_TOGGLE',
        severity: 'warning',
        text: `At t = ${event.time} a race-around oscillation occurred (toggle #${event.toggleIndex}) while the clock remained enabled. Q changed from ${String(event.qBefore)} to ${String(event.qAfter)}.`,
      }];
    case 'race-around-unbounded':
      return [{
        code: 'RACE_AROUND_UNBOUNDED',
        severity: 'error',
        text: `At t = ${event.time} zero-delay race-around oscillation failed to settle after 64 iterations. State became indeterminate (X).`,
      }];
    case 'timing-violation': {
      const vWord = event.violationType === 'setup' ? 'Setup time' : 'Hold time';
      return [{
        code: 'TIMING_VIOLATION',
        severity: 'error',
        text: `At t = ${event.time} a ${vWord} violation occurred on data input "${event.signal}". Signal changed at t = ${event.eventTime} too close to clock edge at t = ${event.edgeTime}. Output Q becomes indeterminate (X).`,
      }];
    }
    case 'unknown-clock':
      return [{
        code: 'UNKNOWN_CLOCK',
        severity: 'error',
        text: `At t = ${event.time} the clock entered an unknown logic level (X), causing the flip-flop to lose defined state.`,
      }];
  }
}

/**
 * Returns pedagogical explanations of invalid state behavior for a flip-flop type.
 */
export function explainInvalidState(type: FlipFlopType): InvalidStateExplanation {
  if (type === 'SR') {
    return {
      title: 'SR Latch Forbidden State (S = 1, R = 1)',
      explanation:
        'When both Set and Reset inputs are asserted simultaneously (S=1 and R=1), both internal cross-coupled NOR gates output 0 (or NAND gates output 1). This breaks the fundamental requirement that Q and Qbar remain complementary opposites. If S and R are subsequently released at the exact same instant, the circuit enters a metastable race condition where the final state is unpredictable.',
      consequences: [
        'Q and Qbar both become equal, violating complementary output definition.',
        'Simultaneous de-assertion triggers hardware metastability.',
        'Eliminated in JK flip-flops by steering feedback to convert S=R=1 into a deterministic Toggle.',
      ],
    };
  }
  return {
    title: `${type} Flip-Flop Deterministic Behavior`,
    explanation: `The ${type} flip-flop architecture has no forbidden input states. All input combinations map to deterministic Hold, Reset, Set, Load, or Toggle operations.`,
    consequences: ['No forbidden input states exist.'],
  };
}

/**
 * Returns pedagogical explanations of race-around hazard analysis.
 */
export function explainRaceAround(analysis: RaceAroundAnalysis, config: FlipFlopConfig): string {
  if (!analysis.applicable) {
    return `Race-around hazard is not applicable to ${config.trigger} edge-triggered flip-flops. Inputs are sampled exclusively on voltage edges.`;
  }
  if (!analysis.occurs) {
    return 'No race-around hazard occurs with the current input combination because the inputs do not cause the flip-flop to continuously invert.';
  }
  if (analysis.toggleCount === 'unbounded') {
    return `A severe race-around hazard occurs. Because propagation delay is 0, the latch oscillates indefinitely during the active clock window, rendering final state indeterminate (X).`;
  }
  return `A race-around hazard occurs: the latch toggles ${analysis.toggleCount} time(s) during the active clock pulse. The final state relative to starting state is ${analysis.finalQRelation}.`;
}

/**
 * Returns pedagogical summary of a trigger mode and its sampling timing rule.
 */
export function explainTrigger(trigger: TriggerMode): TriggerExplanation {
  switch (trigger) {
    case 'rising':
      return {
        title: 'Positive Edge-Triggered (Rising Edge)',
        description: 'The flip-flop samples inputs only during the transition from logic 0 to logic 1.',
        samplingRule: 'Data inputs are sampled strictly before the clock edge (at t-). Changes occurring at the same timestamp as the edge are ignored until the next active edge.',
      };
    case 'falling':
      return {
        title: 'Negative Edge-Triggered (Falling Edge)',
        description: 'The flip-flop samples inputs only during the transition from logic 1 to logic 0.',
        samplingRule: 'Data inputs are sampled strictly before the clock edge (at t-). Changes occurring at the same timestamp as the edge are ignored until the next active edge.',
      };
    case 'level-high':
      return {
        title: 'Level-Sensitive High (Transparent Latch)',
        description: 'The latch is continuously transparent while clock is 1, and holds its state while clock is 0.',
        samplingRule: 'Inputs continuously propagate to outputs throughout the entire high clock duration. Subject to race-around if inputs cause continuous toggling.',
      };
    case 'level-low':
      return {
        title: 'Level-Sensitive Low (Transparent Latch)',
        description: 'The latch is continuously transparent while clock is 0, and holds its state while clock is 1.',
        samplingRule: 'Inputs continuously propagate to outputs throughout the entire low clock duration. Subject to race-around if inputs cause continuous toggling.',
      };
  }
}
