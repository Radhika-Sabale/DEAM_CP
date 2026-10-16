/**
 * @file PipelineStepper.tsx
 * Multi-flow pipeline progression stepper illustrating synthesis workflow stages
 * with multi-channel status representation (text + icons + aria-current) and keyboard navigation.
 */

import { type FC, useState } from 'react';
import { getModule, getPipelineFor } from '../../modules/registry';
import { selectCompletedModules, useProjectStore } from '../../store/projectStore';
import { selectCurrentModule, useUiStore } from '../../store/uiStore';
import type { ModuleId } from '../../types/designProject';
import { CheckIcon } from '../ui/Icons';

export const PipelineStepper: FC = () => {
  const currentModule = useUiStore(selectCurrentModule);
  const setModule = useUiStore((state) => state.setModule);
  const completedModules = useProjectStore(selectCompletedModules);

  const [activeFlow, setActiveFlow] = useState<'combinational' | 'sequential'>('combinational');

  const pipeline = getPipelineFor(activeFlow);

  return (
    <nav
      aria-label="Design synthesis pipeline stages"
      className="pipeline-stepper mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {activeFlow === 'combinational'
              ? 'Combinational Logic Flow'
              : 'Sequential Machine Flow'}
          </h2>
        </div>

        {/* Flow Switcher */}
        <div
          role="group"
          aria-label="Workflow pipeline selection"
          className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
        >
          <button
            type="button"
            onClick={() => setActiveFlow('combinational')}
            aria-pressed={activeFlow === 'combinational'}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
              activeFlow === 'combinational'
                ? 'bg-white text-blue-700 shadow-xs dark:bg-gray-900 dark:text-blue-400 font-semibold'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Combinational
          </button>
          <button
            type="button"
            onClick={() => setActiveFlow('sequential')}
            aria-pressed={activeFlow === 'sequential'}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
              activeFlow === 'sequential'
                ? 'bg-white text-blue-700 shadow-xs dark:bg-gray-900 dark:text-blue-400 font-semibold'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Sequential
          </button>
        </div>
      </div>

      <ol className="pipeline-step-list flex flex-col gap-2 py-1">
        {pipeline.map((stepId: ModuleId, index: number) => {
          const def = getModule(stepId);
          if (!def) return null;

          const isCurrent = currentModule === stepId;
          const isCompleted = completedModules.includes(stepId);

          const statusText = isCurrent
            ? 'Current'
            : isCompleted
            ? 'Completed'
            : 'Upcoming';

          return (
            <li key={stepId} className="min-w-0">
              <button
                type="button"
                onClick={() => setModule(stepId)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`group flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  isCurrent
                    ? 'border-blue-600 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/40 ring-1 ring-blue-600/30'
                    : isCompleted
                    ? 'border-green-300 bg-green-50/40 hover:bg-green-50 dark:border-green-900 dark:bg-green-950/20'
                    : 'border-gray-200 bg-gray-50/50 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-950/40'
                }`}
              >
                {/* Visual Icon indicator */}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isCurrent
                      ? 'bg-blue-600 text-white dark:bg-blue-500'
                      : isCompleted
                      ? 'bg-green-600 text-white dark:bg-green-500'
                      : 'border border-gray-300 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">
                    {def.title}
                  </div>
                  {/* Explicit text label ensures state is never communicated by color alone */}
                  <span
                    className={`inline-block text-[11px] font-medium ${
                      isCurrent
                        ? 'text-blue-700 dark:text-blue-300 font-bold'
                        : isCompleted
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    ({statusText})
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
