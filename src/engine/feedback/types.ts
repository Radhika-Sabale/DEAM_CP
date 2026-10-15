/**
 * @file types.ts
 * Engine-local types for deterministic pedagogical feedback, validation outcomes,
 * step contexts, and diagnostic formatting.
 */

import type {
  ErrorType,
  ExpectedAnswer,
  GotAnswer,
  HintRecord,
  MisconceptionTag,
  StepSubmission,
} from '../../types/feedback';

/**
 * Dynamic parameter context passed to hint templates for contextualization.
 */
export interface DiagnosisContext {
  /** The correct target value string */
  readonly expected: string;
  /** The student's incorrect value string */
  readonly got: string;
  /** Optional target label or expression under consideration */
  readonly target?: string;
  /** Additional mathematical or pedagogical detail */
  readonly detail?: string;
}

/**
 * Three-tiered progressive hint template functions for a misconception.
 */
export interface MisconceptionHintTemplates {
  /** Level 1: Conceptual reminder or gentle nudge (never reveals expected answer) */
  readonly level1: (ctx: DiagnosisContext) => string;
  /** Level 2: Pointed direction identifying the exact error site (never reveals expected answer) */
  readonly level2: (ctx: DiagnosisContext) => string;
  /** Level 3: Fully worked step demonstrating the correct transformation */
  readonly level3: (ctx: DiagnosisContext) => string;
}

/**
 * Full pedagogical entry in the misconception catalog.
 */
export interface MisconceptionCatalogEntry {
  readonly tag: MisconceptionTag;
  readonly title: string;
  /** 2-3 sentence description explaining the underlying cognitive flaw */
  readonly description: string;
  readonly affectedModules: readonly string[];
  readonly example: string;
  readonly hints: MisconceptionHintTemplates;
}

/**
 * Result returned by a domain-specific step validator.
 */
export type ValidationOutcome =
  | { readonly correct: true }
  | {
      readonly correct: false;
      readonly errorType: ErrorType;
      readonly expected: ExpectedAnswer;
      readonly got: GotAnswer;
      readonly misconceptionTag?: MisconceptionTag;
      readonly details?: string;
    };

/**
 * Contextual metadata for K-map group validation.
 */
export interface KMapStepContext {
  readonly variableCount: number;
  readonly minterms: readonly number[];
  readonly dontCares?: readonly number[];
  readonly mode?: 'SOP' | 'POS';
  readonly groupsSoFar?: readonly (readonly number[])[];
  readonly expectedExpression?: string;
  readonly variableNames?: readonly string[];
}

/**
 * Contextual problem metadata provided to step validators.
 */
export interface StepContext {
  readonly previousStepAnswer?: string;
  readonly targetRadix?: number;
  readonly sourceRadix?: number;
  readonly bitWidth?: number;
  readonly isSigned?: boolean;
  readonly claimedLaw?: string;
  readonly detail?: string;
  readonly kmap?: KMapStepContext;
  readonly alu?: {
    readonly op: import('../../types/designProject').AluOpId;
    readonly width: number;
    readonly a: number;
    readonly b: number;
    readonly shiftCount?: number;
    readonly previousC?: 0 | 1;
  };
  readonly cpu8086?: {
    readonly state: import('../cpu8086/cpuTypes').CpuState;
    readonly program: import('../cpu8086/types').Program;
    readonly stepResult?: import('../cpu8086/cpuTypes').StepResult;
    readonly sourceSymbolAddress?: number;
  };
  readonly interrupts?: {
    readonly cpuState: import('../cpu8086/cpuTypes').CpuState;
    readonly program?: import('../cpu8086/types').Program;
    readonly record?: import('../interrupts/types').InterruptRecord;
    readonly iretRecord?: import('../interrupts/types').IretRecord;
    readonly pendingState?: import('../interrupts/types').PendingInterruptState;
    readonly scenario?: import('../interrupts/types').InterruptScenario;
    readonly vector?: number;
    readonly vectorAddress?: number;
    readonly handlerIp?: number;
    readonly installed?: boolean;
    readonly nestingDepth?: number;
    readonly expectedSp?: number;
    readonly expectedWords?: readonly number[];
    readonly tfSetAtIp?: number;
    readonly trapFiresAfterIp?: number;
    readonly initialSp?: number;
  };
}

/**
 * Signature for pluggable step validator functions in the registry.
 */
export type ValidatorFn = (
  submission: StepSubmission,
  context?: StepContext
) => ValidationOutcome;

/**
 * Tracked hint session state per exercise step.
 */
export interface HintSession {
  readonly stepKey: string;
  readonly levelsShown: readonly HintRecord[];
}

/**
 * Summary of a student attempt over multiple sequential steps.
 */
export interface StepAttemptSummary {
  readonly steps: readonly StepSubmission[];
  readonly outcomes: readonly ValidationOutcome[];
  readonly finalAnswer: string;
  readonly expectedFinalAnswer: string;
  readonly assistedSteps?: readonly string[];
}
