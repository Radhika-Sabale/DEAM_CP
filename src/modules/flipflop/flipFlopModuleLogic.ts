/**
 * @file flipFlopModuleLogic.ts
 * Business logic, contract specifications, prerequisite validation, and project store
 * synchronization utilities for the Flip-Flop & Latch Workbench module (Stage 9B).
 */

import type { DesignProject, ProjectPatch } from '../../types/designProject';
import type {
  CreateProjectPatch,
  ExtractModuleInputs,
  ModuleContract,
  ModuleDefinition,
} from '../../types/moduleInterface';
import type { FlipFlopType, TriggerMode } from '../../types/sequential';

/**
 * Architectural specification for the Flip-Flop module registered in the central catalog.
 */
export const flipFlopModuleDefinition: ModuleDefinition = {
  id: 'flipflop-simulator',
  title: 'Flip-Flop & Latch Workbench',
  description:
    'Bistable multivibrator analysis for SR, JK, D, and T flip-flops with clock timing, race-around hazard exploration, and excitation derivations.',
  icon: 'toggle',
  reads: [],
  writes: ['flipFlopType'],
  nextModules: ['sequential-designer'],
};

export interface FlipFlopModuleInputs {
  readonly flipFlopType?: FlipFlopType | null;
}

export interface FlipFlopModuleOutputs {
  readonly flipFlopType: FlipFlopType | null;
}

/**
 * Pure extractor pulling required sub-state from DesignProject.
 * Flip-flop workbench starts the sequential pipeline flow.
 */
export const extractFlipFlopInputs: ExtractModuleInputs<FlipFlopModuleInputs> = (
  project: DesignProject
): FlipFlopModuleInputs => ({
  flipFlopType: project.flipFlopType,
});

/**
 * Pure patch generator formatting student outputs for project persistence.
 * Writes ONLY the flip-flop type field to the project model.
 */
export const createFlipFlopPatch: CreateProjectPatch<FlipFlopModuleOutputs> = (
  outputs: FlipFlopModuleOutputs
): ProjectPatch => ({
  flipFlopType: outputs.flipFlopType,
});

/**
 * Creates a project store patch updating only the flip-flop type.
 *
 * @param type Selected flip-flop architecture
 * @returns Clean ProjectPatch with updated flipFlopType field
 */
export function createFlipFlopStorePatch(type: FlipFlopType | null): ProjectPatch {
  return {
    flipFlopType: type,
  };
}

/**
 * Pedagogical prerequisite validator for the Flip-Flop Workbench module.
 * Verifies that a valid flip-flop type is selected before proceeding to the Sequential Designer.
 *
 * @param project The active DesignProject
 * @returns Array of readable missing prerequisite messages, or null if ready
 */
export function validateFlipFlopPrerequisites(
  project: DesignProject
): readonly string[] | null {
  if (!project.flipFlopType) {
    return ['Choose a flip-flop type (SR, JK, D or T) before continuing.'];
  }
  return null;
}

/**
 * Returns a non-blocking advisory note when a level-triggered mode is active.
 *
 * @param trigger The current trigger mode
 * @returns Plain-language advisory note string or null if edge-triggered
 */
export function getCounterDesignAdvisory(trigger: TriggerMode): string | null {
  if (trigger === 'level-high' || trigger === 'level-low') {
    return 'Counter design assumes edge-triggered flip-flops; level-triggered JK and T can race around.';
  }
  return null;
}

/**
 * Unified ModuleContract implementation for host integration.
 */
export const flipFlopModuleContract: ModuleContract<
  FlipFlopModuleInputs,
  FlipFlopModuleOutputs
> = {
  definition: flipFlopModuleDefinition,
  extractInputs: extractFlipFlopInputs,
  createPatch: createFlipFlopPatch,
  validatePrerequisites: validateFlipFlopPrerequisites,
};
