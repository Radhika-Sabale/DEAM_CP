/**
 * @file types.ts
 * Engine-local types for the evaluation engine (Stage 11B).
 *
 * All types are JSON-serializable (no functions, no classes, no Dates).
 * Strict TypeScript: all structural fields are readonly.
 */

import type { MisconceptionTag } from '../../types/feedback';
import type { PrePostTestResult } from '../../types/logging';

// ---------------------------------------------------------------------------
// System Usability Scale (SUS)
// ---------------------------------------------------------------------------

/** Error returned when SUS responses are incomplete or contain out-of-range values. */
export interface SusScoreError {
  readonly code: 'sus-invalid-input';
  readonly invalidItems: readonly number[];
  readonly message: string;
}

/** Rich qualitative and diagnostic interpretation of a raw SUS score. */
export interface SusInterpretation {
  readonly score: number;
  readonly benchmark: number;
  readonly adjectiveBand: 'Best Imaginable' | 'Excellent' | 'Good' | 'OK' | 'Poor';
  readonly grade: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly isAcceptable: boolean;
  readonly itemScores: readonly number[];
  readonly note: string;
}

/** Aggregated cohort statistics for a set of SUS submissions. */
export interface SusAggregate {
  readonly count: number;
  readonly mean: number;
  readonly sd: number;
  readonly median: number;
  readonly min: number;
  readonly max: number;
  readonly ci95: readonly [number, number];
}

// ---------------------------------------------------------------------------
// Pre/Post Diagnostic Assessments
// ---------------------------------------------------------------------------

/** Subscore for a single content topic in a pre/post assessment. */
export interface TopicSubscore {
  readonly score: number;
  readonly maxScore: number;
}

/**
 * Detailed assessment result extending the Stage 1 PrePostTestResult.
 * Structurally compatible with PrePostTestResult.
 */
export interface DetailedPrePostTestResult extends PrePostTestResult {
  readonly subscores: Readonly<Record<string, TopicSubscore>>;
  readonly unansweredCount: number;
  readonly misconceptionTags: readonly MisconceptionTag[];
}

/** Specification for a single multiple-choice assessment item. */
export interface PrePostItem {
  readonly id: string;
  readonly form: 'A' | 'B';
  readonly topic: string;
  readonly prompt: string;
  readonly options: readonly string[];
  readonly correctAnswer: string;
  readonly distractorTags: Readonly<Record<string, MisconceptionTag>>;
}

/** Statistical outcome for a paired sample comparison (pre vs post). */
export interface PairedTestStats {
  readonly count: number;
  readonly meanDiff: number;
  readonly sdDiff: number;
  readonly seDiff: number;
  readonly t: number;
  readonly df: number;
  readonly pValue: number;
  readonly cohensD: number;
}

/** Error returned when insufficient paired samples exist for inference. */
export interface NotEnoughDataResult {
  readonly code: 'not-enough-data';
  readonly message: string;
}

/** Counterbalanced form assignment. */
export interface FormOrder {
  readonly pre: 'A' | 'B';
  readonly post: 'A' | 'B';
}

// ---------------------------------------------------------------------------
// CSV Export & Session Summaries
// ---------------------------------------------------------------------------

/** Researcher-friendly session summary record. */
export interface SessionSummaryRow {
  readonly participantId: string;
  readonly sessionId: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly durationMs: number;
  readonly stepsAttempted: number;
  readonly stepsCorrectFirstTry: number;
  readonly errorCount: number;
  readonly hintsUsedL1: number;
  readonly hintsUsedL2: number;
  readonly hintsUsedL3: number;
  readonly assistedSteps: number;
  readonly modulesCompleted: number;
  readonly quizScore: number | null;
  readonly preScore: number | null;
  readonly postScore: number | null;
  readonly susScore: number | null;
}

// ---------------------------------------------------------------------------
// Dashboard & Aggregation Model
// ---------------------------------------------------------------------------

/** Optional filter parameters for telemetry log aggregation. */
export interface EvaluationFilter {
  readonly participantId?: string;
  readonly sessionId?: string;
  readonly moduleId?: string;
  readonly dateRange?: {
    readonly start?: string;
    readonly end?: string;
  };
}

/** Misconception ranking record for the instructor dashboard. */
export interface MisconceptionRankingRow {
  readonly tag: MisconceptionTag;
  readonly title: string;
  readonly count: number;
  readonly distinctParticipants: number;
  readonly errorShare: number;
  readonly affectedModules: readonly string[];
}

/** Module pipeline transition counts and dropouts. */
export interface HandoffEdgeCount {
  readonly fromModuleId: string;
  readonly toModuleId: string;
  readonly completedHandoffs: number;
  readonly dropouts: number;
}

/** Summary of pre-test and post-test cohort performance. */
export interface PrePostSummary {
  readonly totalPreSubmissions: number;
  readonly totalPostSubmissions: number;
  readonly pairedParticipantsCount: number;
  readonly meanRawGain: number | null;
  readonly meanHakeGain: number | null;
  readonly pairedStats: PairedTestStats | NotEnoughDataResult;
}

/** Comprehensive, JSON-serializable dashboard analytics model. */
export interface DashboardModel {
  readonly participantsCount: number;
  readonly moduleSummaries: readonly import('../../types/logging').ModuleSummary[];
  readonly misconceptionRankings: readonly MisconceptionRankingRow[];
  readonly stepKindErrorRates: Readonly<Record<string, number>>;
  readonly answerTrapCount: number;
  readonly handoffCounts: readonly HandoffEdgeCount[];
  readonly quizTopicDistributions: Readonly<Record<string, readonly number[]>>;
  readonly prePostSummary: PrePostSummary;
  readonly susSummary: SusAggregate | null;
  readonly excludedCount: number;
  readonly exclusionReasons: readonly string[];
}
