/**
 * @file sequentialPrerequisites.ts
 * Prerequisite and readiness inspectors for the Sequential Designer module.
 */

import {
  designSequential,
  type SequentialDesign,
} from '../../engine/sequential/counterDesigner';
import { analyzeLockout } from '../../engine/sequential/lockout';
import {
  verifyExcitationTable,
  verifyStateTable,
} from '../../engine/sequential/verifyStep';
import type { DesignProject } from '../../types/designProject';
import type {
  ExcitationTable,
  FlipFlopType,
  NextStateEquations,
  SequentialSpec,
  StateTable,
} from '../../types/sequential';

/** Diagnostic report of sequential designer prerequisite readiness. */
export interface SequentialPrerequisiteReport {
  readonly isReady: boolean;
  readonly blockingErrors: readonly string[];
  readonly advisoryNotes: readonly string[];
}

/**
 * Pure extraction of sequential inputs from the active project store.
 */
export function extractSequentialInputs(project: DesignProject): {
  readonly flipFlopType: FlipFlopType | null;
  readonly sequentialSpec: SequentialSpec | null;
  readonly stateTable: StateTable | null;
  readonly excitationTable: ExcitationTable | null;
  readonly nextStateEquations: NextStateEquations | null;
} {
  return {
    flipFlopType: project.flipFlopType ?? null,
    sequentialSpec: project.sequentialSpec ?? null,
    stateTable: project.stateTable ?? null,
    excitationTable: project.excitationTable ?? null,
    nextStateEquations: project.nextStateEquations ?? null,
  };
}

/**
 * Re-derives the engine reference design directly from the project's stored specification.
 * Never trusts potentially corrupted or stale derived artifacts in the store.
 */
export function designFromProject(project: DesignProject): SequentialDesign | null {
  const spec = project.sequentialSpec;
  if (!spec) return null;
  const ff = project.flipFlopType ?? spec.flipFlop ?? 'D';
  const effectiveSpec: SequentialSpec = { ...spec, flipFlop: ff };
  const res = designSequential(effectiveSpec);
  return res.ok ? res.design : null;
}

/**
 * Validates sequential designer prerequisites and provides clear pedagogical guidance.
 */
export function validateSequentialPrerequisites(
  project: DesignProject
): readonly string[] | null {
  const report = checkSequentialReadiness(project);
  return report.blockingErrors.length > 0 ? report.blockingErrors : null;
}

/**
 * Comprehensive prerequisite and advisory inspector for the Sequential Designer.
 */
export function checkSequentialReadiness(
  project: DesignProject
): SequentialPrerequisiteReport {
  const blockingErrors: string[] = [];
  const advisoryNotes: string[] = [];

  if (!project.flipFlopType) {
    blockingErrors.push('Choose a flip-flop type first.');
  }

  if (!project.sequentialSpec) {
    blockingErrors.push('Define a counter or detector first.');
    return { isReady: false, blockingErrors, advisoryNotes };
  }

  const design = designFromProject(project);
  if (!design) {
    blockingErrors.push('Sequential specification is invalid or unsupported.');
    return { isReady: false, blockingErrors, advisoryNotes };
  }

  // 1. Check state table completeness
  if (!project.stateTable) {
    blockingErrors.push('Complete the state table.');
  } else {
    const stRes = verifyStateTable(project.stateTable, design.table);
    if (!stRes.summary.allCorrect) {
      const wrongCount = stRes.summary.total - stRes.summary.correctCount;
      blockingErrors.push(`Complete the state table (${wrongCount} cell(s) still wrong).`);
    }
  }

  // 2. Check excitation table completeness
  if (!project.excitationTable) {
    blockingErrors.push('Complete the excitation table.');
  } else {
    const exRes = verifyExcitationTable(project.excitationTable, design.excitation);
    if (!exRes.summary.allCorrect) {
      blockingErrors.push('Complete the excitation table.');
    }
  }

  // 3. Check equation derivation
  if (!project.nextStateEquations) {
    blockingErrors.push('Derive the equations.');
  } else {
    for (const fn of design.functions) {
      const studentAst = project.nextStateEquations[fn.name];
      if (!studentAst) {
        blockingErrors.push(`Derive equation for ${fn.name}.`);
        break;
      }
    }
  }

  // 4. Lockout advisory
  const lockAnalysis = analyzeLockout({
    table: design.table,
    equations: design.equations,
    flipFlop: project.flipFlopType ?? design.spec.flipFlop ?? 'D',
  });
  if (!lockAnalysis.isSelfCorrecting) {
    const count = lockAnalysis.lockedStates.length + lockAnalysis.indeterminateStates.length;
    advisoryNotes.push(
      `Design has ${count} lockout-prone or indeterminate unused state(s). Consider applying an automated lockout fix.`
    );
  }

  return {
    isReady: blockingErrors.length === 0,
    blockingErrors,
    advisoryNotes,
  };
}
