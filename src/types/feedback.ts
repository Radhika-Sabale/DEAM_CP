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
  | 'number-conversion-step'
  | 'alu-result'
  | 'alu-flag'
  | 'alu-chain-bit'
  | 'alu-compare'
  | 'cpu-register'
  | 'cpu-flag'
  | 'cpu-memory'
  | 'cpu-stack'
  | 'cpu-next-ip'
  | 'int-frame'
  | 'int-vector'
  | 'int-flags'
  | 'int-priority'
  | 'int-trap-timing';

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
 * Closed union of reasoning justification choices for ALU flag evaluations.
 */
export type AluFlagReasoningOption =
  | 'carry-out'
  | 'no-carry-out'
  | 'borrow-needed'
  | 'no-borrow-needed'
  | 'overflow-rule'
  | 'no-overflow'
  | 'msb-of-result'
  | 'msb-is-zero'
  | 'all-bits-zero'
  | 'nonzero-result'
  | 'shift-count-greater-than-one'
  | 'shifted-out-bit'
  | 'inc-dec-preserves-carry'
  | 'none';

/**
 * Student attempt to compute the numerical/binary result of an ALU operation.
 */
export interface AluResultAnswer {
  readonly kind: 'alu-result';
  readonly value: number;
  readonly binaryString?: string;
}

/**
 * Student attempt to evaluate one of the ALU status flags (Z, C, S, O).
 */
export interface AluFlagAnswer {
  readonly kind: 'alu-flag';
  readonly flag: 'Z' | 'C' | 'S' | 'O';
  readonly value: 0 | 1 | 'undefined';
  readonly reasoning?: AluFlagReasoningOption;
}

/**
 * Student entry for an individual bit stage in the ripple-carry chain.
 */
export interface AluChainBitAnswer {
  readonly kind: 'alu-chain-bit';
  readonly bitIndex: number;
  readonly carryIn: 0 | 1;
  readonly sumBit: 0 | 1;
  readonly carryOut: 0 | 1;
}

/**
 * Student claim about a relational comparison (equal, less, greater) derived from ALU flags.
 */
export interface AluCompareAnswer {
  readonly kind: 'alu-compare';
  readonly relation:
    | 'equal'
    | 'unsigned-less'
    | 'unsigned-greater'
    | 'signed-less'
    | 'signed-greater';
  readonly answer: boolean;
}

/**
 * 8086 CPU register names supported in student step predictions.
 */
export type CpuRegisterName =
  | 'AX'
  | 'BX'
  | 'CX'
  | 'DX'
  | 'SI'
  | 'DI'
  | 'SP'
  | 'IP'
  | 'AH'
  | 'AL'
  | 'BH'
  | 'BL'
  | 'CH'
  | 'CL'
  | 'DH'
  | 'DL';

/**
 * Common status flag names across ALU and 8086 modules.
 */
export type FlagName = 'Z' | 'C' | 'S' | 'O';

/**
 * Closed reasoning choices for CPU register predictions.
 */
export type CpuRegisterReasoningOption =
  | 'mov-direction-dest-receives-src'
  | 'partial-register-low-byte'
  | 'partial-register-high-byte'
  | 'cmp-discards-difference';

/**
 * Closed reasoning choices for CPU flag predictions.
 */
export type CpuFlagReasoningOption =
  | 'mov-preserves-flags'
  | 'inc-dec-preserves-carry'
  | 'shift-overflow-undefined';

/**
 * Closed reasoning choices for CPU memory predictions.
 */
export type CpuMemoryReasoningOption =
  | 'little-endian-low-byte-first'
  | 'immediate-address-vs-value';

/**
 * Closed reasoning choices for CPU stack predictions.
 */
export type CpuStackReasoningOption =
  | 'stack-decrement-before-write'
  | 'stack-increment-after-read'
  | 'call-pushes-next-instruction';

/**
 * Closed reasoning choices for CPU branch/jump target predictions.
 */
export type CpuNextIpReasoningOption =
  | 'condition-met-jump'
  | 'condition-not-met-fallthrough';

/**
 * Discriminated union of all CPU step reasoning choices.
 */
export type CpuReasoningOption =
  | CpuRegisterReasoningOption
  | CpuFlagReasoningOption
  | CpuMemoryReasoningOption
  | CpuStackReasoningOption
  | CpuNextIpReasoningOption;

