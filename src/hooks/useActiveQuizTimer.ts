import { useCallback, useEffect, useRef, useState } from 'react';

export interface ActiveQuizTimer {
  readonly elapsedMs: number;
  readonly isRunning: boolean;
  readonly isPaused: boolean;
  readonly pause: () => void;
  readonly resume: () => void;
  readonly restart: () => void;
  readonly stop: () => number;
}

export function formatActiveDuration(durationMs: number): string {
  const seconds = Math.floor(Math.max(0, durationMs) / 1000);
  if (seconds >= 3600) {
    return `${Math.floor(seconds / 3600)}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Counts active quiz time from timestamps, so throttled intervals do not lose time. */
export function useActiveQuizTimer(): ActiveQuizTimer {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const accumulatedMs = useRef(0);
  const segmentStartedAt = useRef<number | null>(null);
  const intervalId = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(false);

  const clearTicker = useCallback(() => {
    if (intervalId.current !== null) {
      clearInterval(intervalId.current);
      intervalId.current = null;
    }
  }, []);

  const refresh = useCallback(() => {
    const activeSegment = segmentStartedAt.current === null
      ? 0
      : Date.now() - segmentStartedAt.current;
    setElapsedMs(Math.max(0, Math.round(accumulatedMs.current + activeSegment)));
  }, []);

  const pause = useCallback(() => {
    if (!runningRef.current) return;
    if (segmentStartedAt.current !== null) {
      accumulatedMs.current += Date.now() - segmentStartedAt.current;
      segmentStartedAt.current = null;
    }
    runningRef.current = false;
    clearTicker();
    setIsRunning(false);
    setIsPaused(true);
    refresh();
  }, [clearTicker, refresh]);

  const resume = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    segmentStartedAt.current = Date.now();
    setIsRunning(true);
    setIsPaused(false);
    clearTicker();
    intervalId.current = setInterval(refresh, 1000);
    refresh();
  }, [clearTicker, refresh]);

  const stop = useCallback(() => {
    if (runningRef.current && segmentStartedAt.current !== null) {
      accumulatedMs.current += Date.now() - segmentStartedAt.current;
    }
    segmentStartedAt.current = null;
    runningRef.current = false;
    clearTicker();
    setIsRunning(false);
    setIsPaused(false);
    const finalElapsed = Math.max(0, Math.round(accumulatedMs.current));
    setElapsedMs(finalElapsed);
    return finalElapsed;
  }, [clearTicker]);

  const restart = useCallback(() => {
    clearTicker();
    accumulatedMs.current = 0;
    segmentStartedAt.current = Date.now();
    runningRef.current = true;
    setElapsedMs(0);
    setIsRunning(true);
    setIsPaused(false);
    intervalId.current = setInterval(refresh, 1000);
  }, [clearTicker, refresh]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') pause();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTicker();
    };
  }, [clearTicker, pause]);

  return { elapsedMs, isRunning, isPaused, pause, resume, restart, stop };
}
