/**
 * @file logAggregator.ts
 * Telemetry log aggregation engine for instructor analytics, research dashboards,
 * misconception ranking, answer-trap detection, and pipeline dropouts (Stage 11B).
 */

import type { MisconceptionTag } from '../../types/feedback';
import type { LogEvent } from '../../types/logging';
import {
  buildHandoffCounts,
  buildMisconceptionRankings,
  buildModuleSummaries,
  buildPrePostSummary,
} from './logAggregatorHelpers';
import { aggregateSus } from './sus';
import type { DashboardModel, EvaluationFilter } from './types';

/**
 * Aggregates telemetry event logs into a comprehensive, JSON-serializable DashboardModel.
 * Order-independent (produces identical outputs regardless of event input order).
 *
 * @param rawEvents Chronological or un-ordered telemetry events
 * @param filter Optional multi-parameter filter
 */
export function aggregate(
  rawEvents: readonly LogEvent[],
  filter?: EvaluationFilter
): DashboardModel {
  // 1. Apply filters
  let filtered = rawEvents;
  if (filter) {
    filtered = rawEvents.filter((ev) => {
      if (filter.participantId && ev.participantId !== filter.participantId) return false;
      if (filter.sessionId && ev.sessionId !== filter.sessionId) return false;
      if (filter.moduleId && ev.moduleId !== filter.moduleId) return false;
      if (filter.dateRange) {
        if (filter.dateRange.start && ev.timestamp < filter.dateRange.start) return false;
        if (filter.dateRange.end && ev.timestamp > filter.dateRange.end) return false;
      }
      return true;
    });
  }

  // 2. Sort deterministically to ensure order invariance
  const events = Array.from(filtered).sort((a, b) => {
    const tCmp = a.timestamp.localeCompare(b.timestamp);
    if (tCmp !== 0) return tCmp;
    return a.id.localeCompare(b.id);
  });

  const participants = new Set<string>();
  const moduleEvents = new Map<string, LogEvent[]>();
  const stepSubmissions = new Map<string, { hadWrong: boolean; hadHint: boolean; finalCorrect: boolean }>();
  const handoffsLogged = new Map<string, number>();
  const moduleStarters = new Map<string, Set<string>>();

  const preScores = new Map<string, number>();
  const postScores = new Map<string, number>();
  const susScores: number[] = [];
  const quizScoresByTopic = new Map<string, number[]>();

  const tagCounts = new Map<MisconceptionTag, number>();
  const tagParticipants = new Map<MisconceptionTag, Set<string>>();
  const tagModules = new Map<MisconceptionTag, Set<string>>();
  let totalErrors = 0;

  const stepKindErrors = new Map<string, { errors: number; total: number }>();

  for (const ev of events) {
    const pid = ev.participantId ?? ev.sessionId;
    participants.add(pid);

    let mList = moduleEvents.get(ev.moduleId);
    if (!mList) {
      mList = [];
      moduleEvents.set(ev.moduleId, mList);
    }
    mList.push(ev);

    let starters = moduleStarters.get(ev.moduleId);
    if (!starters) {
      starters = new Set<string>();
      moduleStarters.set(ev.moduleId, starters);
    }
    starters.add(pid);

    switch (ev.eventType) {
      case 'step-submitted': {
        const stepKey = `${pid}:${ev.stepId}`;
        let record = stepSubmissions.get(stepKey);
        if (!record) {
          record = { hadWrong: false, hadHint: false, finalCorrect: false };
          stepSubmissions.set(stepKey, record);
        }
        if (!ev.isCorrect) {
          record.hadWrong = true;
          totalErrors++;
          if (ev.misconceptionTag) {
            tagCounts.set(ev.misconceptionTag, (tagCounts.get(ev.misconceptionTag) ?? 0) + 1);
            let pSet = tagParticipants.get(ev.misconceptionTag);
            if (!pSet) {
              pSet = new Set<string>();
              tagParticipants.set(ev.misconceptionTag, pSet);
            }
            pSet.add(pid);

            let mSet = tagModules.get(ev.misconceptionTag);
            if (!mSet) {
              mSet = new Set<string>();
              tagModules.set(ev.misconceptionTag, mSet);
            }
            mSet.add(ev.moduleId);
          }
        } else {
          record.finalCorrect = true;
        }

        const prefix = ev.stepId.split('-')[0] || 'general';
        let sk = stepKindErrors.get(prefix);
        if (!sk) {
          sk = { errors: 0, total: 0 };
          stepKindErrors.set(prefix, sk);
        }
        sk.total++;
        if (!ev.isCorrect) sk.errors++;
        break;
      }
      case 'hint-used': {
        const stepKey = `${pid}:${ev.stepId}`;
        let record = stepSubmissions.get(stepKey);
        if (!record) {
          record = { hadWrong: false, hadHint: true, finalCorrect: false };
          stepSubmissions.set(stepKey, record);
        } else {
          record.hadHint = true;
        }
        break;
      }
      case 'module-handoff': {
        const edge = `${ev.fromModuleId}->${ev.toModuleId}`;
        handoffsLogged.set(edge, (handoffsLogged.get(edge) ?? 0) + 1);
        break;
      }
      case 'quiz-answered': {
        let qList = quizScoresByTopic.get(ev.moduleId);
        if (!qList) {
          qList = [];
          quizScoresByTopic.set(ev.moduleId, qList);
        }
        qList.push(ev.isCorrect ? 100 : 0);
        break;
      }
      case 'pretest/posttest-submitted': {
        if (ev.testType === 'pretest') preScores.set(pid, ev.score);
        else if (ev.testType === 'posttest') postScores.set(pid, ev.score);
        break;
      }
      case 'sus-submitted': {
        susScores.push(ev.score);
        break;
      }
    }
  }

  let answerTrapCount = 0;
  for (const record of stepSubmissions.values()) {
    if (record.finalCorrect && (record.hadWrong || record.hadHint)) {
      answerTrapCount++;
    }
  }

  const misconceptionRankings = buildMisconceptionRankings(
    tagCounts,
    tagParticipants,
    tagModules,
    totalErrors
  );
  const moduleSummaries = buildModuleSummaries(moduleEvents);
  const handoffCounts = buildHandoffCounts(handoffsLogged, moduleStarters);
  const { summary: prePostSummary, exclusionReasons } = buildPrePostSummary(
    participants,
    preScores,
    postScores
  );

  const stepKindErrorRates: Record<string, number> = {};
  for (const [kind, data] of stepKindErrors.entries()) {
    stepKindErrorRates[kind] = data.total > 0 ? Number((data.errors / data.total).toFixed(4)) : 0;
  }

  const susSummary = susScores.length > 0 ? aggregateSus(susScores) : null;
  const quizTopicDistributions: Record<string, readonly number[]> = {};
  for (const [top, vals] of quizScoresByTopic.entries()) {
    quizTopicDistributions[top] = vals;
  }

  return {
    participantsCount: participants.size,
    moduleSummaries,
    misconceptionRankings,
    stepKindErrorRates,
    answerTrapCount,
    handoffCounts,
    quizTopicDistributions,
    prePostSummary,
    susSummary,
    excludedCount: exclusionReasons.length,
    exclusionReasons,
  };
}
