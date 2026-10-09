/**
 * @file csvImportEventParsers.ts
 * Deserialization and parsing helpers for specific LogEvent types from CSV rows (Stage 11B).
 */

import type { HintLevel, MisconceptionTag } from '../../types/feedback';
import type {
  BaseLogEvent,
  HintUsedEvent,
  LogEvent,
  ModuleCompletedEvent,
  ModuleHandoffEvent,
  PracticeStartedEvent,
  PrePostTestSubmittedEvent,
  QuizAnsweredEvent,
  StepStartedEvent,
  StepSubmittedEvent,
  SusSubmittedEvent,
} from '../../types/logging';

/**
 * Removes the spreadsheet injection prefix if present.
 */
export function unescapeInjection(val: string): string {
  if (val.startsWith("'") && val.length > 1) {
    const nextChar = val[1];
    if (nextChar === '=' || nextChar === '+' || nextChar === '-' || nextChar === '@') {
      return val.slice(1);
    }
  }
  return val;
}

/**
 * Parses individual event subtypes from validated row fields.
 */
export function parseEventRow(
  eventType: string,
  base: BaseLogEvent,
  get: (col: string) => string
): LogEvent {
  const stepId = get('stepId');
  const isCorrectStr = get('isCorrect');
  const tag = get('misconceptionTag');
  const hintLevel = get('hintLevel');
  const scoreStr = get('score');
  const detailsStr = get('details');

  switch (eventType) {
    case 'step-started': {
      if (!stepId) throw new Error('step-started requires stepId');
      return { ...base, eventType, stepId } as StepStartedEvent;
    }
    case 'step-submitted': {
      if (!stepId) throw new Error('step-submitted requires stepId');
      const isCorrect = isCorrectStr === 'true';
      const score = scoreStr !== '' ? Number(scoreStr) : undefined;
      const misconceptionTag = tag ? (tag as MisconceptionTag) : undefined;
      return {
        ...base,
        eventType,
        stepId,
        isCorrect,
        misconceptionTag,
        score,
      } as StepSubmittedEvent;
    }
    case 'hint-used': {
      if (!stepId || !hintLevel) throw new Error('hint-used requires stepId and hintLevel');
      const lvlNum = Number(hintLevel);
      const lvl: HintLevel = lvlNum === 2 ? 2 : lvlNum === 3 ? 3 : 1;
      return { ...base, eventType, stepId, level: lvl } as HintUsedEvent;
    }
    case 'module-completed': {
      const det = detailsStr ? JSON.parse(detailsStr) : {};
      const durationMs = typeof det.durationMs === 'number' ? det.durationMs : 0;
      const finalScore = scoreStr !== '' ? Number(scoreStr) : undefined;
      return { ...base, eventType, durationMs, finalScore } as ModuleCompletedEvent;
    }
    case 'module-handoff': {
      const det = detailsStr ? JSON.parse(detailsStr) : {};
      return {
        ...base,
        eventType,
        fromModuleId: det.from ?? base.moduleId,
        toModuleId: det.to ?? '',
        payloadSummary: det.payload ?? undefined,
      } as ModuleHandoffEvent;
    }
    case 'practice-started': {
      const det = detailsStr ? JSON.parse(detailsStr) : {};
      return {
        ...base,
        eventType,
        exerciseId: det.exerciseId ?? '',
        category: det.category ?? undefined,
      } as PracticeStartedEvent;
    }
    case 'quiz-answered': {
      const det = detailsStr ? JSON.parse(detailsStr) : {};
      return {
        ...base,
        eventType,
        questionId: stepId,
        selectedOption: det.selectedOption ?? '',
        isCorrect: isCorrectStr === 'true',
      } as QuizAnsweredEvent;
    }
    case 'pretest/posttest-submitted': {
      const det = detailsStr ? JSON.parse(detailsStr) : {};
      const testType = det.testType === 'posttest' ? 'posttest' : 'pretest';
      const maxScore = typeof det.maxScore === 'number' ? det.maxScore : 20;
      return {
        ...base,
        eventType,
        testType,
        score: Number(scoreStr || 0),
        maxScore,
      } as PrePostTestSubmittedEvent;
    }
    case 'sus-submitted': {
      const responses = detailsStr ? JSON.parse(detailsStr) : { items: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3] };
      return {
        ...base,
        eventType,
        score: Number(scoreStr || 0),
        responses,
      } as SusSubmittedEvent;
    }
    default:
      throw new Error(`Unknown eventType: "${eventType}"`);
  }
}
