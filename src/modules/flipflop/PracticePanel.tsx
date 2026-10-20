/**
 * @file PracticePanel.tsx
 * Interactive flip-flop pedagogical practice workbench featuring three training modes:
 * 1. Fill the Characteristic Table
 * 2. Fill the Excitation Table
 * 3. Predict the Clock Pulse Transition
 * Reuses StepChecker, DiagnosisCard, HintLadder, AnswerTrapBanner, useStepTimer, and logStore telemetry.
 */

import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import type { LogicValue } from '../../types/ast';
import type { FlipFlopType } from '../../types/sequential';
import type { StepContext } from '../../engine/feedback/types';
import type { FlipFlopValidationContext } from '../../engine/feedback/validators/flipFlopValidator';
import '../../engine/feedback/validators/flipFlopValidator';
import { inputNames } from '../../engine/flipflop/models';
import { characteristicTable } from '../../engine/flipflop/tables';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';
import { AnswerTrapBanner } from '../../components/feedback/AnswerTrapBanner';
import { StepChecker } from '../../components/feedback/StepChecker';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import type { UseFlipFlopSessionResult } from './useFlipFlopSession';

export interface PracticePanelProps {
  readonly session: UseFlipFlopSessionResult;
  readonly className?: string;
}

const EXCITATION_PAIRS: readonly (readonly [0 | 1, 0 | 1])[] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
];

