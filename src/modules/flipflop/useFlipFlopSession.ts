/**
 * @file useFlipFlopSession.ts
 * React hook wrapping the pure flipFlopSession reducer with simulated timeline derivation,
 * cursor valuation queries, characteristic table row index matching, and plain-language error formatting.
 */

import { useCallback, useMemo, useReducer } from 'react';
import type { LogicValue } from '../../types/ast';
import type { FlipFlopType } from '../../types/sequential';
import { inputNames, type FlipFlopConfig } from '../../engine/flipflop/models';
import type { FlipFlopPreset } from '../../engine/flipflop/presets';
import { simulateTimeline } from '../../engine/flipflop/stepper';
import type {
  FlipFlopChange,
  FlipFlopEvent,
  FlipFlopScript,
  SimulationResult,
} from '../../engine/flipflop/stepperRules';
import {
  createInitialSessionState,
  flipFlopSessionReducer,
  type FlipFlopSessionState,
} from './flipFlopSession';

/**
 * Values of all monitored signals at the current inspection cursor timestamp.
 */
export interface CursorValuation {
  readonly inputs: Record<string, LogicValue>;
  readonly CLK: LogicValue;
  readonly PRE?: LogicValue;
  readonly CLR?: LogicValue;
  readonly Q: LogicValue;
  readonly Qbar: LogicValue;
}

/**
 * Return interface for the useFlipFlopSession hook.
 */
export interface UseFlipFlopSessionResult {
  readonly state: FlipFlopSessionState;
  readonly simulationResult: SimulationResult;
  readonly cursorValues: CursorValuation;
  readonly currentRowIndex: number;
  readonly eventsUpToCursor: readonly FlipFlopEvent[];
  readonly maxTraceTime: number;
  readonly error: string | null;
  readonly changes: readonly FlipFlopChange[];

  // Action dispatches
  readonly setType: (type: FlipFlopType) => void;
  readonly setConfig: (config: FlipFlopConfig) => void;
  readonly setInput: (signal: string, value: LogicValue) => void;
  readonly toggleClock: () => void;
  readonly pulseClock: () => void;
  readonly advance: (delta: number) => void;
  readonly setCursor: (cursor: number) => void;
  readonly nextEvent: () => void;
  readonly prevEvent: () => void;
  readonly loadPreset: (preset: FlipFlopPreset) => void;
  readonly reset: () => void;
  readonly undoLast: () => void;
  readonly setInitialQ: (q: LogicValue) => void;
  readonly setPulseWidth: (pulseWidth: number) => void;
  readonly setActionSpacing: (spacing: number) => void;
}

/**
 * Hook providing reactive flip-flop discrete timeline simulation and inspection capabilities.
 *
 * @param initialType Initial flip-flop architecture (defaults to 'D')
 * @returns Complete session controller object
 */
