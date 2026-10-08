/**
 * @file feedback.ts
 * Type definitions for the educational pedagogical feedback engine, student step
 * submissions, diagnosis records, misconception taxonomy, hints, and LLM rephrasing.
 *
 * Immutability policy:
 * Submissions, diagnoses, feedback evaluations, and hint records are marked readonly
 * because feedback history is an append-only audit trail used for assessment analytics
 * and Socratic scaffolding.
 */

import type { LogicValue } from './ast';

/**
 * Discriminator kinds for student submissions across different laboratory modules.
 */
export type StepSubmissionKind =
  | 'kmap-group'
  | 'kmap-group-set'
  | 'excitation-entry'
  | 'state-table-row'
  | 'boolean-step'
  | 'number-conversion-step';

/**
 * Student attempt to circle a prime implicant group on a Karnaugh map.
 */
export interface KMapGroupAnswer {
  readonly kind: 'kmap-group';
  /** Decimal minterm/maxterm cell indices included in student group */
  readonly selectedCells: readonly number[];
  /** Algebraic product/sum term string entered for this group */
  readonly expression: string;
}

/**
 * Complete set of groups submitted by a student as their final K-map cover.
 */
export interface KMapGroupSetAnswer {
  readonly kind: 'kmap-group-set';
  readonly groups: readonly (readonly number[])[];
  readonly expression?: string;
}

/**
 * Student entry in an excitation table for a flip-flop input.
 */
export interface ExcitationEntryAnswer {
  readonly kind: 'excitation-entry';
  readonly flipFlop: string;
  readonly presentState: string;
  readonly nextState: string;
  readonly inputValues: Record<string, LogicValue>;
}

/**
 * Student entry in a sequential state transition table.
 */
export interface StateTableRowAnswer {
  readonly kind: 'state-table-row';
  readonly presentState: string;
  readonly input?: string;
  readonly nextState: string;
  readonly output?: string;
}

/**
 * Student step in symbolic Boolean algebraic simplification.
 */
export interface BooleanStepAnswer {
  readonly kind: 'boolean-step';
  readonly appliedLaw: string;
  readonly resultingExpression: string;
}

/**
 * Student step in radix/number system conversion (e.g. 2's complement or hex).
 */
export interface NumberConversionStepAnswer {
  readonly kind: 'number-conversion-step';
  readonly sourceValue: string;
  readonly sourceRadix: number;
  readonly targetRadix: number;
  readonly intermediateWork: readonly string[];
  readonly finalAnswer: string;
}

/**
 * Discriminated union of all student response payloads.
 */
export type StudentAnswer =
  | KMapGroupAnswer
  | KMapGroupSetAnswer
  | ExcitationEntryAnswer
  | StateTableRowAnswer
  | BooleanStepAnswer
  | NumberConversionStepAnswer;

/**
 * Student step submission presented to the feedback evaluation engine.
 */
export interface StepSubmission {
  /** Identifier of originating lab module */
  readonly moduleId: string;
  /** Identifier of problem step within the exercise */
  readonly stepId: string;
  /** Strongly typed answer payload */
  readonly studentAnswer: StudentAnswer;
  /** ISO timestamp string of submission */
  readonly timestamp: string;
}

/**
 * Classification of pedagogical errors detected during evaluation.
 */
export type ErrorType =
  | 'syntax-error'
  | 'invalid-group'
  | 'suboptimal-group'
  | 'uncovered-minterm'
  | 'incorrect-excitation'
  | 'incorrect-transition'
  | 'invalid-law-application'
  | 'arithmetic-error'
  | 'parity-error'
  | 'misconception';

/**
 * Strongly typed expected answer payload per step kind.
 */
export type ExpectedAnswer =
  | {
      readonly kind: 'kmap-group';
      readonly validGroups: readonly (readonly number[])[];
      readonly minimalExpression: string;
    }
  | {
      readonly kind: 'kmap-group-set';
      readonly minimalGroups: readonly (readonly number[])[];
      readonly minimalExpression: string;
    }
  | {
      readonly kind: 'excitation-entry';
      readonly inputValues: Record<string, LogicValue>;
    }
  | {
      readonly kind: 'state-table-row';
      readonly nextState: string;
      readonly output?: string;
    }
  | {
      readonly kind: 'boolean-step';
      readonly validExpressions: readonly string[];
      readonly validLaws: readonly string[];
    }
  | {
      readonly kind: 'number-conversion-step';
      readonly targetValue: string;
      readonly intermediateSteps: readonly string[];
    };

/**
 * Strongly typed received student answer payload per step kind.
 */
export type GotAnswer =
  | {
      readonly kind: 'kmap-group';
      readonly studentGroup: readonly number[];
      readonly studentExpression: string;
    }
  | {
      readonly kind: 'kmap-group-set';
      readonly studentGroups: readonly (readonly number[])[];
      readonly studentExpression?: string;
    }
  | {
      readonly kind: 'excitation-entry';
      readonly inputValues: Record<string, LogicValue>;
    }
  | {
      readonly kind: 'state-table-row';
      readonly nextState: string;
      readonly output?: string;
    }
  | {
      readonly kind: 'boolean-step';
      readonly studentExpression: string;
      readonly studentLaw: string;
    }
  | {
      readonly kind: 'number-conversion-step';
      readonly studentValue: string;
      readonly intermediateWork: readonly string[];
    };

