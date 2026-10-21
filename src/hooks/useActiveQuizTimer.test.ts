import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatActiveDuration, useActiveQuizTimer } from './useActiveQuizTimer';

describe('useActiveQuizTimer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ticks each second from elapsed timestamps', () => {
    const { result } = renderHook(() => useActiveQuizTimer());
    act(() => result.current.restart());
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.elapsedMs).toBe(3000);
  });

  it('formats hours after one hour and pads mm:ss before then', () => {
    expect(formatActiveDuration(9_000)).toBe('00:09');
    expect(formatActiveDuration(3_661_000)).toBe('1:01:01');
  });

  it('pauses, resumes, and excludes paused time from the final active duration', () => {
    const { result } = renderHook(() => useActiveQuizTimer());
    act(() => result.current.restart());
    act(() => vi.advanceTimersByTime(2500));
    act(() => result.current.pause());
    expect(result.current.elapsedMs).toBe(2500);
    act(() => vi.advanceTimersByTime(9000));
    expect(result.current.elapsedMs).toBe(2500);
    act(() => result.current.resume());
    act(() => vi.advanceTimersByTime(1500));
    let finalDuration = 0;
    act(() => { finalDuration = result.current.stop(); });
    expect(finalDuration).toBe(4000);
    expect(result.current.elapsedMs).toBe(4000);
  });

  it('restarts at zero with one running interval', () => {
    const { result } = renderHook(() => useActiveQuizTimer());
    act(() => result.current.restart());
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.restart());
    expect(result.current.elapsedMs).toBe(0);
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.elapsedMs).toBe(1000);
  });

  it('clears the interval when unmounted', () => {
    const { result, unmount } = renderHook(() => useActiveQuizTimer());
    act(() => result.current.restart());
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('automatically pauses when the tab becomes hidden and remains paused on return', () => {
    const { result } = renderHook(() => useActiveQuizTimer());
    act(() => result.current.restart());
    act(() => vi.advanceTimersByTime(2000));
    const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current.isPaused).toBe(true);
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.elapsedMs).toBe(2000);
    if (visibility) Object.defineProperty(document, 'visibilityState', visibility);
  });
});
