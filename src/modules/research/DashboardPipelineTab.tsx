/**
 * @file DashboardPipelineTab.tsx
 * Module handoff pipeline transitions and student dropouts (Stage 11C).
 */

import React from 'react';
import type { HandoffEdgeCount } from '../../engine/evaluation/types';

interface DashboardPipelineTabProps {
  readonly handoffCounts: readonly HandoffEdgeCount[];
}

export const DashboardPipelineTab: React.FC<DashboardPipelineTabProps> = ({
  handoffCounts,
}) => {
  if (handoffCounts.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        No module handoffs recorded in this telemetry set.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Module Progression Pipeline
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Tracks transitions and drop-offs between sequential digital logic design stages.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-xs" aria-label="Pipeline Progression Analysis">
          <caption className="sr-only">Table of module transitions showing completed handoffs, dropouts, and retention</caption>
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300">
            <tr>
              <th scope="col" className="p-3 font-semibold">Source Module</th>
              <th scope="col" className="p-3 font-semibold">Target Module</th>
              <th scope="col" className="p-3 font-semibold text-right">Completed Handoffs</th>
              <th scope="col" className="p-3 font-semibold text-right">Dropouts</th>
              <th scope="col" className="p-3 font-semibold text-right">Retention Rate (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {handoffCounts.map((edge) => {
              const total = edge.completedHandoffs + edge.dropouts;
              const retention = total > 0 ? ((edge.completedHandoffs / total) * 100).toFixed(1) : '100.0';

              return (
                <tr key={`${edge.fromModuleId}->${edge.toModuleId}`} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="p-3 font-semibold text-gray-900 dark:text-gray-100">
                    {edge.fromModuleId}
                  </td>
                  <td className="p-3 font-semibold text-gray-900 dark:text-gray-100">
                    {edge.toModuleId}
                  </td>
                  <td className="p-3 text-right font-mono text-green-600 dark:text-green-400 font-semibold">
                    {edge.completedHandoffs}
                  </td>
                  <td className="p-3 text-right font-mono text-red-600 dark:text-red-400">
                    {edge.dropouts}
                  </td>
                  <td className="p-3 text-right font-mono text-gray-800 dark:text-gray-200 font-semibold">
                    {retention}%
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
