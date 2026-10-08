/**
 * @file sequential.ts
 * Type definitions for sequential logic, flip-flops, state machines (Mealy/Moore),
 * counters, excitation tables, lockout detection, and sequential simulation traces.
 *
 * Immutability policy:
 * State specifications, excitation tables, state transition graphs, and trace
 * histories are marked readonly because the sequential synthesis and verification
 * engines generate deterministic, immutable outputs for each design step.
 */

import type { BoolNode, LogicValue } from './ast';

/**
 * Supported bistable multivibrator / flip-flop architectures.
 */
export type FlipFlopType = 'SR' | 'JK' | 'D' | 'T';

/**
 * Clock trigger mode for flip-flops and sequential registers.
 */
export type TriggerMode = 'rising' | 'falling' | 'level-high' | 'level-low';

/**
 * Asynchronous override flags for preset and clear operations.
 */
export interface AsyncControlFlags {
  /** Enables asynchronous preset pin */
  readonly hasAsyncPreset: boolean;
  /** Enables asynchronous clear/reset pin */
  readonly hasAsyncClear: boolean;
  /** True if preset and clear pins are active-low (e.g. PRE#, CLR#) */
  readonly activeLow: boolean;
}

/**
 * Counting direction for sequential counters.
 */
export type CounterDirection = 'up' | 'down' | 'up-down' | 'custom' | 'arbitrary';

/**
 * Clock synchronization style for counters.
 */
export type CounterStyle = 'sync' | 'async' | 'synchronous' | 'asynchronous';

/**
 * Trigger edge for asynchronous ripple counters.
 */
export type AsyncTrigger = 'rising' | 'falling';

/**
 * High-level counter specification for automated synthesis.
 */
export interface CounterSpec {
  /** Spec kind tag */
  readonly kind?: 'counter';
  /** Flip-flop architecture selected for implementation */
  readonly flipFlop?: FlipFlopType;
  /** Synchronous (common clock) vs asynchronous (ripple) */
  readonly style?: 'sync' | 'async';
  /** Counting direction mode */
  readonly direction?: 'up' | 'down' | 'up-down' | 'custom' | 'arbitrary';
  /** Total count states before repeating (e.g., MOD-10 BCD counter) */
  readonly modulus?: number;
  /** Explicit sequence of decimal or binary states visited (custom only) */
  readonly sequence?: readonly number[];
  /** Number of state bits (1..4) */
  readonly stateBits?: number;
  /** Trigger mode for asynchronous ripple counters (default: 'falling') */
  readonly asyncTrigger?: 'rising' | 'falling';
  /** Legacy field for synchronous vs asynchronous */
  readonly syncMode?: 'synchronous' | 'asynchronous';
  /** Legacy field for explicit sequence */
  readonly explicitSequence?: readonly number[];
  /** Legacy field for flip-flop type */
  readonly flipFlopType?: FlipFlopType;
}

/**
 * Specification for a binary sequence detector state machine.
 */
export interface DetectorSpec {
  /** Spec kind tag */
  readonly kind: 'detector';
  /** Target flip-flop architecture */
  readonly flipFlop: FlipFlopType;
  /** Target binary sequence pattern string (2 to 8 bits) */
  readonly pattern: string;
  /** FSM machine architecture model */
  readonly machine: 'mealy' | 'moore';
  /** True if overlapping sequence matches are recognized */
  readonly overlapping: boolean;
}

/**
 * Discriminated union of all high-level sequential machine specifications.
 */
export type SequentialSpec = CounterSpec | DetectorSpec;

/**
 * Finite State Machine classification.
 */
export type MachineKind = 'counter' | 'mealy' | 'moore';

/**
 * FSM state node representation.
 */
export interface State {
  /** Unique state identifier (e.g., "S0", "S1") */
  readonly id: string;
  /** Human-readable state name (e.g., "INIT", "DETECTED") */
  readonly name: string;
  /** Assigned binary encoding (e.g., "00", "01") */
  readonly binaryCode: string;
  /** Associated Moore machine output value, if applicable */
  readonly mooreOutput?: string;
}

/**
 * Directed state transition between two states.
 */
