/**
 * @file designProject.ts
 * Master document data model shared across all Virtual Lab modules.
 *
 * Immutability policy:
 * Structural fields (id, schemaVersion, timestamps) and sub-model arrays/records
 * within DesignProject are marked readonly to ensure clean unidirectional data flow
 * through pure patch functions, preventing accidental in-place mutation of the project state.
 */

import type { BoolNode, LogicValue, TruthTable } from './ast';
import type { CircuitGraph } from './circuit';
import type {
  ExcitationTable,
  FlipFlopType,
  NextStateEquations,
  SequentialSpec,
  SimulationTrace,
  StateDiagram,
  StateTable,
} from './sequential';

/**
 * Current schema version for localStorage and JSON export migrations.
 */
export const CURRENT_SCHEMA_VERSION = 2;

/**
 * All laboratory module identifiers across Phase 1 and reserved Phase 2 expansions.
 */
export type ModuleId =
  // Phase 1 Modules
  | 'number-systems'
  | 'boolean-tool'
  | 'kmap-solver'
  | 'circuit-simulator'
  | 'flipflop-simulator'
  | 'sequential-designer'
  // Stage 11C Research & Practice Modules
  | 'practice'
  | 'quiz'
  | 'prepost-test'
  | 'sus-survey'
  | 'teacher-dashboard'
  // Phase 2 Modules (Reserved)
  | 'alu'
  | '8086-cpu'
  | 'interrupt-controller';

/**
 * Combinational pipeline flow order: boolean-tool -> kmap-solver -> circuit-simulator.
 */
export const COMBINATIONAL_PIPELINE_ORDER = [
  'boolean-tool',
  'kmap-solver',
  'circuit-simulator',
] as const;

/**
 * Sequential pipeline flow order: flipflop-simulator -> sequential-designer -> kmap-solver -> circuit-simulator.
 */
export const SEQUENTIAL_PIPELINE_ORDER = [
  'flipflop-simulator',
  'sequential-designer',
  'kmap-solver',
  'circuit-simulator',
] as const;

/**
 * Primary default pipeline order for combinational synthesis.
 */
export const PIPELINE_ORDER = COMBINATIONAL_PIPELINE_ORDER;

/**
 * Structured minimized expression term representation.
 */
export interface MinimizedTermForm {
  /** Abstract Syntax Tree of the minimized form */
  readonly ast: BoolNode;
  /** Human-readable simplified Boolean expression string */
  readonly text: string;
}

/**
 * Minimized Boolean expression outputs in both SOP and POS canonical arrangements.
 */
export interface MinimizedDualForm {
  /** Minimal Sum of Products */
  readonly sop: MinimizedTermForm | null;
  /** Minimal Product of Sums */
  readonly pos: MinimizedTermForm | null;
}

/**
 * Individual rectangular implicant group identified on a Karnaugh map.
 */
export interface KMapGroup {
  /** Unique group identifier */
  readonly id: string;
  /** Decimal cell/minterm indices spanned by this group */
  readonly cellIndices: readonly number[];
  /** Algebraic product or sum term string */
  readonly termString: string;
  /** True if this implicant is essential */
  readonly isEssential?: boolean;
}

/**
 * Karnaugh map snapshot state including cells, solver groups, and student work.
 */
export interface KMapState {
  /** Active variable names */
  readonly variables: readonly string[];
  /** Flattened cell logic values (0, 1, or 'X') indexed by binary code order */
  readonly cells: readonly LogicValue[];
  /** Minimizer-computed optimal prime implicant groups */
  readonly groups: readonly KMapGroup[];
  /** Optional student-drawn groups for interactive evaluation */
  readonly studentGroups?: readonly KMapGroup[];
}

/**
 * Pipeline progress tracking which modules have been successfully completed.
 */
export interface PipelineProgress {
  /** Ordered list of module IDs completed in this project session */
  readonly completedModules: readonly ModuleId[];
  /** Currently active module */
  readonly activeModule?: ModuleId;
}

/**
 * Metadata recorded when design data is handed off between lab modules.
 */
export interface LastHandoffMetadata {
  /** Origin module initiating handoff */
  readonly from: ModuleId;
  /** Target module receiving synthesized data */
  readonly to: ModuleId;
  /** ISO 8601 timestamp string */
  readonly timestamp: string;
  /** Optional summary description of transmitted payload */
  readonly summary?: string;
}

/**
 * Master project model shared across all modules.
 * Everything is strictly JSON-serializable (plain objects, arrays, strings, numbers, booleans).
 * Every field except identity and schemaVersion is optional/nullable to allow partial progress.
 */
export interface DesignProject {
  /** Data migration schema version */
  readonly schemaVersion: number;
  /** Unique project UUID */
  readonly id: string;
  /** User-assigned project title */
  name: string;
  /** ISO 8601 creation timestamp string */
  createdAt: string;
  /** ISO 8601 last update timestamp string */
  updatedAt: string;

  /** Active Boolean variable identifiers (e.g. ["A", "B", "C"]) */
  variables?: readonly string[];
  /** Primary parsed Boolean expression AST */
  expression?: BoolNode | null;
  /** Computed or user-specified truth table */
  truthTable?: TruthTable | null;
  /** Quine-McCluskey / K-Map minimized expressions (SOP and POS) */
  minimizedExpression?: MinimizedDualForm | null;
  /** Karnaugh map configuration, cell values, and implicant groups */
  kmap?: KMapState | null;
  /** Synthesized or hand-drawn gate schematic netlist */
  circuit?: CircuitGraph | null;
  /** High-level sequential machine specification */
  sequentialSpec?: SequentialSpec | null;
  /** Selected flip-flop type for sequential design */
  flipFlopType?: FlipFlopType | null;
  /** Finite State Machine state diagram */
  stateDiagram?: StateDiagram | null;
  /** State transition table */
  stateTable?: StateTable | null;
  /** Flip-flop excitation table with don't-care values */
  excitationTable?: ExcitationTable | null;
  /** Synthesized next-state combinational logic equations */
  nextStateEquations?: NextStateEquations | null;
  /** Clocked waveform simulation trace */
  simulationTrace?: SimulationTrace | null;
  /** Stage and module completion tracking */
  pipelineProgress?: PipelineProgress;
  /** Most recent inter-module handoff transmission record */
  lastHandoff?: LastHandoffMetadata | null;
}

/**
 * Module-writable partial patch type used to update a DesignProject.
 * Prohibits overwriting immutable identity and creation metadata.
 */
export type ProjectPatch = Partial<
  Omit<DesignProject, 'id' | 'schemaVersion' | 'createdAt'>
>;

/**
 * Pure factory creating an empty, default-initialized DesignProject.
 * This is the single runtime function permitted in the types library.
 *
 * @param id Optional project ID (defaults to generated placeholder)
 * @param name Optional project title (defaults to "Untitled Project")
 * @returns Initialized empty DesignProject
 */
export function createEmptyDesignProject(
  id = 'default-project',
  name = 'Untitled Project'
): DesignProject {
  const now = new Date().toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id,
    name,
    createdAt: now,
    updatedAt: now,
    variables: [],
    expression: null,
    truthTable: null,
    minimizedExpression: null,
    kmap: null,
    circuit: null,
    flipFlopType: null,
    stateDiagram: null,
    stateTable: null,
    excitationTable: null,
    nextStateEquations: null,
    simulationTrace: null,
    pipelineProgress: {
      completedModules: [],
    },
    lastHandoff: null,
  };
}
