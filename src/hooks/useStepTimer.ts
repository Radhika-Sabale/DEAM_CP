/**
 * @file useStepTimer.ts
 * React hook measuring active student time per problem step with automatic pause on
 * tab visibility change and idle inactivity detection.
 *
 * IDLE DETECTION AND ACTIVE TIME PEDAGOGICAL RULE:
 * In learning science research, raw wall-clock duration between step presentation and
 * submission is frequently inflated by off-task distractions (e.g. a student stepping
 * away from the computer). To ensure high telemetry fidelity:
 * 1. Page Visibility API: The timer immediately pauses whenever document.visibilityState
 *    becomes 'hidden' or window blur occurs.
 * 2. Idle Detection: If no user interaction (keydown, mousedown, touchstart) occurs within
 *    the configurable `idleThresholdMs` (default 60,000 ms), counting ceases until the student
 *    resumes interaction.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface StepTimerOptions {
  /** Inactivity threshold in milliseconds before pausing counting (default 60,000 ms) */
  readonly idleThresholdMs?: number;
  /** Injected clock function for test reproducibility (default performance.now) */
  readonly clockFn?: () => number;
  /** Optional callback fired when student becomes idle */
  readonly onIdle?: () => void;
  /** Optional callback fired when student resumes activity after being idle */
  readonly onResume?: () => void;
}

export interface StepTimerResult {
  readonly elapsedMs: number;
  readonly isRunning: boolean;
  readonly isIdle: boolean;
  readonly start: () => void;
  readonly stop: () => number;
  readonly reset: () => void;
}

export function useStepTimer(options: StepTimerOptions = {}): StepTimerResult {
  const {
    idleThresholdMs = 60000,
    clockFn = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    onIdle,
    onResume,
  } = options;

  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isIdle, setIsIdle] = useState<boolean>(false);

  // Mutable refs to track active interval timestamps without re-renders
  const accumulatedMsRef = useRef<number>(0);
  const lastActiveTimestampRef = useRef<number | null>(null);
  const lastInteractionTimestampRef = useRef<number | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const isIdleRef = useRef<boolean>(false);
  const idleTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pauseCounting = useCallback(() => {
    if (!isRunningRef.current || lastActiveTimestampRef.current === null) return;
    const now = clockFn();
    accumulatedMsRef.current += now - lastActiveTimestampRef.current;
    lastActiveTimestampRef.current = null;
    setElapsedMs(Math.round(accumulatedMsRef.current));
  }, [clockFn]);

  const resumeCounting = useCallback(() => {
    if (!isRunningRef.current || isIdleRef.current) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    lastActiveTimestampRef.current = clockFn();
  }, [clockFn]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimeoutIdRef.current !== null) {
      clearTimeout(idleTimeoutIdRef.current);
    }

    if (!isRunningRef.current) return;

    if (isIdleRef.current) {
      isIdleRef.current = false;
      setIsIdle(false);
      resumeCounting();
      onResume?.();
    }

    lastInteractionTimestampRef.current = clockFn();

    idleTimeoutIdRef.current = setTimeout(() => {
      if (isRunningRef.current) {
        pauseCounting();
        isIdleRef.current = true;
        setIsIdle(true);
        onIdle?.();
      }
    }, idleThresholdMs);
  }, [clockFn, idleThresholdMs, onIdle, onResume, pauseCounting, resumeCounting]);

  const start = useCallback(() => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    isIdleRef.current = false;
    setIsRunning(true);
    setIsIdle(false);

    lastActiveTimestampRef.current = clockFn();
    resetIdleTimer();
  }, [clockFn, resetIdleTimer]);

  const stop = useCallback((): number => {
    if (idleTimeoutIdRef.current !== null) {
      clearTimeout(idleTimeoutIdRef.current);
      idleTimeoutIdRef.current = null;
    }

    if (isRunningRef.current && lastActiveTimestampRef.current !== null && !isIdleRef.current) {
      accumulatedMsRef.current += clockFn() - lastActiveTimestampRef.current;
    }

    isRunningRef.current = false;
    isIdleRef.current = false;
    lastActiveTimestampRef.current = null;

    setIsRunning(false);
    setIsIdle(false);
    const finalElapsed = Math.round(accumulatedMsRef.current);
    setElapsedMs(finalElapsed);
    return finalElapsed;
  }, [clockFn]);

  const reset = useCallback(() => {
    if (idleTimeoutIdRef.current !== null) {
      clearTimeout(idleTimeoutIdRef.current);
      idleTimeoutIdRef.current = null;
    }
    accumulatedMsRef.current = 0;
    lastActiveTimestampRef.current = null;
    lastInteractionTimestampRef.current = null;
    isRunningRef.current = false;
    isIdleRef.current = false;

    setElapsedMs(0);
    setIsRunning(false);
    setIsIdle(false);
  }, []);

  // Window focus and visibility listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'hidden') {
        pauseCounting();
      } else {
        resumeCounting();
      }
    };

    const handleWindowBlur = () => {
      pauseCounting();
    };

    const handleWindowFocus = () => {
      resumeCounting();
    };

    const handleUserInteraction = () => {
      resetIdleTimer();
    };

    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleWindowBlur);
      window.addEventListener('focus', handleWindowFocus);
      window.addEventListener('keydown', handleUserInteraction);
      window.addEventListener('mousedown', handleUserInteraction);
      window.addEventListener('touchstart', handleUserInteraction);
    }

    return () => {
      if (typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('focus', handleWindowFocus);
        window.removeEventListener('keydown', handleUserInteraction);
        window.removeEventListener('mousedown', handleUserInteraction);
        window.removeEventListener('touchstart', handleUserInteraction);
      }
      if (idleTimeoutIdRef.current !== null) {
        clearTimeout(idleTimeoutIdRef.current);
      }
    };
  }, [pauseCounting, resetIdleTimer, resumeCounting]);

  return {
    elapsedMs,
    isRunning,
    isIdle,
    start,
    stop,
    reset,
  };
}
