/**
 * @file sus.ts
 * Standard System Usability Scale (SUS) item definitions, scoring, interpretation,
 * and cohort aggregation (Brooke 1996, Bangor et al. 2008/2009).
 */

import type { SusResponse, SusResult } from '../../types/logging';
import { getTCritical95, mean, median, sampleStandardDeviation } from './stats';
import type { SusAggregate, SusInterpretation, SusScoreError } from './types';

// ---------------------------------------------------------------------------
// Standard 10 SUS Questionnaire Items (Brooke 1996)
// ---------------------------------------------------------------------------

/**
 * The 10 official SUS survey items in canonical order.
 * Odd-indexed items (0, 2, 4, 6, 8) are positively phrased.
 * Even-indexed items (1, 3, 5, 7, 9) are negatively phrased.
 */
export const SUS_ITEMS: readonly string[] = [
  'I think that I would like to use this system frequently.',
  'I found the system unnecessarily complex.',
  'I thought the system was easy to use.',
  'I think that I would need the support of a technical person to be able to use this system.',
  'I found the various functions in this system were well integrated.',
  'I thought there was too much inconsistency in this system.',
  'I would imagine that most people would learn to use this system very quickly.',
  'I found the system very cumbersome to use.',
  'I felt very confident using the system.',
  'I needed to learn a lot of things before I could get going with this system.',
] as const;

/** Industry-standard SUS average benchmark across 500+ usability studies (Sauro 2011). */
export const SUS_BENCHMARK = 68.0;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type ScoreSusResult =
  | { readonly ok: true; readonly value: SusResult & { readonly itemScores: readonly number[] } }
  | { readonly ok: false; readonly error: SusScoreError };

/**
 * Validates responses and calculates Brooke's System Usability Scale score (0..100).
 *
 * Scoring algorithm:
 * - Odd items (1, 3, 5, 7, 9): score contribution = response - 1 (0..4)
 * - Even items (2, 4, 6, 8, 10): score contribution = 5 - response (0..4)
 * - Overall score = sum of contributions * 2.5
 *
 * @param responses SUS response tuple or raw number array
 */
export function scoreSus(responses: SusResponse | readonly number[] | unknown): ScoreSusResult {
  const items: readonly unknown[] =
    typeof responses === 'object' && responses !== null && 'items' in responses
      ? (responses as SusResponse).items
      : Array.isArray(responses)
        ? responses
        : [];

  const invalidItems: number[] = [];

  if (items.length !== 10) {
    for (let i = 0; i < 10; i++) {
      if (items[i] === undefined) invalidItems.push(i + 1);
    }
  }

  const numericItems: number[] = [];
  for (let i = 0; i < 10; i++) {
    const val = items[i];
    if (typeof val !== 'number' || !Number.isInteger(val) || val < 1 || val > 5) {
      if (!invalidItems.includes(i + 1)) invalidItems.push(i + 1);
    } else {
      numericItems.push(val);
    }
  }

  if (invalidItems.length > 0) {
    return {
      ok: false,
      error: {
        code: 'sus-invalid-input',
        invalidItems,
        message: `SUS requires 10 integer answers between 1 and 5. Invalid or missing items: [${invalidItems.join(', ')}]`,
      },
    };
  }

  // Calculate Brooke item contributions and overall score
  const itemScores: number[] = [];
  let sumContributions = 0;

  for (let i = 0; i < 10; i++) {
    const resp = numericItems[i];
    if (resp === undefined) continue;
    // i is 0-indexed: even indices correspond to odd items (1st, 3rd, 5th, etc.)
    const contrib = i % 2 === 0 ? resp - 1 : 5 - resp;
    itemScores.push(contrib);
    sumContributions += contrib;
  }

  const rawScore = sumContributions * 2.5;
  const score = Math.round(rawScore * 10) / 10;

  const validResponse: SusResponse = {
    items: numericItems as unknown as SusResponse['items'],
  };

  return {
    ok: true,
    value: {
      score,
      rawResponses: validResponse,
      itemScores,
    },
  };
}

// ---------------------------------------------------------------------------
// Interpretation
// ---------------------------------------------------------------------------

/**
 * Maps a SUS score to qualitative adjective bands and Bangor/Kortum letter grades.
 *
 * @param score Numeric SUS score (0..100)
 * @param itemScores Optional 10 individual Brooke item score contributions (0..4)
 */
export function interpretSus(score: number, itemScores: readonly number[] = []): SusInterpretation {
  const boundedScore = Math.max(0, Math.min(100, score));

  let adjectiveBand: SusInterpretation['adjectiveBand'];
  let grade: SusInterpretation['grade'];

  if (boundedScore >= 85) {
    adjectiveBand = 'Best Imaginable';
    grade = 'A';
  } else if (boundedScore >= 70) {
    adjectiveBand = 'Good';
    grade = 'B';
  } else if (boundedScore >= SUS_BENCHMARK) {
    adjectiveBand = 'Good';
    grade = 'C';
  } else if (boundedScore >= 50) {
    adjectiveBand = 'OK';
    grade = 'D';
  } else {
    adjectiveBand = 'Poor';
    grade = 'F';
  }

  return {
    score: boundedScore,
    benchmark: SUS_BENCHMARK,
    adjectiveBand,
    grade,
    isAcceptable: boundedScore >= SUS_BENCHMARK,
    itemScores,
    note: 'The SUS score is a composite usability index and percentile indicator, not a percentage score.',
  };
}

// ---------------------------------------------------------------------------
// Cohort Aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregates a cohort of SUS results, computing mean, sample standard deviation,
 * median, range, and a 95% confidence interval for the mean using the Student's t-distribution.
 *
 * @param results Array of SusResult objects or numeric scores
 */
export function aggregateSus(
  results: readonly (SusResult | number | { readonly score: number })[]
): SusAggregate {
  if (results.length === 0) {
    return {
      count: 0,
      mean: 0,
      sd: 0,
      median: 0,
      min: 0,
      max: 0,
      ci95: [0, 0],
    };
  }

  const scores = results.map((r) => (typeof r === 'number' ? r : r.score));
  const n = scores.length;
  const m = mean(scores);
  const sd = sampleStandardDeviation(scores);
  const med = median(scores);
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  let ci95: [number, number] = [Number(m.toFixed(2)), Number(m.toFixed(2))];
  if (n > 1) {
    const df = n - 1;
    const tCrit = getTCritical95(df);
    const margin = (tCrit * sd) / Math.sqrt(n);
    ci95 = [
      Number(Math.max(0, m - margin).toFixed(2)),
      Number(Math.min(100, m + margin).toFixed(2)),
    ];
  }

  return {
    count: n,
    mean: Number(m.toFixed(2)),
    sd: Number(sd.toFixed(2)),
    median: Number(med.toFixed(2)),
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    ci95,
  };
}
