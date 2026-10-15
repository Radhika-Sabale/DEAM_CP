/**
 * @file useCpuSession.ts
 * React hook that owns the in-memory 8086 machine state.
 *
 * The project store persists ONLY the source text and breakpoint lines.
 * CPU state, history, and assembled program are ephemeral and reconstructed
 * on mount or when the source changes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  assemble,
  createCpuState,
  setReg,
  writeByte,
  type AssemblerResult,
  type CpuState,
  type Program,
  type RegisterName,
  type StepRecord,
} from '../../engine/cpu8086';
import {
  stepOnce,
  stepOver,
  stepOut,
  runUntil,
  type RunResult,
  type StopReason,
  type Watchpoint,
} from '../../engine/cpu8086/runner';
import {
  createHistory,
  pushRecord,
  stepBack as historyStepBack,
  stepForward as historyStepForward,
  goTo as historyGoTo,
  lastN,
  type ExecutionHistory,
  type TraceTableRow,
} from '../../engine/cpu8086/history';
import type { InterruptScenario } from '../../engine/interrupts';
import { useProjectStore } from '../../store/projectStore';

export type SessionStatus =
  | 'idle'
  | 'assembled'
  | 'running'
  | 'paused'
  | 'halted'
  | 'fault'
  | 'error';

export type RunSpeed = '1' | '5' | '20' | 'max';

export interface CpuSession {
  readonly source: string;
  readonly setSource: (s: string) => void;

  readonly assemblerResult: AssemblerResult | null;
  readonly program: Program | null;
  readonly cpuState: CpuState | null;
  readonly status: SessionStatus;
  readonly stopReason: StopReason | null;
  readonly stopReasonMessage: string | null;
  readonly totalSteps: number;
  readonly currentLine: number;

  readonly breakpoints: ReadonlySet<number>;
  readonly toggleBreakpoint: (line: number) => void;

  readonly watchpoints: readonly Watchpoint[];
  readonly addWatchpoint: (w: Watchpoint) => void;
  readonly removeWatchpoint: (index: number) => void;

  readonly speed: RunSpeed;
  readonly setSpeed: (spd: RunSpeed) => void;

  readonly assembleAndReset: () => void;
  readonly reset: () => void;
  readonly stepSingle: () => void;
  readonly stepOverFn: () => void;
  readonly stepOutFn: () => void;
  readonly run: () => void;
  readonly pause: () => void;
  readonly runToCursor: (line: number) => void;

  readonly setInitialRegister: (name: RegisterName, value: number) => void;
  readonly editMemoryByte: (address: number, value: number) => void;
  readonly memoryEditCount: number;

  readonly canStepBack: boolean;
  readonly canStepForward: boolean;
  readonly historyStepBack: () => void;
  readonly historyStepForward: () => void;
  readonly historyGoTo: (index: number) => void;

  readonly traceRows: readonly TraceTableRow[];
  readonly historyLength: number;
  readonly historyIndex: number;
  readonly historyTruncated: boolean;
  readonly lastRecord: StepRecord | null;
}

const TRACE_DISPLAY_COUNT = 50;
const CHUNK_SIZE = 2500;

function formatStopReason(
  reason: StopReason | null,
  state: CpuState | null,
  program: Program | null
): string | null {
  if (!reason) return null;
  if (reason === 'breakpoint') {
    const ip = state?.registers.IP ?? 0;
    const line = program?.instructions[ip]?.sourceLine;
    return line ? `Stopped: breakpoint at line ${line}` : 'Stopped: breakpoint reached';
  }
  if (reason === 'step-cap') {
    return 'Stopped: step limit reached, the program may loop forever';
  }
  if (reason === 'watch-triggered') {
    return 'Stopped: watchpoint triggered';
  }
  if (reason === 'halted') {
    return 'Program halted (HLT)';
  }
  if (reason === 'halted-waiting-forever') {
    return 'Program halted (HLT) with IF=0; machine is halted waiting forever because interrupts are disabled and cannot wake the CPU.';
  }
  if (reason === 'fault') {
    return state?.fault?.message ? `Fault: ${state.fault.message}` : 'Execution fault';
  }
  return null;
}

export interface UseCpuSessionOptions {
  readonly slice?: 'cpu8086' | 'interrupts';
  readonly scenario?: InterruptScenario;
  readonly lowWaterMark?: number;
}

export function useCpuSession(options: UseCpuSessionOptions = {}): CpuSession {
  const project = useProjectStore((s) => s.project);
  const applyPatch = useProjectStore((s) => s.applyPatch);

  const slice = options.slice ?? 'cpu8086';
  const savedSource =
    slice === 'interrupts'
      ? project.interrupts?.source ?? ''
      : project.cpu8086?.source ?? '';
  const savedBpLines =
    slice === 'interrupts'
      ? project.interrupts?.breakpoints ?? []
      : project.cpu8086?.breakpoints ?? [];

  const [source, setSourceLocal] = useState<string>(savedSource);
  const [assemblerResult, setAssemblerResult] = useState<AssemblerResult | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [cpuState, setCpuState] = useState<CpuState | null>(null);
  const [history, setHistory] = useState<ExecutionHistory | null>(null);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [stopReason, setStopReason] = useState<StopReason | null>(null);
  const [lastRecord, setLastRecord] = useState<StepRecord | null>(null);
  const [breakpoints, setBreakpoints] = useState<ReadonlySet<number>>(() => new Set(savedBpLines));
  const [watchpoints, setWatchpoints] = useState<readonly Watchpoint[]>([]);
  const [speed, setSpeed] = useState<RunSpeed>('max');
  const [memoryEditCount, setMemoryEditCount] = useState<number>(0);

  const runningTimerRef = useRef<number | null>(null);
  const programRef = useRef<Program | null>(null);
  const cpuStateRef = useRef<CpuState | null>(null);
  const historyRef = useRef<ExecutionHistory | null>(null);
  const breakpointsRef = useRef<ReadonlySet<number>>(breakpoints);
  const watchpointsRef = useRef<readonly Watchpoint[]>(watchpoints);
  const isRunningRef = useRef<boolean>(false);

  useEffect(() => {
    programRef.current = program;
  }, [program]);
  useEffect(() => {
    cpuStateRef.current = cpuState;
  }, [cpuState]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  useEffect(() => {
    breakpointsRef.current = breakpoints;
  }, [breakpoints]);
  useEffect(() => {
    watchpointsRef.current = watchpoints;
  }, [watchpoints]);

  const cleanupTimer = useCallback(() => {
    if (runningTimerRef.current !== null) {
      clearTimeout(runningTimerRef.current);
      runningTimerRef.current = null;
    }
    isRunningRef.current = false;
  }, []);

  useEffect(() => {
    return cleanupTimer;
  }, [cleanupTimer]);

  const setSource = useCallback(
    (s: string) => {
      setSourceLocal(s);
      if (slice === 'interrupts') {
        applyPatch({
          interrupts: {
            source: s,
            breakpoints: Array.from(breakpointsRef.current),
            scenario: project.interrupts?.scenario ?? [],
          },
        });
      } else {
        applyPatch({
          cpu8086: {
            source: s,
            breakpoints: Array.from(breakpointsRef.current),
          },
        });
      }
    },
    [applyPatch, slice, project.interrupts?.scenario]
  );

  const toggleBreakpoint = useCallback(
    (line: number) => {
      setBreakpoints((prev) => {
        const next = new Set(prev);
        if (next.has(line)) next.delete(line);
        else next.add(line);
        if (slice === 'interrupts') {
          applyPatch({
            interrupts: {
              source,
              breakpoints: Array.from(next),
              scenario: project.interrupts?.scenario ?? [],
            },
          });
        } else {
          applyPatch({
            cpu8086: {
              source,
              breakpoints: Array.from(next),
            },
          });
        }
        return next;
      });
    },
    [applyPatch, slice, source, project.interrupts?.scenario]
  );

  const addWatchpoint = useCallback((w: Watchpoint) => {
    setWatchpoints((prev) => [...prev, w]);
  }, []);

  const removeWatchpoint = useCallback((index: number) => {
    setWatchpoints((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const assembleAndReset = useCallback(() => {
    cleanupTimer();
    const result = assemble(source);
    setAssemblerResult(result);

    if (!result.ok) {
      setStatus('error');
      return;
    }

    const prog = result.program;
    const state = createCpuState(prog, {
      scenario: options.scenario,
      lowWaterMark: options.lowWaterMark ?? (slice === 'interrupts' ? 0x0400 : undefined),
    });
    const hist = createHistory(state);

    programRef.current = prog;
    cpuStateRef.current = state;
    historyRef.current = hist;

    setProgram(prog);
    setCpuState(state);
    setHistory(hist);
    setStatus('assembled');
    setStopReason(null);
    setLastRecord(null);
  }, [cleanupTimer, source, options.scenario, options.lowWaterMark, slice]);

  const reset = useCallback(() => {
    cleanupTimer();
    if (!program) return;
    const state = createCpuState(program, {
      scenario: options.scenario,
      lowWaterMark: options.lowWaterMark ?? (slice === 'interrupts' ? 0x0400 : undefined),
    });
    const hist = createHistory(state);

    cpuStateRef.current = state;
    historyRef.current = hist;

    setCpuState(state);
    setHistory(hist);
    setStatus('assembled');
    setStopReason(null);
    setLastRecord(null);
  }, [cleanupTimer, program, options.scenario, options.lowWaterMark, slice]);

  const applyStepResult = useCallback((resState: CpuState, rec: StepRecord) => {
    let hist = historyRef.current;
    if (hist) {
      hist = pushRecord(hist, rec);
      historyRef.current = hist;
      setHistory(hist);
    }
    cpuStateRef.current = resState;
    setCpuState(resState);
    setLastRecord(rec);

    if (resState.fault) {
      setStatus('fault');
      setStopReason('fault');
    } else if (resState.halted) {
      setStatus('halted');
      setStopReason('halted');
    } else {
      setStatus('paused');
      setStopReason(null);
    }
  }, []);

  const stepSingle = useCallback(() => {
    cleanupTimer();
    const curr = cpuStateRef.current;
    const prog = programRef.current;
    if (!curr || !prog || curr.halted || curr.fault) return;
    const result = stepOnce(curr, prog, { scenario: options.scenario });
    applyStepResult(result.state, result.record);
  }, [cleanupTimer, applyStepResult, options.scenario]);

  const applyRunResult = useCallback((result: RunResult) => {
    let hist = historyRef.current;
    if (hist && result.recentTrace) {
      for (const rec of result.recentTrace) {
        hist = pushRecord(hist, rec);
      }
      historyRef.current = hist;
      setHistory(hist);
    }
    cpuStateRef.current = result.state;
    setCpuState(result.state);
    if (result.lastRecord) setLastRecord(result.lastRecord);
    setStopReason(result.stopReason);
    setStatus(
      result.state.fault
        ? 'fault'
        : result.state.halted
          ? 'halted'
          : 'paused'
    );
  }, []);

  const stepOverFn = useCallback(() => {
    cleanupTimer();
    const curr = cpuStateRef.current;
    const prog = programRef.current;
    if (!curr || !prog || curr.halted || curr.fault) return;
    const result = stepOver(curr, prog, {
      breakpointLines: Array.from(breakpointsRef.current),
      watchpoints: watchpointsRef.current,
      scenario: options.scenario,
    });
    applyRunResult(result);
  }, [cleanupTimer, applyRunResult, options.scenario]);

  const stepOutFn = useCallback(() => {
    cleanupTimer();
    const curr = cpuStateRef.current;
    const prog = programRef.current;
    if (!curr || !prog || curr.halted || curr.fault) return;
    const result = stepOut(curr, prog, {
      breakpointLines: Array.from(breakpointsRef.current),
      watchpoints: watchpointsRef.current,
      scenario: options.scenario,
    });
    applyRunResult(result);
  }, [cleanupTimer, applyRunResult, options.scenario]);

  const pause = useCallback(() => {
    cleanupTimer();
    setStatus((prev) => (prev === 'running' ? 'paused' : prev));
  }, [cleanupTimer]);

  const runChunk = useCallback(
    (extraBpLines?: readonly number[]) => {
      const prog = programRef.current;
      const curr = cpuStateRef.current;
      if (!prog || !curr || curr.halted || curr.fault || !isRunningRef.current) {
        cleanupTimer();
        return;
      }

      const allBpLines = extraBpLines
        ? Array.from(new Set([...Array.from(breakpointsRef.current), ...extraBpLines]))
        : Array.from(breakpointsRef.current);

      if (speed === 'max') {
        const result = runUntil(curr, prog, {
          breakpointLines: allBpLines,
          watchpoints: watchpointsRef.current,
          maxSteps: CHUNK_SIZE,
          scenario: options.scenario,
        });

        let hist = historyRef.current;
        if (hist && result.recentTrace) {
          for (const rec of result.recentTrace) hist = pushRecord(hist, rec);
          setHistory(hist);
        }
        setCpuState(result.state);
        if (result.lastRecord) setLastRecord(result.lastRecord);

        if (
          result.state.halted ||
          result.state.fault ||
          result.stopReason === 'breakpoint' ||
          result.stopReason === 'watch-triggered' ||
          result.stopReason === 'halted-waiting-forever'
        ) {
          cleanupTimer();
          setStopReason(result.stopReason);
          setStatus(result.state.fault ? 'fault' : result.state.halted ? 'halted' : 'paused');
          return;
        }

        // Bounded slice executed; schedule next chunk to keep UI responsive
        runningTimerRef.current = window.setTimeout(() => runChunk(extraBpLines), 0);
      } else {
        const stepsPerSec = parseInt(speed, 10) || 5;
        const intervalMs = Math.max(10, Math.floor(1000 / stepsPerSec));
        const result = runUntil(curr, prog, {
          breakpointLines: allBpLines,
          watchpoints: watchpointsRef.current,
          maxSteps: 1,
          scenario: options.scenario,
        });

        let hist = historyRef.current;
        if (hist && result.lastRecord) {
          hist = pushRecord(hist, result.lastRecord);
          setHistory(hist);
        }
        setCpuState(result.state);
        if (result.lastRecord) setLastRecord(result.lastRecord);

        if (
          result.state.halted ||
          result.state.fault ||
          result.stopReason === 'breakpoint' ||
          result.stopReason === 'watch-triggered' ||
          result.stopReason === 'halted-waiting-forever'
        ) {
          cleanupTimer();
          setStopReason(result.stopReason);
          setStatus(result.state.fault ? 'fault' : result.state.halted ? 'halted' : 'paused');
          return;
        }

        runningTimerRef.current = window.setTimeout(() => runChunk(extraBpLines), intervalMs);
      }
    },
    [speed, cleanupTimer, options.scenario]
  );

  const run = useCallback(() => {
    cleanupTimer();
    const curr = cpuStateRef.current;
    const prog = programRef.current;
    if (!curr || !prog || curr.halted || curr.fault) return;
    setStatus('running');
    setStopReason(null);
    isRunningRef.current = true;
    runChunk();
  }, [cleanupTimer, runChunk]);

  const runToCursor = useCallback(
    (line: number) => {
      cleanupTimer();
      const curr = cpuStateRef.current;
      const prog = programRef.current;
      if (!curr || !prog || curr.halted || curr.fault) return;
      setStatus('running');
      setStopReason(null);
      isRunningRef.current = true;
      runChunk([line]);
    },
    [cleanupTimer, runChunk]
  );

  const setInitialRegister = useCallback((name: RegisterName, value: number) => {
    const curr = cpuStateRef.current;
    if (!curr) return;
    const nextState = setReg(curr, name, value);
    const nextHist = createHistory(nextState);
    cpuStateRef.current = nextState;
    historyRef.current = nextHist;
    setCpuState(nextState);
    setHistory(nextHist);
    setStopReason(null);
  }, []);

  const editMemoryByte = useCallback((address: number, value: number) => {
    const curr = cpuStateRef.current;
    if (!curr) return;
    const nextMem = writeByte(curr.memory, address, value).memory;
    const nextState: CpuState = { ...curr, memory: nextMem };
    const nextHist = createHistory(nextState);
    cpuStateRef.current = nextState;
    historyRef.current = nextHist;
    setCpuState(nextState);
    setHistory(nextHist);
    setMemoryEditCount((c) => c + 1);
  }, []);

  const doHistoryStepBack = useCallback(() => {
    const hist = historyRef.current;
    const curr = cpuStateRef.current;
    if (!hist || !curr) return;
    const res = historyStepBack(hist, curr);
    if (!res) return;
    cpuStateRef.current = res.state;
    historyRef.current = res.history;
    setHistory(res.history);
    setCpuState(res.state);
    setStatus(res.state.halted ? 'halted' : res.state.fault ? 'fault' : 'paused');
  }, []);

  const doHistoryStepForward = useCallback(() => {
    const hist = historyRef.current;
    const curr = cpuStateRef.current;
    if (!hist || !curr) return;
    const res = historyStepForward(hist, curr);
    if (!res) return;
    cpuStateRef.current = res.state;
    historyRef.current = res.history;
    setHistory(res.history);
    setCpuState(res.state);
    setStatus(res.state.halted ? 'halted' : res.state.fault ? 'fault' : 'paused');
  }, []);

  const doHistoryGoTo = useCallback((index: number) => {
    const hist = historyRef.current;
    if (!hist) return;
    const res = historyGoTo(hist, index);
    if (!res) return;
    cpuStateRef.current = res.state;
    historyRef.current = res.history;
    setHistory(res.history);
    setCpuState(res.state);
    setStatus(res.state.halted ? 'halted' : res.state.fault ? 'fault' : 'paused');
  }, []);

  const traceRows = useMemo(() => {
    if (!history) return [];
    return lastN(history, TRACE_DISPLAY_COUNT);
  }, [history]);

  const currentLine = useMemo(() => {
    if (!cpuState || !program) return -1;
    const ip = cpuState.registers.IP;
    const inst = program.instructions[ip];
    return inst?.sourceLine ?? -1;
  }, [cpuState, program]);

  const totalSteps = history?.totalSteps ?? 0;
  const stopReasonMessage = useMemo(
    () => formatStopReason(stopReason, cpuState, program),
    [stopReason, cpuState, program]
  );

  return {
    source,
    setSource,
    assemblerResult,
    program,
    cpuState,
    status,
    stopReason,
    stopReasonMessage,
    totalSteps,
    currentLine,
    breakpoints,
    toggleBreakpoint,
    watchpoints,
    addWatchpoint,
    removeWatchpoint,
    speed,
    setSpeed,
    assembleAndReset,
    reset,
    stepSingle,
    stepOverFn,
    stepOutFn,
    run,
    pause,
    runToCursor,
    setInitialRegister,
    editMemoryByte,
    memoryEditCount,
    canStepBack: !!(history && history.currentIndex >= 0),
    canStepForward: !!(history && history.currentIndex < history.records.length - 1),
    historyStepBack: doHistoryStepBack,
    historyStepForward: doHistoryStepForward,
    historyGoTo: doHistoryGoTo,
    traceRows,
    historyLength: history?.records.length ?? 0,
    historyIndex: history?.currentIndex ?? -1,
    historyTruncated: history?.truncated ?? false,
    lastRecord,
  };
}
