/**
 * @file FlipFlopPage.tsx
 * Top-level page component for the Flip-Flop & Latch Workbench laboratory module (Stage 9B).
 * Orchestrates component configuration, discrete-event simulation, characteristic tables,
 * race-around condition exploration, progressive pedagogical practice, and pipeline handoff.
 */

import { useEffect, useMemo, useState, type FC } from 'react';
import type { FlipFlopType } from '../../types/sequential';
import { selectCurrentProject, useProjectStore } from '../../store/projectStore';
import { PipelineStepper } from '../../components/layout/PipelineStepper';
import { SendToNextButton } from '../../components/layout/SendToNextButton';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import { CharacteristicTables } from './CharacteristicTables';
import { ClockStepper } from './ClockStepper';
import { ConfigPanel } from './ConfigPanel';
import { EventLog } from './EventLog';
import { createFlipFlopStorePatch, getCounterDesignAdvisory } from './flipFlopModuleLogic';
import { FlipFlopTiming } from './FlipFlopTiming';
import { PracticePanel } from './PracticePanel';
import { RaceAroundExplorer } from './RaceAroundExplorer';
import { useFlipFlopSession } from './useFlipFlopSession';

export const FlipFlopPage: FC = () => {
  const project = useProjectStore(selectCurrentProject);
  const applyPatch = useProjectStore((s) => s.applyPatch);

  const initialType: FlipFlopType = project.flipFlopType ?? 'D';
  const session = useFlipFlopSession(initialType);
  const [activeCenterTab, setActiveCenterTab] = useState<string>('simulate');

  // Synchronize flip-flop type selection with master DesignProject store
  useEffect(() => {
    const chosenType = session.state.config.type;
    if (project.flipFlopType !== chosenType) {
      applyPatch(createFlipFlopStorePatch(chosenType));
    }
  }, [session.state.config.type, project.flipFlopType, applyPatch]);

  const isLevel =
    session.state.config.trigger === 'level-high' ||
    session.state.config.trigger === 'level-low';

  const advisoryNote = useMemo(() => {
    return getCounterDesignAdvisory(session.state.config.trigger);
  }, [session.state.config.trigger]);

  // Dynamic Tabs list (Race-Around Explorer tab appears only for level-triggered modes)
  const centerTabs: readonly TabItem[] = useMemo(() => {
    const list: TabItem[] = [
      {
        id: 'simulate',
        label: 'Simulate',
        content: (
          <div className="space-y-6">
            <ClockStepper session={session} />
            <FlipFlopTiming session={session} />
            <EventLog session={session} />
          </div>
        ),
      },
      {
        id: 'tables',
        label: 'Tables',
        content: (
          <CharacteristicTables
            type={session.state.config.type}
            currentRowIndex={session.currentRowIndex}
          />
        ),
      },
    ];

    if (isLevel) {
      list.push({
        id: 'race-around',
        label: 'Race-around',
        content: <RaceAroundExplorer session={session} />,
      });
    }

    list.push({
      id: 'practice',
      label: 'Practice',
      content: <PracticePanel session={session} />,
    });

    return list;
  }, [session, isLevel]);

  return (
    <div className="space-y-6 pb-12">
      {/* Pipeline Navigation Stepper */}
      <PipelineStepper />

      {/* Module Title Header & Pipeline Transition Handoff */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
              Module 5 &bull; Sequential Pipeline
            </span>
            <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300">
              Type: {session.state.config.type}
            </span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Flip-Flop &amp; Latch Workbench
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Explore clock edge triggering, transparent latches, characteristic tables, excitation mappings, and race-around hazards.
          </p>
        </div>

        <div>
          <SendToNextButton />
        </div>
      </header>

      {/* Non-blocking Advisory Banner for Level-Sensitive Mode */}
      {advisoryNote && (
        <div
          role="note"
          aria-label="Pedagogical advisory note"
          className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <span className="text-base" aria-hidden="true">
            ℹ
          </span>
          <p className="font-medium">{advisoryNote}</p>
        </div>
      )}

      {/* Two-Column Responsive Layout */}
      <main className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Configuration Controls */}
        <div className="lg:col-span-4 space-y-6">
          <ConfigPanel
            config={session.state.config}
            initialQ={session.state.initialQ}
            onTypeChange={(t) => session.setType(t)}
            onConfigChange={(c) => session.setConfig(c)}
            onInitialQChange={(q) => session.setInitialQ(q)}
          />
        </div>

        {/* Center/Right Column: Multi-View Tabs */}
        <div className="lg:col-span-8">
          <Tabs
            tabs={centerTabs}
            value={activeCenterTab}
            onChange={(tabId) => setActiveCenterTab(tabId)}
          />
        </div>
      </main>
    </div>
  );
};

export default FlipFlopPage;
