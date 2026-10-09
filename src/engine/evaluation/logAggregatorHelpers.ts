/**
 * @file logAggregatorHelpers.ts
 * Helper aggregation builders for module summaries, misconception rankings,
 * handoff pipelines, and pre/post diagnostics (Stage 11B).
 */

import { getMisconception } from '../feedback/misconceptions';
import type { MisconceptionTag } from '../../types/feedback';
import type { LogEvent, MisconceptionCount, ModuleSummary } from '../../types/logging';
import { calculateHakeGain, calculateRawGain, analyzePrePostCohort } from './prepost';
import type { HandoffEdgeCount, MisconceptionRankingRow, PrePostSummary } from './types';

export function buildMisconceptionRankings(
  tagCounts: ReadonlyMap<MisconceptionTag, number>,
  tagParticipants: ReadonlyMap<MisconceptionTag, Set<string>>,
  tagModules: ReadonlyMap<MisconceptionTag, Set<string>>,
  totalErrors: number
): readonly MisconceptionRankingRow[] {
  const rankings: MisconceptionRankingRow[] = [];
  for (const [tag, count] of tagCounts.entries()) {
    let title = tag as string;
    try {
      title = getMisconception(tag).title;
    } catch {
      // Fallback
    }
    const distinctP = tagParticipants.get(tag)?.size ?? 0;
    const errorShare = totalErrors > 0 ? Number((count / totalErrors).toFixed(4)) : 0;
    const mods = Array.from(tagModules.get(tag) ?? []).sort();
    rankings.push({
      tag,
      title,
      count,
      distinctParticipants: distinctP,
      errorShare,
      affectedModules: mods,
    });
  }

  rankings.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.distinctParticipants !== a.distinctParticipants) return b.distinctParticipants - a.distinctParticipants;
    return a.tag.localeCompare(b.tag);
  });

  return rankings;
}

export function buildModuleSummaries(
  moduleEvents: ReadonlyMap<string, LogEvent[]>
): readonly ModuleSummary[] {
  const summaries: ModuleSummary[] = [];
  for (const [mId, mEvents] of moduleEvents.entries()) {
    let completedCount = 0;
    let durationSum = 0;
    let hintsCount = 0;
    const modTagCounts = new Map<MisconceptionTag, { count: number; pSet: Set<string> }>();

    for (const ev of mEvents) {
      const pid = ev.participantId ?? ev.sessionId;
      switch (ev.eventType) {
        case 'module-completed':
          completedCount++;
          durationSum += ev.durationMs;
          break;
        case 'hint-used':
          hintsCount++;
          break;
        case 'step-submitted':
          if (!ev.isCorrect && ev.misconceptionTag) {
            let entry = modTagCounts.get(ev.misconceptionTag);
            if (!entry) {
              entry = { count: 0, pSet: new Set<string>() };
              modTagCounts.set(ev.misconceptionTag, entry);
            }
            entry.count++;
            entry.pSet.add(pid);
          }
          break;
      }
    }

    const topMisconceptions: MisconceptionCount[] = Array.from(modTagCounts.entries())
      .map(([mTag, data]) => ({
        misconceptionTag: mTag,
        count: data.count,
        studentCount: data.pSet.size,
        affectedModuleIds: [mId],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    summaries.push({
      moduleId: mId,
      completedCount,
      averageDurationMs: completedCount > 0 ? Math.round(durationSum / completedCount) : 0,
      totalHintsRequested: hintsCount,
      topMisconceptions,
    });
  }
  summaries.sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  return summaries;
}

export function buildHandoffCounts(
  handoffsLogged: ReadonlyMap<string, number>,
  moduleStarters: ReadonlyMap<string, Set<string>>
): readonly HandoffEdgeCount[] {
  const handoffCounts: HandoffEdgeCount[] = [];
  const standardEdges: [string, string][] = [
    ['boolean-tool', 'kmap-solver'],
    ['kmap-solver', 'circuit-simulator'],
    ['flipflop-simulator', 'sequential-designer'],
  ];
  for (const [from, to] of standardEdges) {
    const edgeKey = `${from}->${to}`;
    const completed = handoffsLogged.get(edgeKey) ?? 0;
    const startersFrom = moduleStarters.get(from)?.size ?? 0;
    const dropouts = Math.max(0, startersFrom - completed);
    handoffCounts.push({
      fromModuleId: from,
      toModuleId: to,
      completedHandoffs: completed,
      dropouts,
    });
  }
  return handoffCounts;
}

export function buildPrePostSummary(
  participants: ReadonlySet<string>,
  preScores: ReadonlyMap<string, number>,
  postScores: ReadonlyMap<string, number>
): { readonly summary: PrePostSummary; readonly exclusionReasons: readonly string[] } {
  const pairedList: { pre: number; post: number }[] = [];
  const exclusionReasons: string[] = [];

  for (const pid of participants) {
    const pre = preScores.get(pid);
    const post = postScores.get(pid);
    if (pre !== undefined && post !== undefined) {
      pairedList.push({ pre, post });
    } else if (pre !== undefined && post === undefined) {
      exclusionReasons.push(`Participant "${pid}": submitted pretest but missing posttest`);
    } else if (pre === undefined && post !== undefined) {
      exclusionReasons.push(`Participant "${pid}": submitted posttest without pretest baseline`);
    }
  }

  let meanRawGain: number | null = null;
  let meanHakeGain: number | null = null;
  if (pairedList.length > 0) {
    const rawGains = pairedList.map((p) => calculateRawGain({ score: p.pre }, { score: p.post }));
    const hakeGains = pairedList.map((p) => calculateHakeGain({ score: p.pre, maxScore: 20 }, { score: p.post }));
    meanRawGain = Number((rawGains.reduce((a, b) => a + b, 0) / pairedList.length).toFixed(4));
    meanHakeGain = Number((hakeGains.reduce((a, b) => a + b, 0) / pairedList.length).toFixed(4));
  }

  const pairedStats = analyzePrePostCohort(pairedList);
  return {
    summary: {
      totalPreSubmissions: preScores.size,
      totalPostSubmissions: postScores.size,
      pairedParticipantsCount: pairedList.length,
      meanRawGain,
      meanHakeGain,
      pairedStats,
    },
    exclusionReasons,
  };
}
