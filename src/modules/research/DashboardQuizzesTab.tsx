/**
 * @file DashboardQuizzesTab.tsx
 * Quiz score distribution analysis across learning topics with table view toggle (Stage 11C).
 */

import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';

interface DashboardQuizzesTabProps {
  readonly quizTopicDistributions: Readonly<Record<string, readonly number[]>>;
}

export const DashboardQuizzesTab: React.FC<DashboardQuizzesTabProps> = ({
  quizTopicDistributions,
}) => {
  const [viewMode, setViewMode] = useState<'bars' | 'table'>('bars');

  const topics = Object.keys(quizTopicDistributions);

  if (topics.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        No quiz submissions recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Quiz Topic Performance
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Cohort score distributions across conceptual quiz categories (scores out of 10).
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setViewMode((prev) => (prev === 'bars' ? 'table' : 'bars'))}
          aria-label={viewMode === 'bars' ? 'Switch to pure table view' : 'Switch to bar charts'}
        >
          {viewMode === 'bars' ? 'View as Pure Table' : 'View as Charts'}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-xs" aria-label="Quiz Performance by Topic">
          <caption className="sr-only">Table of quiz topics showing participant counts, average scores, and distribution</caption>
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300">
            <tr>
              <th scope="col" className="p-3 font-semibold">Topic</th>
              <th scope="col" className="p-3 font-semibold text-right">Submissions</th>
              <th scope="col" className="p-3 font-semibold text-right">Mean Score (/10)</th>
              <th scope="col" className="p-3 font-semibold text-right">Min / Max</th>
              {viewMode === 'bars' && <th scope="col" className="p-3 font-semibold w-1/3">Score Progress</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {topics.map((topic) => {
              const scores = quizTopicDistributions[topic] ?? [];
              const count = scores.length;
              const mean = count > 0 ? (scores.reduce((a, b) => a + b, 0) / count).toFixed(1) : '0.0';
              const min = count > 0 ? Math.min(...scores) : 0;
              const max = count > 0 ? Math.max(...scores) : 0;
              const pct = count > 0 ? Math.round((parseFloat(mean) / 10) * 100) : 0;

              return (
                <tr key={topic} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="p-3 font-semibold text-gray-900 dark:text-gray-100">
                    {topic}
                  </td>
                  <td className="p-3 text-right text-gray-700 dark:text-gray-300 font-mono">
                    {count}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-gray-100">
                    {mean}
                  </td>
                  <td className="p-3 text-right font-mono text-gray-500 dark:text-gray-400">
                    {min} / {max}
                  </td>
                  {viewMode === 'bars' && (
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                            aria-hidden="true"
                          />
                        </div>
                        <span className="text-[11px] font-mono text-gray-600 dark:text-gray-400 w-10 text-right">
                          {mean}
                        </span>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
