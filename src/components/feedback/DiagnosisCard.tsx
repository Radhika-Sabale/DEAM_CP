/**
 * @file DiagnosisCard.tsx
 * Accessible diagnostic card displaying step-level feedback, expected vs student values,
 * misconception cognitive descriptions, and AI friendly rephrasings without obscuring
 * authoritative deterministic explanations.
 */

import { type FC, useEffect, useRef, useState } from 'react';
import type { Diagnosis } from '../../types/feedback';
import { getMisconception } from '../../engine/feedback/misconceptions';
import { stringifyExpected, stringifyGot } from '../../engine/feedback/diagnosis';
import { useLogStore } from '../../store/logStore';

export interface DiagnosisCardProps {
  readonly diagnosis: Diagnosis;
  readonly friendlyText?: string;
  readonly onShowFullExplanation?: () => void;
  readonly className?: string;
}

export const DiagnosisCard: FC<DiagnosisCardProps> = ({
  diagnosis,
  friendlyText,
  onShowFullExplanation,
  className = '',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [hasLoggedFull, setHasLoggedFull] = useState<boolean>(false);

  // Focus management: keyboard focus immediately shifts to the alert on mount
  useEffect(() => {
    cardRef.current?.focus();
  }, [diagnosis]);

  const gotStr = stringifyGot(diagnosis.got);
  const expectedStr = stringifyExpected(diagnosis.expected);

  let misconceptionTitle = '';
  let misconceptionDesc = '';
  if (diagnosis.misconceptionTag) {
    try {
      const entry = getMisconception(diagnosis.misconceptionTag);
      misconceptionTitle = entry.title;
      misconceptionDesc = entry.description;
    } catch {
      // Fallback if tag is unmapped
    }
  }

  const handleToggleExplanation = () => {
    const next = !showExplanation;
    setShowExplanation(next);

    // Pedagogical honesty rule: Revealing the full explanation is equivalent to a Level 3 hint
    if (next && !hasLoggedFull) {
      setHasLoggedFull(true);
      onShowFullExplanation?.();
      useLogStore.getState().logEvent({
        eventType: 'hint-used',
        moduleId: 'feedback',
        stepId: diagnosis.step,
        level: 3,
      });
    }
  };

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      role="alert"
      aria-live="polite"
      className={`rounded-xl border border-red-300 bg-red-50/70 p-5 shadow-xs transition-all dark:border-red-900/60 dark:bg-red-950/30 ${className}`}
    >
      {/* Header with Icon and Error Type */}
      <div className="flex items-center justify-between gap-3 border-b border-red-200/80 pb-3 dark:border-red-900/40">
        <div className="flex items-center gap-2">
          {/* Status cross icon */}
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
            aria-hidden="true"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </span>
          <span className="text-sm font-bold text-red-900 dark:text-red-200">
            Incorrect &bull; {diagnosis.step}
          </span>
        </div>
        <span className="rounded-md bg-red-100/80 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-red-800 dark:bg-red-900/40 dark:text-red-300">
          {diagnosis.errorType}
        </span>
      </div>

      {/* Side-by-Side Comparison: You Wrote vs Expected */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-red-200 bg-white/80 p-3 dark:border-red-900/30 dark:bg-gray-900/60">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            You wrote:
          </span>
          <p className="mt-1 font-mono text-sm font-bold text-red-700 dark:text-red-400">
            {gotStr || '(empty)'}
          </p>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-white/80 p-3 dark:border-emerald-900/30 dark:bg-gray-900/60">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Expected:
          </span>
          <p className="mt-1 font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
            {expectedStr}
          </p>
        </div>
      </div>

      {/* Misconception Headline & Description */}
      {misconceptionTitle && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
            <svg
              className="h-4 w-4 text-amber-600 dark:text-amber-400"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            Cognitive Diagnosis: {misconceptionTitle}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-amber-950 dark:text-amber-300">
            {misconceptionDesc}
          </p>
        </div>
      )}

      {/* Immediate Hint */}
      {diagnosis.hint && (
        <div className="mt-3 text-xs text-gray-800 dark:text-gray-200">
          <span className="font-semibold">Hint: </span>
          {diagnosis.hint}
        </div>
      )}

      {/* Disclosure for Full Explanation */}
      <div className="mt-4 border-t border-red-200/60 pt-3 dark:border-red-900/30">
        <button
          type="button"
          onClick={handleToggleExplanation}
          className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-900 hover:underline dark:text-red-400 dark:hover:text-red-300"
        >
          <span>{showExplanation ? 'Hide full explanation' : 'Show full explanation'}</span>
          <svg
            className={`h-3.5 w-3.5 transition-transform ${showExplanation ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showExplanation && (
          <div className="mt-3 space-y-3">
            {/* AI Rephrased text if present */}
            {friendlyText && (
              <div className="rounded-lg border border-purple-200 bg-purple-50/80 p-3 dark:border-purple-900/40 dark:bg-purple-950/40">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300">
                  Rephrased by AI
                </span>
                <p className="mt-1 text-xs text-purple-950 dark:text-purple-200">
                  {friendlyText}
                </p>
              </div>
            )}

            {/* Authoritative Deterministic Explanation */}
            <div className="rounded-lg border border-gray-200 bg-white/90 p-3 dark:border-gray-800 dark:bg-gray-900">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Original Explanation
              </span>
              <p className="mt-1 text-xs text-gray-800 dark:text-gray-200">
                {diagnosis.fullExplanation}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
