/**
 * @file stepperRules.ts
 * Data structures, event unions, script interfaces, and validation rules
 * for the discrete-event timeline simulator.
 */

import type { LogicValue } from '../../types/ast';
import { inputNames, nextState, type FlipFlopConfig } from './models';

/** Single signal transition recorded during flip-flop simulation. */
export interface FlipFlopChange {
  readonly time: number;
  readonly nodeId: string;
  readonly value: LogicValue;
}

/** Detailed diagnostic events emitted during timeline simulation. */
export type FlipFlopEvent =
  | { readonly kind: 'active-edge'; readonly time: number; readonly edge: 'rising' | 'falling'; readonly sampledInputs: Record<string, LogicValue>; readonly operation: string; readonly qBefore: LogicValue; readonly qAfter: LogicValue }
  | { readonly kind: 'level-open'; readonly time: number; readonly level: 'high' | 'low'; readonly sampledInputs: Record<string, LogicValue> }
  | { readonly kind: 'level-close'; readonly time: number; readonly level: 'high' | 'low' }
  | { readonly kind: 'q-update'; readonly time: number; readonly qBefore: LogicValue; readonly qAfter: LogicValue; readonly source: 'clock' | 'async' | 'feedback' }
  | { readonly kind: 'invalid-input'; readonly time: number; readonly inputs: Record<string, LogicValue>; readonly message: string }
  | { readonly kind: 'async-set'; readonly time: number; readonly qBefore: LogicValue }
  | { readonly kind: 'async-clear'; readonly time: number; readonly qBefore: LogicValue }
  | { readonly kind: 'async-conflict'; readonly time: number; readonly message: string }
  | { readonly kind: 'async-release'; readonly time: number; readonly releasedPins: readonly ('PRE' | 'CLR')[]; readonly resultingQ: LogicValue }
  | { readonly kind: 'clock-ignored'; readonly time: number; readonly reason: string }
  | { readonly kind: 'race-around-toggle'; readonly time: number; readonly toggleIndex: number; readonly qBefore: LogicValue; readonly qAfter: LogicValue }
  | { readonly kind: 'race-around-unbounded'; readonly time: number; readonly message: string }
  | { readonly kind: 'timing-violation'; readonly time: number; readonly violationType: 'setup' | 'hold'; readonly signal: string; readonly edgeTime: number; readonly eventTime: number }
  | { readonly kind: 'unknown-clock'; readonly time: number; readonly message: string };

/** Event injected into the flip-flop stimulus script. */
export interface FlipFlopScriptEvent {
  readonly time: number;
  readonly signal: string;
  readonly value: LogicValue;
}

/** Input stimulus script driving discrete-event simulation. */
export interface FlipFlopScript {
  readonly initialQ?: LogicValue;
  readonly initialInputs?: Record<string, LogicValue>;
  readonly initialClock?: LogicValue;
  readonly initialPreset?: LogicValue;
  readonly initialClear?: LogicValue;
  readonly events: readonly FlipFlopScriptEvent[];
  readonly endTime: number;
}

/** Final settled state snapshot at endTime. */
export interface FlipFlopFinalState {
  readonly q: LogicValue;
  readonly qBar: LogicValue;
  readonly clock: LogicValue;
  readonly inputs: Record<string, LogicValue>;
  readonly preset?: LogicValue;
  readonly clear?: LogicValue;
}

/** Summary metrics of simulated execution. */
export interface FlipFlopStats {
  readonly activeEdgesCount: number;
  readonly qTogglesCount: number;
  readonly asyncEventsCount: number;
  readonly timingViolationsCount: number;
}

/** Scheduled output update pending in future simulation queue. */
export interface ScheduledUpdate {
  readonly time: number;
  readonly q: LogicValue;
  readonly qBar: LogicValue;
  readonly source: 'clock' | 'async' | 'feedback';
}

