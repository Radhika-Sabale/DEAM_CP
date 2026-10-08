/**
 * @file flipFlopSession.ts
 * Pure immutable reducer and state management for interactive flip-flop simulation sessions.
 *
 * SIMULATION INSERTION & TIME-ADVANCE INVARIANT:
 * Every stimulus action that changes a signal (such as setting an input, toggling clock,
 * or pulsing clock) records a discrete stimulus event at the current session time and then
 * automatically advances time by `actionSpacing` (default 5 time units).
 * This ensures consecutive interactions (e.g. changing D and then pulsing the clock)
 * never land on the same simultaneous instant, avoiding accidental race conditions or
 * same-instant sampling surprises during student exploration.
 *
 * If multiple changes to the same signal occur at the exact same timestamp, the later event
 * cleanly replaces the earlier event for that signal.
 */

import type { LogicValue } from '../../types/ast';
import type { FlipFlopType } from '../../types/sequential';
import {
  defaultConfig,
  inputNames,
  type FlipFlopConfig,
} from '../../engine/flipflop/models';
import type { FlipFlopPreset } from '../../engine/flipflop/presets';
import type { FlipFlopScriptEvent } from '../../engine/flipflop/stepperRules';

/**
 * Immutable, strictly JSON-serializable session state model for the flip-flop workbench.
 */
export interface FlipFlopSessionState {
  readonly config: FlipFlopConfig;
  readonly initialQ: LogicValue;
  readonly initialInputs: Record<string, LogicValue>;
  readonly initialClock: LogicValue;
  readonly initialPreset?: LogicValue;
  readonly initialClear?: LogicValue;
  readonly events: readonly FlipFlopScriptEvent[];
  readonly time: number;
  readonly cursor: number;
  readonly actionSpacing: number;
  readonly pulseWidth: number;
  readonly history?: readonly FlipFlopSessionState[];
}

/**
 * Discriminated union of pure reducer action types.
 */
export type FlipFlopSessionAction =
  | { readonly type: 'SET_TYPE'; readonly flipFlopType: FlipFlopType }
  | { readonly type: 'SET_CONFIG'; readonly config: FlipFlopConfig }
  | { readonly type: 'SET_INPUT'; readonly signal: string; readonly value: LogicValue }
  | { readonly type: 'TOGGLE_CLOCK' }
  | { readonly type: 'PULSE_CLOCK' }
  | { readonly type: 'ADVANCE'; readonly delta: number }
  | { readonly type: 'SET_CURSOR'; readonly cursor: number }
  | { readonly type: 'NEXT_EVENT' }
  | { readonly type: 'PREV_EVENT' }
  | { readonly type: 'LOAD_PRESET'; readonly preset: FlipFlopPreset }
  | { readonly type: 'RESET' }
  | { readonly type: 'UNDO_LAST' }
  | { readonly type: 'SET_INITIAL_Q'; readonly q: LogicValue }
  | { readonly type: 'SET_PULSE_WIDTH'; readonly pulseWidth: number }
  | { readonly type: 'SET_ACTION_SPACING'; readonly actionSpacing: number };

/**
 * Creates default initial inputs map for a flip-flop type with all signals initialized to 0.
 */
export function createDefaultInputs(type: FlipFlopType): Record<string, LogicValue> {
  const names = inputNames(type);
  const map: Record<string, LogicValue> = {};
  for (const name of names) {
    map[name] = 0;
  }
  return map;
}

/**
 * Factory for creating an initialized default FlipFlopSessionState.
 *
 * @param type Flip-flop architecture (defaults to 'D')
 * @returns Freshly initialized FlipFlopSessionState
 */
export function createInitialSessionState(type: FlipFlopType = 'D'): FlipFlopSessionState {
  const config = defaultConfig(type);
  return {
    config,
    initialQ: 0,
    initialInputs: createDefaultInputs(type),
    initialClock: 0,
    initialPreset: config.asyncActiveLow ? 1 : 0,
    initialClear: config.asyncActiveLow ? 1 : 0,
    events: [],
    time: 0,
    cursor: 0,
    actionSpacing: 5,
    pulseWidth: 10,
    history: [],
  };
}

