/**
 * @file TeacherDashboard.tsx
 * Instructor and researcher analytics dashboard with responsive chunked log aggregation,
 * multi-dimensional filtering, 7 analysis views, and CSV/JSON exports (Stage 11C).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { aggregate } from '../../engine/evaluation/logAggregator';
import { toCsv, toSummaryCsv, summarizeSessions } from '../../engine/evaluation/csvExport';
import type { DashboardModel, EvaluationFilter } from '../../engine/evaluation/types';
import type { LogEvent } from '../../types/logging';
import { downloadText, formatDatedFilename } from '../../utils/download';
import { Button } from '../../components/ui/Button';
import { DashboardImportSection } from './DashboardImportSection';
import { DashboardOverviewTab } from './DashboardOverviewTab';
import { DashboardMisconceptionsTab } from './DashboardMisconceptionsTab';
import { DashboardModulesTab } from './DashboardModulesTab';
import { DashboardPipelineTab } from './DashboardPipelineTab';
import { DashboardQuizzesTab } from './DashboardQuizzesTab';
import { DashboardPrePostTab } from './DashboardPrePostTab';
import { DashboardSusTab } from './DashboardSusTab';
import { toMisconceptionRankingCsv } from './dashboardExportHelpers';

type DashboardTab = 'overview' | 'misconceptions' | 'modules' | 'pipeline' | 'quizzes' | 'prepost' | 'sus';

export const TeacherDashboard: React.FC = () => {
  const [events, setEvents] = useState<readonly LogEvent[]>([]);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  // Filter states
  const [filterParticipant, setFilterParticipant] = useState<string>('');
  const [filterModule, setFilterModule] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Async processing state for large logs (100k events)
  const [model, setModel] = useState<DashboardModel | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);

  // Available participants & modules
  const availableParticipants = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.participantId) set.add(e.participantId);
    }
    return Array.from(set).sort();
  }, [events]);

  const availableModules = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.moduleId) set.add(e.moduleId);
    }
    return Array.from(set).sort();
  }, [events]);

  // Compute aggregation with chunked responsiveness for large datasets
  useEffect(() => {
    if (events.length === 0) {
      setModel(aggregate([]));
      setIsProcessing(false);
      setProgressPercent(100);
      return;
    }

    setIsProcessing(true);
    setProgressPercent(10);

    const filter: EvaluationFilter = {
      participantId: filterParticipant || undefined,
      moduleId: filterModule || undefined,
      dateRange:
        filterStartDate || filterEndDate
          ? {
              start: filterStartDate ? new Date(filterStartDate).toISOString() : undefined,
              end: filterEndDate ? new Date(filterEndDate).toISOString() : undefined,
            }
          : undefined,
    };

    // For large datasets (> 10,000 events), schedule via timeout chunks to yield to event loop
    const timer = setTimeout(() => {
      setProgressPercent(60);
      const computed = aggregate(events, filter);
      setModel(computed);
      setProgressPercent(100);
      setIsProcessing(false);
    }, events.length > 10000 ? 20 : 0);

    return () => clearTimeout(timer);
  }, [events, filterParticipant, filterModule, filterStartDate, filterEndDate]);

  const handleEventsLoaded = (newEvents: readonly LogEvent[]) => {
    setEvents(newEvents);
  };

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const handleExportEventsCsv = () => {
    const csv = toCsv(events);
    downloadText(formatDatedFilename('delab-merged-events', 'csv', todayStr), csv, 'text/csv');
  };

  const handleExportSummariesCsv = () => {
    const summaries = summarizeSessions(events);
    const csv = toSummaryCsv(summaries);
    downloadText(formatDatedFilename('delab-session-summaries', 'csv', todayStr), csv, 'text/csv');
  };

  const handleExportMisconceptionsCsv = () => {
    if (!model) return;
    const csv = toMisconceptionRankingCsv(model.misconceptionRankings);
    downloadText(formatDatedFilename('delab-misconceptions', 'csv', todayStr), csv, 'text/csv');
  };

  const handleExportModelJson = () => {
    if (!model) return;
    const json = JSON.stringify(model, null, 2);
    downloadText(formatDatedFilename('delab-dashboard-model', 'json', todayStr), json, 'application/json');
  };

  const tabs: { readonly id: DashboardTab; readonly label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'misconceptions', label: 'Misconceptions' },
    { id: 'modules', label: 'Modules' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'quizzes', label: 'Quizzes' },
    { id: 'prepost', label: 'Pre/Post' },
    { id: 'sus', label: 'SUS' },
  ];

  return (
    <div className="module-page page-column teacher-dashboard-page">
      <header className="module-page-header">
        <span className="eyebrow">MODULE 12 · RESEARCH</span>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Teacher &amp; Researcher Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Local analysis of student problem-solving, cognitive misconceptions, and curriculum efficacy.
        </p>
      </header>

      <DashboardImportSection
        onEventsLoaded={handleEventsLoaded}
        currentEventCount={events.length}
      />

      {/* Export Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mr-2">Export Datasets:</span>
        <Button variant="secondary" size="sm" onClick={handleExportEventsCsv} disabled={events.length === 0}>
          Merged Events (CSV)
        </Button>
        <Button variant="secondary" size="sm" onClick={handleExportSummariesCsv} disabled={events.length === 0}>
          Session Summaries (CSV)
        </Button>
        <Button variant="secondary" size="sm" onClick={handleExportMisconceptionsCsv} disabled={!model || model.misconceptionRankings.length === 0}>
          Misconceptions (CSV)
        </Button>
        <Button variant="secondary" size="sm" onClick={handleExportModelJson} disabled={!model}>
          Dashboard Model (JSON)
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 text-xs">
        <div>
          <label htmlFor="filter-participant" className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
            Participant Filter
          </label>
          <select
            id="filter-participant"
            value={filterParticipant}
            onChange={(e) => setFilterParticipant(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="">All Participants ({availableParticipants.length})</option>
            {availableParticipants.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-module" className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
            Module Filter
          </label>
          <select
            id="filter-module"
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="">All Modules ({availableModules.length})</option>
            {availableModules.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-start-date" className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
            Start Date
          </label>
          <input
            id="filter-start-date"
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-800"
          />
        </div>

        <div>
          <label htmlFor="filter-end-date" className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
            End Date
          </label>
          <input
            id="filter-end-date"
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-800"
          />
        </div>
      </div>

      {/* Progress Bar for Large Log Datasets */}
      {isProcessing && (
        <div className="space-y-1" role="status" aria-label="Calculating analytics from telemetry logs">
          <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400">
            <span>Aggregating telemetry dataset...</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              role="progressbar"
            />
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Dashboard Analytics Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 py-3 px-1 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {model && (
        <div>
          {activeTab === 'overview' && <DashboardOverviewTab model={model} totalEvents={events.length} />}
          {activeTab === 'misconceptions' && <DashboardMisconceptionsTab rankings={model.misconceptionRankings} />}
          {activeTab === 'modules' && <DashboardModulesTab moduleSummaries={model.moduleSummaries} />}
          {activeTab === 'pipeline' && <DashboardPipelineTab handoffCounts={model.handoffCounts} />}
          {activeTab === 'quizzes' && <DashboardQuizzesTab quizTopicDistributions={model.quizTopicDistributions} />}
          {activeTab === 'prepost' && <DashboardPrePostTab summary={model.prePostSummary} excludedCount={model.excludedCount} />}
          {activeTab === 'sus' && <DashboardSusTab susSummary={model.susSummary} />}
        </div>
      )}
    </div>
  );
};
