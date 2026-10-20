/**
 * @file ClockStepper.tsx
 * Interactive clock stimulus generator, input toggle controls, preset loader, and cursor timeline navigator.
 * Supports keyboard accessibility, scenario selection, and polite live region announcements.
 */

import { useState, type FC } from 'react';
import type { LogicValue } from '../../types/ast';
import { inputNames } from '../../engine/flipflop/models';
import { PRESET_SCENARIOS, type FlipFlopPreset } from '../../engine/flipflop/presets';
import type { UseFlipFlopSessionResult } from './useFlipFlopSession';

export interface ClockStepperProps {
  readonly session: UseFlipFlopSessionResult;
  readonly className?: string;
}

export const ClockStepper: FC<ClockStepperProps> = ({ session, className = '' }) => {
  const {
    state,
    cursorValues,
    maxTraceTime,
    setInput,
    toggleClock,
    pulseClock,
    advance,
    setCursor,
    nextEvent,
    prevEvent,
    loadPreset,
    reset,
    undoLast,
  } = session;

  const [advanceAmount, setAdvanceAmount] = useState<number>(5);
  const [announcement, setAnnouncement] = useState<string>('Simulator ready.');

  const names = inputNames(state.config.type);
  const hasHistory = (state.history ?? []).length > 0;

  const handleToggleInput = (signal: string) => {
    const currentVal = cursorValues.inputs[signal] ?? 0;
    const nextVal: LogicValue = currentVal === 1 ? 0 : 1;
    setInput(signal, nextVal);
    setAnnouncement(`Input ${signal} changed to ${nextVal} at t = ${state.time}.`);
  };

  const handleToggleClock = () => {
    const nextClk = cursorValues.CLK === 1 ? 0 : 1;
    toggleClock();
    setAnnouncement(
      `Clock transitioned to ${nextClk} at t = ${state.time}; Q is now ${cursorValues.Q}.`
    );
  };

  const handlePulseClock = () => {
    pulseClock();
    setAnnouncement(
      `Clock pulsed (width = ${state.pulseWidth}) at t = ${state.time}; Q is now ${cursorValues.Q}.`
    );
  };

  const handleTogglePre = () => {
    const cur = cursorValues.PRE ?? (state.config.asyncActiveLow ? 1 : 0);
    const nextVal: LogicValue = cur === 1 ? 0 : 1;
    setInput('PRE', nextVal);
    setAnnouncement(`PRESET toggled to ${nextVal} at t = ${state.time}.`);
  };

  const handleToggleClr = () => {
    const cur = cursorValues.CLR ?? (state.config.asyncActiveLow ? 1 : 0);
    const nextVal: LogicValue = cur === 1 ? 0 : 1;
    setInput('CLR', nextVal);
    setAnnouncement(`CLEAR toggled to ${nextVal} at t = ${state.time}.`);
  };

  const handleLoadPreset = (presetId: string) => {
    const preset = PRESET_SCENARIOS.find((p) => p.id === presetId);
    if (preset) {
      loadPreset(preset);
      setAnnouncement(`Loaded preset scenario: ${preset.title}.`);
    }
  };

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      {/* Live Region for Screen Reader Announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Header & Scenario Selection */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Interactive Clock & Stimulus Stepper
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Toggle inputs, pulse clock edges, step through time, or load educational presets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="scenario-select" className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            Presets:
          </label>
          <select
            id="scenario-select"
            aria-label="Preset Scenarios Menu"
            onChange={(e) => {
              if (e.target.value) handleLoadPreset(e.target.value);
            }}
            defaultValue=""
            className="rounded-lg border border-gray-300 bg-white p-1.5 text-xs text-gray-900 shadow-2xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="" disabled>
              Select an educational scenario...
            </option>
            {PRESET_SCENARIOS.map((p: FlipFlopPreset) => (
              <option key={p.id} value={p.id}>
                [{p.config.type}] {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Signal Status Readout Badges */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono text-xs">
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 dark:border-gray-800 dark:bg-gray-950">
          <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Current Time
          </span>
          <p className="mt-1 text-sm font-bold text-gray-900 dark:text-gray-100">
            t = {state.time}
          </p>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 dark:border-gray-800 dark:bg-gray-950">
          <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Clock Level
          </span>
          <p className="mt-1 text-sm font-bold text-gray-900 dark:text-gray-100">
            CLK = {cursorValues.CLK}
          </p>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-2.5 dark:border-blue-900/50 dark:bg-blue-950/30">
          <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
            Normal Output (Q)
          </span>
          <p className="mt-1 text-sm font-bold text-blue-700 dark:text-blue-300">
            Q = {cursorValues.Q}
          </p>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 dark:border-gray-800 dark:bg-gray-950">
          <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Complemented (Q&apos;)
          </span>
          <p className="mt-1 text-sm font-bold text-gray-700 dark:text-gray-300">
            Q&apos; = {cursorValues.Qbar}
          </p>
        </div>
      </div>

      {/* Action Buttons Toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* Data Inputs Toggle Group */}
        <div className="flex items-center gap-2">
          {names.map((name) => {
            const val = cursorValues.inputs[name] ?? 0;
            return (
              <button
                key={name}
                type="button"
                onClick={() => handleToggleInput(name)}
                aria-label={`Toggle input ${name}, currently ${val}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 shadow-2xs hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                <span>{name} =</span>
                <span
                  className={`rounded-sm px-1.5 py-0.5 text-xs ${
                    val === 1
                      ? 'bg-blue-600 text-white'
                      : val === 0
                      ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  {val}
                </span>
              </button>
            );
          })}
        </div>

        {/* Clock Controls */}
        <div className="flex items-center gap-2 border-l border-gray-200 pl-3 dark:border-gray-800">
          <button
            type="button"
            onClick={handleToggleClock}
            aria-label={`Toggle clock transition, current level ${cursorValues.CLK}`}
            aria-pressed={cursorValues.CLK === 1}
            className="flipflop-clock-toggle inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-xs"
          >
            <span>Toggle CLK ({cursorValues.CLK})</span>
          </button>

          <button
            type="button"
            onClick={handlePulseClock}
            aria-label="Pulse clock full cycle"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <span>Pulse Clock</span>
          </button>
        </div>

        {/* Asynchronous Controls if enabled */}
        {state.config.asyncControls && (
          <div className="flex items-center gap-2 border-l border-gray-200 pl-3 dark:border-gray-800">
            <button
              type="button"
              onClick={handleTogglePre}
              aria-label={`Toggle PRESET pin, currently ${cursorValues.PRE ?? 1}`}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 shadow-2xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              PRE = {cursorValues.PRE ?? 1}
            </button>
            <button
              type="button"
              onClick={handleToggleClr}
              aria-label={`Toggle CLEAR pin, currently ${cursorValues.CLR ?? 1}`}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 shadow-2xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              CLR = {cursorValues.CLR ?? 1}
            </button>
          </div>
        )}

        {/* Timeline Advancement, Undo, Reset */}
        <div className="flex items-center gap-2 border-l border-gray-200 pl-3 dark:border-gray-800">
          <button
            type="button"
            onClick={() => advance(advanceAmount)}
            aria-label={`Advance timeline by ${advanceAmount} time units`}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            Advance +{advanceAmount}
          </button>

          <input
            type="number"
            min={1}
            max={50}
            value={advanceAmount}
            onChange={(e) => setAdvanceAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
            aria-label="Advance amount units"
            className="w-12 rounded-lg border border-gray-300 p-1 text-center font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />

          <button
            type="button"
            onClick={undoLast}
            disabled={!hasHistory}
            aria-label="Undo last stimulus action"
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            Undo
          </button>

          <button
            type="button"
            onClick={reset}
            aria-label="Reset timeline session"
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Timeline Cursor Stepping Slider */}
      <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800 space-y-2">
        <div className="flex flex-wrap items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
          <label htmlFor="timeline-cursor-slider">
            Inspection Cursor Timestamp: <span className="font-mono font-bold text-red-600">t = {state.cursor}</span>
          </label>
          <div className="flex items-center gap-2 font-normal">
            <button
              type="button"
              onClick={prevEvent}
              aria-label="Step cursor to previous event"
              className="rounded-md border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Previous Event
            </button>
            <button
              type="button"
              onClick={nextEvent}
              aria-label="Step cursor to next event"
              className="rounded-md border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Next Event
            </button>
          </div>
        </div>

        <input
          id="timeline-cursor-slider"
          type="range"
          min={0}
          max={maxTraceTime}
          value={state.cursor}
          onChange={(e) => setCursor(parseInt(e.target.value, 10) || 0)}
          aria-label="Timeline inspection cursor position"
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-red-600"
        />
      </div>
    </div>
  );
};