/**
 * Known student misconception tags for diagnostic classification and targeted remediation.
 */
export type MisconceptionTag =
  | 'forgot-wraparound-grouping'
  | 'grouped-non-power-of-two'
  | 'group-not-rectangle'
  | 'group-not-maximal'
  | 'redundant-group'
  | 'missed-minterm'
  | 'covered-a-zero'
  | 'missed-dont-cares'
  | 'wrong-excitation-table'
  | 'confused-q-and-qnext'
  | 'ignored-lockout-state'
  | 'wrong-complement'
  | 'wrong-radix-weight'
  | 'demorgan-misapplied'
  | 'wrong-carry-propagation'
  | 'wrong-bit-order'
  | 'wrong-remainder-order'
  | 'wrong-overflow-rule'
  | 'wrong-law-applied'
  | 'algebra-sign-error'
  | 'other';

/**
 * Catalog entry detailing a specific misconception's pedagogical rationale.
 */
export interface MisconceptionEntry {
  /** Tag matching MisconceptionTag union */
  readonly tag: MisconceptionTag;
  /** Short headline name */
  readonly title: string;
  /** Detailed cognitive explanation of why students make this error */
  readonly description: string;
  /** Lab module IDs where this misconception typically arises */
  readonly affectedModules: readonly string[];
  /** Concrete illustrative example */
  readonly example: string;
}

/**
 * Diagnostic record explaining a specific mistake in the student submission.
 */
export interface Diagnosis {
  /** Identifier of the step containing the error */
  readonly step: string;
  /** Error category */
  readonly errorType: ErrorType;
  /** Strongly typed correct target answer */
  readonly expected: ExpectedAnswer;
  /** Strongly typed student answer that triggered diagnostic */
  readonly got: GotAnswer;
  /** Associated misconception tag if recognized by pattern matcher */
  readonly misconceptionTag?: MisconceptionTag;
  /** Immediate targeted hint */
  readonly hint: string;
  /** Full educational explanation resolving the discrepancy */
  readonly fullExplanation: string;
}

/**
 * Three-tiered progressive hint ladder:
 * 1: Nudge (subtle reminder of the governing rule)
 * 2: Pointed (specific direction on where the student went wrong)
 * 3: Worked step (concrete demonstration of the correct transformation)
 */
export type HintLevel = 1 | 2 | 3;

/**
 * Record of a hint presented to the student.
 */
export interface HintRecord {
  /** Hint ladder level */
  readonly level: HintLevel;
  /** Hint text shown to student */
  readonly content: string;
  /** ISO timestamp when hint was unlocked */
  readonly shownAt: string;
  /** Problem step ID */
  readonly stepId: string;
}

/**
 * Flag indicating student arrived at the correct answer through flawed intermediate steps
 * or algebraic coincidence (e.g. canceling terms through an invalid law).
 */
export interface AnswerTrapFlag {
  /** True if the terminal value matches expected output */
  readonly finalAnswerCorrect: boolean;
  /** List of intermediate step IDs or descriptions containing fallacious logic */
  readonly inconsistentSteps: readonly string[];
  /** Pedagogical note detailing the compensatory errors */
  readonly notes: string;
}

/**
 * Feedback result when student submission passes all criteria.
 */
export interface FeedbackSuccess {
  readonly ok: true;
  readonly message: string;
  readonly answerTrap?: AnswerTrapFlag;
}

/**
 * Feedback result when errors or misconceptions are found.
 */
export interface FeedbackFailure {
  readonly ok: false;
  readonly diagnoses: readonly Diagnosis[];
  readonly answerTrap?: AnswerTrapFlag;
}

/**
 * Discriminated union of evaluation engine feedback results.
 */
export type FeedbackResult = FeedbackSuccess | FeedbackFailure;

/**
 * Request payload sent to the LLM tutor persona for rephrasing.
 */
export interface LlmRephraseRequest {
  /** Deterministic core diagnostic produced by local rule engine */
  readonly rawDiagnosis: Diagnosis;
  /** Optional pedagogical tone preference */
  readonly studentTonePreference?: 'encouraging' | 'direct' | 'socratic';
  /** Previous hints revealed to the student to avoid verbatim repetition */
  readonly previousHintsGiven: readonly string[];
}

/**
 * Response received from the LLM tutor persona.
 *
 * CRITICAL PEDAGOGICAL INVARIANT:
 * LLM rephrasing outputs are strictly display-only pedagogical aids.
 * The LLM output must NEVER modify the authoritative FeedbackResult,
 * alter the diagnosis, or change the `ok` boolean flag.
 */
export interface LlmRephraseResponse {
  /** Socratic or adapted hint text for UI rendering */
  readonly displayHint: string;
  /** Socratic or adapted explanation text for UI rendering */
  readonly displayExplanation: string;
  /** Optional real-world engineering analogy */
  readonly analogy?: string;
}
