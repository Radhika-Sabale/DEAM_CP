/**
 * @file DashboardModulesTab.tsx
 * Per-module student performance, completion counts, duration, and hint utilization (Stage 11C).
 */

import React from 'react';
import type { ModuleSummary } from '../../types/logging';

interface DashboardModulesTabProps {
  readonly moduleSummaries: readonly ModuleSummary[];
}

export const DashboardModulesTab: React.FC<DashboardModulesTabProps> = ({
  moduleSummaries,
}) => {
  if (moduleSummaries.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        No module activity logged yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Module Performance &amp; Engagement
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Completions, average active duration, hint requests, and top cognitive misconceptions per module.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-xs" aria-label="Per-Module Performance Breakdown">
          <caption className="sr-only">Detailed breakdown of completions, duration, hints, and misconceptions per module</caption>
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300">
            <tr>
              <th scope="col" className="p-3 font-semibold">Module</th>
              <th scope="col" className="p-3 font-semibold text-right">Completions</th>
              <th scope="col" className="p-3 font-semibold text-right">Avg Duration</th>
              <th scope="col" className="p-3 font-semibold text-right">Hints Requested</th>
              <th scope="col" className="p-3 font-semibold">Top Misconceptions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {moduleSummaries.map((m) => {
              const avgDurationSec =
                m.averageDurationMs > 0
                  ? (m.averageDurationMs / 1000).toFixed(1) + 's'
                  : '0.0s';
              const misconceptionsList =
                m.topMisconceptions.length > 0
                  ? m.topMisconceptions.map((c) => `${c.misconceptionTag} (${c.count})`).join(', ')
                  : 'None';

              return (
                <tr key={m.moduleId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="p-3 font-semibold text-gray-900 dark:text-gray-100">
                    {m.moduleId}
                  </td>
                  <td className="p-3 text-right font-mono text-gray-900 dark:text-gray-100">
                    {m.completedCount}
                  </td>
                  <td className="p-3 text-right text-gray-700 dark:text-gray-300 font-mono">
                    {avgDurationSec}
                  </td>
                  <td className="p-3 text-right font-mono text-gray-700 dark:text-gray-300">
                    {m.totalHintsRequested}
                  </td>
                  <td className="p-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                    {misconceptionsList}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
