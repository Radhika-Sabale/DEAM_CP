/**
 * @file simulatorCore.ts
 * Internal state management and evaluation primitives for the circuit simulator.
 */

import type { LogicValue } from '../../types/ast';
import type { CircuitGraph, CircuitNode, CircuitWire, GateNode } from '../../types/circuit';
import { EventQueue } from './eventQueue';
import { evaluateGate } from './gateLogic';
import type { CircuitIndex } from './graphAnalysis';
import type { DelayMode, StepResult, ValueChange } from './simulatorTypes';

/**
 * Discrete simulation event payload variant.
 */
export type SimulatorEvent =
  | { readonly kind: 'node-value'; readonly nodeId: string; readonly value: LogicValue }
  | { readonly kind: 'clock-toggle'; readonly nodeId: string }
  | { readonly kind: 'gate-eval'; readonly nodeId: string };

/**
 * Encapsulated mutable state container for a circuit simulation session.
 */
export interface SimulatorState {
  readonly graph: CircuitGraph;
  readonly index: CircuitIndex;
  readonly nodeMap: Map<string, CircuitNode>;
  readonly nodeOrder: Map<string, number>;
  readonly delayMode: DelayMode;
  readonly maxDeltaCycles: number;
  readonly maxEvents: number;
  readonly maxTraceLength: number;
  readonly nodeValues: Map<string, LogicValue>;
  readonly projectedValues: Map<string, LogicValue>;
  readonly eventQueue: EventQueue<SimulatorEvent>;
  readonly trace: ValueChange[];
  currentTime: number;
  valuesDirty: boolean;
  traceTruncated: boolean;
  eventsProcessedCount: number;
  gateEvaluationsCount: number;
  maxDeltaCyclesUsedCount: number;
}

/**
 * Resolves the propagation delay in integer ticks for a gate under the active delay mode.
 */
export function resolveGateDelay(gate: GateNode, mode: DelayMode): number {
  switch (mode) {
    case 'zero':
      return 0;
    case 'unit':
      return 1;
    case 'per-gate':
      return gate.delay !== undefined && gate.delay >= 0 ? Math.floor(gate.delay) : 1;
  }
}

/**
 * Collects input values from driver nodes feeding a gate's input pins and computes its 3-valued output.
 */
export function evaluateGateOutput(
  gate: GateNode,
  nodeValues: Map<string, LogicValue>,
  incomingWires: ReadonlyMap<string, ReadonlyMap<number, readonly CircuitWire[]>>
): LogicValue {
  const inputValues: LogicValue[] = [];
  const pinMap = incomingWires.get(gate.id);

  for (let pin = 0; pin < gate.inputCount; pin++) {
    const wireList = pinMap?.get(pin);
    if (!wireList || wireList.length === 0) {
      inputValues.push('X');
    } else {
      const srcWire = wireList[0];
      const srcVal = srcWire ? nodeValues.get(srcWire.from.nodeId) ?? 'X' : 'X';
      inputValues.push(srcVal);
    }
  }

  return evaluateGate(gate.gateType, inputValues);
}

/**
 * Initializes node value maps and queues initial events at t = 0.
 */
export function initializeCircuitNodes(
  graph: CircuitGraph,
  nodeValues: Map<string, LogicValue>,
  projectedValues: Map<string, LogicValue>,
  pushEvent: (time: number, payload: SimulatorEvent) => void
): void {
  for (const node of graph.nodes) {
    switch (node.kind) {
      case 'input':
      case 'const':
        nodeValues.set(node.id, node.value);
        projectedValues.set(node.id, node.value);
        break;
      case 'clock':
        nodeValues.set(node.id, node.startValue);
        projectedValues.set(node.id, node.startValue);
        pushEvent(node.halfPeriod, { kind: 'clock-toggle', nodeId: node.id });
        break;
      case 'output':
        nodeValues.set(node.id, 'X');
        projectedValues.set(node.id, 'X');
        break;
      case 'gate':
        nodeValues.set(node.id, 'X');
        projectedValues.set(node.id, 'X');
        pushEvent(0, { kind: 'gate-eval', nodeId: node.id });
        break;
    }
  }
}

/**
 * Evaluates a gate and schedules an event if projected output differs.
 */
export function evaluateAndScheduleGate(state: SimulatorState, gate: GateNode): void {
  state.gateEvaluationsCount++;
  const evalResult = evaluateGateOutput(gate, state.nodeValues, state.index.incomingWires);
  const projVal = state.projectedValues.get(gate.id);

  if (projVal !== evalResult) {
    state.projectedValues.set(gate.id, evalResult);
    const delay = resolveGateDelay(gate, state.delayMode);
    state.eventQueue.push(state.currentTime + delay, {
      kind: 'node-value',
      nodeId: gate.id,
      value: evalResult,
    });
  }
}

/**
 * Processes delta cycle iterations for the current simulation timestamp.
 */
