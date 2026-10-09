/**
 * @file stats.ts
 * Pure statistical helpers and sample inference methods (Stage 11B).
 *
 * Implements descriptive statistics (mean, median, sample standard deviation)
 * and paired t-test inference comparing pre/post student evaluations.
 */

import { getTCritical95, studentTTwoSidedPValue } from './statsDistributions';
import type { NotEnoughDataResult, PairedTestStats } from './types';

export { getTCritical95, studentTTwoSidedPValue };
export { incBeta } from './statsDistributions';

// ---------------------------------------------------------------------------
// Basic Descriptive Statistics
// ---------------------------------------------------------------------------

/**
 * Computes the arithmetic mean of an array of numbers.
 *
 * @param values Numbers to average
 * @returns Arithmetic mean, or 0 if array is empty
 */
export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) {
    sum += v;
  }
  return sum / values.length;
}

/**
 * Computes the sample standard deviation (Bessel's correction, N - 1 denominator).
 *
 * @param values Sample values
 * @returns Sample standard deviation, or 0 if sample size < 2
 */
export function sampleStandardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let sumSqDiff = 0;
  for (const v of values) {
    const diff = v - m;
    sumSqDiff += diff * diff;
  }
  return Math.sqrt(sumSqDiff / (values.length - 1));
}

/**
 * Computes the median of an array of numbers.
 *
 * @param values Input numbers (does not mutate input array)
 * @returns Median value, or 0 if empty
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const midVal = sorted[mid] ?? 0;
  if (sorted.length % 2 === 1) {
    return midVal;
  }
  const prevVal = sorted[mid - 1] ?? 0;
  return (prevVal + midVal) / 2;
}

// ---------------------------------------------------------------------------
// Paired Samples Inference
// ---------------------------------------------------------------------------

/**
 * Performs a paired t-test comparing paired (pre, post) numeric observations.
 * Returns a typed error result if fewer than 2 pairs are supplied.
 *
 * @param pairs Array of paired { pre, post } scores
 */
export function pairedTTest(
  pairs: readonly { readonly pre: number; readonly post: number }[]
): PairedTestStats | NotEnoughDataResult {
  if (pairs.length < 2) {
    return {
      code: 'not-enough-data',
      message: `At least 2 paired observations are required (received ${pairs.length}).`,
    };
  }

  const diffs = pairs.map((p) => p.post - p.pre);
  const n = diffs.length;
  const meanDiff = mean(diffs);
  const sdDiff = sampleStandardDeviation(diffs);
  const seDiff = sdDiff / Math.sqrt(n);
  const df = n - 1;

  let t = 0;
  let pValue = 1.0;
  let cohensD = 0;

  if (sdDiff > 1e-9) {
    t = meanDiff / seDiff;
    pValue = studentTTwoSidedPValue(t, df);
    cohensD = meanDiff / sdDiff;
  } else if (Math.abs(meanDiff) > 1e-9) {
    // Zero variance in differences but non-zero mean diff
    t = meanDiff > 0 ? Infinity : -Infinity;
    pValue = 0;
    cohensD = meanDiff > 0 ? Infinity : -Infinity;
  }

  return {
    count: n,
    meanDiff: Number(meanDiff.toFixed(4)),
    sdDiff: Number(sdDiff.toFixed(4)),
    seDiff: Number(seDiff.toFixed(4)),
    t: Number(t.toFixed(4)),
    df,
    pValue: Number(pValue.toFixed(6)),
    cohensD: Number(cohensD.toFixed(4)),
  };
}
