/**
 * @file DashboardOverviewTab.tsx
 * Overview dashboard tab with high-level statistics and prominent privacy note (Stage 11C).
 */

import React from 'react';
import type { DashboardModel } from '../../engine/evaluation/types';

interface DashboardOverviewTabProps {
  readonly model: DashboardModel;
  readonly totalEvents: number;
}

export const DashboardOverviewTab: React.FC<DashboardOverviewTabProps> = ({
  model,
  totalEvents,
}) => {
  const totalCompletedModules = model.moduleSummaries.reduce(
    (acc, m) => acc + m.completedCount,
    0
  );

  return (
    <div className="space-y-6">
      {/* Privacy Notice */}
      <div
        className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
        role="region"
        aria-label="Privacy and Local Data Notice"
      >
        <span className="font-bold flex items-center gap-1.5 mb-1">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Strict Local-Only Processing (No Cloud Upload)
        </span>
        <p>
          All data processing, aggregation, and analysis remain entirely on your local device. Imported logs are evaluated in-browser and are never uploaded to any remote server or cloud infrastructure.
        </p>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Unique Participants</span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {model.participantsCount}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Telemetry Events</span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {totalEvents.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Modules Completed</span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-green-600 dark:text-green-400">
            {totalCompletedModules}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Answer Traps Encountered</span>
          <p className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {model.answerTrapCount}
          </p>
        </div>
      </div>

      {/* Exclusion Audit */}
      {model.excludedCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          <h4 className="font-bold mb-1">Excluded Participant Sessions ({model.excludedCount})</h4>
          <ul className="list-disc list-inside space-y-0.5">
            {model.exclusionReasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