export interface Transition {
  /** Unique transition identifier */
  readonly id: string;
  /** Origin state ID */
  readonly fromStateId: string;
  /** Destination state ID */
  readonly toStateId: string;
  /** Input boolean expression or bit string triggering transition */
  readonly inputCondition?: string;
  /** Associated Mealy machine output value during transition, if applicable */
  readonly mealyOutput?: string;
}

/**
 * Full state diagram model for sequential design.
 */
export interface StateDiagram {
  /** FSM classification */
  readonly machineKind: MachineKind;
  /** All states in the machine */
  readonly states: readonly State[];
  /** Transitions between states */
  readonly transitions: readonly Transition[];
  /** Identifier of the power-on / reset state */
  readonly initialStateId: string;
}

/**
 * Row in a tabular state transition table.
 */
export interface StateTableRow {
  /** Present state name or binary encoding */
  readonly presentState: string;
  /** Input valuation or bit pattern */
  readonly input?: string;
  /** Resulting next state name or binary encoding */
  readonly nextState: string;
  /** Output valuation (Mealy or Moore) */
  readonly output?: string;
}

/**
 * Full state transition table.
 */
export interface StateTable {
  readonly rows: readonly StateTableRow[];
}

/**
 * Row in an excitation table mapping present and next states to flip-flop inputs.
 */
export interface ExcitationTableRow {
  /** Present state binary representation */
  readonly presentState: string;
  /** Next state binary representation */
  readonly nextState: string;
  /**
   * Flip-flop excitation input valuations, supporting don't-care 'X'.
   * Keyed by flip-flop name and input pin (e.g., { "Q1": { "J": 1, "K": "X" }, "Q0": { "J": "X", "K": 0 } })
   */
  readonly flipFlopInputs: Record<string, Record<string, LogicValue>>;
}

/**
 * Full excitation table for the circuit's flip-flops.
 */
export interface ExcitationTable {
  readonly rows: readonly ExcitationTableRow[];
}

/**
 * Simplified Next-State Boolean equations keyed by state variable (e.g. Q0_next = ...).
 */
export type NextStateEquations = Record<string, BoolNode>;

/**
 * Simplified Flip-Flop excitation input equations keyed by pin (e.g. J0 = ..., K0 = ...).
 */
export type FlipFlopInputEquations = Record<string, BoolNode>;

/**
 * Analysis of states not included in the primary count or state cycle.
 */
export interface UnusedStateInfo {
  /** List of unused binary state encodings (e.g. ["1010", "1011"]) */
  readonly unusedStates: readonly string[];
  /** Transitions leading out of unused states under default don't-care assignments */
  readonly transitionsFromUnused: readonly Transition[];
}

/**
 * Lockout analysis determining whether the circuit can get permanently trapped in an unused loop.
 */
export interface LockoutReport {
  /** All unassigned states */
  readonly unusedStates: readonly string[];
  /** True if one or more self-contained loops exist outside the main cycle */
  readonly hasLockout: boolean;
  /** Cycles of trapped unused states (e.g. [["1010", "1100"], ["1111"]]) */
  readonly trappedCycles: readonly (readonly string[])[];
  /** Proposed self-correcting transitions redirecting unused states back to initial state */
  readonly proposedFixTransitions: readonly Transition[];
}

/**
 * Runtime state snapshot of an individual flip-flop during interactive simulation.
 */
export interface FlipFlopSimulationState {
  /** Normal output Q */
  readonly q: LogicValue;
  /** Inverted output Q-bar */
  readonly qBar: LogicValue;
  /** Previous clock pin value used for edge detection */
  readonly lastClock: LogicValue;
  /** Current asynchronous preset active state */
  readonly presetActive: boolean;
  /** Current asynchronous clear active state */
  readonly clearActive: boolean;
}

/**
 * Step record of flip-flop behavior over a clock edge or level change.
 */
export interface ClockStepRecord {
  /** Sequential clock cycle counter */
  readonly clockCycle: number;
  /** Clock pin value */
  readonly clockLevel: LogicValue;
  /** Synchronous input valuations (e.g. { J: 1, K: 0 } or { D: 1 }) */
  readonly inputs: Record<string, LogicValue>;
  /** State Q before clock event */
  readonly q: LogicValue;
  /** State Q-bar before clock event */
  readonly qBar: LogicValue;
  /** Resulting state Q after clock event */
  readonly nextQ: LogicValue;
}

/**
 * Specification for a sequential sequence detector exercise or designer.
 */