export function processDeltaCycles(state: SimulatorState): StepResult {
  const snapshot = new Map(state.nodeValues);
  let deltaCycle = 0;
  let hasPendingDeltaEvents = true;

  while (hasPendingDeltaEvents) {
    const currentEvents = state.eventQueue.popWhile((t) => t === state.currentTime);
    if (currentEvents.length === 0) {
      hasPendingDeltaEvents = false;
      break;
    }

    deltaCycle++;
    if (deltaCycle > state.maxDeltaCyclesUsedCount) state.maxDeltaCyclesUsedCount = deltaCycle;

    const changed = new Map<string, LogicValue>();
    for (const entry of currentEvents) {
      state.eventsProcessedCount++;
      const e = entry.payload;
      if (e.kind === 'node-value') {
        if (state.nodeValues.get(e.nodeId) !== e.value) {
          state.nodeValues.set(e.nodeId, e.value);
          changed.set(e.nodeId, e.value);
        }
      } else if (e.kind === 'clock-toggle') {
        const clk = state.nodeMap.get(e.nodeId);
        if (clk && clk.kind === 'clock') {
          const nextVal: LogicValue = state.nodeValues.get(e.nodeId) === 1 ? 0 : 1;
          state.nodeValues.set(e.nodeId, nextVal);
          changed.set(e.nodeId, nextVal);
          state.eventQueue.push(state.currentTime + clk.halfPeriod, {
            kind: 'clock-toggle',
            nodeId: e.nodeId,
          });
        }
      } else if (e.kind === 'gate-eval') {
        const gNode = state.nodeMap.get(e.nodeId);
        if (gNode && gNode.kind === 'gate') evaluateAndScheduleGate(state, gNode);
      }
    }

    const downstreamGates = collectDownstreamGates(changed, state);
    for (const gNode of downstreamGates) {
      evaluateAndScheduleGate(state, gNode);
    }

    if (deltaCycle >= state.maxDeltaCycles) {
      const oscIds = Array.from(changed.keys());
      for (const id of oscIds) {
        state.nodeValues.set(id, 'X');
        state.projectedValues.set(id, 'X');
        const fanout = state.index.fanoutWires.get(id) ?? [];
        for (const wire of fanout) {
          const target = state.nodeMap.get(wire.to.nodeId);
          if (target && target.kind === 'output') {
            state.nodeValues.set(target.id, 'X');
            state.projectedValues.set(target.id, 'X');
          }
        }
      }
      state.eventQueue.popWhile((t) => t === state.currentTime);
      state.valuesDirty = true;
      return {
        status: 'oscillating',
        time: state.currentTime,
        changes: commitChanges(state, snapshot),
        oscillatingNodeIds: oscIds,
      };
    }

    if (state.eventsProcessedCount >= state.maxEvents) {
      state.valuesDirty = true;
      return { status: 'limit', time: state.currentTime, changes: commitChanges(state, snapshot) };
    }
  }

  return { status: 'ok', time: state.currentTime, changes: commitChanges(state, snapshot) };
}

function collectDownstreamGates(
  changed: Map<string, LogicValue>,
  state: SimulatorState
): GateNode[] {
  const gatesToEvaluate = new Set<string>();

  for (const [changedId, newVal] of changed.entries()) {
    const fanoutWires = state.index.fanoutWires.get(changedId) ?? [];
    for (const wire of fanoutWires) {
      const targetNode = state.nodeMap.get(wire.to.nodeId);
      if (!targetNode) continue;

      if (targetNode.kind === 'output') {
        if (state.nodeValues.get(targetNode.id) !== newVal) {
          state.nodeValues.set(targetNode.id, newVal);
        }
      } else if (targetNode.kind === 'gate') {
        gatesToEvaluate.add(targetNode.id);
      }
    }
  }

  const sortedGateIds = Array.from(gatesToEvaluate).sort((a, b) => {
    const oA = state.nodeOrder.get(a) ?? 0;
    const oB = state.nodeOrder.get(b) ?? 0;
    return oA - oB;
  });

  const result: GateNode[] = [];
  for (const gId of sortedGateIds) {
    const gNode = state.nodeMap.get(gId);
    if (gNode && gNode.kind === 'gate') result.push(gNode);
  }
  return result;
}

function commitChanges(state: SimulatorState, snapshot: Map<string, LogicValue>): ValueChange[] {
  const committed: ValueChange[] = [];
  for (const [nodeId, currentVal] of state.nodeValues.entries()) {
    const prevVal = snapshot.get(nodeId);
    if (prevVal !== currentVal) {
      const chg: ValueChange = { time: state.currentTime, nodeId, value: currentVal };
      committed.push(chg);

      if (state.trace.length < state.maxTraceLength) {
        state.trace.push(chg);
      } else {
        state.traceTruncated = true;
      }
    }
  }
  if (committed.length > 0) state.valuesDirty = true;
  return committed;
}
