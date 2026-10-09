/**
 * @file DashboardPrePostTab.tsx
 * Pre/Post diagnostic test evaluation, paired statistics, normalized gains, and effect sizes (Stage 11C).
 */

import React from 'react';
import type { PairedTestStats, PrePostSummary } from '../../engine/evaluation/types';

interface DashboardPrePostTabProps {
  readonly summary: PrePostSummary;
  readonly excludedCount: number;
}

export const DashboardPrePostTab: React.FC<DashboardPrePostTabProps> = ({
  summary,
  excludedCount,
}) => {
  const isNotEnough = 'code' in summary.pairedStats && summary.pairedStats.code === 'not-enough-data';
  const paired: PairedTestStats | null = !isNotEnough ? (summary.pairedStats as PairedTestStats) : null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Pre/Post Diagnostic Assessment Analytics
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Evaluates learning gains, normalized Hake gain, and statistical effect size for paired participants.
        </p>
      </div>

      {/* Cohort Counts Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Pre-Test Submissions</span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {summary.totalPreSubmissions}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Post-Test Submissions</span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {summary.totalPostSubmissions}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Paired Participants (N)</span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {summary.pairedParticipantsCount}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Excluded Incomplete</span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {excludedCount}
          </p>
        </div>
      </div>

      {/* Gain & Effect Size Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Mean Raw Score Gain</span>
          <p className="mt-1 text-3xl font-bold tracking-tight text-green-600 dark:text-green-400">
            {summary.meanRawGain !== null ? `${summary.meanRawGain > 0 ? '+' : ''}${summary.meanRawGain.toFixed(2)} pts` : 'N/A'}
          </p>
          <p className="mt-1 text-xs text-gray-500">Post-test score minus pre-test score across paired students.</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Average Normalized Gain (Hake &lt;g&gt;)</span>
          <p className="mt-1 text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {summary.meanHakeGain !== null ? summary.meanHakeGain.toFixed(2) : 'N/A'}
          </p>
          <p className="mt-1 text-xs text-gray-500">Fraction of maximum possible score improvement achieved.</p>
        </div>
      </div>

      {/* Paired Inference or Not Enough Data */}
      {isNotEnough ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
          role="status"
        >
          <h4 className="font-bold flex items-center gap-2 mb-1">
            <span aria-hidden="true">⚠️</span> Insufficient Data for Inferential Statistics
          </h4>
          <p className="text-xs">
            {summary.pairedStats.message} (Requires at least 2 participants who have completed both Pre-test and Post-test).
          </p>
        </div>
      ) : paired ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Paired Samples t-Test Statistics
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
              <span className="text-gray-500 block">Mean Diff (Post - Pre)</span>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100 font-mono">
                {paired.meanDiff.toFixed(2)}
              </span>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
              <span className="text-gray-500 block">t-Statistic (df = {paired.df})</span>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100 font-mono">
                {paired.t.toFixed(3)}
              </span>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
              <span className="text-gray-500 block">p-Value (two-tailed)</span>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100 font-mono">
                {paired.pValue < 0.001 ? '&lt; 0.001' : paired.pValue.toFixed(4)}
              </span>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
              <span className="text-gray-500 block">Cohen&apos;s d Effect Size</span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono">
                {paired.cohensD.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
