/**
 * @file types.ts
 * Type definitions for the Seed Problems pedagogical repository (Stage 12A).
 *
 * Immutability policy:
 * All seed problem definitions, step structures, and load summaries are immutable
 * append-only pedagogical records with readonly fields.
 */

import type { MisconceptionTag } from '../../../types/feedback';
import type { ModuleId, ProjectPatch } from '../../../types/designProject';
import type { Difficulty, ProblemStep } from '../types';

/**
 * A curated pedagogical seed problem with step-by-step worked solutions
 * and target design project initialization state.
 */
export interface SeedProblem {
  /** Globally unique deterministic problem identifier */
  readonly id: string;
  /** Originating laboratory module identifier */
  readonly moduleId: ModuleId;
  /** Pedagogical difficulty tier */
  readonly difficulty: Difficulty;
  /** Human-readable headline title */
  readonly title: string;
  /** Student-facing problem statement in clear plain text */
  readonly statement: string;
  /** Strongly typed input parameters and given initial values */
  readonly parameters: Readonly<Record<string, unknown>>;
  /** Ordered problem steps validated by Feedback Engine */
  readonly steps: readonly ProblemStep[];
  /** Authoritative final solution answer verified by domain engine */
  readonly finalAnswer: unknown;
  /** Step-by-step worked explanation written for students (one per step) */
  readonly explanation: readonly string[];
  /** Clear educational objective achieved by solving this problem */
  readonly learningObjective: string;
  /** Cognitive misconception tags this problem is designed to diagnose */
  readonly tags: readonly MisconceptionTag[];
  /** Initial project patch used when opening this example in the lab */
  readonly projectSeed: ProjectPatch;
}

/**
 * Schema of a seed problems JSON file imported statically via Vite.
 */
export interface SeedFile {
  /** Target laboratory module identifier */
  readonly moduleId: ModuleId;
  /** List of curated seed problems */
  readonly problems: readonly SeedProblem[];
}

/**
 * Diagnostic error report for a seed problem failing type guards or validation.
 */
export interface SeedLoadError {
  /** Problem identifier (or "unknown" if missing) */
  readonly id: string;
  /** Human-readable explanation of why validation failed */
  readonly reason: string;
  /** Originating file or module context */
  readonly file?: string;
}

/**
 * Aggregate typed result emitted by the seed problem loader.
 */
export interface SeedLoadResult {
  /** All valid seed problems across all modules */
  readonly problems: readonly SeedProblem[];
  /** Valid seed problems grouped by laboratory module ID */
  readonly byModule: Readonly<Record<ModuleId, readonly SeedProblem[]>>;
  /** Problems or entries that failed schema validation */
  readonly errors: readonly SeedLoadError[];
}

/**
 * Filter criteria for querying seed problems.
 */
export interface SeedProblemFilter {
  /** Filter by originating module */
  readonly moduleId?: ModuleId;
  /** Filter by difficulty tier */
  readonly difficulty?: Difficulty;
  /** Filter by associated cognitive misconception tag */
  readonly tag?: MisconceptionTag;
}

/**
 * Project creation payload produced from a seed problem.
 */
export interface SeedProjectPayload {
  /** Partial project state patch */
  readonly patch: ProjectPatch;
  /** Initial suggested project name */
  readonly name: string;
  /** Target module to navigate into */
  readonly targetModule: ModuleId;
}
