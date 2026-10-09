/**
 * @file types.ts
 * Engine-local types for the practice-problem generators and quiz engine (Stage 11A).
 *
 * All types are JSON-serializable (no functions, no class instances, no Dates).
 * Immutability policy: practice problems and quiz results are append-only pedagogical
 * records; all structural fields are readonly.
 */

import type { MisconceptionTag, StepSubmissionKind } from '../../types/feedback';

// ---------------------------------------------------------------------------
// Difficulty
// ---------------------------------------------------------------------------

/** Practice problem difficulty tier. */
export type Difficulty = 'easy' | 'medium' | 'hard';

// ---------------------------------------------------------------------------
// Problem
// ---------------------------------------------------------------------------

/**
 * A single step within a practice problem that the student must complete.
 * Each step's `expected` is typed to match the Feedback Engine's submission kinds
 * so that StepChecker can validate it directly.
 */
export interface ProblemStep {
  /** Unique key within this problem (e.g. "conversion-step-1", "kmap-groups") */
  readonly key: string;
  /** Student-facing prompt for this step */
  readonly prompt: string;
  /** The correct expected answer, JSON-serializable */
  readonly expected: unknown;
  /** Feedback Engine submission kind that validates this step */
  readonly kind: StepSubmissionKind | string;
  /** Optional domain validation context for step validators */
  readonly context?: Record<string, unknown>;
}

/**
 * A fully generated practice problem with deterministic parameters and solution.
 */
export interface Problem {
  /** Deterministic ID derived from moduleId, difficulty, and seed */
  readonly id: string;
  /** Originating lab module identifier */
  readonly moduleId: string;
  /** Difficulty tier */
  readonly difficulty: Difficulty;
  /** Seed used to generate this problem */
  readonly seed: number;
  /** Short descriptive title */
  readonly title: string;
  /**
   * Problem statement.
   * `text` is a plain-text rendering suitable for display.
   * `data` carries structured parameters for rich UI rendering.
   */
  readonly statement: {
    readonly text: string;
    readonly data: Record<string, unknown>;
  };
  /** Generated input parameters (the "given" values) */
  readonly parameters: Record<string, unknown>;
  /** Ordered steps the student must complete */
  readonly steps: readonly ProblemStep[];
  /** The final correct answer (matches the last step's expected, or a summary) */
  readonly finalAnswer: unknown;
  /** Misconception tags this problem is designed to exercise */
  readonly tags: readonly MisconceptionTag[];
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

/** Quiz question type discriminator. */
export type QuestionType = 'multiple-choice' | 'short-answer';

/**
 * A single distractor option in a multiple-choice question.
 */
export interface DistractorOption {
  /** The distractor answer text */
  readonly text: string;
  /** Misconception tag if this distractor corresponds to a known wrong method */
  readonly misconceptionTag?: MisconceptionTag;
}

/**
 * A single quiz question.
 */
export interface QuizQuestion {
  /** Unique question ID */
  readonly id: string;
  /** Question type */
  readonly type: QuestionType;
  /** Difficulty of this question */
  readonly difficulty: Difficulty;
  /** Question prompt text */
  readonly prompt: string;
  /** For multiple-choice: ordered option texts (shuffled by seed) */
  readonly options?: readonly string[];
  /** Index of the correct option within `options` (multiple-choice only) */
  readonly correctOptionIndex?: number;
  /** Correct answer text (for short-answer or reference) */
  readonly correctAnswer: string;
  /** Misconception tags carried by each distractor, indexed same as options */
  readonly optionMisconceptionTags?: readonly (MisconceptionTag | undefined)[];
  /** Sub-skill category within the topic */
  readonly subSkill: string;
}

/**
 * Difficulty distribution for quiz question generation.
 */
export interface DifficultyMix {
  readonly easy: number;
  readonly medium: number;
  readonly hard: number;
}

/** Default difficulty mix: 4 easy, 4 medium, 2 hard. */
export const DEFAULT_DIFFICULTY_MIX: DifficultyMix = {
  easy: 4,
  medium: 4,
  hard: 2,
};

/**
 * A complete quiz with 10 questions on a single topic.
 */
export interface Quiz {
  /** Topic module ID */
  readonly topic: string;
  /** Seed used for deterministic generation */
  readonly seed: number;
  /** Difficulty distribution used */
  readonly difficultyMix: DifficultyMix;
  /** Ordered list of 10 questions */
  readonly questions: readonly QuizQuestion[];
}

/** Per-question result in a scored quiz. */
export interface QuestionResult {
  /** Question ID */
  readonly questionId: string;
  /** Whether the student answered correctly */
  readonly correct: boolean;
  /** Whether the question was left unanswered */
  readonly unanswered: boolean;
  /** Misconception tag if wrong MC answer maps to a known wrong method */
  readonly misconceptionTag?: MisconceptionTag;
}

/**
 * Scored quiz result (time-agnostic; timing is added by the UI/log layer).
 */
export interface QuizResult {
  /** Topic module ID */
  readonly topic: string;
  /** Raw score out of 10 */
  readonly score: number;
  /** Total number of questions */
  readonly totalQuestions: number;
  /** Per-question correctness details */
  readonly perQuestion: readonly QuestionResult[];
  /** Aggregate misconception tags from wrong answers */
  readonly misconceptionTags: readonly MisconceptionTag[];
}

// ---------------------------------------------------------------------------
// Generator registry types
// ---------------------------------------------------------------------------

/** Signature of a problem generator function. */
export type GeneratorFn = (difficulty: Difficulty, seed: number) => Problem;

/** Typed error when a module generator is unavailable. */
export interface GeneratorUnavailableError {
  readonly code: 'generator-unavailable';
  readonly moduleId: string;
  readonly message: string;
}

/** Discriminated result of problem generation. */
export type GenerateProblemResult =
  | { readonly ok: true; readonly problem: Problem }
  | { readonly ok: false; readonly error: GeneratorUnavailableError };
