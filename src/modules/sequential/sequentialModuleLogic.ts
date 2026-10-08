/**
 * @file sequentialModuleLogic.ts
 * Pure, React-free module logic for the Sequential Circuit Designer (Stage 10C).
 *
 * Implements the standard ModuleContract / ModuleDefinition pattern:
 * - Pure input extraction from DesignProject state
 * - Reference design re-derivation from stored spec (never trusts stale derived artifacts)
 * - Granular patch builders for design steps, simulation traces, and lockout mitigation
 * - Pipeline handoff patch generator for K-Map solver (with downstream cache invalidation)
 * - Prerequisite readiness checks with clear pedagogical feedback
 */

import type {
  ProjectPatch,
} from '../../types/designProject';
import type {
  ModuleContract,
  ModuleDefinition,
} from '../../types/moduleInterface';
import type {
  ExcitationTable,
  FlipFlopType,
  NextStateEquations,
  SequentialSpec,
  SimulationTrace,
  StateDiagram,
  StateTable,
} from '../../types/sequential';
import {
  extractSequentialInputs,
  validateSequentialPrerequisites,
} from './sequentialPrerequisites';

export {
  canonicalToExcitationTable,
  canonicalToStateTable,
  stateDiagramDataToDiagram,
} from './sequentialDataConverters';

export {
  createKMapHandoffPatch,
  type KMapHandoffResult,
} from './sequentialHandoff';

export {
  checkSequentialReadiness,
  designFromProject,
  extractSequentialInputs,
  type SequentialPrerequisiteReport,
  validateSequentialPrerequisites,
} from './sequentialPrerequisites';

/** Input state extracted by the sequential module from a project. */
export interface SequentialModuleInputs {
  readonly flipFlopType: FlipFlopType | null;
  readonly sequentialSpec: SequentialSpec | null;
  readonly stateTable: StateTable | null;
  readonly excitationTable: ExcitationTable | null;
  readonly nextStateEquations: NextStateEquations | null;
}

/** Output artifacts produced by the sequential designer. */
export interface SequentialModuleOutputs {
  readonly sequentialSpec?: SequentialSpec;
  readonly stateDiagram?: StateDiagram;
  readonly stateTable?: StateTable;
  readonly excitationTable?: ExcitationTable;
  readonly nextStateEquations?: NextStateEquations;
  readonly simulationTrace?: SimulationTrace;
}

/**
 * Formal ModuleDefinition metadata for the Sequential Designer.
 */
export const sequentialModuleDefinition: ModuleDefinition = {
  id: 'sequential-designer',
  title: 'Sequential Circuit Designer',
  description:
    'Design synchronous and asynchronous sequential circuits including counters and sequence detectors with state diagrams, excitation tables, and lockout analysis.',
  icon: 'cpu',
  reads: ['flipFlopType', 'sequentialSpec', 'stateTable', 'excitationTable', 'nextStateEquations'],
  writes: [
    'sequentialSpec',
    'stateDiagram',
    'stateTable',
    'excitationTable',
    'nextStateEquations',
    'simulationTrace',
    'pipelineProgress',
  ],
  nextModules: ['kmap-solver', 'circuit-simulator'],
};

/**
 * Creates a project patch containing derived sequential designer artifacts.
 */
export function createSequentialPatch(
  outputs: SequentialModuleOutputs,
  stepCompleted?: string
): ProjectPatch {
  const patch: ProjectPatch = {};
  if (outputs.sequentialSpec !== undefined) patch.sequentialSpec = outputs.sequentialSpec;
  if (outputs.stateDiagram !== undefined) patch.stateDiagram = outputs.stateDiagram;
  if (outputs.stateTable !== undefined) patch.stateTable = outputs.stateTable;
  if (outputs.excitationTable !== undefined) patch.excitationTable = outputs.excitationTable;
  if (outputs.nextStateEquations !== undefined) patch.nextStateEquations = outputs.nextStateEquations;
  if (outputs.simulationTrace !== undefined) patch.simulationTrace = outputs.simulationTrace;

  if (stepCompleted) {
    patch.pipelineProgress = {
      activeModule: 'sequential-designer',
      completedModules: ['sequential-designer'],
    };
  }

  return patch;
}

/** Alias matching other module store patch conventions. */
export const createSequentialStorePatch = createSequentialPatch;

/**
 * Unified ModuleContract implementation for host integration.
 */
export const sequentialModuleContract: ModuleContract<
  SequentialModuleInputs,
  SequentialModuleOutputs
> = {
  definition: sequentialModuleDefinition,
  extractInputs: extractSequentialInputs,
  createPatch: createSequentialPatch,
  validatePrerequisites: validateSequentialPrerequisites,
};
