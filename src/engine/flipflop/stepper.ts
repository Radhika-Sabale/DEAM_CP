/**
 * @file stepper.ts
 * Discrete-event timeline simulation engine for bistable flip-flops and latches.
 *
 * DOCUMENTED TIME-STEP PROCESSING ORDER AT EACH TIME t:
 * 1. Apply scheduled output updates landing at t (committed Q and Qbar updates).
 * 2. Snapshot the input and clock values as they were BEFORE this time step (at t-).
 * 3. Apply all stimulus events occurring at t together (updating pins).
 * 4. Evaluate asynchronous controls (PRE, CLR) with priority override.
 * 5. Evaluate the clock (active edge detection or level-sensitive transparency).
 */

import type { LogicValue } from '../../types/ast';
import { inputNames, isInvalidInput, nextState, operationName, outputsFromQ, type FlipFlopConfig } from './models';
import {
  evaluateAsyncControls,
  findTimingViolations,
  iterateZeroDelayFeedback,
  validateScript,
  type FlipFlopChange,
  type FlipFlopEvent,
  type FlipFlopScript,
  type ScheduledUpdate,
  type SimulationResult,
} from './stepperRules';

export * from './stepperRules';

/** Executes a full discrete-event timeline simulation of a flip-flop or latch. */
export function simulateTimeline(config: FlipFlopConfig, script: FlipFlopScript): SimulationResult {
  const validationError = validateScript(config, script);
  if (validationError) return { ok: false, error: validationError };

  const names = inputNames(config.type);
  const currentInputs: Record<string, LogicValue> = {};
  for (const name of names) currentInputs[name] = script.initialInputs?.[name] ?? 0;

  let currentClock: LogicValue = script.initialClock ?? 0;
  let currentPre: LogicValue = config.asyncControls ? (script.initialPreset ?? (config.asyncActiveLow ? 1 : 0)) : 1;
  let currentClr: LogicValue = config.asyncControls ? (script.initialClear ?? (config.asyncActiveLow ? 1 : 0)) : 1;
  let committedQ: LogicValue = script.initialQ ?? 'X';
  let committedQbar: LogicValue = outputsFromQ(committedQ).qBar;
  let projectedQ: LogicValue = committedQ;
  let projectedQbar: LogicValue = committedQbar;

  const changes: FlipFlopChange[] = [];
  const events: FlipFlopEvent[] = [];
  const scheduledUpdates: ScheduledUpdate[] = [];

  let activeEdgesCount = 0;
  let qTogglesCount = 0;
  let asyncEventsCount = 0;
  let timingViolationsCount = 0;
  let levelIsOpen = false;
  let toggleCountInWindow = 0;
  let wasPreAsserted = false;
  let wasClrAsserted = false;

  const recordedValues: Record<string, LogicValue> = {};
  const recordChange = (time: number, nodeId: string, value: LogicValue) => {
    if (time <= script.endTime && recordedValues[nodeId] !== value) {
      recordedValues[nodeId] = value;
      changes.push({ time, nodeId, value });
    }
  };

  for (const name of names) recordChange(0, name, currentInputs[name] ?? 0);
  recordChange(0, 'CLK', currentClock);
  if (config.asyncControls) {
    recordChange(0, 'PRE', currentPre);
    recordChange(0, 'CLR', currentClr);
  }
  recordChange(0, 'Q', committedQ);
  recordChange(0, 'Qbar', committedQbar);

  const timeSet = new Set<number>([0, script.endTime]);
  for (const ev of script.events) timeSet.add(ev.time);

  const scriptEventsByTime = new Map<number, typeof script.events[0][]>();
  for (const ev of script.events) {
    const list = scriptEventsByTime.get(ev.time) ?? [];
    list.push(ev);
    scriptEventsByTime.set(ev.time, list);
  }

  const applyOutput = (time: number, targetQ: LogicValue, targetQbar: LogicValue, source: 'clock' | 'async' | 'feedback') => {
    projectedQ = targetQ;
    projectedQbar = targetQbar;
    if (config.propagationDelay === 0) {
      if (committedQ !== targetQ || committedQbar !== targetQbar) {
        const qBefore = committedQ;
        committedQ = targetQ;
        committedQbar = targetQbar;
        recordChange(time, 'Q', committedQ);
        recordChange(time, 'Qbar', committedQbar);
        qTogglesCount++;
        events.push({ kind: 'q-update', time, qBefore, qAfter: committedQ, source });
        if (levelIsOpen && ++toggleCountInWindow >= 2) {
          events.push({ kind: 'race-around-toggle', time, toggleIndex: toggleCountInWindow, qBefore, qAfter: committedQ });
        }
      }
    } else {
      const updateTime = time + config.propagationDelay;
      if (updateTime <= script.endTime) {
        scheduledUpdates.push({ time: updateTime, q: targetQ, qBar: targetQbar, source });
        timeSet.add(updateTime);
      }
    }
  };

  const visitedTimes = new Set<number>();
  while (visitedTimes.size < timeSet.size) {
    const remaining = Array.from(timeSet).filter((t) => !visitedTimes.has(t) && t <= script.endTime).sort((a, b) => a - b);
    if (remaining.length === 0) break;
    const t = remaining[0] as number;
    visitedTimes.add(t);

    // 1. Apply scheduled output updates landing at t
    const due = scheduledUpdates.filter((u) => u.time === t);
    if (due.length > 0) {
      const latest = due[due.length - 1];
      if (latest && (committedQ !== latest.q || committedQbar !== latest.qBar)) {
        const qBefore = committedQ;
        committedQ = latest.q;
        committedQbar = latest.qBar;
        recordChange(t, 'Q', committedQ);
        recordChange(t, 'Qbar', committedQbar);
        qTogglesCount++;
        events.push({ kind: 'q-update', time: t, qBefore, qAfter: committedQ, source: latest.source });
        if (levelIsOpen && ++toggleCountInWindow >= 2) {
          events.push({ kind: 'race-around-toggle', time: t, toggleIndex: toggleCountInWindow, qBefore, qAfter: committedQ });
        }
      }
    }

    // 2. Snapshot values before step
    const snapshotInputs: Record<string, LogicValue> = { ...currentInputs };
    const snapshotClock = currentClock;

    // 3. Apply stimulus events at t
    let inputsChangedAtT = false;
    for (const ev of scriptEventsByTime.get(t) ?? []) {
      if (names.includes(ev.signal)) {
        if (currentInputs[ev.signal] !== ev.value) {
          currentInputs[ev.signal] = ev.value;
          inputsChangedAtT = true;
          recordChange(t, ev.signal, ev.value);
        }
      } else if (ev.signal === 'CLK' && currentClock !== ev.value) {
        currentClock = ev.value;
        recordChange(t, 'CLK', ev.value);
      } else if (ev.signal === 'PRE' && currentPre !== ev.value) {
        currentPre = ev.value;
        recordChange(t, 'PRE', ev.value);
      } else if (ev.signal === 'CLR' && currentClr !== ev.value) {
        currentClr = ev.value;
        recordChange(t, 'CLR', ev.value);
      }
    }

    // 4. Evaluate asynchronous controls
    let asyncOverriding = false;
    if (config.asyncControls) {
      const asyncRes = evaluateAsyncControls(config, currentPre, currentClr, committedQ, wasPreAsserted, wasClrAsserted, t);
      asyncOverriding = asyncRes.asyncOverriding;
      wasPreAsserted = asyncRes.newWasPreAsserted;
      wasClrAsserted = asyncRes.newWasClrAsserted;
      if (asyncRes.incAsyncCount) asyncEventsCount++;
      if (asyncRes.event) events.push(asyncRes.event);
      if (asyncRes.asyncOverriding) scheduledUpdates.length = 0;
      if (asyncRes.targetOutput) applyOutput(t, asyncRes.targetOutput.q, asyncRes.targetOutput.qBar, 'async');
    }

    // 5. Evaluate the clock
    if (asyncOverriding) {
      if (snapshotClock !== currentClock) {
        events.push({ kind: 'clock-ignored', time: t, reason: 'Clock transition ignored because asynchronous control is asserted.' });
      }
    } else {
      const isEdge = config.trigger === 'rising' || config.trigger === 'falling';
      if (isEdge) {
        const isRising = config.trigger === 'rising' && snapshotClock === 0 && currentClock === 1;
        const isFalling = config.trigger === 'falling' && snapshotClock === 1 && currentClock === 0;
        if ((snapshotClock === 'X' && currentClock !== 'X') || (snapshotClock !== 'X' && currentClock === 'X')) {
          events.push({ kind: 'unknown-clock', time: t, message: 'Clock transitioned to or from unknown (X) logic level.' });
          applyOutput(t, 'X', 'X', 'clock');
        } else if (isRising || isFalling) {
          activeEdgesCount++;
          const violations = findTimingViolations(config, script.events, t);
          for (const v of violations) {
            timingViolationsCount++;
            events.push({ kind: 'timing-violation', time: t, violationType: v.violationType, signal: v.signal, edgeTime: t, eventTime: v.eventTime });
          }
          const inputVec = names.map((n) => snapshotInputs[n] ?? 0);
          if (violations.length > 0) {
            applyOutput(t, 'X', 'X', 'clock');
          } else if (isInvalidInput(config.type, inputVec)) {
            events.push({ kind: 'invalid-input', time: t, inputs: snapshotInputs, message: 'Invalid input combination sampled at active clock edge.' });
            applyOutput(t, 'X', 'X', 'clock');
          } else {
            const nextQ = nextState(config.type, inputVec, committedQ);
            events.push({ kind: 'active-edge', time: t, edge: config.trigger as 'rising' | 'falling', sampledInputs: snapshotInputs, operation: operationName(config.type, inputVec), qBefore: committedQ, qAfter: nextQ });
            applyOutput(t, nextQ, outputsFromQ(nextQ).qBar, 'clock');
          }
        }
      } else {
        const isEnabled = config.trigger === 'level-high' ? currentClock === 1 : currentClock === 0;
        const wasEnabled = config.trigger === 'level-high' ? snapshotClock === 1 : snapshotClock === 0;
        if (!wasEnabled && isEnabled) {
          levelIsOpen = true;
          toggleCountInWindow = 0;
          events.push({ kind: 'level-open', time: t, level: config.trigger === 'level-high' ? 'high' : 'low', sampledInputs: { ...currentInputs } });
        } else if (wasEnabled && !isEnabled) {
          levelIsOpen = false;
          events.push({ kind: 'level-close', time: t, level: config.trigger === 'level-high' ? 'high' : 'low' });
        }
        if (isEnabled) {
          const inputVec = names.map((n) => currentInputs[n] ?? 0);
          if (isInvalidInput(config.type, inputVec)) {
            events.push({ kind: 'invalid-input', time: t, inputs: { ...currentInputs }, message: 'Invalid input combination present while latch level is active.' });
            applyOutput(t, 'X', 'X', 'clock');
          } else if (config.propagationDelay === 0) {
            const { settledQ, converged } = iterateZeroDelayFeedback(config.type, inputVec, committedQ);
            if (!converged) {
              events.push({ kind: 'race-around-unbounded', time: t, message: 'Zero-delay level-triggered race-around loop failed to stabilize within 64 rounds.' });
              committedQ = 'X';
              committedQbar = 'X';
              recordChange(t, 'Q', 'X');
              recordChange(t, 'Qbar', 'X');
            } else if (committedQ !== settledQ) {
              const qBefore = committedQ;
              committedQ = settledQ;
              committedQbar = outputsFromQ(settledQ).qBar;
              recordChange(t, 'Q', committedQ);
              recordChange(t, 'Qbar', committedQbar);
              qTogglesCount++;
              events.push({ kind: 'q-update', time: t, qBefore, qAfter: committedQ, source: 'feedback' });
            }
          } else {
            const targetQ = nextState(config.type, inputVec, committedQ);
            const targetQbar = outputsFromQ(targetQ).qBar;
            if (targetQ !== projectedQ || targetQbar !== projectedQbar || inputsChangedAtT) {
              applyOutput(t, targetQ, targetQbar, 'feedback');
            }
          }
        }
      }
    }
  }

  return {
    ok: true,
    changes,
    events,
    finalState: {
      q: committedQ,
      qBar: committedQbar,
      clock: currentClock,
      inputs: { ...currentInputs },
      ...(config.asyncControls ? { preset: currentPre, clear: currentClr } : {}),
    },
    stats: { activeEdgesCount, qTogglesCount, asyncEventsCount, timingViolationsCount },
  };
}
