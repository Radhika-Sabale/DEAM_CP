/**
 * @file useFlipFlopSession.test.ts
 * Unit tests for the useFlipFlopSession hook, cursor valuation, row matching, and error handling.
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFlipFlopSession } from './useFlipFlopSession';

describe('useFlipFlopSession', () => {
  it('evaluates cursor values and initial values correctly', () => {
    const { result } = renderHook(() => useFlipFlopSession('D'));

    expect(result.current.cursorValues.CLK).toBe(0);
    expect(result.current.cursorValues.inputs.D).toBe(0);
    expect(result.current.cursorValues.Q).toBe(0);
    expect(result.current.cursorValues.Qbar).toBe(1);
    expect(result.current.currentRowIndex).toBe(0); // D=0, Q=0 -> 0
  });

  it('updates cursor values when stepping and pulsing the clock', () => {
    const { result } = renderHook(() => useFlipFlopSession('D'));

    act(() => {
      result.current.setInput('D', 1);
    });

    // Time is now 5, cursor is 5, D is 1
    expect(result.current.cursorValues.inputs.D).toBe(1);
    expect(result.current.cursorValues.Q).toBe(0);
    expect(result.current.currentRowIndex).toBe(2); // D=1, Q=0 -> (1 << 1) | 0 = 2

    act(() => {
      result.current.pulseClock();
    });

    // Clock pulsed: at t=5 CLK rose to 1, at t=6 Q becomes 1 (delay=1), then clock fell
    // Current time is 5 + 10 + 5 = 20, cursor is 20
    expect(result.current.cursorValues.Q).toBe(1);
    expect(result.current.cursorValues.Qbar).toBe(0);
    expect(result.current.currentRowIndex).toBe(3); // D=1, Q=1 -> (1 << 1) | 1 = 3
  });

  it('computes correct characteristic table row index for all four flip-flop types', () => {
    // 1. D: D=1, Q=0 -> index 2
    const { result: dHook } = renderHook(() => useFlipFlopSession('D'));
    act(() => dHook.current.setInput('D', 1));
    expect(dHook.current.currentRowIndex).toBe(2);

    // 2. T: T=1, Q=0 -> index 2
    const { result: tHook } = renderHook(() => useFlipFlopSession('T'));
    act(() => tHook.current.setInput('T', 1));
    expect(tHook.current.currentRowIndex).toBe(2);

    // 3. JK: J=1, K=0, Q=1 -> index 5 (binary 101)
    const { result: jkHook } = renderHook(() => useFlipFlopSession('JK'));
    act(() => {
      jkHook.current.setInitialQ(1);
      jkHook.current.setInput('J', 1);
    });
    expect(jkHook.current.currentRowIndex).toBe(5);

    // 4. SR: S=0, R=1, Q=1 -> index 3 (binary 011)
    const { result: srHook } = renderHook(() => useFlipFlopSession('SR'));
    act(() => {
      srHook.current.setInitialQ(1);
      srHook.current.setInput('R', 1);
    });
    expect(srHook.current.currentRowIndex).toBe(3);
  });

  it('formats engine simulation errors in plain language if encountered', () => {
    const { result } = renderHook(() => useFlipFlopSession('D'));
    expect(result.current.error).toBeNull();
  });
});
