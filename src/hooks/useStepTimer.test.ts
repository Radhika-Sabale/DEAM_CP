/**
 * @file useStepTimer.test.ts
 * Unit tests for useStepTimer hook:
 * verification of active duration accumulation, pausing during background tab visibility,
 * idle inactivity threshold detection, and timer reset behavior.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStepTimer } from './useStepTimer';

describe('useStepTimer Hook Unit Tests', () => {
  let currentTime = 1000;
  const mockClock = () => currentTime;

  beforeEach(() => {
    currentTime = 1000;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with 0 elapsedMs and isRunning: false', () => {
    const { result } = renderHook(() => useStepTimer({ clockFn: mockClock }));
    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isIdle).toBe(false);
  });

  it('measures elapsed time between start and stop', () => {
    const { result } = renderHook(() => useStepTimer({ clockFn: mockClock }));

    act(() => {
      result.current.start();
    });
    expect(result.current.isRunning).toBe(true);

    // Advance 5000 ms
    currentTime += 5000;
    vi.advanceTimersByTime(5000);

    let finalElapsed = 0;
    act(() => {
      finalElapsed = result.current.stop();
    });

    expect(result.current.isRunning).toBe(false);
    expect(finalElapsed).toBe(5000);
    expect(result.current.elapsedMs).toBe(5000);
  });

  it('reset clears all accumulated time and running state', () => {
    const { result } = renderHook(() => useStepTimer({ clockFn: mockClock }));

    act(() => {
      result.current.start();
    });
    currentTime += 3000;
    act(() => {
      result.current.stop();
    });
    expect(result.current.elapsedMs).toBe(3000);

    act(() => {
      result.current.reset();
    });
    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.isRunning).toBe(false);
  });

  it('pauses accumulation when document visibility becomes hidden', () => {
    const { result } = renderHook(() => useStepTimer({ clockFn: mockClock }));

    act(() => {
      result.current.start();
    });

    // 2 seconds active
    currentTime += 2000;
    vi.advanceTimersByTime(2000);

    // Switch tab to hidden
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // 10 seconds pass while tab is hidden
    currentTime += 10000;
    vi.advanceTimersByTime(10000);

    // Switch tab back to visible
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // 1 second active
    currentTime += 1000;
    vi.advanceTimersByTime(1000);

    let finalElapsed = 0;
    act(() => {
      finalElapsed = result.current.stop();
    });

    // Total should be 2000 + 1000 = 3000 ms (the 10s hidden was ignored)
    expect(finalElapsed).toBe(3000);
  });

  it('idle detection: pauses timer when student is inactive and resumes on interaction', () => {
    const onIdle = vi.fn();
    const onResume = vi.fn();

    const { result } = renderHook(() =>
      useStepTimer({
        clockFn: mockClock,
        idleThresholdMs: 4000,
        onIdle,
        onResume,
      })
    );

    act(() => {
      result.current.start();
    });

    // Active for 2 seconds
    currentTime += 2000;
    vi.advanceTimersByTime(2000);

    // Advance past 4s threshold without interaction (total 4000 ms inactivity from start)
    currentTime += 2000;
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.isIdle).toBe(true);
    expect(onIdle).toHaveBeenCalledTimes(1);

    // 20 seconds pass while idle
    currentTime += 20000;
    vi.advanceTimersByTime(20000);

    // User presses a key to resume
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A' }));
    });

    expect(result.current.isIdle).toBe(false);
    expect(onResume).toHaveBeenCalledTimes(1);

    // Active for 1 second more
    currentTime += 1000;
    vi.advanceTimersByTime(1000);

    let finalElapsed = 0;
    act(() => {
      finalElapsed = result.current.stop();
    });

    // Total should be 4000 ms (before idle) + 1000 ms (after resume) = 5000 ms (the 20s idle was ignored)
    expect(finalElapsed).toBe(5000);
  });
});