export interface SequenceDetectorSpec {
  /** Target binary bit sequence to detect (e.g., "1011") */
  readonly targetPattern: string;
  /** True if overlapping matches should be detected */
  readonly allowOverlap: boolean;
  /** State machine output model */
  readonly machineKind: 'mealy' | 'moore';
}

/**
 * Single step recorded during sequential machine / counter simulation execution.
 */
export interface CounterTraceStep {
  /** Clock pulse sequence index (0, 1, 2...) */
  readonly pulseIndex: number;
  /** Current state in binary notation (e.g., "010") */
  readonly stateBinary: string;
  /** Current state as an integer decimal value */
  readonly stateValue: number;
  /** Machine output signal levels */
  readonly outputs: Record<string, LogicValue>;
}

/**
 * Shared simulation trace output for sequential counter runs.
 */
export interface SimulationTrace {
  /** Ordered list of simulated clock pulse results */
  readonly steps: readonly CounterTraceStep[];
  /** Total simulated clock pulses */
  readonly totalPulses: number;
}

/**
 * Individual row in a canonical sequential state transition table.
 */
export interface CanonicalStateTableRow {
  readonly index: number;
  readonly code: number;
  readonly stateName: string;
  readonly inputValue: number;
  readonly inputName?: string;
  readonly valid: boolean;
  readonly nextCode: number | 'X';
  readonly nextStateName: string;
  readonly mealyOutput: LogicValue;
  readonly mooreOutput: LogicValue;
}

/**
 * Canonical sequential state table spanning all 2^n binary state codes.
 */
export interface CanonicalStateTable {
  readonly stateBits: number;
  readonly stateCount: number;
  readonly hasInput: boolean;
  readonly inputKind: 'none' | 'counter-up-down' | 'detector';
  readonly machineKind: MachineKind;
  readonly initialStateCode: number;
  readonly validCodes: readonly number[];
  readonly unusedCodes: readonly number[];
  readonly stateNames: Record<number, string>;
  readonly rows: readonly CanonicalStateTableRow[];
}

/**
 * Node in a state diagram.
 */
export interface StateDiagramNode {
  readonly id: string;
  readonly code: number;
  readonly name: string;
  readonly binaryCode: string;
  readonly isInitial: boolean;
  readonly mooreOutput?: LogicValue;
}

/**
 * Merged directed edge in a state diagram.
 */
export interface StateDiagramEdge {
  readonly id: string;
  readonly fromCode: number;
  readonly toCode: number;
  readonly label: string;
  readonly conditions: readonly {
    readonly inputValue: number;
    readonly mealyOutput?: LogicValue;
  }[];
  readonly isSelfLoop: boolean;
}

/**
 * Complete state diagram graph data.
 */
export interface StateDiagramData {
  readonly machineKind: MachineKind;
  readonly stateBits: number;
  readonly initialStateCode: number;
  readonly nodes: readonly StateDiagramNode[];
  readonly edges: readonly StateDiagramEdge[];
}

/**
 * Single function column ready for K-map optimization in Stage 10B.
 */
export interface FunctionColumn {
  readonly name: string;
  readonly variables: readonly string[];
  readonly column: readonly LogicValue[];
}

/**
 * Transition record for a single flip-flop bit in an excitation table row.
 */
export interface BitExcitationRecord {
  readonly bitIndex: number;
  readonly q: 0 | 1;
  readonly qNext: LogicValue;
  readonly inputs: Record<string, LogicValue>;
}

/**
 * Excitation table row for multi-flip-flop sequential circuit.
 */
export interface CanonicalExcitationTableRow {
  readonly rowIndex: number;
  readonly code: number;
  readonly presentBits: readonly (0 | 1)[];
  readonly inputValue?: 0 | 1;
  readonly valid: boolean;
  readonly nextCode: number | 'X';
  readonly nextBits: readonly LogicValue[];
  readonly transitions: readonly BitExcitationRecord[];
  readonly flipFlopInputs: Record<string, LogicValue>;
}

/**
 * Full excitation table for sequential machine synthesis.
 */
export interface CanonicalExcitationTable {
  readonly stateBits: number;
  readonly flipFlop: FlipFlopType;
  readonly hasInput: boolean;
  readonly rows: readonly CanonicalExcitationTableRow[];
  readonly functionColumns: readonly FunctionColumn[];
}

