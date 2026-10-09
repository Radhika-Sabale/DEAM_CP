/**
 * @file PracticeControls.tsx
 * Module selection with availability gating, difficulty picker, deterministic seed,
 * and rule-based adaptive difficulty recommendation (Stage 11C).
 */

import { type FC } from 'react';
import { Button } from '../../components/ui/Button';
import {
  DIFFICULTY_ORDER,
  difficultyLabel,
  suggestNextDifficulty,
  type Difficulty,
  type RecentResult,
} from '../../engine/practice';
import { listAvailableModules } from '../../engine/practice';
import { MODULE_REGISTRY } from '../registry';

export interface PracticeControlsProps {
  readonly selectedModule: string;
  readonly difficulty: Difficulty;
  readonly seed: number;
  readonly recentResults: readonly RecentResult[];
  readonly onSelectModule: (moduleId: string) => void;
  readonly onChangeDifficulty: (difficulty: Difficulty) => void;
  readonly onChangeSeed: (seed: number) => void;
  readonly onGenerate: () => void;
}

export const PracticeControls: FC<PracticeControlsProps> = ({
  selectedModule,
  difficulty,
  seed,
  recentResults,
  onSelectModule,
  onChangeDifficulty,
  onChangeSeed,
  onGenerate,
}) => {
  const availableSet = new Set(listAvailableModules());
  const suggestedDiff = suggestNextDifficulty(difficulty, recentResults);

  // Derive human-readable explanation for adaptive suggestion
  let adaptiveReason = 'Practise more to receive adaptive tier recommendations.';
  if (recentResults.length >= 2) {
    const last2 = recentResults.slice(-2);
    if (last2[0]?.correct && last2[0]?.unassisted && last2[1]?.correct && last2[1]?.unassisted) {
      adaptiveReason = 'Based on 2 consecutive unassisted correct steps.';
    } else if (!last2[0]?.correct && !last2[1]?.correct) {
      adaptiveReason = 'Based on 2 consecutive incorrect attempts.';
    } else if (recentResults.filter((r) => r.usedLevel3Hint).length >= 2) {
      adaptiveReason = 'Based on multiple worked step hints requested.';
    } else {
      adaptiveReason = 'Steady performance: maintaining current challenge level.';
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Module Picker */}
        <div>
          <label
            htmlFor="practice-module-select"
            className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Module
          </label>
          <select
            id="practice-module-select"
            value={selectedModule}
            onChange={(e) => onSelectModule(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            {MODULE_REGISTRY.map((mod) => {
              const hasGen = availableSet.has(mod.id);
              return (
                <option
                  key={mod.id}
                  value={mod.id}
                  disabled={!hasGen}
                >
                  {mod.title} {!hasGen ? '(No practice generator available)' : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* Difficulty Picker */}
        <div>
          <label
            htmlFor="practice-difficulty-select"
            className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Difficulty
          </label>
          <select
            id="practice-difficulty-select"
            value={difficulty}
            onChange={(e) => onChangeDifficulty(e.target.value as Difficulty)}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            {DIFFICULTY_ORDER.map((d) => (
              <option key={d} value={d}>
                {difficultyLabel(d)}
              </option>
            ))}
          </select>
        </div>

        {/* Seed Input */}
        <div>
          <label
            htmlFor="practice-seed-input"
            className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Problem Seed
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="practice-seed-input"
              type="number"
              value={seed}
              onChange={(e) => onChangeSeed(Number(e.target.value))}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 font-mono"
            />
            <Button
              variant="primary"
              size="md"
              onClick={onGenerate}
              className="shrink-0"
            >
              New problem
            </Button>
          </div>
        </div>
      </div>

      {/* Adaptive Difficulty Suggestion (Advisory only) */}
      <div className="flex flex-wrap items-center justify-between rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
        <div>
          <span className="font-semibold">Adaptive Recommendation: </span>
          <span>
            Try {difficultyLabel(suggestedDiff)} next. {adaptiveReason}
          </span>
        </div>
        {suggestedDiff !== difficulty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChangeDifficulty(suggestedDiff)}
            className="mt-1 sm:mt-0 text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200"
          >
            Switch to {difficultyLabel(suggestedDiff)}
          </Button>
        )}
      </div>
    </div>
  );
};