export const PracticePanel: FC<PracticePanelProps> = ({ session, className = '' }) => {
  const currentType = session.state.config.type;
  const assistedSteps = useFeedbackStore((s) => s.assistedSteps);
  const latestAnswerTrap = useFeedbackStore((s) => s.latestAnswerTrap);
  const logEvent = useLogStore((s) => s.logEvent);

  const [activeTab, setActiveTab] = useState<string>('char-practice');
  const [practiceType, setPracticeType] = useState<FlipFlopType>(currentType);

  // Mode 1: Characteristic Table state
  const [charAnswers, setCharAnswers] = useState<Record<number, LogicValue>>({});
  const [charResults, setCharResults] = useState<Record<number, boolean>>({});

  // Mode 2: Excitation Table state
  const [excAnswers, setExcAnswers] = useState<Record<string, LogicValue>>({});
  const [excResults, setExcResults] = useState<Record<string, boolean>>({});

  // Mode 3: Pulse Prediction state
  const [predictInputs, setPredictInputs] = useState<Record<string, LogicValue>>({ J: 1, K: 0, D: 1, T: 1, S: 1, R: 0 });
  const [predictInitialQ, setPredictInitialQ] = useState<LogicValue>(0);
  const [predictAnswer, setPredictAnswer] = useState<LogicValue>(1);
  const [predictResult, setPredictResult] = useState<boolean | null>(null);

  // Module completion tracking
  const hasLoggedCompletionRef = useRef<boolean>(false);

  const names = useMemo(() => inputNames(practiceType), [practiceType]);
  const charRows = useMemo(() => characteristicTable(practiceType), [practiceType]);

  // Handle Practice Start Telemetry
  useEffect(() => {
    logEvent({
      eventType: 'practice-started',
      moduleId: 'flipflop-simulator',
      exerciseId: activeTab,
    });
  }, [activeTab, logEvent]);

  // Check if entire characteristic table was completed without assistance
  const checkCompletion = (allCorrect: boolean, stepKeys: readonly string[]) => {
    if (allCorrect && !hasLoggedCompletionRef.current) {
      const anyAssisted = stepKeys.some((k) => !!assistedSteps[k]);
      if (!anyAssisted) {
        hasLoggedCompletionRef.current = true;
        logEvent({
          eventType: 'module-completed',
          moduleId: 'flipflop-simulator',
          durationMs: 0,
        });
      }
    }
  };

  const handleReset = () => {
    setCharAnswers({});
    setCharResults({});
    setExcAnswers({});
    setExcResults({});
    setPredictResult(null);
  };

  const tabs: readonly TabItem[] = [
    {
      id: 'char-practice',
      label: 'Fill the characteristic table',
      content: (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Characteristic Table Exercise: {practiceType} Flip-Flop
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Determine next state Q+ for each combination of inputs and present state Q.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="char-type-select" className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                Flip-Flop:
              </label>
              <select
                id="char-type-select"
                value={practiceType}
                onChange={(e) => {
                  setPracticeType(e.target.value as FlipFlopType);
                  handleReset();
                }}
                className="rounded-lg border border-gray-300 bg-white p-1 text-xs text-gray-900 shadow-2xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="SR">SR</option>
                <option value="JK">JK</option>
                <option value="D">D</option>
                <option value="T">T</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {charRows.map((row) => {
              const stepKey = `ff-char-${practiceType}-row-${row.index}`;
              const answer = charAnswers[row.index] ?? 0;
              const charCtx: FlipFlopValidationContext = {
                type: practiceType,
                inputs: row.inputs,
                q: row.q,
              };

              return (
                <StepChecker
                  key={stepKey}
                  moduleId="flipflop-simulator"
                  stepId={stepKey}
                  title={`Row #${row.index}: Inputs (${row.inputs.map((v, i) => `${names[i]}=${v}`).join(', ')}), Q = ${row.q}`}
                  buildSubmission={() => ({
                    moduleId: 'flipflop-simulator',
                    stepId: stepKey,
                    timestamp: new Date().toISOString(),
                    studentAnswer: {
                      kind: 'ff-characteristic-row' as unknown as 'state-table-row',
                      presentState: String(row.q),
                      nextState: String(answer),
                    },
                  })}
                  context={charCtx as unknown as StepContext}
                  onSuccess={() => {
                    const nextResults = { ...charResults, [row.index]: true };
                    setCharResults(nextResults);
                    if (Object.keys(nextResults).length === charRows.length) {
                      checkCompletion(
                        true,
                        charRows.map((r) => `ff-char-${practiceType}-row-${r.index}`)
                      );
                    }
                  }}
                  renderInput={({ isCorrect }) => (
                    <div className="flex items-center gap-3">
                      <label htmlFor={`char-select-${row.index}`} className="font-semibold text-gray-700 dark:text-gray-300">
                        Predicted Next State Q+:
                      </label>
                      <select
                        id={`char-select-${row.index}`}
                        disabled={isCorrect}
                        value={String(answer)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCharAnswers((prev) => ({
                            ...prev,
                            [row.index]: val === '1' ? 1 : val === '0' ? 0 : 'X',
                          }));
                        }}
                        className="rounded-lg border border-gray-300 bg-white p-1.5 font-mono text-xs text-gray-900 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      >
                        <option value="0">0 (Reset / Low)</option>
                        <option value="1">1 (Set / High)</option>
                        <option value="X">X (Indeterminate / Invalid)</option>
                      </select>
                    </div>
                  )}
                />
              );
            })}
          </div>
        </div>
      ),
    },
    {
      id: 'exc-practice',
      label: 'Fill the excitation table',
      content: (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Excitation Table Exercise: {practiceType} Flip-Flop
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Determine the required input pin values to achieve each specified state transition (Q &rarr; Q+).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="exc-type-select" className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                Flip-Flop:
              </label>
              <select
                id="exc-type-select"
                value={practiceType}
                onChange={(e) => {
                  setPracticeType(e.target.value as FlipFlopType);
                  handleReset();
                }}
                className="rounded-lg border border-gray-300 bg-white p-1 text-xs text-gray-900 shadow-2xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="SR">SR</option>
                <option value="JK">JK</option>
                <option value="D">D</option>
                <option value="T">T</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {EXCITATION_PAIRS.map(([q, qNext], idx) => {
              return names.map((name) => {
                const cellKey = `${q}-${qNext}-${name}`;
                const stepKey = `ff-exc-${practiceType}-${cellKey}`;
                const answer = excAnswers[cellKey] ?? 0;
                const excCtx: FlipFlopValidationContext = {
                  type: practiceType,
                  q,
                  qNext,
                  inputName: name,
                };

                return (
                  <StepChecker
                    key={stepKey}
                    moduleId="flipflop-simulator"
                    stepId={stepKey}
                    title={`Transition ${q} → ${qNext} (${name} input)`}
                    description={`Find required input valuation on pin "${name}" to transition Q from ${q} to ${qNext}.`}
                    buildSubmission={() => ({
                      moduleId: 'flipflop-simulator',
                      stepId: stepKey,
                      timestamp: new Date().toISOString(),
                      studentAnswer: {
                        kind: 'excitation-entry',
                        flipFlop: practiceType,
                        presentState: String(q),
                        nextState: String(qNext),
                        inputValues: { [name]: answer },
                      },
                    })}
                    context={excCtx as unknown as StepContext}
                    onSuccess={() => {
                      const nextResults = { ...excResults, [cellKey]: true };
                      setExcResults(nextResults);
                    }}
                    renderInput={({ isCorrect }) => (
                      <div className="flex items-center gap-3">
                        <label htmlFor={`exc-select-${idx}-${name}`} className="font-semibold text-gray-700 dark:text-gray-300">
                          Required Value for {name}:
                        </label>
                        <select
                          id={`exc-select-${idx}-${name}`}
                          disabled={isCorrect}
                          value={String(answer)}
                          onChange={(e) => {
                            const val = e.target.value;
                            setExcAnswers((prev) => ({
                              ...prev,
                              [cellKey]: val === '1' ? 1 : val === '0' ? 0 : 'X',
                            }));
                          }}
                          className="rounded-lg border border-gray-300 bg-white p-1.5 font-mono text-xs text-gray-900 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        >
                          <option value="0">0</option>
                          <option value="1">1</option>
                          <option value="X">X (Don&apos;t-care)</option>
                        </select>
                      </div>
                    )}
                  />
                );
              });
            })}
          </div>
        </div>
      ),
    },
    {
      id: 'pulse-predict',
      label: 'Predict the next pulse',
      content: (
        <div className="space-y-4">
          <div className="border-b border-gray-100 pb-3 dark:border-gray-800">
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Clock Pulse State Prediction Challenge
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Set inputs and initial state, predict resulting Q, verify with feedback, then apply to live simulator.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-950/40 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="predict-init-q" className="block font-semibold text-gray-700 dark:text-gray-300">
                  Initial Output Q(0):
                </label>
                <select
                  id="predict-init-q"
                  value={String(predictInitialQ)}
                  onChange={(e) => setPredictInitialQ(e.target.value === '1' ? 1 : 0)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-1.5 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="0">Q = 0</option>
                  <option value="1">Q = 1</option>
                </select>
              </div>

              {names.map((name) => (
                <div key={name}>
                  <label htmlFor={`predict-in-${name}`} className="block font-semibold text-gray-700 dark:text-gray-300">
                    Input {name}:
                  </label>
                  <select
                    id={`predict-in-${name}`}
                    value={String(predictInputs[name] ?? 0)}
                    onChange={(e) =>
                      setPredictInputs((prev) => ({
                        ...prev,
                        [name]: e.target.value === '1' ? 1 : 0,
                      }))
                    }
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-1.5 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="0">0</option>
                    <option value="1">1</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {(() => {
            const predCtx: FlipFlopValidationContext = {
              type: practiceType,
              config: session.state.config,
              script: {
                initialQ: predictInitialQ,
                initialClock: 0,
                initialInputs: predictInputs,
                events: [
                  { time: 5, signal: 'CLK', value: 1 },
                  { time: 15, signal: 'CLK', value: 0 },
                ],
                endTime: 20,
              },
              pulseIndex: 1,
            };

            return (
              <StepChecker
                moduleId="flipflop-simulator"
                stepId={`ff-predict-pulse-${practiceType}`}
                title={`Predict Q After 1 Clock Pulse (${practiceType} Flip-Flop)`}
                description="Predict output state Q after an active clock edge is applied."
                buildSubmission={() => ({
                  moduleId: 'flipflop-simulator',
                  stepId: `ff-predict-pulse-${practiceType}`,
                  timestamp: new Date().toISOString(),
                  studentAnswer: {
                    kind: 'ff-pulse-prediction' as unknown as 'state-table-row',
                    presentState: String(predictInitialQ),
                    nextState: String(predictAnswer),
                  },
                })}
                context={predCtx as unknown as StepContext}
                onSuccess={() => {
                  setPredictResult(true);
                }}
                renderInput={({ isCorrect }) => (
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label htmlFor="predict-choice" className="font-semibold text-gray-700 dark:text-gray-300">
                        Your Predicted Q:
                      </label>
                      <select
                        id="predict-choice"
                        disabled={isCorrect}
                        value={String(predictAnswer)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPredictAnswer(v === '1' ? 1 : v === '0' ? 0 : 'X');
                        }}
                        className="rounded-lg border border-gray-300 bg-white p-1.5 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      >
                        <option value="0">0 (Reset / Low)</option>
                        <option value="1">1 (Set / High)</option>
                        <option value="X">X (Indeterminate)</option>
                      </select>
                    </div>

                    {predictResult && (
                      <button
                        type="button"
                        onClick={() => {
                          session.setInitialQ(predictInitialQ);
                          for (const name of names) {
                            session.setInput(name, predictInputs[name] ?? 0);
                          }
                          session.pulseClock();
                        }}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 dark:bg-emerald-500"
                      >
                        Apply Predicted Pulse to Simulator
                      </button>
                    )}
                  </div>
                )}
              />
            );
          })()}
        </div>
      ),
    },
  ];

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      {/* Answer Trap Alert if detected */}
      {latestAnswerTrap && (
        <div className="mb-4">
          <AnswerTrapBanner
            flag={latestAnswerTrap}
            onDismiss={() => useFeedbackStore.setState({ latestAnswerTrap: null })}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Interactive Practice & Socratic Evaluation
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Fill characteristic truth tables, derive excitation mappings, and predict clock pulse behavior.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          Reset Practice Work
        </button>
      </div>

      <div className="mt-4">
        <Tabs
          tabs={tabs}
          value={activeTab}
          onChange={(tabId) => setActiveTab(tabId)}
        />
      </div>
    </div>
  );
};
