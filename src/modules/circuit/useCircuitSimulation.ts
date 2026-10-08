/**
 * @file useCircuitSimulation.ts
 * React hook managing discrete-event simulation lifecycle, state caching,
 * play/pause animation frame loops, oscillation reporting, and input state preservation.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LogicValue } from '../../types/ast';
import type { CircuitDiagnostic, CircuitGraph } from '../../types/circuit';
import {
  CircuitSimulator,
  createSimulator,
  structuralSignature,
  validateCircuit,
  type DelayMode,
  type SimulationStatus,
  type SimulationTrace,
} from '../../engine/circuit';

/**
 * Return type of the useCircuitSimulation hook.
 */
export interface UseCircuitSimulationResult {
  readonly values: Readonly<Record<string, LogicValue>>;
  readonly time: number;
  readonly trace: SimulationTrace;
  readonly status: SimulationStatus;
  readonly oscillationMessage: string | null;
  readonly diagnostics: readonly CircuitDiagnostic[];
  readonly isPlaying: boolean;
  readonly delayMode: DelayMode;
  readonly allowFeedback: boolean;
  readonly setInput: (nodeId: string, value: LogicValue) => void;
  readonly step: () => void;
  readonly runFor: (units: number) => void;
  readonly runToNextEvent: () => void;
  readonly play: () => void;
  readonly pause: () => void;
  readonly reset: () => void;
  readonly setDelayMode: (mode: DelayMode) => void;
  readonly setAllowFeedback: (allow: boolean) => void;
}

/**
 * Hook managing the runtime lifecycle of a CircuitSimulator for a given CircuitGraph.
 *
 * @param graph Circuit schematic netlist
 * @returns Simulation reactive state and control handlers
 */
