/**
 * @file useInterruptSession.ts
 * React hook that owns the in-memory 8086 machine state with the interrupt subsystem.
 *
 * Wraps useCpuSession from the 8086 module and extends it with:
 * - External interrupt scenario management (atTick, kind, vector)
 * - Interrupt recognition log and latency audit tracking
 * - Micro-step sequence stepper for interrupt entry animation
 * - Hardware line indicators (NMI latch, INTR line, IF, TF, STI shadow)
 * - Specialized watchpoints ('interrupt-recognised')
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  InterruptEvent,
  InterruptKind,
  InterruptMicroStep,
  InterruptRecord,
  InterruptScenario,
  InterruptSource,
} from '../../engine/interrupts';
import { validateScenario } from '../../engine/interrupts';
import { useCpuSession, type CpuSession } from '../cpu8086';
import { useProjectStore } from '../../store/projectStore';
import type { StepRecord } from '../../engine/cpu8086/cpuTypes';

export interface InterruptLogEntry {
  readonly id: string;
  readonly tick: number;
  readonly kind: InterruptKind;
  readonly source: InterruptSource;
  readonly vector: number;
  readonly recognizedAtInstructionIp: number;
  readonly handlerIp: number;
  readonly returnIp: number;
  readonly returnCs: number;
  readonly returnedByIretAtTick?: number;
  readonly nestingDepth: number;
  readonly latencyTicks: number;
}

export interface InterruptSession extends CpuSession {
  readonly scenario: InterruptScenario;
  readonly setScenario: (sc: InterruptScenario) => void;
  readonly addScenarioEvent: (ev: InterruptEvent) => void;
  readonly removeScenarioEvent: (index: number) => void;
  readonly updateScenarioEvent: (index: number, ev: InterruptEvent) => void;
  readonly importScenarioJson: (json: string) => { ok: true } | { ok: false; error: string };
  readonly exportScenarioJson: () => string;

  readonly interruptLog: readonly InterruptLogEntry[];
  readonly lastInterruptRecord: InterruptRecord | null;

  readonly microStepIndex: number;
  readonly currentMicroStep: InterruptMicroStep | null;
  readonly stepIntoMicroStep: () => void;
  readonly prevMicroStep: () => void;
  readonly showAllMicroSteps: () => void;
  readonly resetMicroSteps: () => void;

  readonly currentTick: number;
  readonly pendingLines: {
    readonly nmi: boolean;
    readonly intr: { readonly vector: number } | null;
    readonly ifFlag: 0 | 1;
    readonly tfFlag: 0 | 1;
    readonly stiShadow: boolean;
  };
  readonly pendingList: readonly {
    readonly source: 'single-step' | 'nmi' | 'intr';
    readonly priority: number;
    readonly vector: number;
    readonly blocked: boolean;
    readonly label: string;
  }[];

  readonly hasInterruptWatchpoint: boolean;
  readonly toggleInterruptWatchpoint: () => void;
}

export function useInterruptSession(): InterruptSession {
  const project = useProjectStore((s) => s.project);
  const applyPatch = useProjectStore((s) => s.applyPatch);

  const initialScenario = useMemo<InterruptScenario>(() => {
    return { events: project.interrupts?.scenario ?? [] };
  }, [project.interrupts?.scenario]);

  const [scenario, setScenarioState] = useState<InterruptScenario>(initialScenario);
  const [interruptLog, setInterruptLog] = useState<readonly InterruptLogEntry[]>([]);
  const [microStepIndex, setMicroStepIndex] = useState<number>(-1);

  // Synchronize scenario changes to project store
  const persistScenario = useCallback(
    (nextSc: InterruptScenario) => {
      setScenarioState(nextSc);
      applyPatch({
        interrupts: {
          source: project.interrupts?.source ?? '',
          breakpoints: project.interrupts?.breakpoints ?? [],
          scenario: nextSc.events,
        },
      });
    },
    [applyPatch, project.interrupts?.source, project.interrupts?.breakpoints]
  );

  const cpuSession = useCpuSession({
    slice: 'interrupts',
    scenario,
    lowWaterMark: 0x0400,
  });

  const lastRecordRef = useRef<StepRecord | null>(null);

  // Audit interrupt entries and IRET returns into interruptLog
  useEffect(() => {
    const rec = cpuSession.lastRecord;
    if (!rec || rec === lastRecordRef.current) return;
    lastRecordRef.current = rec;

    if (rec.interruptRecord) {
      const ir = rec.interruptRecord;
      // Calculate latency from scenario if hardware
      let scheduledTick = rec.address;
      if (ir.kind === 'nmi') {
        const ev = scenario.events.find((e) => e.kind === 'nmi' && e.atTick <= (cpuSession.cpuState?.ticks ?? 0));
        scheduledTick = ev?.atTick ?? (cpuSession.cpuState?.ticks ?? 0);
      } else if (ir.kind === 'intr') {
        const ev = scenario.events.find((e) => e.kind === 'intr' && e.vector === ir.vector && e.atTick <= (cpuSession.cpuState?.ticks ?? 0));
        scheduledTick = ev?.atTick ?? (cpuSession.cpuState?.ticks ?? 0);
      }
      const latency = Math.max(0, (cpuSession.cpuState?.ticks ?? 0) - scheduledTick);

      setInterruptLog((prev) => {
        // Compute nesting depth
        const activeUnreturned = prev.filter((entry) => entry.returnedByIretAtTick === undefined);
        const entry: InterruptLogEntry = {
          id: `int-${cpuSession.cpuState?.ticks ?? 0}-${prev.length}`,
          tick: cpuSession.cpuState?.ticks ?? 0,
          kind: ir.kind,
          source: ir.source,
          vector: ir.vector,
          recognizedAtInstructionIp: ir.returnIp,
          handlerIp: ir.handlerIp,
          returnIp: ir.returnIp,
          returnCs: ir.returnCs,
          nestingDepth: activeUnreturned.length + 1,
          latencyTicks: latency,
        };
        return [...prev, entry];
      });

      // Prepare microstep stepper
      setMicroStepIndex(0);
    }

    if (rec.iretRecord) {
      setInterruptLog((prev) => {
        // Mark the most recent unreturned interrupt as returned
        const revIdx = [...prev].reverse().findIndex((e) => e.returnedByIretAtTick === undefined);
        if (revIdx === -1) return prev;
        const targetIdx = prev.length - 1 - revIdx;
        return prev.map((entry, idx) =>
          idx === targetIdx
            ? { ...entry, returnedByIretAtTick: cpuSession.cpuState?.ticks ?? 0 }
            : entry
        );
      });
    }
  }, [cpuSession.lastRecord, cpuSession.cpuState?.ticks, scenario.events]);

  // Reset interrupt log when assembling or resetting
  const originalAssembleAndReset = cpuSession.assembleAndReset;
  const originalReset = cpuSession.reset;

  const assembleAndReset = useCallback(() => {
    setInterruptLog([]);
    setMicroStepIndex(-1);
    originalAssembleAndReset();
  }, [originalAssembleAndReset]);

  const reset = useCallback(() => {
    setInterruptLog([]);
    setMicroStepIndex(-1);
    originalReset();
  }, [originalReset]);

  const addScenarioEvent = useCallback(
    (ev: InterruptEvent) => {
      const next = { events: [...scenario.events, ev].sort((a, b) => a.atTick - b.atTick) };
      persistScenario(next);
      reset();
    },
    [scenario.events, persistScenario, reset]
  );

  const removeScenarioEvent = useCallback(
    (index: number) => {
      const next = { events: scenario.events.filter((_, i) => i !== index) };
      persistScenario(next);
      reset();
    },
    [scenario.events, persistScenario, reset]
  );

  const updateScenarioEvent = useCallback(
    (index: number, ev: InterruptEvent) => {
      const nextEvents = [...scenario.events];
      nextEvents[index] = ev;
      nextEvents.sort((a, b) => a.atTick - b.atTick);
      persistScenario({ events: nextEvents });
      reset();
    },
    [scenario.events, persistScenario, reset]
  );

  const importScenarioJson = useCallback(
    (json: string): { ok: true } | { ok: false; error: string } => {
      try {
        const parsed = JSON.parse(json);
        if (!parsed || !Array.isArray(parsed.events)) {
          return { ok: false, error: 'Imported JSON must contain an "events" array.' };
        }
        const valRes = validateScenario(parsed as InterruptScenario);
        if (!valRes.valid) {
          return { ok: false, error: valRes.message };
        }
        persistScenario(parsed as InterruptScenario);
        reset();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
    [persistScenario, reset]
  );

  const exportScenarioJson = useCallback(() => {
    return JSON.stringify(scenario, null, 2);
  }, [scenario]);

  const lastInterruptRecord = cpuSession.lastRecord?.interruptRecord ?? null;
  const currentMicroStep =
    lastInterruptRecord && microStepIndex >= 0 && microStepIndex < lastInterruptRecord.microSteps.length
      ? lastInterruptRecord.microSteps[microStepIndex] ?? null
      : null;

  const stepIntoMicroStep = useCallback(() => {
    if (!lastInterruptRecord) return;
    setMicroStepIndex((prev) => Math.min(lastInterruptRecord.microSteps.length - 1, prev + 1));
  }, [lastInterruptRecord]);

  const prevMicroStep = useCallback(() => {
    setMicroStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const showAllMicroSteps = useCallback(() => {
    if (!lastInterruptRecord) return;
    setMicroStepIndex(lastInterruptRecord.microSteps.length - 1);
  }, [lastInterruptRecord]);

  const resetMicroSteps = useCallback(() => {
    setMicroStepIndex(-1);
  }, []);

  const currentTick = cpuSession.cpuState?.ticks ?? 0;
  const pendingNmi = cpuSession.cpuState?.pendingNmi ?? false;
  const pendingIntr = cpuSession.cpuState?.pendingIntr ?? null;
  const ifFlag = cpuSession.cpuState?.flags.I ?? 1;
  const tfFlag = cpuSession.cpuState?.flags.T ?? 0;
  const stiShadow = cpuSession.cpuState?.stiShadowActive ?? false;

  const pendingList = useMemo(() => {
    const list: {
      source: 'single-step' | 'nmi' | 'intr';
      priority: number;
      vector: number;
      blocked: boolean;
      label: string;
    }[] = [];

    if (cpuSession.cpuState?.singleStepPending) {
      list.push({
        source: 'single-step',
        priority: 1,
        vector: 1,
        blocked: false,
        label: 'Single-Step Trap (Vector 1)',
      });
    }

    if (pendingNmi) {
      list.push({
        source: 'nmi',
        priority: 2,
        vector: 2,
        blocked: false,
        label: 'NMI (Vector 2, Non-Maskable)',
      });
    }

    if (pendingIntr) {
      const isBlocked = ifFlag === 0 || stiShadow;
      list.push({
        source: 'intr',
        priority: 3,
        vector: pendingIntr.vector,
        blocked: isBlocked,
        label: `INTR (Vector ${pendingIntr.vector}${isBlocked ? ' - Blocked by IF=0' : ' - Ready'})`,
      });
    }

    return list;
  }, [cpuSession.cpuState?.singleStepPending, pendingNmi, pendingIntr, ifFlag, stiShadow]);

  const hasInterruptWatchpoint = useMemo(() => {
    return cpuSession.watchpoints.some((w) => w.type === 'interrupt');
  }, [cpuSession.watchpoints]);

  const toggleInterruptWatchpoint = useCallback(() => {
    if (hasInterruptWatchpoint) {
      const idx = cpuSession.watchpoints.findIndex((w) => w.type === 'interrupt');
      if (idx !== -1) cpuSession.removeWatchpoint(idx);
    } else {
      cpuSession.addWatchpoint({ type: 'interrupt' });
    }
  }, [hasInterruptWatchpoint, cpuSession]);

  return {
    ...cpuSession,
    assembleAndReset,
    reset,
    scenario,
    setScenario: persistScenario,
    addScenarioEvent,
    removeScenarioEvent,
    updateScenarioEvent,
    importScenarioJson,
    exportScenarioJson,
    interruptLog,
    lastInterruptRecord,
    microStepIndex,
    currentMicroStep,
    stepIntoMicroStep,
    prevMicroStep,
    showAllMicroSteps,
    resetMicroSteps,
    currentTick,
    pendingLines: {
      nmi: pendingNmi,
      intr: pendingIntr,
      ifFlag,
      tfFlag,
      stiShadow,
    },
    pendingList,
    hasInterruptWatchpoint,
    toggleInterruptWatchpoint,
  };
}
