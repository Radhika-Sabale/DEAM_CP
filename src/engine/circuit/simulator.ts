/**
 * @file simulator.ts
 * Discrete-event gate-level digital circuit simulation engine.
 */

import type { LogicValue } from '../../types/ast';
import type { CircuitGraph, CircuitNode } from '../../types/circuit';
import { EventQueue } from './eventQueue';
import { buildIndex } from './graphAnalysis';
import {
  initializeCircuitNodes,
  processDeltaCycles,
  type SimulatorEvent,
  type SimulatorState,
} from './simulatorCore';
import type {
  CreateSimulatorResult,
  SimulationTrace,
  SimulatorOptions,
  SimulatorStats,
  StepResult,
  ValueChange,
} from './simulatorTypes';
import { validateCircuit } from './validate';

/**
 * Stateful discrete-event circuit simulator.
 */
export class CircuitSimulator {
  private readonly state: SimulatorState;
  private cachedValuesRecord: Record<string, LogicValue> = {};

  public constructor(graph: CircuitGraph, options: SimulatorOptions = {}) {
    const nodeMap = new Map<string, CircuitNode>();
    const nodeOrder = new Map<string, number>();
    graph.nodes.forEach((n, idx) => {
      nodeMap.set(n.id, n);
      nodeOrder.set(n.id, idx);
    });

    this.state = {
      graph,
      index: buildIndex(graph),
      nodeMap,
      nodeOrder,
      delayMode: options.delayMode ?? 'unit',
      maxDeltaCycles: options.maxDeltaCycles ?? 1000,
      maxEvents: options.maxEvents ?? 1_000_000,
      maxTraceLength: options.maxTraceLength ?? 200_000,
      nodeValues: new Map<string, LogicValue>(),
      projectedValues: new Map<string, LogicValue>(),
      eventQueue: new EventQueue<SimulatorEvent>(),
      trace: [] as ValueChange[],
      currentTime: 0,
      valuesDirty: true,
      traceTruncated: false,
      eventsProcessedCount: 0,
      gateEvaluationsCount: 0,
      maxDeltaCyclesUsedCount: 0,
    };

    initializeCircuitNodes(
      this.state.graph,
      this.state.nodeValues,
      this.state.projectedValues,
      (time, payload) => this.state.eventQueue.push(time, payload)
    );
    this.state.valuesDirty = true;
    processDeltaCycles(this.state);
  }

  public get time(): number {
    return this.state.currentTime;
  }

  public get stats(): SimulatorStats {
    return {
      eventsProcessed: this.state.eventsProcessedCount,
      gateEvaluations: this.state.gateEvaluationsCount,
      maxDeltaCyclesUsed: this.state.maxDeltaCyclesUsedCount,
    };
  }

  public getNodeValue(id: string): LogicValue {
    return this.state.nodeValues.get(id) ?? 'X';
  }

  public getWireValue(id: string): LogicValue {
    const wire = this.state.index.wireById.get(id);
    if (!wire) return 'X';
    return this.state.nodeValues.get(wire.from.nodeId) ?? 'X';
  }

  public getValues(): Readonly<Record<string, LogicValue>> {
    if (this.state.valuesDirty) {
      const nextRecord: Record<string, LogicValue> = {};
      for (const [id, val] of this.state.nodeValues.entries()) {
        nextRecord[id] = val;
      }
      this.cachedValuesRecord = nextRecord;
      this.state.valuesDirty = false;
    }
    return this.cachedValuesRecord;
  }

  public getTrace(): SimulationTrace {
    return { changes: [...this.state.trace], truncated: this.state.traceTruncated };
  }

  public setInput(id: string, value: LogicValue): StepResult {
    const node = this.state.nodeMap.get(id);
    if (!node || node.kind !== 'input' || this.state.nodeValues.get(id) === value) {
      return { status: 'ok', time: this.state.currentTime, changes: [] };
    }
    this.state.eventQueue.push(this.state.currentTime, { kind: 'node-value', nodeId: id, value });
    this.state.projectedValues.set(id, value);
    return processDeltaCycles(this.state);
  }

  public scheduleInput(time: number, id: string, value: LogicValue): boolean {
    if (time < this.state.currentTime) return false;
    const node = this.state.nodeMap.get(id);
    if (!node || node.kind !== 'input') return false;
    return this.state.eventQueue.push(time, { kind: 'node-value', nodeId: id, value });
  }

  public advanceTo(targetTime: number): StepResult {
    if (targetTime < this.state.currentTime) {
      return { status: 'ok', time: this.state.currentTime, changes: [] };
    }
    const stepChanges: ValueChange[] = [];
    let isRunning = true;
    while (isRunning) {
      const deltaRes = processDeltaCycles(this.state);
      stepChanges.push(...deltaRes.changes);
      if (deltaRes.status !== 'ok') {
        return {
          status: deltaRes.status,
          time: this.state.currentTime,
          changes: stepChanges,
          oscillatingNodeIds: deltaRes.oscillatingNodeIds,
        };
      }
      if (this.state.eventsProcessedCount >= this.state.maxEvents) {
        return { status: 'limit', time: this.state.currentTime, changes: stepChanges };
      }
      const nextEventTime = this.state.eventQueue.peekTime();
      if (nextEventTime === undefined || nextEventTime > targetTime) {
        this.state.currentTime = targetTime;
        isRunning = false;
        break;
      }
      this.state.currentTime = nextEventTime;
    }
    return { status: 'ok', time: this.state.currentTime, changes: stepChanges };
  }

  public settle(options: { readonly maxTime?: number } = {}): StepResult {
    const maxBound = options.maxTime;
    const stepChanges: ValueChange[] = [];
    let isSettling = true;
    while (isSettling) {
      const deltaRes = processDeltaCycles(this.state);
      stepChanges.push(...deltaRes.changes);
      if (deltaRes.status !== 'ok') {
        return {
          status: deltaRes.status,
          time: this.state.currentTime,
          changes: stepChanges,
          oscillatingNodeIds: deltaRes.oscillatingNodeIds,
        };
      }
      if (this.state.eventsProcessedCount >= this.state.maxEvents) {
        return { status: 'limit', time: this.state.currentTime, changes: stepChanges };
      }
      const nextTime = this.state.eventQueue.peekTime();
      if (nextTime === undefined || (maxBound !== undefined && nextTime > maxBound)) {
        if (maxBound !== undefined && nextTime !== undefined) this.state.currentTime = maxBound;
        isSettling = false;
        break;
      }
      const nextEvent = this.state.eventQueue.peek();
      if (nextEvent && nextEvent.payload.kind === 'clock-toggle' && nextEvent.time > this.state.currentTime) {
        isSettling = false;
        break;
      }
      this.state.currentTime = nextTime;
    }
    return { status: 'ok', time: this.state.currentTime, changes: stepChanges };
  }
}

/**
 * Creates and initializes a CircuitSimulator from a circuit graph.
 *
 * @param graph Circuit graph to simulate
 * @param options Simulation configuration options
 * @returns Result with simulator instance or blocking diagnostics
 */
export function createSimulator(
  graph: CircuitGraph,
  options: SimulatorOptions = {}
): CreateSimulatorResult {
  const validation = validateCircuit(graph, { allowFeedback: true });
  if (validation.hasBlockingErrors) {
    const blockingDiags = validation.diagnostics.filter((d) =>
      ['invalid-reference', 'invalid-pin', 'multiple-drivers'].includes(d.code)
    );
    return { ok: false, diagnostics: blockingDiags };
  }
  return { ok: true, sim: new CircuitSimulator(graph, options) };
}
