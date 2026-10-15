/**
 * @file useInterruptSession.test.ts
 * Unit tests for the useInterruptSession hook.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from '../../store/projectStore';
import { createEmptyDesignProject } from '../../types/designProject';
import { useInterruptSession } from './useInterruptSession';

describe('useInterruptSession hook', () => {
  beforeEach(() => {
    const proj = createEmptyDesignProject('test-intr', 'Test Interrupts');
    proj.interrupts = {
      source: 'MOV AX, 1\nINT 32\nHLT',
      breakpoints: [],
      scenario: [
        { atTick: 5, kind: 'nmi' },
        { atTick: 10, kind: 'intr', vector: 64 },
      ],
    };
    useProjectStore.setState({ project: proj, isDirty: false });
  });

  it('initializes scenario from project store', () => {
    const { result } = renderHook(() => useInterruptSession());
    expect(result.current.scenario.events.length).toBe(2);
    expect(result.current.scenario.events[0]?.kind).toBe('nmi');
  });

  it('adds, updates, and removes scenario events while keeping them sorted by atTick', () => {
    const { result } = renderHook(() => useInterruptSession());

    act(() => {
      result.current.addScenarioEvent({ atTick: 2, kind: 'intr', vector: 100 });
    });

    expect(result.current.scenario.events.length).toBe(3);
    // Chronologically sorted: tick 2 is first
    expect(result.current.scenario.events[0]?.atTick).toBe(2);

    act(() => {
      result.current.removeScenarioEvent(0);
    });
    expect(result.current.scenario.events.length).toBe(2);
    expect(result.current.scenario.events[0]?.atTick).toBe(5);
  });

  it('exports and imports scenario JSON with validation', () => {
    const { result } = renderHook(() => useInterruptSession());
    const jsonStr = result.current.exportScenarioJson();
    expect(jsonStr).toContain('"events"');

    act(() => {
      const res = result.current.importScenarioJson(
        JSON.stringify({
          events: [{ atTick: 20, kind: 'nmi' }],
        })
      );
      expect(res.ok).toBe(true);
    });

    expect(result.current.scenario.events.length).toBe(1);
    expect(result.current.scenario.events[0]?.atTick).toBe(20);

    // Invalid JSON import rejected
    act(() => {
      const bad = result.current.importScenarioJson('{"bad": true}');
      expect(bad.ok).toBe(false);
    });
  });

  it('toggles interrupt watchpoint', () => {
    const { result } = renderHook(() => useInterruptSession());
    expect(result.current.hasInterruptWatchpoint).toBe(false);

    act(() => {
      result.current.toggleInterruptWatchpoint();
    });
    expect(result.current.hasInterruptWatchpoint).toBe(true);

    act(() => {
      result.current.toggleInterruptWatchpoint();
    });
    expect(result.current.hasInterruptWatchpoint).toBe(false);
  });
});
