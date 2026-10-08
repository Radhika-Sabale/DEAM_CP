/**
 * @file sequentialSession.ts
 * Pure reducer and state model for the Sequential Circuit Designer session (Stage 10D).
 *
 * Implements strict unlocking rules, spec change invalidation of downstream steps,
 * and project re-derivation without persisting unverified drafts.
 */

import {
  type SequentialStepId,
  type SequentialStepState,
  type SequentialSessionState,
  type SequentialSessionAction,
  SEQUENTIAL_STEP_IDS,
  isStepUnlocked,
} from './sequentialSessionTypes';
import { deriveSessionFromProject } from './sequentialSessionRehydration';

// Re-export all session types, constants, and utilities
export * from './sequentialSessionTypes';
export { deriveSessionFromProject } from './sequentialSessionRehydration';

/**
 * Creates a fresh, empty sequential session for a counter or detector.
 *
 * @param kind 'counter' | 'detector'
 * @returns Initial session state
 */
export function createInitialSequentialSession(
  kind: 'counter' | 'detector' = 'counter'
): SequentialSessionState {
  const steps = {} as Record<SequentialStepId, SequentialStepState>;
  for (const stepId of SEQUENTIAL_STEP_IDS) {
    steps[stepId] = {
      status: 'not-started',
      draft: null,
    };
  }

  return {
    spec: null,
    currentStep: 'flipflop',
    steps,
    kind,
  };
}

/**
 * Checks if any steps following a given step have non-null drafts.
 *
 * @param state Current session state
 * @param fromStep Step from which to inspect downstream steps
 * @returns True if any later steps have drafts
 */
export function hasLaterDrafts(
  state: SequentialSessionState,
  fromStep: SequentialStepId
): boolean {
  const fromIdx = SEQUENTIAL_STEP_IDS.indexOf(fromStep);
  for (let i = fromIdx + 1; i < SEQUENTIAL_STEP_IDS.length; i++) {
    const sId = SEQUENTIAL_STEP_IDS[i];
    if (sId && state.steps[sId].draft !== null) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if any steps downstream of 'define' have non-null drafts.
 * Used to prompt confirmation before dropping user drafts on spec changes.
 */
export function hasDraftsDownstream(state: SequentialSessionState): boolean {
  return hasLaterDrafts(state, 'define');
}

/**
 * Pure reducer managing sequential session transitions and invalidation rules.
 *
 * RULES:
 * 1. Step unlocking: A step can only be selected if the previous step is verified or assisted.
 * 2. Spec changes: Invalidate all downstream steps (diagram through simulate), resetting them
 *    to 'not-started' and dropping their component drafts.
 * 3. Asynchronous ripple counter rule: state diagram step is bypassed and marked verified
 *    with pedagogical explanation.
 *
 * @param state Current session state
 * @param action Session action
 * @returns Updated session state
 */
export function sequentialSessionReducer(
  state: SequentialSessionState,
  action: SequentialSessionAction
): SequentialSessionState {
  switch (action.type) {
    case 'setSpec': {
      const newSpec = action.spec;
      const newKind = newSpec?.kind === 'detector' ? 'detector' : 'counter';
      const isAsync = newSpec?.kind === 'counter' && newSpec.style === 'async';

      // Downstream steps must be invalidated and drafts dropped
      const updatedSteps: Record<SequentialStepId, SequentialStepState> = {
        ...state.steps,
        diagram: isAsync
          ? {
              status: 'verified',
              draft: 'Asynchronous ripple counters follow a fixed pattern; see the design on the next step',
            }
          : { status: 'not-started', draft: null },
        table: { status: 'not-started', draft: null },
        excitation: { status: 'not-started', draft: null },
        equations: { status: 'not-started', draft: null },
        lockout: { status: 'not-started', draft: null },
        simulate: { status: 'not-started', draft: null },
      };

      if (newSpec) {
        updatedSteps.define = { status: 'verified', draft: newSpec };
      } else {
        updatedSteps.define = { status: 'not-started', draft: null };
      }

      return {
        ...state,
        spec: newSpec,
        kind: newKind,
        steps: updatedSteps,
      };
    }

    case 'selectStep': {
      if (!isStepUnlocked(state, action.stepId)) {
        return state;
      }
      return {
        ...state,
        currentStep: action.stepId,
      };
    }

    case 'updateDraft': {
      const curr = state.steps[action.stepId];
      const nextStatus =
        curr.status === 'not-started' ? 'in-progress' : curr.status;
      return {
        ...state,
        steps: {
          ...state.steps,
          [action.stepId]: {
            status: nextStatus,
            draft: action.draft,
          },
        },
      };
    }

    case 'markVerified': {
      const curr = state.steps[action.stepId];
      return {
        ...state,
        steps: {
          ...state.steps,
          [action.stepId]: {
            status: 'verified',
            draft: action.draft !== undefined ? action.draft : curr.draft,
          },
        },
      };
    }

    case 'markAssisted': {
      const curr = state.steps[action.stepId];
      return {
        ...state,
        steps: {
          ...state.steps,
          [action.stepId]: {
            status: 'assisted',
            draft: action.draft !== undefined ? action.draft : curr.draft,
          },
        },
      };
    }

    case 'resetStep': {
      return {
        ...state,
        steps: {
          ...state.steps,
          [action.stepId]: {
            status: 'not-started',
            draft: null,
          },
        },
      };
    }

    case 'resetAll':
      return createInitialSequentialSession(state.kind);

    case 'loadFromProject':
      return deriveSessionFromProject(action.project);

    default:
      return state;
  }
}
