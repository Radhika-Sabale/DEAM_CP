/**
 * @file EventLog.tsx
 * Chronological explanatory event log with severity classification, live polite/assertive
 * announcements, and interactive pedagogical concept disclosures for invalid states and race-around hazards.
 */

import { type FC, useMemo } from 'react';
import {
  explainEvent,
  explainInvalidState,
  explainRaceAround,
  type EventExplanation,
} from '../../engine/flipflop/explain';
import { analyzeRaceAround } from '../../engine/flipflop/hazards';
import type { UseFlipFlopSessionResult } from './useFlipFlopSession';

export interface EventLogProps {
  readonly session: UseFlipFlopSessionResult;
  readonly className?: string;
}

export const EventLog: FC<EventLogProps> = ({ session, className = '' }) => {
  const { state, eventsUpToCursor, cursorValues } = session;

  // Generate plain-language explanations for all events occurring up to current cursor
  const explainedItems = useMemo<readonly { eventTime: number; explanation: EventExplanation }[]>(() => {
    const list: { eventTime: number; explanation: EventExplanation }[] = [];
    for (const ev of eventsUpToCursor) {
      const items = explainEvent(ev, state.config);
      for (const item of items) {
        list.push({ eventTime: ev.time, explanation: item });
      }
    }
    return list;
  }, [eventsUpToCursor, state.config]);

  // Latest critical warning or error for assertive mirroring
  const latestAlert = useMemo<EventExplanation | null>(() => {
    for (let i = explainedItems.length - 1; i >= 0; i--) {
      const item = explainedItems[i]?.explanation;
      if (item && (item.severity === 'error' || item.severity === 'warning')) {
        return item;
      }
    }
    return null;
  }, [explainedItems]);

  const invalidStateInfo = useMemo(() => explainInvalidState(state.config.type), [state.config.type]);
  const isLevel = state.config.trigger === 'level-high' || state.config.trigger === 'level-low';

  const raceAnalysis = useMemo(() => {
    if (!isLevel) return null;
    return analyzeRaceAround(state.config, cursorValues.inputs, state.pulseWidth);
  }, [isLevel, state.config, cursorValues.inputs, state.pulseWidth]);

  const raceExplanation = useMemo(() => {
    if (!raceAnalysis) return '';
    return explainRaceAround(raceAnalysis, state.config);
  }, [raceAnalysis, state.config]);

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 text-xs space-y-4 ${className}`}
    >
      {/* Mirror Region for Assertive Screen Reader Delivery of Critical Errors */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {latestAlert ? `[${latestAlert.severity.toUpperCase()}] ${latestAlert.text}` : ''}
      </div>

      <div className="border-b border-gray-100 pb-3 dark:border-gray-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Simulation Event Log & Pedagogical Explanations
        </h3>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Plain-language audit log of signal transitions, trigger operations, and potential hazard warnings up to t = {state.cursor}.
        </p>
      </div>

      {/* Ordered List Container */}
      <div
        role="log"
        aria-label="Simulation event log"
        aria-live="polite"
        className="max-h-60 overflow-y-auto space-y-2 rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-950/40"
      >
        {explainedItems.length === 0 ? (
          <p className="py-4 text-center italic text-gray-400 dark:text-gray-500">
            No events logged yet. Toggle clock or inputs to simulate.
          </p>
        ) : (
          explainedItems.map((item, idx) => {
            const { severity, text } = item.explanation;
            const isError = severity === 'error';
            const isWarning = severity === 'warning';

            return (
              <div
                key={idx}
                className={`flex items-start gap-2.5 rounded-md p-2.5 text-xs transition-all ${
                  isError
                    ? 'border border-red-200 bg-red-50/90 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200'
                    : isWarning
                    ? 'border border-amber-200 bg-amber-50/90 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'
                    : 'border border-gray-200/80 bg-white text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200'
                }`}
              >
                {/* Severity Badge: Icon + Word */}
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    isError
                      ? 'bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200'
                      : isWarning
                      ? 'bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'
                  }`}
                >
                  <span>{isError ? 'Error' : isWarning ? 'Warning' : 'Info'}</span>
                  <span>{isError ? 'Error' : isWarning ? 'Warning' : 'Info'}</span>
                </span>

                <p className="flex-1 leading-relaxed">{text}</p>
              </div>
            );
          })
        )}
      </div>

      {/* "What does this mean?" Educational Disclosures */}
      <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        {/* Invalid State Disclosure for SR */}
        {state.config.type === 'SR' && (
          <details className="group rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20 text-xs">
            <summary className="cursor-pointer font-bold text-amber-900 dark:text-amber-200 flex items-center justify-between">
              <span>What does forbidden state mean? ({invalidStateInfo.title})</span>
              <span className="text-[10px] text-amber-700 dark:text-amber-400 group-open:rotate-180 transition-transform">
                Show details
              </span>
            </summary>
            <div className="mt-2 space-y-2 text-amber-950 dark:text-amber-200 text-[11px] leading-relaxed">
              <p>{invalidStateInfo.explanation}</p>
              <ul className="list-inside list-disc space-y-1">
                {invalidStateInfo.consequences.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          </details>
        )}

        {/* Race-Around Disclosure for Level-Triggered */}
        {isLevel && raceExplanation && (
          <details className="group rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/40 dark:bg-blue-950/20 text-xs">
            <summary className="cursor-pointer font-bold text-blue-900 dark:text-blue-200 flex items-center justify-between">
              <span>What is a Race-Around Hazard in Level-Sensitive Latches?</span>
              <span className="text-[10px] text-blue-700 dark:text-blue-400 group-open:rotate-180 transition-transform">
                Show details
              </span>
            </summary>
            <div className="mt-2 space-y-2 text-blue-950 dark:text-blue-200 text-[11px] leading-relaxed">
              <p>{raceExplanation}</p>
              <p>
                In level-sensitive mode, whenever the clock remains active and inputs command a state inversion, the updated output races back through feedback gates while the clock is still transparent, causing indeterminate rapid oscillation.
              </p>
            </div>
          </details>
        )}
      </div>
    </div>
  );
};
