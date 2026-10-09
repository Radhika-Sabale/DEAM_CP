/**
 * @file prepost.ts
 * Pre-test and post-test scoring, gain metrics (raw & Hake normalized gain),
 * paired cohort inference, and counterbalanced form assignment (Stage 11B).
 */

import type { MisconceptionTag } from '../../types/feedback';
import { FORM_A_ITEMS, FORM_B_ITEMS } from './prepostData';
import { pairedTTest } from './stats';
import type {
  DetailedPrePostTestResult,
  FormOrder,
  NotEnoughDataResult,
  PairedTestStats,
  PrePostItem,
  TopicSubscore,
} from './types';

export { FORM_A_ITEMS, FORM_B_ITEMS };

// ---------------------------------------------------------------------------
// Counterbalanced Form Assignment
// ---------------------------------------------------------------------------

/**
 * Assigns Form A / Form B order deterministically to a participant using FNV-1a 32-bit hash.
 * If hash mod 2 is 0 -> { pre: 'A', post: 'B' }
 * If hash mod 2 is 1 -> { pre: 'B', post: 'A' }
 *
 * @param participantId Participant pseudonym or identifier
 */
export function assignFormOrder(participantId: string): FormOrder {
  let hash = 2166136261;
  for (let i = 0; i < participantId.length; i++) {
    hash ^= participantId.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const isAFirst = (hash % 2) === 0;
  return isAFirst ? { pre: 'A', post: 'B' } : { pre: 'B', post: 'A' };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Scores a completed pre-test or post-test submission against the official item bank.
 *
 * @param form Assessment battery ('A' or 'B')
 * @param answers Student responses keyed by item ID
 * @param submittedAt Optional ISO timestamp (defaults to 1970-01-01T00:00:00.000Z if unspecified)
 */
export function scoreTest(
  form: 'A' | 'B',
  answers: Readonly<Record<string, string>>,
  submittedAt: string = '1970-01-01T00:00:00.000Z'
): DetailedPrePostTestResult {
  const items: readonly PrePostItem[] = form === 'A' ? FORM_A_ITEMS : FORM_B_ITEMS;
  const subscoresMutable: Record<string, { score: number; maxScore: number }> = {};
  const tags: MisconceptionTag[] = [];

  let totalScore = 0;
  let unansweredCount = 0;

  for (const item of items) {
    const entry = subscoresMutable[item.topic] ?? { score: 0, maxScore: 0 };
    entry.maxScore += 1;
    subscoresMutable[item.topic] = entry;

    const studentAns = answers[item.id];
    if (studentAns === undefined || studentAns.trim() === '') {
      unansweredCount++;
      continue;
    }

    if (studentAns.trim() === item.correctAnswer.trim()) {
      totalScore += 1;
      entry.score += 1;
    } else {
      // Check if distractor maps to a known cognitive misconception
      const tag = item.distractorTags[studentAns.trim()];
      if (tag) {
        tags.push(tag);
      }
    }
  }

  const maxScore = items.length;
  const percentage = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(2)) : 0;

  const subscores: Record<string, TopicSubscore> = {};
  for (const [topic, sub] of Object.entries(subscoresMutable)) {
    subscores[topic] = { score: sub.score, maxScore: sub.maxScore };
  }

  return {
    testType: 'pretest', // Caller can cast or override if needed
    answers: { ...answers },
    score: totalScore,
    maxScore,
    percentage,
    submittedAt,
    subscores,
    unansweredCount,
    misconceptionTags: tags,
  };
}

// ---------------------------------------------------------------------------
// Gain and Cohort Statistics
// ---------------------------------------------------------------------------

/**
 * Computes raw gain: postScore - preScore.
 */
export function calculateRawGain(
  pre: { readonly score: number },
  post: { readonly score: number }
): number {
  return post.score - pre.score;
}

/**
 * Computes Hake's normalized gain (Hake 1998):
 * g = (post - pre) / (max - pre)
 *
 * Edge cases:
 * - If pre == max:
 *     - If post == max: returns 1.0 (perfect retention at ceiling)
 *     - If post < max: returns -1.0 (negative regression from ceiling)
 * - If pre > max: clamped.
 *
 * @param pre Pre-test result
 * @param post Post-test result
 */
export function calculateHakeGain(
  pre: { readonly score: number; readonly maxScore?: number },
  post: { readonly score: number }
): number {
  const max = pre.maxScore ?? 20;
  const preScore = pre.score;
  const postScore = post.score;

  if (preScore >= max) {
    return postScore >= max ? 1.0 : -1.0;
  }

  const possibleGain = max - preScore;
  const actualGain = postScore - preScore;
  const gain = actualGain / possibleGain;
  return Number(gain.toFixed(4));
}

/**
 * Evaluates paired pre/post differences across a student cohort.
 * Computes mean difference, sample standard deviation, Student's t-statistic,
 * exact two-sided p-value, and Cohen's d effect size.
 *
 * @param pairs Array of paired { pre, post } scores
 */
export function analyzePrePostCohort(
  pairs: readonly { readonly pre: number; readonly post: number }[]
): PairedTestStats | NotEnoughDataResult {
  return pairedTTest(pairs);
}