/**
 * Student prediction for an 8086 register value.
 */
export interface CpuRegisterAnswer {
  readonly kind: 'cpu-register';
  readonly register: CpuRegisterName;
  readonly value: number;
  readonly reasoning?: CpuRegisterReasoningOption;
}

/**
 * Student prediction for an 8086 status flag value.
 */
export interface CpuFlagAnswer {
  readonly kind: 'cpu-flag';
  readonly flag: FlagName;
  readonly value: 0 | 1 | 'undefined';
  readonly reasoning?: CpuFlagReasoningOption;
}

/**
 * Student prediction for an 8086 memory location.
 */
export interface CpuMemoryAnswer {
  readonly kind: 'cpu-memory';
  readonly address: number;
  readonly width: 8 | 16;
  readonly value: number;
  readonly reasoning?: CpuMemoryReasoningOption;
}

/**
 * Student prediction for an 8086 stack operation.
 */
export interface CpuStackAnswer {
  readonly kind: 'cpu-stack';
  readonly op: 'push' | 'pop';
  readonly sp: number;
  readonly address: number;
  readonly value: number;
  readonly reasoning?: CpuStackReasoningOption;
}

/**
 * Student prediction for 8086 instruction pointer following instruction or branch.
 */
export interface CpuNextIpAnswer {
  readonly kind: 'cpu-next-ip';
  readonly nextIp: number;
  readonly reasoning?: CpuNextIpReasoningOption;
}

/**
 * Closed reasoning choices for interrupt stack frame predictions.
 */
export type IntFrameReasoningOption =
  | 'flags-cs-ip-pushed-downward'
  | 'ip-cs-flags-reversed'
  | 'ret-pops-ip-only'
  | 'none';

/**
 * Closed reasoning choices for interrupt vector address predictions.
 */
export type IntVectorReasoningOption =
  | 'vector-times-four'
  | 'vector-times-two'
  | 'vector-plus-four'
  | 'none';

/**
 * Closed reasoning choices for interrupt flag predictions.
 */
export type IntFlagsReasoningOption =
  | 'hardware-clears-if-tf'
  | 'iret-restores-flags'
  | 'flags-unaffected'
  | 'none';

/**
 * Closed reasoning choices for interrupt priority predictions.
 */
export type IntPriorityReasoningOption =
  | 'nmi-higher-than-intr'
  | 'intr-higher-than-nmi'
  | 'software-preempts-hardware'
  | 'none';

/**
 * Closed reasoning choices for single-step trap timing predictions.
 */
export type IntTrapTimingReasoningOption =
  | 'trap-after-next-instruction'
  | 'trap-immediately-on-popf'
  | 'none';

/**
 * Discriminated union of all interrupt step reasoning choices.
 */
export type InterruptReasoningOption =
  | IntFrameReasoningOption
  | IntVectorReasoningOption
  | IntFlagsReasoningOption
  | IntPriorityReasoningOption
  | IntTrapTimingReasoningOption;

/**
 * Student prediction for stack words and SP following interrupt entry or return.
 */
export interface IntFrameAnswer {
  readonly kind: 'int-frame';
  readonly phase: 'entry' | 'return';
  readonly sp: number;
  readonly words: readonly number[];
  readonly reasoning?: IntFrameReasoningOption;
}

/**
 * Student prediction for an interrupt vector table descriptor and handler target.
 */
export interface IntVectorAnswer {
  readonly kind: 'int-vector';
  readonly vector: number;
  readonly vectorAddress: number;
  readonly handlerIp: number;
  readonly installed: boolean;
  readonly reasoning?: IntVectorReasoningOption;
}

/**
 * Student prediction for IF and TF flag values after interrupt entry or IRET.
 */
export interface IntFlagsAnswer {
  readonly kind: 'int-flags';
  readonly context: 'after-entry' | 'after-iret';
  readonly ifValue: 0 | 1;
  readonly tfValue: 0 | 1;
  readonly reasoning?: IntFlagsReasoningOption;
}

/**
 * Student prediction for servicing order among multiple pending interrupts.
 */
export interface IntPriorityAnswer {
  readonly kind: 'int-priority';
  readonly pendingKinds: readonly ('nmi' | 'intr' | 'software' | 'single-step')[];
  readonly servicedOrder: readonly ('nmi' | 'intr' | 'software' | 'single-step')[];
  readonly reasoning?: IntPriorityReasoningOption;
}

