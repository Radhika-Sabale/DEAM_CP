/**
 * @file hints.ts
 * Three-tiered progressive hint ladder, state session management,
 * and no-leak invariants for Socratic tutoring.
 */

import type { Diagnosis, HintLevel, HintRecord } from '../../types/feedback';
import { getMisconception } from './misconceptions';
import { stringifyExpected, stringifyGot } from './diagnosis';
import type { DiagnosisContext, HintSession } from './types';

/**
 * Creates an empty, initialized hint session for a step.
 *
 * @param stepKey Unique key for the exercise step
 */
export function createHintSession(stepKey: string): HintSession {
  return {
    stepKey,
    levelsShown: [],
  };
}

/**
 * Result returned by requestHint containing the next hint and updated session.
 */
export interface RequestHintResult {
  readonly session: HintSession;
  readonly hint: HintRecord;
  /** True if the student unlocked Level 3 (worked step with answer revealed) */
  readonly assisted: boolean;
}

/**
 * Advances the hint ladder for a given step:
 * Level 1 (nudge) -> Level 2 (pointed) -> Level 3 (worked step) -> Repeat Level 3.
 *
 * @param session Current HintSession state
 * @param diagnosis The current active diagnosis for this step
 * @param now Current ISO 8601 timestamp string
 */
export function requestHint(
  session: HintSession,
  diagnosis: Diagnosis,
  now: string
): RequestHintResult {
  const currentCount = session.levelsShown.length;
  let nextLevel: HintLevel;

  if (currentCount === 0) {
    nextLevel = 1;
  } else if (currentCount === 1) {
    nextLevel = 2;
  } else {
    nextLevel = 3;
  }

  const expectedStr = stringifyExpected(diagnosis.expected);
  const gotStr = stringifyGot(diagnosis.got);
  const diagCtx: DiagnosisContext = {
    expected: expectedStr,
    got: gotStr,
    detail: diagnosis.fullExplanation,
  };

  let content: string;
  if (diagnosis.misconceptionTag) {
    try {
      const entry = getMisconception(diagnosis.misconceptionTag);
      switch (nextLevel) {
        case 1:
          content = entry.hints.level1(diagCtx);
          break;
        case 2:
          content = entry.hints.level2(diagCtx);
          break;
        case 3:
          content = entry.hints.level3(diagCtx);
          break;
      }
    } catch {
      content = fallbackHint(nextLevel, expectedStr);
    }
  } else {
    content = fallbackHint(nextLevel, expectedStr);
  }

  const record: HintRecord = {
    level: nextLevel,
    content,
    shownAt: now,
    stepId: session.stepKey,
  };

  const updatedSession: HintSession = {
    stepKey: session.stepKey,
    levelsShown: [...session.levelsShown, record],
  };

  return {
    session: updatedSession,
    hint: record,
    assisted: nextLevel === 3,
  };
}

function fallbackHint(level: HintLevel, expectedStr: string): string {
  switch (level) {
    case 1:
      return 'Check the governing rules and definitions for this operation.';
    case 2:
      return 'Examine your calculations and intermediate values carefully for discrepancies.';
    case 3:
      return `The correct target value for this step is: ${expectedStr}.`;
  }
}

/**
 * Generates an aggregated summary of hints used across all sessions for telemetry logging.
 *
 * @param sessions Map or record of step keys to HintSessions
 */
export function hintsUsedSummary(
  sessions: Record<string, HintSession>
): {
  readonly totalHints: number;
  readonly levelCounts: Record<HintLevel, number>;
  readonly assistedSteps: readonly string[];
} {
  let totalHints = 0;
  const levelCounts: Record<HintLevel, number> = { 1: 0, 2: 0, 3: 0 };
  const assistedSteps: string[] = [];

  for (const [stepKey, session] of Object.entries(sessions)) {
    let hasLevel3 = false;
    for (const record of session.levelsShown) {
      totalHints++;
      levelCounts[record.level] = (levelCounts[record.level] ?? 0) + 1;
      if (record.level === 3) {
        hasLevel3 = true;
      }
    }
    if (hasLevel3) {
      assistedSteps.push(stepKey);
    }
  }

  return {
    totalHints,
    levelCounts,
    assistedSteps,
  };
}

export type { HintSession };
