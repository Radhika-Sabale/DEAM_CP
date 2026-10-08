/**
 * @file moduleInterface.ts
 * Type definitions for inter-module integration contracts, input/output extraction,
 * pipeline handoffs, and compile-time key validation against DesignProject.
 *
 * Immutability policy:
 * Module definitions, handoff payloads, and validation results are marked readonly
 * because module registration metadata and inter-module transfer records are immutable
 * architectural contracts.
 */

import type { DesignProject, ModuleId, ProjectPatch } from './designProject';

/**
 * Structural definition and capabilities registration for a laboratory module.
 * `reads` and `writes` are strictly typed as keys of DesignProject so typos fail compilation.
 */
export interface ModuleDefinition {
  /** Unique module identifier */
  readonly id: ModuleId;
  /** Human-readable module title */
  readonly title: string;
  /** Pedagogical description of module functionality */
  readonly description: string;
  /** Icon symbol name for navigation UI */
  readonly icon: string;
  /** Explicit array of DesignProject fields read by this module */
  readonly reads: readonly (keyof DesignProject)[];
  /** Explicit array of DesignProject fields modified/emitted by this module */
  readonly writes: readonly (keyof DesignProject)[];
  /** Modules permitted as next destinations in the educational workflow */
  readonly nextModules: readonly ModuleId[];
}

/**
 * Function contract for extracting module-specific input state from the master project model.
 */
export type ExtractModuleInputs<TInputs> = (project: DesignProject) => TInputs;

/**
 * Function contract for generating a validated ProjectPatch from module calculation outputs.
 */
export type CreateProjectPatch<TOutputs> = (outputs: TOutputs) => ProjectPatch;

/**
 * Standard contract every laboratory module implements for unified host integration.
 */
export interface ModuleContract<TInputs, TOutputs> {
  /** Static module definition and dependency metadata */
  readonly definition: ModuleDefinition;
  /** Pure extractor pulling required sub-state from DesignProject */
  readonly extractInputs: ExtractModuleInputs<TInputs>;
  /** Pure patch builder formatting student outputs for project persistence */
  readonly createPatch: CreateProjectPatch<TOutputs>;
  /** Validator checking if prerequisites in DesignProject are met before opening */
  readonly validatePrerequisites?: (
    project: DesignProject
  ) => readonly string[] | null;
}

/**
 * Data payload transmitted when handing off design work to a subsequent module.
 */
export interface SendToNextPayload {
  /** Source module initiating transfer */
  readonly fromModuleId: ModuleId;
  /** Target module receiving synthesized data */
  readonly toModuleId: ModuleId;
  /** Patch containing newly generated or updated project fields */
  readonly patch: ProjectPatch;
  /** ISO timestamp string of transmission */
  readonly timestamp: string;
}

/**
 * Successful module handoff outcome containing the updated project state.
 */
export interface HandoffSuccess {
  readonly success: true;
  readonly updatedProject: DesignProject;
}

/**
 * Failed module handoff outcome with descriptive pedagogical guidance on missing prerequisites.
 */
export interface HandoffFailure {
  readonly success: false;
  /** Human-readable error messages explaining which steps must be completed first */
  readonly missingPrerequisites: readonly string[];
}

/**
 * Discriminated union of handoff operation outcomes.
 */
export type HandoffResult = HandoffSuccess | HandoffFailure;