export function useFlipFlopSession(initialType: FlipFlopType = 'D'): UseFlipFlopSessionResult {
  const [state, dispatch] = useReducer(
    flipFlopSessionReducer,
    initialType,
    createInitialSessionState
  );

  const maxTraceTime = useMemo(() => {
    let maxT = Math.max(10, state.time, state.cursor);
    for (const ev of state.events) {
      if (ev.time > maxT) maxT = ev.time;
    }
    return maxT;
  }, [state.time, state.cursor, state.events]);

  const script = useMemo<FlipFlopScript>(() => {
    return {
      initialQ: state.initialQ,
      initialInputs: state.initialInputs,
      initialClock: state.initialClock,
      initialPreset: state.initialPreset,
      initialClear: state.initialClear,
      events: state.events,
      endTime: maxTraceTime,
    };
  }, [state, maxTraceTime]);

  const simulationResult = useMemo<SimulationResult>(() => {
    return simulateTimeline(state.config, script);
  }, [state.config, script]);

  const changes = useMemo<readonly FlipFlopChange[]>(() => {
    return simulationResult.ok ? simulationResult.changes : [];
  }, [simulationResult]);

  // Compute signal values at current cursor position
  const cursorValues = useMemo<CursorValuation>(() => {
    const names = inputNames(state.config.type);
    const inputs: Record<string, LogicValue> = {};
    for (const name of names) {
      inputs[name] = state.initialInputs[name] ?? 0;
    }

    let clk: LogicValue = state.initialClock;
    let pre: LogicValue = state.config.asyncControls ? (state.initialPreset ?? (state.config.asyncActiveLow ? 1 : 0)) : 1;
    let clr: LogicValue = state.config.asyncControls ? (state.initialClear ?? (state.config.asyncActiveLow ? 1 : 0)) : 1;
    let q: LogicValue = state.initialQ;
    let qbar: LogicValue = q === 1 ? 0 : q === 0 ? 1 : 'X';

    if (simulationResult.ok) {
      for (const ch of simulationResult.changes) {
        if (ch.time <= state.cursor) {
          if (names.includes(ch.nodeId)) inputs[ch.nodeId] = ch.value;
          else if (ch.nodeId === 'CLK') clk = ch.value;
          else if (ch.nodeId === 'PRE') pre = ch.value;
          else if (ch.nodeId === 'CLR') clr = ch.value;
          else if (ch.nodeId === 'Q') q = ch.value;
          else if (ch.nodeId === 'Qbar') qbar = ch.value;
        }
      }
    }

    return {
      inputs,
      CLK: clk,
      ...(state.config.asyncControls ? { PRE: pre, CLR: clr } : {}),
      Q: q,
      Qbar: qbar,
    };
  }, [state, simulationResult]);

  // Calculate current characteristic table row index matching (inputs..., Q)
  const currentRowIndex = useMemo<number>(() => {
    const names = inputNames(state.config.type);
    let index = 0;
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const val = name ? cursorValues.inputs[name] : 0;
      if (val === 'X') return -1;
      index = (index << 1) | (val === 1 ? 1 : 0);
    }
    if (cursorValues.Q === 'X') return -1;
    index = (index << 1) | (cursorValues.Q === 1 ? 1 : 0);
    return index;
  }, [state.config.type, cursorValues]);

  // Diagnostic events up to the cursor
  const eventsUpToCursor = useMemo<readonly FlipFlopEvent[]>(() => {
    if (!simulationResult.ok) return [];
    return simulationResult.events.filter((e) => e.time <= state.cursor);
  }, [simulationResult, state.cursor]);

  // Plain-language error if simulation encountered validation error
  const error = useMemo<string | null>(() => {
    if (simulationResult.ok) return null;
    return simulationResult.error.message;
  }, [simulationResult]);

  // Callbacks
  const setType = useCallback((type: FlipFlopType) => dispatch({ type: 'SET_TYPE', flipFlopType: type }), []);
  const setConfig = useCallback((config: FlipFlopConfig) => dispatch({ type: 'SET_CONFIG', config }), []);
  const setInput = useCallback((signal: string, value: LogicValue) => dispatch({ type: 'SET_INPUT', signal, value }), []);
  const toggleClock = useCallback(() => dispatch({ type: 'TOGGLE_CLOCK' }), []);
  const pulseClock = useCallback(() => dispatch({ type: 'PULSE_CLOCK' }), []);
  const advance = useCallback((delta: number) => dispatch({ type: 'ADVANCE', delta }), []);
  const setCursor = useCallback((cursor: number) => dispatch({ type: 'SET_CURSOR', cursor }), []);
  const nextEvent = useCallback(() => dispatch({ type: 'NEXT_EVENT' }), []);
  const prevEvent = useCallback(() => dispatch({ type: 'PREV_EVENT' }), []);
  const loadPreset = useCallback((preset: FlipFlopPreset) => dispatch({ type: 'LOAD_PRESET', preset }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);
  const undoLast = useCallback(() => dispatch({ type: 'UNDO_LAST' }), []);
  const setInitialQ = useCallback((q: LogicValue) => dispatch({ type: 'SET_INITIAL_Q', q }), []);
  const setPulseWidth = useCallback((pulseWidth: number) => dispatch({ type: 'SET_PULSE_WIDTH', pulseWidth }), []);
  const setActionSpacing = useCallback((actionSpacing: number) => dispatch({ type: 'SET_ACTION_SPACING', actionSpacing }), []);

  return {
    state,
    simulationResult,
    cursorValues,
    currentRowIndex,
    eventsUpToCursor,
    maxTraceTime,
    error,
    changes,
    setType,
    setConfig,
    setInput,
    toggleClock,
    pulseClock,
    advance,
    setCursor,
    nextEvent,
    prevEvent,
    loadPreset,
    reset,
    undoLast,
    setInitialQ,
    setPulseWidth,
    setActionSpacing,
  };
}
