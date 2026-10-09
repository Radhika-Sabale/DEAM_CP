/**
 * @file DashboardSusTab.tsx
 * Cohort System Usability Scale (SUS) summary statistics, SD, and 95% CI (Stage 11C).
 */

import React from 'react';
import type { SusAggregate } from '../../engine/evaluation/types';

interface DashboardSusTabProps {
  readonly susSummary: SusAggregate | null;
}

export const DashboardSusTab: React.FC<DashboardSusTabProps> = ({
  susSummary,
}) => {
  if (!susSummary || susSummary.count === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        No System Usability Scale (SUS) evaluations recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Usability Evaluation (SUS) Summary
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Cohort-wide aggregated Brooke System Usability Scale metrics on a 0–100 percentile scale.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Evaluations</span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 font-mono">
            {susSummary.count}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Mean SUS Score</span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400 font-mono">
            {susSummary.mean.toFixed(1)} / 100
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Standard Deviation (SD)</span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 font-mono">
            ±{susSummary.sd.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">95% Confidence Interval</span>
          <p className="mt-1 text-base font-bold tracking-tight text-gray-900 dark:text-gray-100 font-mono">
            [{susSummary.ci95[0].toFixed(1)}, {susSummary.ci95[1].toFixed(1)}]
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Median Score</span>
          <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100 font-mono">
            {susSummary.median.toFixed(1)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Minimum Score</span>
          <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100 font-mono">
            {susSummary.min.toFixed(1)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Maximum Score</span>
          <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100 font-mono">
            {susSummary.max.toFixed(1)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
        <span className="font-semibold text-gray-800 dark:text-gray-200 block mb-1">
          SUS Benchmark Context:
        </span>
        An industry benchmark score of 68.0 represents average usability (Grade C / &quot;OK&quot;). Scores &ge; 70.0 indicate acceptable usability, and scores &ge; 80.3 represent Grade A (&quot;Excellent&quot;).
      </div>
    </div>
  );
};
