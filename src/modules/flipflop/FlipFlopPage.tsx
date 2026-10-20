/**
 * @file FlipFlopPage.tsx
 * Top-level page component for the Flip-Flop & Latch Workbench laboratory module (Stage 9B).
 * Orchestrates component configuration, discrete-event simulation, characteristic tables,
 * race-around condition exploration, progressive pedagogical practice, and pipeline handoff.
 */

import { useEffect, useMemo, useState, type FC } from 'react';
import type { FlipFlopType } from '../../types/sequential';
import { selectCurrentProject, useProjectStore } from '../../store/projectStore';
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
    <div className="module-page page-column flipflop-page pb-12">
      {/* Module Title Header */}
      <header className="module-card module-title">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow">MODULE 05 · FLIP-FLOP LAB</span>
            <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300">
              Type: {session.state.config.type}
            </span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Flip-Flop &amp; Latch Workbench
          </h1>
        </div>
      </header>

      {/* Non-blocking Advisory Banner for Level-Sensitive Mode */}
      {advisoryNote && (
        <div
          role="note"
          aria-label="Pedagogical advisory note"
          className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <p className="font-medium">{advisoryNote}</p>
        </div>
      )}

      <main className="flipflop-workbench">
        <div className="flipflop-controls-row">
          <ConfigPanel
            config={session.state.config}
            initialQ={session.state.initialQ}
            onTypeChange={(t) => session.setType(t)}
            onConfigChange={(c) => session.setConfig(c)}
            onInitialQChange={(q) => session.setInitialQ(q)}
          />
        </div>

        <div className="flipflop-tab-content">
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