/**
 * Appends or replaces an event at a given timestamp in a chronologically sorted event list.
 */
function recordScriptEvent(
  events: readonly FlipFlopScriptEvent[],
  time: number,
  signal: string,
  value: LogicValue
): readonly FlipFlopScriptEvent[] {
  const existingIdx = events.findIndex((e) => e.time === time && e.signal === signal);
  if (existingIdx >= 0) {
    const next = [...events];
    next[existingIdx] = { time, signal, value };
    return next;
  }

  const newEvent: FlipFlopScriptEvent = { time, signal, value };
  const next = [...events, newEvent];
  next.sort((a, b) => a.time - b.time);
  return next;
}

/**
 * Determines current signal value at a given target time from initial conditions and event list.
 */
export function getSignalValueAtTime(
  state: FlipFlopSessionState,
  signal: string,
  targetTime: number
): LogicValue {
  let val: LogicValue = 0;
  if (signal === 'CLK') val = state.initialClock;
  else if (signal === 'PRE') val = state.initialPreset ?? (state.config.asyncActiveLow ? 1 : 0);
  else if (signal === 'CLR') val = state.initialClear ?? (state.config.asyncActiveLow ? 1 : 0);
  else val = state.initialInputs[signal] ?? 0;

  for (const ev of state.events) {
    if (ev.signal === signal && ev.time <= targetTime) {
      val = ev.value;
    }
  }
  return val;
}

function createSnapshot(state: FlipFlopSessionState): Omit<FlipFlopSessionState, 'history'> {
  return {
    config: state.config,
    initialQ: state.initialQ,
    initialClock: state.initialClock,
    initialInputs: state.initialInputs,
    events: state.events,
    time: state.time,
    cursor: state.cursor,
    pulseWidth: state.pulseWidth,
    actionSpacing: state.actionSpacing,
  };
}

/**
 * Pure reducer function managing all state transformations for flip-flop sessions.
 *
 * @param state Current session state
 * @param action Dispatch action
 * @returns New immutable session state
 */
