/**
 * @file sessionSummary.ts
 * Computes per-session active duration, step attempts, first-try accuracy,
 * hint usage, and module completion metrics for researcher summary tables (Stage 11B).
 */

import type { LogEvent } from '../../types/logging';
import type { SessionSummaryRow } from './types';

export const SUMMARY_CSV_COLUMNS = [
  'participantId',
  'sessionId',
  'startTime',
  'endTime',
  'durationMs',
  'stepsAttempted',
  'stepsCorrectFirstTry',
  'errorCount',
  'hintsUsedL1',
  'hintsUsedL2',
  'hintsUsedL3',
  'assistedSteps',
  'modulesCompleted',
  'quizScore',
  'preScore',
  'postScore',
  'susScore',
] as const;

/**
 * Aggregates raw telemetry events into per-session summary records.
 *
 * @param events Telemetry log events
 */
export function summarizeSessions(events: readonly LogEvent[]): readonly SessionSummaryRow[] {
  const sessions = new Map<string, LogEvent[]>();

  for (const ev of events) {
    const key = `${ev.participantId ?? 'anon'}:${ev.sessionId}`;
    let list = sessions.get(key);
    if (!list) {
      list = [];
      sessions.set(key, list);
    }
    list.push(ev);
  }

  const summaries: SessionSummaryRow[] = [];

  for (const [, sEvents] of sessions.entries()) {
    sEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
    const first = sEvents[0];
    const last = sEvents[sEvents.length - 1];
    if (!first || !last) continue;

    const participantId = first.participantId ?? '';
    const sessionId = first.sessionId;
    const startTime = first.timestamp;
    const endTime = last.timestamp;

    let activeDurationMs = 0;
    const stepStartTimes = new Map<string, number>();
    const stepFirstAttemptCorrect = new Map<string, boolean>();
    const assistedStepIds = new Set<string>();

    let errors = 0;
    let h1 = 0;
    let h2 = 0;
    let h3 = 0;
    let completedModules = 0;
    let quizSum = 0;
    let quizCount = 0;
    let preScore: number | null = null;
    let postScore: number | null = null;
    let susScore: number | null = null;

    for (const ev of sEvents) {
      const t = Date.parse(ev.timestamp);

      switch (ev.eventType) {
        case 'step-started':
          stepStartTimes.set(ev.stepId, t);
          break;
        case 'step-submitted': {
          const start = stepStartTimes.get(ev.stepId);
          if (start !== undefined && t >= start) {
            activeDurationMs += t - start;
            stepStartTimes.delete(ev.stepId);
          }
          if (!stepFirstAttemptCorrect.has(ev.stepId)) {
            stepFirstAttemptCorrect.set(ev.stepId, ev.isCorrect);
          }
          if (!ev.isCorrect) errors++;
          break;
        }
        case 'hint-used':
          assistedStepIds.add(ev.stepId);
          if (ev.level === 1) h1++;
          else if (ev.level === 2) h2++;
          else if (ev.level === 3) h3++;
          break;
        case 'module-completed':
          completedModules++;
          if (activeDurationMs === 0 && ev.durationMs > 0) {
            activeDurationMs += ev.durationMs;
          }
          break;
        case 'quiz-answered':
          quizCount++;
          if (ev.isCorrect) quizSum++;
          break;
        case 'pretest/posttest-submitted':
          if (ev.testType === 'pretest') preScore = ev.score;
          else if (ev.testType === 'posttest') postScore = ev.score;
          break;
        case 'sus-submitted':
          susScore = ev.score;
          break;
      }
    }

    let correctFirstTry = 0;
    for (const isCorrect of stepFirstAttemptCorrect.values()) {
      if (isCorrect) correctFirstTry++;
    }

    summaries.push({
      participantId,
      sessionId,
      startTime,
      endTime,
      durationMs: activeDurationMs,
      stepsAttempted: stepFirstAttemptCorrect.size,
      stepsCorrectFirstTry: correctFirstTry,
      errorCount: errors,
      hintsUsedL1: h1,
      hintsUsedL2: h2,
      hintsUsedL3: h3,
      assistedSteps: assistedStepIds.size,
      modulesCompleted: completedModules,
      quizScore: quizCount > 0 ? Number(((quizSum / quizCount) * 100).toFixed(1)) : null,
      preScore,
      postScore,
      susScore,
    });
  }

  // Stable sort: by startTime, then participantId, then sessionId
  summaries.sort((a, b) => {
    const tCmp = a.startTime.localeCompare(b.startTime);
    if (tCmp !== 0) return tCmp;
    const pCmp = a.participantId.localeCompare(b.participantId);
    if (pCmp !== 0) return pCmp;
    return a.sessionId.localeCompare(b.sessionId);
  });

  return summaries;
}
