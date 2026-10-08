/**
 * @file circuit.ts
 * Type definitions for gate-level circuit schematics, nodes, wires,
 * diagnostics, and simulation data.
 *
 * Immutability policy:
 * Schematic graphs, wire topologies, and diagnostic reports are marked readonly
 * because the simulation engine treats circuit netlists as immutable inputs,
 * producing new state snapshots on simulation ticks.
 */

import type { LogicValue } from './ast';

/**
 * Standard logic gate types.
 * NOT has exactly 1 input; other gates support 2..8 inputs.
 */
export type GateType = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR';

/**
 * User-controllable input node providing logic levels.
 */
export interface InputNode {
  readonly kind: 'input';
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly value: LogicValue;
}

/**
 * Circuit output probe / terminal node.
 */
export interface OutputNode {
  readonly kind: 'output';
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly label: string;
}

/**
 * Periodic square-wave clock generator node.
 */
export interface ClockNode {
  readonly kind: 'clock';
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly label: string;
  /** Half-period duration in simulation time units (integer >= 1) */
  readonly halfPeriod: number;
  /** Initial clock logic level at t = 0 */
  readonly startValue: 0 | 1;
}

/**
 * Constant fixed logic level source (0 or 1).
 */
export interface ConstNode {
  readonly kind: 'const';
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly value: 0 | 1;
  readonly label?: string;
}

/**
 * Multi-input logic gate node.
 */
export interface GateNode {
  readonly kind: 'gate';
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly gateType: GateType;
  /** Number of inputs (1 for NOT, 2..8 for others) */
  readonly inputCount: number;
  /** Optional propagation delay in simulation time units (integer >= 0) */
  readonly delay?: number;
  readonly label?: string;
}

/**
 * Discriminated union of all nodes in a CircuitGraph.
 */
export type CircuitNode = InputNode | OutputNode | ClockNode | ConstNode | GateNode;

/**
 * Directed electrical connection from driver pin to target pin.
 * Source pin is always 0; target pin indexes the target node's input pins (0..inputCount-1).
 */
export interface CircuitWire {
  readonly id: string;
  readonly from: {
    readonly nodeId: string;
    readonly pin: number;
  };
  readonly to: {
    readonly nodeId: string;
    readonly pin: number;
  };
}

/**
 * Complete netlist and layout representation of a digital circuit.
 * Contains JSON-serializable plain arrays of nodes and wires.
 */
export interface CircuitGraph {
  readonly nodes: readonly CircuitNode[];
  readonly wires: readonly CircuitWire[];
}

/**
 * Diagnostic severity level.
 */
export type CircuitDiagnosticSeverity = 'error' | 'warning' | 'info';

/**
 * Standard circuit diagnostic codes.
 */
export type CircuitDiagnosticCode =
  | 'invalid-reference'
  | 'invalid-pin'
  | 'multiple-drivers'
  | 'floating-input'
  | 'undriven-output'
  | 'duplicate-label'
  | 'combinational-loop'
  | 'unused-input'
  | 'dangling-gate-output'
  | 'dead-logic'
  | 'invalid-label'
  | 'no-outputs'
  | 'feedback-loop';

/**
 * Validation diagnostic emitted during static netlist and topological analysis.
 */
export interface CircuitDiagnostic {
  readonly code: CircuitDiagnosticCode;
  readonly severity: CircuitDiagnosticSeverity;
  readonly message: string;
  readonly nodeIds: readonly string[];
  readonly wireIds: readonly string[];
}

/**
 * Individual row of an extracted circuit truth table.
 */
export interface ExtractedTruthTableRow {
  readonly index: number;
  readonly inputs: readonly LogicValue[];
  readonly outputs: readonly LogicValue[];
}

/**
 * Extracted truth table representation from static levelized circuit simulation.
 */
export interface ExtractedTruthTable {
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly rows: readonly ExtractedTruthTableRow[];
}