/** Error codes produced by script validation or simulator execution. */
export type SimulationErrorCode =
  | 'unsorted-times'
  | 'unknown-signal'
  | 'async-not-enabled'
  | 'bad-value'
  | 'bad-time'
  | 'end-before-last-event'
  | 'too-many-events';

/** Discriminated result returned by simulateTimeline. */
export type SimulationResult =
  | {
      readonly ok: true;
      readonly changes: readonly FlipFlopChange[];
      readonly events: readonly FlipFlopEvent[];
      readonly finalState: FlipFlopFinalState;
      readonly stats: FlipFlopStats;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: SimulationErrorCode;
        readonly message: string;
      };
    };

/** Maximum allowed stimulus events in a single script execution */
export const MAX_SCRIPT_EVENTS = 10000;

/**
 * Validates script integrity against configuration parameters.
 */
export function validateScript(
  config: FlipFlopConfig,
  script: FlipFlopScript
): { code: SimulationErrorCode; message: string } | null {
  if (typeof script.endTime !== 'number' || !Number.isFinite(script.endTime) || script.endTime < 0) {
    return { code: 'bad-time', message: `Invalid simulation endTime: ${String(script.endTime)}. Must be a finite non-negative number.` };
  }
  if (script.events.length > MAX_SCRIPT_EVENTS) {
    return { code: 'too-many-events', message: `Script exceeds maximum event limit (${MAX_SCRIPT_EVENTS}).` };
  }

  const validSignals = new Set<string>([
    ...inputNames(config.type),
    'CLK',
    ...(config.asyncControls ? ['PRE', 'CLR'] : []),
  ]);

  let lastTime = 0;
  for (let i = 0; i < script.events.length; i++) {
    const ev = script.events[i];
    if (!ev) continue;

    if (typeof ev.time !== 'number' || !Number.isFinite(ev.time) || ev.time < 0) {
      return { code: 'bad-time', message: `Event at index ${i} has invalid time: ${String(ev.time)}.` };
    }
    if (ev.time < lastTime) {
      return { code: 'unsorted-times', message: `Events must be chronologically sorted. Event at index ${i} (t=${ev.time}) occurs before preceding event (t=${lastTime}).` };
    }
    lastTime = ev.time;

    if (ev.time > script.endTime) {
      return { code: 'end-before-last-event', message: `Event at index ${i} (t=${ev.time}) occurs after simulation endTime (t=${script.endTime}).` };
    }
    if (!validSignals.has(ev.signal)) {
      if ((ev.signal === 'PRE' || ev.signal === 'CLR') && !config.asyncControls) {
        return { code: 'async-not-enabled', message: `Signal "${ev.signal}" received but asyncControls are not enabled in configuration.` };
      }
      return { code: 'unknown-signal', message: `Unknown signal identifier "${ev.signal}". Valid signals: ${Array.from(validSignals).join(', ')}.` };
    }
    if (ev.value !== 0 && ev.value !== 1 && ev.value !== 'X') {
      return { code: 'bad-value', message: `Invalid logic value for signal "${ev.signal}" at t=${ev.time}: ${String(ev.value)}.` };
    }
  }
  return null;
}

/**
 * Checks for data setup or hold violations relative to a clock edge timestamp.
 */
export function findTimingViolations(
  config: FlipFlopConfig,
  events: readonly FlipFlopScriptEvent[],
  edgeTime: number
): { violationType: 'setup' | 'hold'; signal: string; eventTime: number }[] {
  const dataNames = inputNames(config.type);
  const violations: { violationType: 'setup' | 'hold'; signal: string; eventTime: number }[] = [];
  if (config.setupTime <= 0 && config.holdTime <= 0) return violations;

  for (const ev of events) {
    if (dataNames.includes(ev.signal)) {
      if (config.setupTime > 0 && ev.time > edgeTime - config.setupTime && ev.time < edgeTime) {
        violations.push({ violationType: 'setup', signal: ev.signal, eventTime: ev.time });
      }
      if (config.holdTime > 0 && ev.time >= edgeTime && ev.time < edgeTime + config.holdTime) {
        violations.push({ violationType: 'hold', signal: ev.signal, eventTime: ev.time });
      }
    }
  }
  return violations;
}

