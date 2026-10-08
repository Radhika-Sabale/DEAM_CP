/**
 * @file flipFlopSession.test.ts
 * Unit tests for pure flipFlopSession reducer, action spacing, event coalescing, and JSON round-tripping.
 */

import { describe, expect, it } from 'vitest';
import { PRESET_SCENARIOS } from '../../engine/flipflop/presets';
import {
  createInitialSessionState,
  flipFlopSessionReducer,
  getSignalValueAtTime,
  type FlipFlopSessionState,
} from './flipFlopSession';

describe('flipFlopSession reducer', () => {
  it('initializes with default state for D flip-flop', () => {
    const s = createInitialSessionState('D');
    expect(s.config.type).toBe('D');
    expect(s.initialQ).toBe(0);
    expect(s.time).toBe(0);
    expect(s.cursor).toBe(0);
    expect(s.events).toEqual([]);
    expect(s.actionSpacing).toBe(5);
    expect(s.pulseWidth).toBe(10);
  });

  it('SET_TYPE resets events, time, and updates input mappings', () => {
    let s = createInitialSessionState('D');
    s = flipFlopSessionReducer(s, { type: 'SET_INPUT', signal: 'D', value: 1 });
    expect(s.events.length).toBe(1);

    s = flipFlopSessionReducer(s, { type: 'SET_TYPE', flipFlopType: 'JK' });
    expect(s.config.type).toBe('JK');
    expect(s.events).toEqual([]);
    expect(s.time).toBe(0);
    expect(s.cursor).toBe(0);
    expect(s.initialInputs).toEqual({ J: 0, K: 0 });
  });

  it('SET_INPUT records event at current time and advances time by actionSpacing', () => {
    let s = createInitialSessionState('D');
    expect(s.time).toBe(0);

    s = flipFlopSessionReducer(s, { type: 'SET_INPUT', signal: 'D', value: 1 });
    expect(s.events).toEqual([{ time: 0, signal: 'D', value: 1 }]);
    expect(s.time).toBe(5);
    expect(s.cursor).toBe(5);

    // Setting another input advances time further
    s = flipFlopSessionReducer(s, { type: 'SET_INPUT', signal: 'D', value: 0 });
    expect(s.events).toEqual([
      { time: 0, signal: 'D', value: 1 },
      { time: 5, signal: 'D', value: 0 },
    ]);
    expect(s.time).toBe(10);
    expect(s.cursor).toBe(10);
  });

  it('coalesces events on the same signal at the same time by replacing the earlier event', () => {
    let s = createInitialSessionState('SR');
    // Simulate setting S at t=0
    s = flipFlopSessionReducer(s, { type: 'SET_INPUT', signal: 'S', value: 1 });
    // Manually test direct replace by rewinding time
    s = { ...s, time: 0 };
    s = flipFlopSessionReducer(s, { type: 'SET_INPUT', signal: 'S', value: 0 });
    expect(s.events.length).toBe(1);
    expect(s.events[0]).toEqual({ time: 0, signal: 'S', value: 0 });
  });

  it('D-change-then-clock sequence is cleanly captured with no same-instant sampling surprise', () => {
    let s = createInitialSessionState('D');
    // Set D = 1 at t=0 -> advances time to 5
    s = flipFlopSessionReducer(s, { type: 'SET_INPUT', signal: 'D', value: 1 });
    expect(s.time).toBe(5);

    // Toggle clock at t=5 -> advances time to 10
    s = flipFlopSessionReducer(s, { type: 'TOGGLE_CLOCK' });
    expect(s.time).toBe(10);

    expect(s.events).toEqual([
      { time: 0, signal: 'D', value: 1 },
      { time: 5, signal: 'CLK', value: 1 },
    ]);
  });

  it('PULSE_CLOCK creates rising then falling clock transitions', () => {
    let s = createInitialSessionState('D');
    s = flipFlopSessionReducer(s, { type: 'PULSE_CLOCK' });
    expect(s.events).toEqual([
      { time: 0, signal: 'CLK', value: 1 },
      { time: 10, signal: 'CLK', value: 0 },
    ]);
    expect(s.time).toBe(15);
    expect(s.cursor).toBe(15);
  });

  it('ADVANCE advances time and cursor', () => {
    let s = createInitialSessionState('D');
    s = flipFlopSessionReducer(s, { type: 'ADVANCE', delta: 8 });
    expect(s.time).toBe(8);
    expect(s.cursor).toBe(8);
  });

  it('NEXT_EVENT and PREV_EVENT step cursor between event timestamps', () => {
    let s = createInitialSessionState('D');
    s = flipFlopSessionReducer(s, { type: 'SET_INPUT', signal: 'D', value: 1 }); // event at 0, time=5
    s = flipFlopSessionReducer(s, { type: 'SET_INPUT', signal: 'D', value: 0 }); // event at 5, time=10
    s = flipFlopSessionReducer(s, { type: 'SET_CURSOR', cursor: 0 });

    s = flipFlopSessionReducer(s, { type: 'NEXT_EVENT' });
    expect(s.cursor).toBe(5);

    s = flipFlopSessionReducer(s, { type: 'PREV_EVENT' });
    expect(s.cursor).toBe(0);
  });

  it('UNDO_LAST restores the previous session state', () => {
    let s = createInitialSessionState('D');
    s = flipFlopSessionReducer(s, { type: 'SET_INPUT', signal: 'D', value: 1 });
    expect(s.events.length).toBe(1);

    s = flipFlopSessionReducer(s, { type: 'UNDO_LAST' });
    expect(s.events.length).toBe(0);
    expect(s.time).toBe(0);
  });

  it('LOAD_PRESET loads preset config and timeline', () => {
    let s = createInitialSessionState('D');
    const preset = PRESET_SCENARIOS[0]!;
    s = flipFlopSessionReducer(s, { type: 'LOAD_PRESET', preset });
    expect(s.config.type).toBe('D');
    expect(s.events).toEqual(preset.script.events);
    expect(s.time).toBe(preset.script.endTime);
  });

  it('RESET clears timeline and resets cursor/time', () => {
    let s = createInitialSessionState('D');
    s = flipFlopSessionReducer(s, { type: 'SET_INPUT', signal: 'D', value: 1 });
    s = flipFlopSessionReducer(s, { type: 'RESET' });
    expect(s.events).toEqual([]);
    expect(s.time).toBe(0);
    expect(s.cursor).toBe(0);
  });

  it('supports JSON round-tripping with perfect fidelity', () => {
    let s = createInitialSessionState('JK');
    s = flipFlopSessionReducer(s, { type: 'SET_INPUT', signal: 'J', value: 1 });
    s = flipFlopSessionReducer(s, { type: 'PULSE_CLOCK' });

    const json = JSON.stringify(s);
    const restored: FlipFlopSessionState = JSON.parse(json);
    expect(restored.config).toEqual(s.config);
    expect(restored.events).toEqual(s.events);
    expect(restored.time).toBe(s.time);
  });

  it('queries signal values at target timestamps deterministically', () => {
    let s = createInitialSessionState('D');
    s = flipFlopSessionReducer(s, { type: 'SET_INPUT', signal: 'D', value: 1 }); // t=0, val=1
    s = flipFlopSessionReducer(s, { type: 'SET_INPUT', signal: 'D', value: 0 }); // t=5, val=0

    expect(getSignalValueAtTime(s, 'D', 0)).toBe(1);
    expect(getSignalValueAtTime(s, 'D', 4)).toBe(1);
    expect(getSignalValueAtTime(s, 'D', 5)).toBe(0);
    expect(getSignalValueAtTime(s, 'D', 10)).toBe(0);
  });
});
