/**
 * @file ScenarioEditor.tsx
 * Interactive hardware interrupt scenario editor for scheduling external NMI and INTR events.
 *
 * Allows configuring timed events at specific CPU ticks, verifying architectural priority,
 * choosing presets, importing/exporting JSON definitions with validation, and reviewing past vs upcoming events.
 */

import { type FC, useState } from 'react';
import type { InterruptEvent, InterruptScenario } from '../../engine/interrupts';
import { Button } from '../../components/ui/Button';

export interface ScenarioEditorProps {
  readonly scenario: InterruptScenario;
  readonly currentTick?: number;
  readonly onAddEvent: (ev: InterruptEvent) => void;
  readonly onRemoveEvent: (index: number) => void;
  readonly onSetScenario: (sc: InterruptScenario) => void;
  readonly onImportJson: (json: string) => { ok: true } | { ok: false; error: string };
  readonly onExportJson: () => string;
  readonly className?: string;
}

export const ScenarioEditor: FC<ScenarioEditorProps> = ({
  scenario,
  currentTick = 0,
  onAddEvent,
  onRemoveEvent,
  onSetScenario,
  onImportJson,
  onExportJson,
  className = '',
}) => {
  const [kind, setKind] = useState<'nmi' | 'intr'>('intr');
  const [atTickStr, setAtTickStr] = useState<string>('10');
  const [vectorStr, setVectorStr] = useState<string>('8');
  const [formError, setFormError] = useState<string | null>(null);

  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);

  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const tick = parseInt(atTickStr.trim(), 10);
    if (Number.isNaN(tick) || tick < 0) {
      setFormError('Scheduled tick must be a non-negative integer.');
      return;
    }

    if (kind === 'intr') {
      const vec = parseInt(vectorStr.trim(), 10);
      if (Number.isNaN(vec) || vec < 0 || vec > 255) {
        setFormError('INTR vector must be an integer between 0 and 255.');
        return;
      }
      onAddEvent({ atTick: tick, kind: 'intr', vector: vec });
    } else {
      onAddEvent({ atTick: tick, kind: 'nmi' });
    }
  };

  const handleApplyPreset = (presetName: 'nmi-10' | 'intr-15' | 'priority-test' | 'nested' | 'clear') => {
    switch (presetName) {
      case 'nmi-10':
        onSetScenario({ events: [{ atTick: 10, kind: 'nmi' }] });
        break;
      case 'intr-15':
        onSetScenario({ events: [{ atTick: 15, kind: 'intr', vector: 8 }] });
        break;
      case 'priority-test':
        onSetScenario({
          events: [
            { atTick: 10, kind: 'intr', vector: 8 },
            { atTick: 10, kind: 'nmi' },
          ],
        });
        break;
      case 'nested':
        onSetScenario({
          events: [
            { atTick: 10, kind: 'intr', vector: 8 },
            { atTick: 20, kind: 'intr', vector: 9 },
          ],
        });
        break;
      case 'clear':
        onSetScenario({ events: [] });
        break;
    }
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    const res = onImportJson(importText);
    if (!res.ok) {
      setImportError(res.error);
    } else {
      setIsImportOpen(false);
      setImportText('');
    }
  };

  const handleCopyExport = () => {
    const json = onExportJson();
    navigator.clipboard.writeText(json).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div
      role="region"
      aria-label="Hardware interrupt scenario editor"
      className={`rounded-xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900 text-xs">
        <div className="flex items-center gap-2">
          <h3 className="font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Hardware Interrupt Scenario
          </h3>
          <span className="font-mono text-gray-500">
            (Current CPU Tick: {currentTick})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsImportOpen(true)}
            aria-label="Import scenario JSON"
          >
            Import JSON
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyExport}
            aria-label="Export scenario JSON to clipboard"
          >
            {copySuccess ? 'Copied!' : 'Export JSON'}
          </Button>
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-100 bg-gray-50/50 p-2.5 dark:border-gray-800 dark:bg-gray-900/30 text-xs">
        <span className="font-semibold text-gray-600 dark:text-gray-400">Presets:</span>
        <button
          type="button"
          onClick={() => handleApplyPreset('nmi-10')}
          className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          NMI @ 10
        </button>
        <button
          type="button"
          onClick={() => handleApplyPreset('intr-15')}
          className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          INTR 8 @ 15
        </button>
        <button
          type="button"
          onClick={() => handleApplyPreset('priority-test')}
          className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          Priority (NMI + INTR @ 10)
        </button>
        <button
          type="button"
          onClick={() => handleApplyPreset('nested')}
          className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          Nested (8 @ 10, 9 @ 20)
        </button>
        <button
          type="button"
          onClick={() => handleApplyPreset('clear')}
          className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-rose-600 hover:bg-rose-50 dark:border-gray-700 dark:bg-gray-800 dark:text-rose-400"
        >
          Clear
        </button>
      </div>

      {/* Add Event Form */}
      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2 p-3 text-xs border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-1">
          <label htmlFor="event-kind" className="font-semibold text-gray-700 dark:text-gray-300">
            Kind:
          </label>
          <select
            id="event-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as 'nmi' | 'intr')}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="intr">INTR (Maskable)</option>
            <option value="nmi">NMI (Non-Maskable)</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <label htmlFor="event-tick" className="font-semibold text-gray-700 dark:text-gray-300">
            At Tick:
          </label>
          <input
            id="event-tick"
            type="number"
            min="0"
            value={atTickStr}
            onChange={(e) => setAtTickStr(e.target.value)}
            className="w-20 rounded border border-gray-300 px-2 py-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>

        {kind === 'intr' && (
          <div className="flex items-center gap-1">
            <label htmlFor="event-vector" className="font-semibold text-gray-700 dark:text-gray-300">
              Vector:
            </label>
            <input
              id="event-vector"
              type="number"
              min="0"
              max="255"
              value={vectorStr}
              onChange={(e) => setVectorStr(e.target.value)}
              className="w-16 rounded border border-gray-300 px-2 py-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
        )}

        <Button variant="primary" size="sm" type="submit">
          Add Event
        </Button>

        {formError && (
          <span className="text-red-600 dark:text-red-400 font-semibold" role="alert">
            {formError}
          </span>
        )}
      </form>

      {/* Events Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono" aria-label="Scheduled external interrupt events">
          <caption className="sr-only">
            Table of scheduled hardware interrupt events sorted by tick and priority.
          </caption>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70 text-gray-500 dark:border-gray-800 dark:bg-gray-900/50">
              <th scope="col" className="px-3 py-1.5 text-left font-semibold">Tick</th>
              <th scope="col" className="px-3 py-1.5 text-left font-semibold">Kind</th>
              <th scope="col" className="px-3 py-1.5 text-left font-semibold">Vector</th>
              <th scope="col" className="px-3 py-1.5 text-left font-semibold">Priority</th>
              <th scope="col" className="px-3 py-1.5 text-left font-semibold">Timeline</th>
              <th scope="col" className="px-3 py-1.5 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {scenario.events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-400 dark:text-gray-500 italic">
                  No external events scheduled. Add an event or pick a preset above.
                </td>
              </tr>
            ) : (
              scenario.events.map((ev, idx) => {
                const isPast = ev.atTick < currentTick;
                const isCurrent = ev.atTick === currentTick;
                const isNmi = ev.kind === 'nmi';

                return (
                  <tr
                    key={`${ev.atTick}-${ev.kind}-${ev.vector ?? 2}-${idx}`}
                    className={`hover:bg-gray-50/80 dark:hover:bg-gray-800/30 ${
                      isCurrent
                        ? 'bg-amber-50/60 dark:bg-amber-950/20'
                        : isPast
                          ? 'opacity-60'
                          : ''
                    }`}
                  >
                    <td className="px-3 py-1.5 font-bold text-gray-800 dark:text-gray-200">
                      {ev.atTick}
                    </td>
                    <td className="px-3 py-1.5">
                      {isNmi ? (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                          <span aria-hidden="true">⚡</span>
                          NMI
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                          <span aria-hidden="true">🔔</span>
                          INTR
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 font-medium">
                      {isNmi ? 'Vector 2 (Fixed)' : `Vector ${ev.vector}`}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-gray-500">
                      {isNmi ? 'Priority 2 (High)' : 'Priority 3 (Maskable)'}
                    </td>
                    <td className="px-3 py-1.5 text-xs">
                      {isCurrent ? (
                        <span className="font-bold text-amber-600 dark:text-amber-400">Active Now</span>
                      ) : isPast ? (
                        <span className="text-gray-400">Past</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          In {ev.atTick - currentTick} ticks
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveEvent(idx)}
                        aria-label={`Remove event at tick ${ev.atTick}`}
                        className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400"
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Import Modal / Popover */}
      {isImportOpen && (
        <div
          role="dialog"
          aria-labelledby="import-scenario-title"
          className="border-t border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/90"
        >
          <div className="flex items-center justify-between pb-2">
            <h4 id="import-scenario-title" className="text-xs font-bold uppercase text-gray-700 dark:text-gray-200">
              Import Scenario JSON
            </h4>
            <Button variant="ghost" size="sm" onClick={() => setIsImportOpen(false)}>
              ✕
            </Button>
          </div>
          <form onSubmit={handleImportSubmit} className="space-y-2">
            <textarea
              rows={4}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{"events": [{"atTick": 10, "kind": "nmi"}]}'
              className="w-full rounded border border-gray-300 p-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            {importError && (
              <div role="alert" className="text-xs text-red-600 dark:text-red-400 font-semibold">
                {importError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setIsImportOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                Import & Replace
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
