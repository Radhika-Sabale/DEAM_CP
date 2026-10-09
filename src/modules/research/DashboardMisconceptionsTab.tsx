/**
 * @file DashboardMisconceptionsTab.tsx
 * Misconception ranking view with horizontal bars, numerical values, affected modules, and table view (Stage 11C).
 */

import React, { useState } from 'react';
import type { MisconceptionRankingRow } from '../../engine/evaluation/types';
import { Button } from '../../components/ui/Button';

interface DashboardMisconceptionsTabProps {
  readonly rankings: readonly MisconceptionRankingRow[];
}

export const DashboardMisconceptionsTab: React.FC<DashboardMisconceptionsTabProps> = ({
  rankings,
}) => {
  const [viewMode, setViewMode] = useState<'bars' | 'table'>('bars');
  const [expandedTag, setExpandedTag] = useState<string | null>(null);

  if (rankings.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        No misconceptions recorded in the selected telemetry scope.
      </div>
    );
  }

  const maxCount = Math.max(...rankings.map((r) => r.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Ranked Misconceptions
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Frequency and prevalence of identified student cognitive error patterns.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setViewMode((prev) => (prev === 'bars' ? 'table' : 'bars'))}
          aria-label={viewMode === 'bars' ? 'Switch to pure data table view' : 'Switch to bar visualization'}
        >
          {viewMode === 'bars' ? 'View as Pure Table' : 'View as Chart Bars'}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-xs" aria-label="Misconception Ranking Analysis">
          <caption className="sr-only">Ranked table of student misconceptions with frequency counts and affected modules</caption>
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300">
            <tr>
              <th scope="col" className="p-3 font-semibold">Misconception & Tag</th>
              <th scope="col" className="p-3 font-semibold text-right">Occurrences</th>
              <th scope="col" className="p-3 font-semibold text-right">Participants</th>
              <th scope="col" className="p-3 font-semibold text-right">Share (%)</th>
              {viewMode === 'bars' && <th scope="col" className="p-3 font-semibold w-1/3">Prevalence</th>}
              <th scope="col" className="p-3 font-semibold text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rankings.map((row) => {
              const isExpanded = expandedTag === row.tag;
              const barPercent = Math.round((row.count / maxCount) * 100);

              return (
                <React.Fragment key={row.tag}>
                  <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="p-3">
                      <span className="font-semibold text-gray-900 dark:text-gray-100 block">{row.title}</span>
                      <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">{row.tag}</span>
                    </td>
                    <td className="p-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                      {row.count}
                    </td>
                    <td className="p-3 text-right text-gray-700 dark:text-gray-300">
                      {row.distinctParticipants}
                    </td>
                    <td className="p-3 text-right text-gray-700 dark:text-gray-300">
                      {(row.errorShare * 100).toFixed(1)}%
                    </td>
                    {viewMode === 'bars' && (
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div
                              className="h-full bg-red-500/80 dark:bg-red-600 rounded-full transition-all"
                              style={{ width: `${barPercent}%` }}
                              aria-hidden="true"
                            />
                          </div>
                          <span className="text-[11px] font-mono text-gray-600 dark:text-gray-400 w-10 text-right">
                            {row.count}
                          </span>
                        </div>
                      </td>
                    )}
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => setExpandedTag(isExpanded ? null : row.tag)}
                        className="rounded px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                        aria-expanded={isExpanded}
                        aria-label={`Toggle affected modules for ${row.title}`}
                      >
                        {isExpanded ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-gray-50/70 dark:bg-gray-800/40">
                      <td colSpan={viewMode === 'bars' ? 6 : 5} className="p-3">
                        <div className="text-xs space-y-1">
                          <span className="font-semibold text-gray-700 dark:text-gray-300">
                            Affected Learning Modules ({row.affectedModules.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {row.affectedModules.map((m) => (
                              <span
                                key={m}
                                className="rounded-md bg-white border border-gray-200 px-2 py-0.5 text-[11px] font-mono text-gray-800 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