/**
 * Iterates zero-delay feedback loop to a fixed point (cap 64 rounds).
 */
export function iterateZeroDelayFeedback(
  type: FlipFlopConfig['type'],
  inputs: readonly LogicValue[],
  startQ: LogicValue
): { settledQ: LogicValue; rounds: number; converged: boolean } {
  let qCurr = startQ;
  let rounds = 0;
  while (rounds < 64) {
    const nextVal = nextState(type, inputs, qCurr);
    if (nextVal === qCurr) return { settledQ: qCurr, rounds, converged: true };
    qCurr = nextVal;
    rounds++;
  }
  return { settledQ: 'X', rounds, converged: false };
}

/**
 * Evaluates asynchronous PRESET/CLEAR control conditions.
 */
export function evaluateAsyncControls(
  config: FlipFlopConfig,
  currentPre: LogicValue,
  currentClr: LogicValue,
  committedQ: LogicValue,
  wasPreAsserted: boolean,
  wasClrAsserted: boolean,
  time: number
): {
  asyncOverriding: boolean;
  targetOutput?: { q: LogicValue; qBar: LogicValue };
  event?: FlipFlopEvent;
  incAsyncCount: boolean;
  newWasPreAsserted: boolean;
  newWasClrAsserted: boolean;
} {
  const activeLevel = config.asyncActiveLow ? 0 : 1;
  const preAsserted = currentPre === activeLevel;
  const clrAsserted = currentClr === activeLevel;

  if (currentPre === 'X' || currentClr === 'X') {
    return { asyncOverriding: true, targetOutput: { q: 'X', qBar: 'X' }, incAsyncCount: false, newWasPreAsserted: preAsserted, newWasClrAsserted: clrAsserted };
  }
  if (preAsserted && clrAsserted) {
    return {
      asyncOverriding: true,
      targetOutput: { q: 1, qBar: 1 },
      event: { kind: 'async-conflict', time, message: 'Both PRESET and CLEAR pins are asserted simultaneously.' },
      incAsyncCount: true,
      newWasPreAsserted: preAsserted,
      newWasClrAsserted: clrAsserted,
    };
  }
  if (preAsserted) {
    return {
      asyncOverriding: true,
      targetOutput: { q: 1, qBar: 0 },
      event: { kind: 'async-set', time, qBefore: committedQ },
      incAsyncCount: true,
      newWasPreAsserted: preAsserted,
      newWasClrAsserted: clrAsserted,
    };
  }
  if (clrAsserted) {
    return {
      asyncOverriding: true,
      targetOutput: { q: 0, qBar: 1 },
      event: { kind: 'async-clear', time, qBefore: committedQ },
      incAsyncCount: true,
      newWasPreAsserted: preAsserted,
      newWasClrAsserted: clrAsserted,
    };
  }
  if (wasPreAsserted && wasClrAsserted) {
    return {
      asyncOverriding: false,
      targetOutput: { q: 'X', qBar: 'X' },
      event: { kind: 'async-release', time, releasedPins: ['PRE', 'CLR'], resultingQ: 'X' },
      incAsyncCount: true,
      newWasPreAsserted: preAsserted,
      newWasClrAsserted: clrAsserted,
    };
  }
  if (wasPreAsserted || wasClrAsserted) {
    return {
      asyncOverriding: false,
      event: { kind: 'async-release', time, releasedPins: wasPreAsserted ? ['PRE'] : ['CLR'], resultingQ: committedQ },
      incAsyncCount: true,
      newWasPreAsserted: preAsserted,
      newWasClrAsserted: clrAsserted,
    };
  }

  return { asyncOverriding: false, incAsyncCount: false, newWasPreAsserted: preAsserted, newWasClrAsserted: clrAsserted };
}
