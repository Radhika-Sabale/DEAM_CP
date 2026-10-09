/**
 * @file SusPage.tsx
 * Standard System Usability Scale (SUS) 10-item questionnaire page (Stage 11C).
 *
 * Implements 10 Brooke (1996) survey items with 5-point scale text labels, accessible
 * radio groups, progress indicator, incomplete item validation naming missing questions,
 * scoring calculation with percentile interpretation band and rough guide notice,
 * and telemetry logging.
 */

import { type FC, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { scoreSus, SUS_ITEMS } from '../../engine/evaluation/sus';
import type { SusInterpretation } from '../../engine/evaluation/types';
import { useLogStore } from '../../store/logStore';
import { useStudyStore } from '../../store/studyStore';
import type { SusResponse } from '../../types/logging';

const SCALE_LABELS = [
  { value: 1, text: 'Strongly disagree' },
  { value: 2, text: 'Disagree' },
  { value: 3, text: 'Neutral' },
  { value: 4, text: 'Agree' },
  { value: 5, text: 'Strongly agree' },
] as const;

export const SusPage: FC = () => {
  const [responses, setResponses] = useState<Record<number, number>>({});
  const [missingItems, setMissingItems] = useState<readonly number[]>([]);
  const [interpretation, setInterpretation] = useState<SusInterpretation | null>(null);

  const setLatestSusResult = useStudyStore((s) => s.setLatestSusResult);

  const answeredCount = Object.keys(responses).length;

  const handleSelect = (itemIndex: number, val: number) => {
    setResponses((prev) => ({ ...prev, [itemIndex]: val }));
    if (missingItems.includes(itemIndex + 1)) {
      setMissingItems((prev) => prev.filter((i) => i !== itemIndex + 1));
    }
  };

  const handleSubmit = () => {
    const missing: number[] = [];
    const values: number[] = [];

    for (let i = 0; i < SUS_ITEMS.length; i++) {
      const val = responses[i];
      if (val === undefined) {
        missing.push(i + 1);
      } else {
        values.push(val);
      }
    }

    if (missing.length > 0) {
      setMissingItems(missing);
      return;
    }

    const susResp: SusResponse = {
      items: values as unknown as SusResponse['items'],
    };

    const scored = scoreSus(susResp);
    if (scored.ok) {
      const interp: SusInterpretation = {
        score: scored.value.score,
        benchmark: 68.0,
        adjectiveBand: scored.value.score >= 85 ? 'Excellent' : scored.value.score >= 70 ? 'Good' : scored.value.score >= 50 ? 'OK' : 'Poor',
        grade: scored.value.score >= 80 ? 'A' : scored.value.score >= 70 ? 'B' : scored.value.score >= 60 ? 'C' : scored.value.score >= 50 ? 'D' : 'F',
        isAcceptable: scored.value.score >= 70,
        itemScores: scored.value.itemScores,
        note: 'The SUS score is a percentile ranking on a 0–100 scale, not a percentage mark. A score of 68 is the industry benchmark average. This interpretation is a rough guide.',
      };

      setInterpretation(interp);
      setLatestSusResult(scored.value);

      useLogStore.getState().logEvent({
        eventType: 'sus-submitted',
        moduleId: 'sus',
        score: scored.value.score,
        responses: susResp,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          System Usability Scale (SUS)
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Standard 10-item instrument measuring usability and subjective learnability.
        </p>
      </div>

      {interpretation ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 text-xl font-bold">
            ✓
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Your Usability Score
            </span>
            <div className="mt-2 text-5xl font-black text-blue-600 dark:text-blue-400">
              {interpretation.score.toFixed(1)} / 100
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <span>Interpretation: {interpretation.adjectiveBand}</span>
              <span>•</span>
              <span>Grade {interpretation.grade}</span>
              <span>•</span>
              <span className={interpretation.isAcceptable ? 'text-emerald-600' : 'text-amber-600'}>
                {interpretation.isAcceptable ? 'Acceptable' : 'Marginal'}
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-4 text-xs leading-relaxed text-gray-600 dark:bg-gray-800/60 dark:text-gray-300 max-w-xl mx-auto">
            <span className="font-semibold">Note: </span>
            {interpretation.note}
          </div>

          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              setResponses({});
              setInterpretation(null);
            }}
          >
            Retake Questionnaire
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold">Progress</span>
            <span>{answeredCount} of {SUS_ITEMS.length} answered</span>
          </div>

          {/* Validation Alert */}
          {missingItems.length > 0 && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
            >
              <span className="font-bold">Missing Responses: </span>
              Please answer the following items before submitting: {missingItems.map((n) => `Item ${n}`).join(', ')}.
            </div>
          )}

          {/* 10 Survey Items */}
          <div className="space-y-4">
            {SUS_ITEMS.map((itemText, idx) => {
              const selectedVal = responses[idx];
              const isMissing = missingItems.includes(idx + 1);

              return (
                <div
                  key={idx}
                  className={`rounded-xl border p-5 transition-colors ${
                    isMissing
                      ? 'border-red-300 bg-red-50/20 dark:border-red-800'
                      : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    {idx + 1}. {itemText}
                  </p>

                  <div
                    role="radiogroup"
                    aria-label={`Item ${idx + 1}: ${itemText}`}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-5"
                  >
                    {SCALE_LABELS.map((opt) => {
                      const isChecked = selectedVal === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={`flex items-center sm:flex-col sm:justify-center gap-2 rounded-lg border p-2.5 cursor-pointer text-center transition-all ${
                            isChecked
                              ? 'border-blue-600 bg-blue-50/80 ring-1 ring-blue-600 dark:border-blue-500 dark:bg-blue-950/50'
                              : 'border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/40'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`sus-item-${idx}`}
                            value={opt.value}
                            checked={isChecked}
                            onChange={() => handleSelect(idx, opt.value)}
                            className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {opt.text}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-4">
            <Button variant="primary" size="lg" onClick={handleSubmit}>
              Submit Usability Evaluation
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
