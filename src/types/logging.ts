/**
 * @file logging.ts
 * Type definitions for telemetry logging, student interaction events, CSV export,
 * standardized System Usability Scale (SUS), pre/post assessments, and dashboard analytics.
 *
 * Immutability policy:
 * Telemetry log events and analytics summaries are marked readonly because event
 * logs constitute an immutable chronological audit trail for pedagogical research
 * and offline CSV export.
 */

import type { HintLevel, MisconceptionTag } from './feedback';

/**
 * Base properties required on every telemetry log event.
 */
export interface BaseLogEvent {
  /** Unique UUID for this log entry */
  readonly id: string;
  /** Browser session identifier */
  readonly sessionId: string;
  /** Optional pseudonymized participant ID stored locally */
  readonly participantId?: string;
  /** Module generating the event */
  readonly moduleId: string;
  /** ISO 8601 timestamp string */
  readonly timestamp: string;
}

/**
 * Event recorded when a student starts a problem step.
 */
export interface StepStartedEvent extends BaseLogEvent {
  readonly eventType: 'step-started';
  readonly stepId: string;
}

/**
 * Event recorded when a student submits an answer for a problem step.
 */
export interface StepSubmittedEvent extends BaseLogEvent {
  readonly eventType: 'step-submitted';
  readonly stepId: string;
  readonly isCorrect: boolean;
  readonly misconceptionTag?: MisconceptionTag;
  readonly score?: number;
}

/**
 * Event recorded when a student requests a hint.
 */
export interface HintUsedEvent extends BaseLogEvent {
  readonly eventType: 'hint-used';
  readonly stepId: string;
  readonly level: HintLevel;
}

/**
 * Event recorded when a student completes all steps in a module.
 */
export interface ModuleCompletedEvent extends BaseLogEvent {
  readonly eventType: 'module-completed';
  /** Total active duration in milliseconds spent in module */
  readonly durationMs: number;
  /** Optional overall score achieved */
  readonly finalScore?: number;
}

/**
 * Event recorded when design data is handed off from one module to another.
 */
export interface ModuleHandoffEvent extends BaseLogEvent {
  readonly eventType: 'module-handoff';
  readonly fromModuleId: string;
  readonly toModuleId: string;
  readonly payloadSummary?: string;
}

/**
 * Event recorded when freeform sandbox or practice mode is initiated.
 */
export interface PracticeStartedEvent extends BaseLogEvent {
  readonly eventType: 'practice-started';
  readonly exerciseId: string;
  readonly category?: string;
}

/**
 * Event recorded when answering a formative quiz question.
 */
export interface QuizAnsweredEvent extends BaseLogEvent {
  readonly eventType: 'quiz-answered';
  readonly questionId: string;
  readonly selectedOption: string;
  readonly isCorrect: boolean;
}

/**
 * Event recorded when submitting pre-test or post-test assessment batteries.
 */
export interface PrePostTestSubmittedEvent extends BaseLogEvent {
  readonly eventType: 'pretest/posttest-submitted';
  readonly testType: 'pretest' | 'posttest';
  readonly score: number;
  readonly maxScore: number;
}

/**
 * Event recorded when submitting a 10-item System Usability Scale (SUS) questionnaire.
 */
export interface SusSubmittedEvent extends BaseLogEvent {
  readonly eventType: 'sus-submitted';
  readonly score: number;
  readonly responses: SusResponse;
}

/**
 * Discriminated union of all telemetry log events.
 */
export type LogEvent =
  | StepStartedEvent
  | StepSubmittedEvent
  | HintUsedEvent
  | ModuleCompletedEvent
  | ModuleHandoffEvent
  | PracticeStartedEvent
  | QuizAnsweredEvent
  | PrePostTestSubmittedEvent
  | SusSubmittedEvent;

/**
 * Ordered column headers exported to research CSV files.
 */
export const CSV_COLUMNS = [
  'id',
  'sessionId',
  'participantId',
  'moduleId',
  'timestamp',
  'eventType',
  'stepId',
  'isCorrect',
  'misconceptionTag',
  'hintLevel',
  'score',
  'details',
] as const;

/**
 * Derived string literal type for CSV header keys.
 */
export type CsvColumn = (typeof CSV_COLUMNS)[number];

/**
 * Flat representation of a single telemetry record in a CSV row.
 */
export type CsvRow = Record<CsvColumn, string | number | boolean | null>;

/**
 * Standard 1-to-5 Likert scale responses for System Usability Scale.
 */
export type SusLikertRating = 1 | 2 | 3 | 4 | 5;

/**
 * Responses to the 10 standard SUS survey items (1 = Strongly Disagree, 5 = Strongly Agree).
 */
export interface SusResponse {
  readonly items: readonly [
    SusLikertRating,
    SusLikertRating,
    SusLikertRating,
    SusLikertRating,
    SusLikertRating,
    SusLikertRating,
    SusLikertRating,
    SusLikertRating,
    SusLikertRating,
    SusLikertRating,
  ];
}

/**
 * Computed SUS score scaled from 0 to 100 per standard Brooke (1996) methodology.
 */
export interface SusResult {
  readonly score: number;
  readonly rawResponses: SusResponse;
}

/**
 * Assessment outcome for pre-test and post-test diagnostic evaluations.
 */
export interface PrePostTestResult {
  readonly testType: 'pretest' | 'posttest';
  readonly answers: Record<string, string>;
  readonly score: number;
  readonly maxScore: number;
  readonly percentage: number;
  readonly submittedAt: string;
}

/**
 * Aggregated tally of a specific misconception across student submissions.
 */
export interface MisconceptionCount {
  readonly misconceptionTag: MisconceptionTag;
  readonly count: number;
  readonly studentCount: number;
  readonly affectedModuleIds: readonly string[];
}

/**
 * Performance and engagement summary for a module displayed on teacher dashboard.
 */
export interface ModuleSummary {
  readonly moduleId: string;
  readonly completedCount: number;
  readonly averageDurationMs: number;
  readonly totalHintsRequested: number;
  readonly topMisconceptions: readonly MisconceptionCount[];
}
