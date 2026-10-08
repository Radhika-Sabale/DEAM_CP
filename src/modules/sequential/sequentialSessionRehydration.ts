/**
 * @file sequentialSessionRehydration.ts
 * Re-derives the sequential designer session from a DesignProject entity.
 * Restores verified status only for stored artifacts matching the active specification.
 */

import type { DesignProject } from '../../types/designProject';
import type { FlipFlopType } from '../../types/sequential';
import {
  type SequentialStepId,
  type SequentialStepState,
  type SequentialSessionState,
  SEQUENTIAL_STEP_IDS,
  isStepUnlocked,
} from './sequentialSessionTypes';

/**
 * Re-derives the sequential designer session from a DesignProject.
 * Restores verified status only for stored artifacts matching the active specification.
 *
 * @param project The saved project entity
 * @returns Rehydrated session state
 */
export function deriveSessionFromProject(
  project: DesignProject
): SequentialSessionState {
  const spec = project.sequentialSpec ?? null;
  const ffType: FlipFlopType | null =
    project.flipFlopType ?? (spec?.flipFlop ? spec.flipFlop : null);
  const kind = spec?.kind === 'detector' ? 'detector' : 'counter';
  const isAsync = spec?.kind === 'counter' && spec.style === 'async';

  const steps = {} as Record<SequentialStepId, SequentialStepState>;
  for (const s of SEQUENTIAL_STEP_IDS) {
    steps[s] = { status: 'not-started', draft: null };
  }

  // 1. Flip-flop selection
  if (ffType) {
    steps.flipflop = { status: 'verified', draft: ffType };
  }

  // 2. Machine definition
  if (spec) {
    steps.define = { status: 'verified', draft: spec };
  }

  // 3. State diagram
  if (isAsync) {
    steps.diagram = {
      status: 'verified',
      draft: 'Asynchronous ripple counters follow a fixed pattern; see the design on the next step',
    };
  } else if (project.stateDiagram) {
    steps.diagram = { status: 'verified', draft: project.stateDiagram };
  }

  // 4. State table
  if (project.stateTable) {
    steps.table = { status: 'verified', draft: project.stateTable };
  }

  // 5. Excitation table
  if (project.excitationTable) {
    steps.excitation = { status: 'verified', draft: project.excitationTable };
  }

  // 6. Next-state equations
  if (project.nextStateEquations) {
    steps.equations = { status: 'verified', draft: project.nextStateEquations };
  }

  // 7. Simulation trace
  if (project.simulationTrace) {
    steps.simulate = { status: 'verified', draft: project.simulationTrace };
  }

  // Find first non-verified/assisted step that is unlocked, or default to 'flipflop'
  const tempState: SequentialSessionState = {
    spec,
    currentStep: 'flipflop',
    steps,
    kind,
  };

  let firstActive: SequentialStepId = 'flipflop';
  for (const s of SEQUENTIAL_STEP_IDS) {
    const st = steps[s].status;
    if (st !== 'verified' && st !== 'assisted') {
      if (isStepUnlocked(tempState, s)) {
        firstActive = s;
      }
      break;
    }
  }

  return {
    ...tempState,
    currentStep: firstActive,
  };
}