/**
 * Student prediction for instruction boundary timing of single-step traps.
 */
export interface IntTrapTimingAnswer {
  readonly kind: 'int-trap-timing';
  readonly tfSetAtIp: number;
  readonly trapFiresAfterIp: number;
  readonly reasoning?: IntTrapTimingReasoningOption;
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
  | NumberConversionStepAnswer
  | AluResultAnswer
  | AluFlagAnswer
  | AluChainBitAnswer
  | AluCompareAnswer
  | CpuRegisterAnswer
  | CpuFlagAnswer
  | CpuMemoryAnswer
  | CpuStackAnswer
  | CpuNextIpAnswer
  | IntFrameAnswer
  | IntVectorAnswer
  | IntFlagsAnswer
  | IntPriorityAnswer
  | IntTrapTimingAnswer;

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
    }
  | {
      readonly kind: 'alu-result';
      readonly expectedValue: number;
    }
  | {
      readonly kind: 'alu-flag';
      readonly flag: 'Z' | 'C' | 'S' | 'O';
      readonly expectedValue: 0 | 1 | 'undefined';
      readonly validReasonings?: readonly AluFlagReasoningOption[];
    }
  | {
      readonly kind: 'alu-chain-bit';
      readonly bitIndex: number;
      readonly expectedCarryIn: 0 | 1;
      readonly expectedSumBit: 0 | 1;
      readonly expectedCarryOut: 0 | 1;
    }
  | {
      readonly kind: 'alu-compare';
      readonly relation:
        | 'equal'
        | 'unsigned-less'
        | 'unsigned-greater'
        | 'signed-less'
        | 'signed-greater';
      readonly expectedAnswer: boolean;
    }
  | {
      readonly kind: 'cpu-register';
      readonly register: CpuRegisterName;
      readonly expectedValue: number;
      readonly validReasonings?: readonly CpuRegisterReasoningOption[];
    }
  | {
      readonly kind: 'cpu-flag';
      readonly flag: FlagName;
      readonly expectedValue: 0 | 1 | 'undefined';
      readonly validReasonings?: readonly CpuFlagReasoningOption[];
    }
  | {
      readonly kind: 'cpu-memory';
      readonly address: number;
      readonly width: 8 | 16;
      readonly expectedValue: number;
      readonly validReasonings?: readonly CpuMemoryReasoningOption[];
    }
  | {
      readonly kind: 'cpu-stack';
      readonly op: 'push' | 'pop';
      readonly expectedSp: number;
      readonly expectedAddress: number;
      readonly expectedValue: number;
      readonly validReasonings?: readonly CpuStackReasoningOption[];
    }
  | {
      readonly kind: 'cpu-next-ip';
      readonly expectedIp: number;
      readonly validReasonings?: readonly CpuNextIpReasoningOption[];
    }
  | {
      readonly kind: 'int-frame';
      readonly phase: 'entry' | 'return';
      readonly expectedSp: number;
      readonly expectedWords: readonly number[];
      readonly validReasonings?: readonly IntFrameReasoningOption[];
    }
  | {
      readonly kind: 'int-vector';
      readonly vector: number;
      readonly expectedVectorAddress: number;
      readonly expectedHandlerIp: number;
      readonly expectedInstalled: boolean;
      readonly validReasonings?: readonly IntVectorReasoningOption[];
    }
  | {
      readonly kind: 'int-flags';
      readonly context: 'after-entry' | 'after-iret';
      readonly expectedIf: 0 | 1;
      readonly expectedTf: 0 | 1;
      readonly validReasonings?: readonly IntFlagsReasoningOption[];
    }
  | {
      readonly kind: 'int-priority';
      readonly pendingKinds: readonly ('nmi' | 'intr' | 'software' | 'single-step')[];
      readonly expectedServicedOrder: readonly ('nmi' | 'intr' | 'software' | 'single-step')[];
      readonly validReasonings?: readonly IntPriorityReasoningOption[];
    }
  | {
      readonly kind: 'int-trap-timing';
      readonly tfSetAtIp: number;
      readonly expectedTrapFiresAfterIp: number;
      readonly validReasonings?: readonly IntTrapTimingReasoningOption[];
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
    }
  | {
      readonly kind: 'alu-result';
      readonly studentValue: number;
    }
  | {
      readonly kind: 'alu-flag';
      readonly flag: 'Z' | 'C' | 'S' | 'O';
      readonly studentValue: 0 | 1 | 'undefined';
      readonly studentReasoning?: AluFlagReasoningOption;
    }
  | {
      readonly kind: 'alu-chain-bit';
      readonly bitIndex: number;
      readonly studentCarryIn: 0 | 1;
      readonly studentSumBit: 0 | 1;
      readonly studentCarryOut: 0 | 1;
    }
  | {
      readonly kind: 'alu-compare';
      readonly relation:
        | 'equal'
        | 'unsigned-less'
        | 'unsigned-greater'
        | 'signed-less'
        | 'signed-greater';
      readonly studentAnswer: boolean;
    }
  | {
      readonly kind: 'cpu-register';
      readonly register: CpuRegisterName;
      readonly studentValue: number;
      readonly studentReasoning?: CpuRegisterReasoningOption;
    }
  | {
      readonly kind: 'cpu-flag';
      readonly flag: FlagName;
      readonly studentValue: 0 | 1 | 'undefined';
      readonly studentReasoning?: CpuFlagReasoningOption;
    }
  | {
      readonly kind: 'cpu-memory';
      readonly address: number;
      readonly width: 8 | 16;
      readonly studentValue: number;
      readonly studentReasoning?: CpuMemoryReasoningOption;
    }
  | {
      readonly kind: 'cpu-stack';
      readonly op: 'push' | 'pop';
      readonly studentSp: number;
      readonly studentAddress: number;
      readonly studentValue: number;
      readonly studentReasoning?: CpuStackReasoningOption;
    }
  | {
      readonly kind: 'cpu-next-ip';
      readonly studentNextIp: number;
      readonly studentReasoning?: CpuNextIpReasoningOption;
    }
  | {
      readonly kind: 'int-frame';
      readonly phase: 'entry' | 'return';
      readonly studentSp: number;
      readonly studentWords: readonly number[];
      readonly studentReasoning?: IntFrameReasoningOption;
    }
  | {
      readonly kind: 'int-vector';
      readonly vector: number;
      readonly studentVectorAddress: number;
      readonly studentHandlerIp: number;
      readonly studentInstalled: boolean;
      readonly studentReasoning?: IntVectorReasoningOption;
    }
  | {
      readonly kind: 'int-flags';
      readonly context: 'after-entry' | 'after-iret';
      readonly studentIf: 0 | 1;
      readonly studentTf: 0 | 1;
      readonly studentReasoning?: IntFlagsReasoningOption;
    }
  | {
      readonly kind: 'int-priority';
      readonly pendingKinds: readonly ('nmi' | 'intr' | 'software' | 'single-step')[];
      readonly studentServicedOrder: readonly ('nmi' | 'intr' | 'software' | 'single-step')[];
      readonly studentReasoning?: IntPriorityReasoningOption;
    }
  | {
      readonly kind: 'int-trap-timing';
      readonly tfSetAtIp: number;
      readonly studentTrapFiresAfterIp: number;
      readonly studentReasoning?: IntTrapTimingReasoningOption;
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
  | 'wrong-borrow-convention'
  | 'forgot-invert-b-in-subtract'
  | 'wrong-shift-carry-out'
  | 'wrong-sign-flag'
  | 'wrong-zero-flag'
  | 'wrong-cmp-relation'
  | 'inc-dec-changes-carry'
  | 'wrong-law-applied'
  | 'algebra-sign-error'
  | 'wrong-jcc-condition'
  | 'wrong-push-order'
  | 'wrong-stack-direction'
  | 'confused-mov-direction'
  | 'cmp-stores-result'
  | 'mov-affects-flags'
  | 'wrong-call-return-address'
  | 'wrong-byte-order'
  | 'wrong-address-vs-value'
  | 'wrong-partial-register'
  | 'wrong-ip-after-jump'
  | 'ret-instead-of-iret'
  | 'wrong-ivt-address'
  | 'wrong-int-frame-order'
  | 'wrong-int-frame-size'
  | 'if-tf-not-cleared-on-entry'
  | 'nmi-treated-as-maskable'
  | 'intr-ignores-if'
  | 'forgot-sti-in-handler-for-nesting'
  | 'wrong-interrupt-priority'
  | 'tf-trap-timing'
  | 'unset-vector-assumed-valid'
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