export function useCircuitSimulation(graph: CircuitGraph): UseCircuitSimulationResult {
  const [delayMode, setDelayMode] = useState<DelayMode>('unit');
  const [allowFeedback, setAllowFeedback] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Runtime reactive snapshot state
  const [time, setTime] = useState<number>(0);
  const [status, setStatus] = useState<SimulationStatus>('ok');
  const [oscillationMessage, setOscillationMessage] = useState<string | null>(null);
  const [values, setValues] = useState<Readonly<Record<string, LogicValue>>>({});
  const [trace, setTrace] = useState<SimulationTrace>({ changes: [], truncated: false });

  const simulatorRef = useRef<CircuitSimulator | null>(null);
  const prevSignatureRef = useRef<string>('');
  const prevInputsRef = useRef<Map<string, LogicValue>>(new Map());

  // Real-time static validation
  const validation = useMemo(() => {
    return validateCircuit(graph, { allowFeedback });
  }, [graph, allowFeedback]);

  // Synchronize input node values into prevInputsRef
  useEffect(() => {
    for (const node of graph.nodes) {
      if (node.kind === 'input') {
        if (!prevInputsRef.current.has(node.id)) {
          prevInputsRef.current.set(node.id, node.value);
        }
      }
    }
  }, [graph.nodes]);

  // Check if simulator needs to be reconstructed based on structuralSignature
  const sig = useMemo(() => {
    return structuralSignature(graph) + `_delay:${delayMode}_fb:${allowFeedback}`;
  }, [graph, delayMode, allowFeedback]);

  const syncStateFromSim = useCallback((sim: CircuitSimulator) => {
    setTime(sim.time);
    setValues({ ...sim.getValues() });
    setTrace(sim.getTrace());
  }, []);

  // Simulator construction and re-initialization
  useEffect(() => {
    if (prevSignatureRef.current === sig && simulatorRef.current) {
      return;
    }
    prevSignatureRef.current = sig;

    const simRes = createSimulator(graph, { delayMode });
    if (!simRes.ok) {
      simulatorRef.current = null;
      setStatus('ok');
      setOscillationMessage(null);
      setTime(0);
      setValues({});
      setTrace({ changes: [], truncated: false });
      return;
    }

    const sim = simRes.sim;
    simulatorRef.current = sim;

    // Restore preserved user input values by node ID
    for (const node of graph.nodes) {
      if (node.kind === 'input') {
        const preserved = prevInputsRef.current.get(node.id) ?? node.value;
        if (preserved !== undefined && preserved !== 'X') {
          sim.setInput(node.id, preserved);
        }
      }
    }

    // Settle initial time 0 state
    const settleRes = sim.settle({ maxTime: 0 });
    setStatus(settleRes.status);
    if (settleRes.status === 'oscillating') {
      const oscillatingList = (settleRes.oscillatingNodeIds ?? []).join(', ');
      setOscillationMessage(
        `The circuit oscillates at time ${settleRes.time}; nodes [${oscillatingList}] were set to X. Press Reset.`
      );
    } else {
      setOscillationMessage(null);
    }

    syncStateFromSim(sim);
  }, [sig, graph, delayMode, syncStateFromSim]);

  // Set input value handler
  const setInput = useCallback(
    (nodeId: string, value: LogicValue) => {
      prevInputsRef.current.set(nodeId, value);
      const sim = simulatorRef.current;
      if (!sim) return;

      const res = sim.setInput(nodeId, value);
      setStatus(res.status);
      if (res.status === 'oscillating') {
        const oscillatingList = (res.oscillatingNodeIds ?? []).join(', ');
        setOscillationMessage(
          `The circuit oscillates at time ${res.time}; nodes [${oscillatingList}] were set to X. Press Reset.`
        );
      } else {
        setOscillationMessage(null);
      }
      syncStateFromSim(sim);
    },
    [syncStateFromSim]
  );

  // Step 1 unit
  const step = useCallback(() => {
    const sim = simulatorRef.current;
    if (!sim) return;

    const res = sim.advanceTo(sim.time + 1);
    setStatus(res.status);
    if (res.status === 'oscillating') {
      const oscillatingList = (res.oscillatingNodeIds ?? []).join(', ');
      setOscillationMessage(
        `The circuit oscillates at time ${res.time}; nodes [${oscillatingList}] were set to X. Press Reset.`
      );
      setIsPlaying(false);
    } else {
      setOscillationMessage(null);
    }
    syncStateFromSim(sim);
  }, [syncStateFromSim]);

  // Run for N units
  const runFor = useCallback(
    (units: number) => {
      const sim = simulatorRef.current;
      if (!sim) return;

      const res = sim.advanceTo(sim.time + Math.max(1, units));
      setStatus(res.status);
      if (res.status === 'oscillating') {
        const oscillatingList = (res.oscillatingNodeIds ?? []).join(', ');
        setOscillationMessage(
          `The circuit oscillates at time ${res.time}; nodes [${oscillatingList}] were set to X. Press Reset.`
        );
        setIsPlaying(false);
      } else {
        setOscillationMessage(null);
      }
      syncStateFromSim(sim);
    },
    [syncStateFromSim]
  );

  // Run to next event
  const runToNextEvent = useCallback(() => {
    const sim = simulatorRef.current;
    if (!sim) return;

    const res = sim.settle();
    setStatus(res.status);
    if (res.status === 'oscillating') {
      const oscillatingList = (res.oscillatingNodeIds ?? []).join(', ');
      setOscillationMessage(
        `The circuit oscillates at time ${res.time}; nodes [${oscillatingList}] were set to X. Press Reset.`
      );
      setIsPlaying(false);
    } else {
      setOscillationMessage(null);
    }
    syncStateFromSim(sim);
  }, [syncStateFromSim]);

  // Reset simulator
  const reset = useCallback(() => {
    setIsPlaying(false);
    setStatus('ok');
    setOscillationMessage(null);
    prevSignatureRef.current = ''; // Force reconstruction on next pass

    const simRes = createSimulator(graph, { delayMode });
    if (!simRes.ok) {
      simulatorRef.current = null;
      setTime(0);
      setValues({});
      setTrace({ changes: [], truncated: false });
      return;
    }

    const sim = simRes.sim;
    simulatorRef.current = sim;

    for (const node of graph.nodes) {
      if (node.kind === 'input') {
        const val = prevInputsRef.current.get(node.id) ?? node.value;
        if (val !== undefined && val !== 'X') {
          sim.setInput(node.id, val);
        }
      }
    }

    sim.settle({ maxTime: 0 });
    syncStateFromSim(sim);
  }, [graph, delayMode, syncStateFromSim]);

  const play = useCallback(() => {
    if (status === 'oscillating') return;
    setIsPlaying(true);
  }, [status]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Continuous animation / clock stepping loop
  useEffect(() => {
    if (!isPlaying) return;

    const intervalId = window.setInterval(() => {
      const sim = simulatorRef.current;
      if (!sim) {
        setIsPlaying(false);
        return;
      }

      const res = sim.advanceTo(sim.time + 1);
      if (res.status !== 'ok') {
        setStatus(res.status);
        if (res.status === 'oscillating') {
          const oscillatingList = (res.oscillatingNodeIds ?? []).join(', ');
          setOscillationMessage(
            `The circuit oscillates at time ${res.time}; nodes [${oscillatingList}] were set to X. Press Reset.`
          );
        }
        setIsPlaying(false);
      }
      syncStateFromSim(sim);
    }, 120);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isPlaying, syncStateFromSim]);

  return {
    values,
    time,
    trace,
    status,
    oscillationMessage,
    diagnostics: validation.diagnostics,
    isPlaying,
    delayMode,
    allowFeedback,
    setInput,
    step,
    runFor,
    runToNextEvent,
    play,
    pause,
    reset,
    setDelayMode,
    setAllowFeedback,
  };
}
