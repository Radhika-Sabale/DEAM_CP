/**
 * @file sequentialSessionTypes.ts
 * Types and action interfaces for the Sequential Circuit Designer session.
 */

import type { DesignProject } from '../../types/designProject';
import type { SequentialSpec } from '../../types/sequential';

/** Sequential wizard step identifiers in execution sequence. */
export type SequentialStepId =
  | 'flipflop'
  | 'define'
  | 'diagram'
  | 'table'
  | 'excitation'
  | 'equations'
  | 'lockout'
  | 'simulate';

/** Alias for SequentialStepId. */
export type StepId = SequentialStepId;

/** Ordered sequence of wizard step IDs. */
export const SEQUENTIAL_STEP_IDS: readonly SequentialStepId[] = [
  'flipflop',
  'define',
  'diagram',
  'table',
  'excitation',
  'equations',
  'lockout',
  'simulate',
] as const;

/** Pedagogical completion and verification status for a wizard step. */
export type StepStatus = 'not-started' | 'in-progress' | 'verified' | 'assisted';

/** Per-step state holding status and component-local draft. */
export interface SequentialStepState<TDraft = unknown> {
  readonly status: StepStatus;
  readonly draft: TDraft;
}

/** Immutable, JSON-serializable sequential designer session. */
export interface SequentialSessionState {
  readonly spec: SequentialSpec | null;
  readonly currentStep: SequentialStepId;
  readonly steps: Readonly<Record<SequentialStepId, SequentialStepState>>;
  readonly kind: 'counter' | 'detector';
}

/** Discriminated union of pure reducer actions for the sequential session. */
export type SequentialSessionAction =
  | { readonly type: 'setSpec'; readonly spec: SequentialSpec | null }
  | { readonly type: 'selectStep'; readonly stepId: SequentialStepId }
  | { readonly type: 'updateDraft'; readonly stepId: SequentialStepId; readonly draft: unknown }
  | { readonly type: 'markVerified'; readonly stepId: SequentialStepId; readonly draft?: unknown }
  | { readonly type: 'markAssisted'; readonly stepId: SequentialStepId; readonly draft?: unknown }
  | { readonly type: 'resetStep'; readonly stepId: SequentialStepId }
  | { readonly type: 'resetAll' }
  | { readonly type: 'loadFromProject'; readonly project: DesignProject };

/** Friendly display labels for wizard steps. */
export const STEP_TITLES: Record<SequentialStepId, string> = {
  flipflop: 'Select Flip-Flop',
  define: 'Define Machine',
  diagram: 'State Diagram',
  table: 'State Table',
  excitation: 'Excitation Table',
  equations: 'Next-State Equations',
  lockout: 'Lockout Analysis',
  simulate: 'Simulation & Verification',
};

/**
 * Checks whether a step is unlocked according to wizard progression rules.
 * Rule: Step 0 is always unlocked; subsequent steps unlock only when the prior step is verified or assisted.
 */
export function isStepUnlocked(
  state: SequentialSessionState,
  stepId: SequentialStepId
): boolean {
  const idx = SEQUENTIAL_STEP_IDS.indexOf(stepId);
  if (idx <= 0) return true;
  const prevId = SEQUENTIAL_STEP_IDS[idx - 1];
  if (!prevId) return false;
  const prevStatus = state.steps[prevId].status;
  return prevStatus === 'verified' || prevStatus === 'assisted';
}

/**
 * Returns a human-readable reason why a step is locked, or null if unlocked.
 */
export function getStepLockReason(
  state: SequentialSessionState,
  stepId: SequentialStepId
): string | null {
  const idx = SEQUENTIAL_STEP_IDS.indexOf(stepId);
  if (idx <= 0) return null;
  const prevId = SEQUENTIAL_STEP_IDS[idx - 1];
  if (!prevId) return null;
  const prevStatus = state.steps[prevId].status;
  if (prevStatus === 'verified' || prevStatus === 'assisted') return null;

  switch (prevId) {
    case 'flipflop':
      return 'Choose a flip-flop first';
    case 'define':
      return 'Define the machine specification first';
    case 'diagram':
      return 'Finish the state diagram first';
    case 'table':
      return 'Finish the state table first';
    case 'excitation':
      return 'Complete the excitation table first';
    case 'equations':
      return 'Derive the equations first';
    case 'lockout':
      return 'Perform lockout analysis first';
    default:
      return 'Complete prior steps first';
  }
}
