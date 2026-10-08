/**
 * @file feedbackStore.ts
 * Central pedagogical store managing step evaluations, progressive hint sessions,
 * assisted flags, answer trap detection, and optional LLM friendly rephrasing.
 *
 * CRITICAL INVARIANT:
 * The deterministic Diagnosis objects and authoritative `ok` booleans are NEVER mutated
 * by the LLM rephraser. LLM text is stored separately in `friendlyTexts`.
 */

import { create } from 'zustand';
import type {
  AnswerTrapFlag,
  Diagnosis,
  FeedbackResult,
  HintRecord,
  StepSubmission,
  StudentAnswer,
} from '../types/feedback';
import {
  createHintSession,
  requestHint as engineRequestHint,
} from '../engine/feedback/hints';
import {
  evaluateAttempt,
  evaluateStep,
} from '../engine/feedback/feedbackEngine';
import type { HintSession, StepContext } from '../engine/feedback/types';
import {
  rephraseDiagnosis,
  storeApiKey,
  getStoredApiKey,
  type LlmConfig,
} from '../engine/feedback/llmAdapter';
import { useLogStore } from './logStore';

export interface FeedbackState {
  hintSessions: Record<string, HintSession>;
  latestDiagnoses: Record<string, readonly Diagnosis[]>;
  assistedSteps: Record<string, boolean>;
  attemptHistory: Record<string, readonly StepSubmission[]>;
  latestAnswerTrap: AnswerTrapFlag | null;
  friendlyTexts: Record<string, string>;
  featureFlags: {
    llmHints: boolean;
  };
  llmConfig: LlmConfig;

  submitStep: (
    submission: StepSubmission,
    context?: StepContext
  ) => FeedbackResult;
  requestHint: (stepKey: string) => HintRecord | null;
  resetStep: (stepKey: string) => void;
  resetAll: () => void;
  completeAttempt: (
    finalAnswer: StudentAnswer,
    moduleId?: string,
    context?: StepContext & { expectedFinalAnswer?: string }
  ) => AnswerTrapFlag | null;
  setLlmHintsEnabled: (enabled: boolean) => void;
  setLlmApiKey: (key: string, rememberInSession?: boolean) => void;
}

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  hintSessions: {},
  latestDiagnoses: {},
  assistedSteps: {},
  attemptHistory: {},
  latestAnswerTrap: null,
  friendlyTexts: {},
  featureFlags: {
    llmHints: false,
  },
  llmConfig: {
    enabled: false,
    provider: 'anthropic',
    apiKey: getStoredApiKey() ?? undefined,
  },

  setLlmHintsEnabled: (enabled) => {
    set((state) => ({
      featureFlags: { ...state.featureFlags, llmHints: enabled },
      llmConfig: { ...state.llmConfig, enabled },
    }));
  },

  setLlmApiKey: (key, rememberInSession = false) => {
    storeApiKey(key, rememberInSession);
    set((state) => ({
      llmConfig: { ...state.llmConfig, apiKey: key },
    }));
  },

  submitStep: (submission, context) => {
    const stepKey = submission.stepId;
    const result = evaluateStep(submission, context);

    const history = get().attemptHistory[stepKey] ?? [];
    const updatedHistory = {
      ...get().attemptHistory,
      [stepKey]: [...history, submission],
    };

    if (result.ok) {
      set({
        attemptHistory: updatedHistory,
        latestDiagnoses: { ...get().latestDiagnoses, [stepKey]: [] },
      });
    } else {
      set({
        attemptHistory: updatedHistory,
        latestDiagnoses: { ...get().latestDiagnoses, [stepKey]: result.diagnoses },
      });

      // If LLM rephrasing feature flag is active, trigger background rephrase
      if (get().featureFlags.llmHints && result.diagnoses.length > 0) {
        const primaryDiag = result.diagnoses[0];
        if (primaryDiag) {
          rephraseDiagnosis(primaryDiag, get().llmConfig).then((rephrased) => {
            if (rephrased.wasRephrased) {
              set((state) => ({
                friendlyTexts: {
                  ...state.friendlyTexts,
                  [stepKey]: rephrased.displayExplanation,
                },
              }));
            }
          });
        }
      }
    }

    // Telemetry logging through logStore
    useLogStore.getState().logStepSubmitted(
      submission.stepId,
      submission.moduleId,
      result
    );

    return result;
  },

  requestHint: (stepKey) => {
    const { hintSessions, latestDiagnoses } = get();
    const session = hintSessions[stepKey] ?? createHintSession(stepKey);
    const diagnoses = latestDiagnoses[stepKey] ?? [];
    const primaryDiag = diagnoses[0];

    if (!primaryDiag) {
      return null;
    }

    const now = new Date().toISOString();
    const result = engineRequestHint(session, primaryDiag, now);

    set((state) => ({
      hintSessions: {
        ...state.hintSessions,
        [stepKey]: result.session,
      },
      assistedSteps: {
        ...state.assistedSteps,
        [stepKey]: state.assistedSteps[stepKey] || result.assisted,
      },
    }));

    // Telemetry log for hint usage
    useLogStore.getState().logEvent({
      eventType: 'hint-used',
      moduleId: 'feedback',
      stepId: stepKey,
      level: result.hint.level,
    });

    return result.hint;
  },

  resetStep: (stepKey) => {
    set((state) => {
      const nextHints = { ...state.hintSessions };
      const nextDiags = { ...state.latestDiagnoses };
      const nextAssisted = { ...state.assistedSteps };
      const nextHistory = { ...state.attemptHistory };
      const nextFriendly = { ...state.friendlyTexts };

      delete nextHints[stepKey];
      delete nextDiags[stepKey];
      delete nextAssisted[stepKey];
      delete nextHistory[stepKey];
      delete nextFriendly[stepKey];

      return {
        hintSessions: nextHints,
        latestDiagnoses: nextDiags,
        assistedSteps: nextAssisted,
        attemptHistory: nextHistory,
        friendlyTexts: nextFriendly,
      };
    });
  },

  resetAll: () => {
    set({
      hintSessions: {},
      latestDiagnoses: {},
      assistedSteps: {},
      attemptHistory: {},
      latestAnswerTrap: null,
      friendlyTexts: {},
    });
  },

  completeAttempt: (finalAnswer, moduleId = 'feedback', context) => {
    const allSteps: StepSubmission[] = [];
    for (const stepList of Object.values(get().attemptHistory)) {
      allSteps.push(...stepList);
    }

    const evaluation = evaluateAttempt(allSteps, finalAnswer, context);
    set({ latestAnswerTrap: evaluation.answerTrap });

    if (evaluation.overall) {
      useLogStore.getState().logEvent({
        eventType: 'module-completed',
        moduleId,
        durationMs: 0,
      });
    }

    return evaluation.answerTrap;
  },
}));