export function flipFlopSessionReducer(
  state: FlipFlopSessionState,
  action: FlipFlopSessionAction
): FlipFlopSessionState {
  switch (action.type) {
    case 'SET_TYPE': {
      const config: FlipFlopConfig = {
        ...state.config,
        type: action.flipFlopType,
      };
      return {
        ...state,
        config,
        initialInputs: createDefaultInputs(action.flipFlopType),
        events: [],
        time: 0,
        cursor: 0,
        history: [],
      };
    }

    case 'SET_CONFIG': {
      return {
        ...state,
        config: action.config,
        initialInputs: state.config.type === action.config.type
          ? state.initialInputs
          : createDefaultInputs(action.config.type),
      };
    }

    case 'SET_INITIAL_Q': {
      return {
        ...state,
        initialQ: action.q,
      };
    }

    case 'SET_ACTION_SPACING': {
      return {
        ...state,
        actionSpacing: Math.max(1, Math.round(action.actionSpacing)),
      };
    }

    case 'SET_PULSE_WIDTH': {
      return {
        ...state,
        pulseWidth: Math.max(1, Math.round(action.pulseWidth)),
      };
    }

    case 'SET_INPUT': {
      const priorHistory = state.history ?? [];
      const snapshot = createSnapshot(state);
      const newEvents = recordScriptEvent(state.events, state.time, action.signal, action.value);
      const newTime = state.time + state.actionSpacing;

      return {
        ...state,
        events: newEvents,
        time: newTime,
        cursor: newTime,
        history: [...priorHistory, snapshot],
      };
    }

    case 'TOGGLE_CLOCK': {
      const priorHistory = state.history ?? [];
      const snapshot = createSnapshot(state);
      const currentClock = getSignalValueAtTime(state, 'CLK', state.time);
      const newClock: LogicValue = currentClock === 1 ? 0 : 1;
      const newEvents = recordScriptEvent(state.events, state.time, 'CLK', newClock);
      const newTime = state.time + state.actionSpacing;

      return {
        ...state,
        events: newEvents,
        time: newTime,
        cursor: newTime,
        history: [...priorHistory, snapshot],
      };
    }

    case 'PULSE_CLOCK': {
      const priorHistory = state.history ?? [];
      const snapshot = createSnapshot(state);
      const isFallingOrLow = state.config.trigger === 'falling' || state.config.trigger === 'level-low';
      const firstVal: LogicValue = isFallingOrLow ? 0 : 1;
      const secondVal: LogicValue = isFallingOrLow ? 1 : 0;

      const t1 = state.time;
      const t2 = state.time + state.pulseWidth;

      let newEvents = recordScriptEvent(state.events, t1, 'CLK', firstVal);
      newEvents = recordScriptEvent(newEvents, t2, 'CLK', secondVal);
      const newTime = t2 + state.actionSpacing;

      return {
        ...state,
        events: newEvents,
        time: newTime,
        cursor: newTime,
        history: [...priorHistory, snapshot],
      };
    }

    case 'ADVANCE': {
      const priorHistory = state.history ?? [];
      const snapshot = createSnapshot(state);
      const newTime = state.time + Math.max(1, action.delta);

      return {
        ...state,
        time: newTime,
        cursor: newTime,
        history: [...priorHistory, snapshot],
      };
    }

    case 'SET_CURSOR': {
      return {
        ...state,
        cursor: Math.max(0, action.cursor),
      };
    }

    case 'NEXT_EVENT': {
      const allTimes = Array.from(new Set([0, ...state.events.map((e) => e.time)])).sort(
        (a, b) => a - b
      );
      const nextTime = allTimes.find((t) => t > state.cursor);
      return {
        ...state,
        cursor: nextTime !== undefined ? nextTime : state.cursor,
      };
    }

    case 'PREV_EVENT': {
      const allTimes = Array.from(new Set([0, ...state.events.map((e) => e.time)])).sort(
        (a, b) => a - b
      );
      const prevTimes = allTimes.filter((t) => t < state.cursor);
      const prevTime = prevTimes.length > 0 ? prevTimes[prevTimes.length - 1] : 0;
      return {
        ...state,
        cursor: prevTime !== undefined ? prevTime : 0,
      };
    }

    case 'LOAD_PRESET': {
      const p = action.preset;
      const names = inputNames(p.config.type);
      const inputs: Record<string, LogicValue> = {};
      for (const name of names) {
        inputs[name] = p.script.initialInputs?.[name] ?? 0;
      }

      return {
        config: p.config,
        initialQ: p.script.initialQ ?? 0,
        initialInputs: inputs,
        initialClock: p.script.initialClock ?? 0,
        initialPreset: p.script.initialPreset ?? (p.config.asyncActiveLow ? 1 : 0),
        initialClear: p.script.initialClear ?? (p.config.asyncActiveLow ? 1 : 0),
        events: [...p.script.events],
        time: p.script.endTime,
        cursor: p.script.endTime,
        actionSpacing: 5,
        pulseWidth: 10,
        history: [],
      };
    }

    case 'RESET': {
      return {
        ...state,
        initialQ: 0,
        initialClock: 0,
        initialPreset: state.config.asyncActiveLow ? 1 : 0,
        initialClear: state.config.asyncActiveLow ? 1 : 0,
        initialInputs: createDefaultInputs(state.config.type),
        events: [],
        time: 0,
        cursor: 0,
        history: [],
      };
    }

    case 'UNDO_LAST': {
      const history = state.history ?? [];
      if (history.length === 0) return state;
      const previousState = history[history.length - 1];
      if (!previousState) return state;

      return {
        ...previousState,
        history: history.slice(0, history.length - 1),
      };
    }
  }
}
