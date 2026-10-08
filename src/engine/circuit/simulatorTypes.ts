/**
 * @file simulatorTypes.ts
 * Type definitions for the discrete-event circuit simulation engine.
 */

import type { LogicValue } from '../../types/ast';
import type { CircuitDiagnostic } from '../../types/circuit';
import type { CircuitSimulator } from './simulator';

/**
 * Gate propagation delay model.
 * - 'zero': All gates have 0 delay (pure levelized evaluation).
 * - 'unit': All gates have 1 simulation time unit delay.
 * - 'per-gate': Each gate uses its configured node.delay (defaulting to 1).
 */
export type DelayMode = 'zero' | 'unit' | 'per-gate';

/**
 * Configuration options for creating a CircuitSimulator.
 */
export interface SimulatorOptions {
  /** Propagation delay model (defaults to 'unit') */
  readonly delayMode?: DelayMode;
  /** Maximum zero-delay delta evaluation rounds at a single timestamp (defaults to 1000) */
  readonly maxDeltaCycles?: number;
  /** Maximum total events allowed across simulation run (defaults to 1,000,000) */
  readonly maxEvents?: number;
  /** Maximum trace history buffer size (defaults to 200,000) */
  readonly maxTraceLength?: number;
}

/**
 * Termination status of a simulation step or settlement.
 * - 'ok': Settled normally or reached target timestamp.
 * - 'oscillating': Combinational or zero-delay oscillation loop exceeded delta cycles.
 * - 'limit': Exceeded maximum allowed event count.
 */
export type SimulationStatus = 'ok' | 'oscillating' | 'limit';

/**
 * Individual point-in-time value transition on a node.
 */
export interface ValueChange {
  readonly time: number;
  readonly nodeId: string;
  readonly value: LogicValue;
}

/**
 * Result returned by advanceTo or settle operations.
 */
export interface StepResult {
  readonly status: SimulationStatus;
  readonly time: number;
  readonly changes: readonly ValueChange[];
  readonly oscillatingNodeIds?: readonly string[];
}

/**
 * Monitored simulation signal history trace.
 */
export interface SimulationTrace {
  readonly changes: readonly ValueChange[];
  readonly truncated: boolean;
}

/**
 * Aggregate runtime metrics gathered during simulation.
 */
export interface SimulatorStats {
  readonly eventsProcessed: number;
  readonly gateEvaluations: number;
  readonly maxDeltaCyclesUsed: number;
}

/**
 * Factory result for createSimulator.
 */
export type CreateSimulatorResult =
  | { readonly ok: true; readonly sim: CircuitSimulator }
  | { readonly ok: false; readonly diagnostics: readonly CircuitDiagnostic[] };
