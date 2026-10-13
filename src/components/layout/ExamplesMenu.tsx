/**
 * @file ExamplesMenu.tsx
 * Interactive, accessible modal dialog listing curated seed problems grouped by module and difficulty.
 * Allows students to instantiate a seed problem into a new DesignProject and navigate to its home module.
 */

import { type FC, useMemo, useState } from 'react';
import { loadSeedProblems, seedToProject } from '../../engine/practice/seed/loader';
import type { SeedProblem } from '../../engine/practice/seed/types';
import { MODULE_REGISTRY } from '../../modules/registry';
import { selectIsDirty, useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { createEmptyDesignProject, type DesignProject } from '../../types/designProject';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

/** Props for the ExamplesMenu modal component. */
export interface ExamplesMenuProps {
  /** Controlled open state of the examples modal. */
  isOpen: boolean;
  /** Callback invoked when the modal is closed. */
  onClose: () => void;
}

/**
 * Accessible Examples modal providing filtered browsing and instantiation of seed problems.
 */
export const ExamplesMenu: FC<ExamplesMenuProps> = ({ isOpen, onClose }) => {
  const isDirty = useProjectStore(selectIsDirty);
  const setProject = useProjectStore((state) => state.setProject);
  const setModule = useUiStore((state) => state.setModule);
  const pushToast = useUiStore((state) => state.pushToast);

  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [pendingProblem, setPendingProblem] = useState<SeedProblem | null>(null);

  const allProblems = useMemo(() => loadSeedProblems().problems, []);

  const filteredProblems = useMemo(() => {
    return allProblems.filter((p) => {
      if (selectedModule !== 'all' && p.moduleId !== selectedModule) return false;
      if (selectedDifficulty !== 'all' && p.difficulty !== selectedDifficulty) return false;
      return true;
    });
  }, [allProblems, selectedModule, selectedDifficulty]);

  const executeOpenExample = (problem: SeedProblem): void => {
    const payload = seedToProject(problem);
    const newProj: DesignProject = {
      ...createEmptyDesignProject(crypto.randomUUID(), payload.name),
      ...payload.patch,
    };

    setProject(newProj);
    setModule(payload.targetModule);
    pushToast({
      level: 'success',
      title: 'Example Loaded',
      message: `Opened "${problem.title}" in ${problem.moduleId}.`,
    });
    setPendingProblem(null);
    onClose();
  };

  const handleSelectProblem = (problem: SeedProblem): void => {
    if (isDirty) {
      setPendingProblem(problem);
    } else {
      executeOpenExample(problem);
    }
  };

  const difficultyBadgeClass = (diff: string): string => {
    switch (diff) {
      case 'easy':
        return 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300';
      case 'medium':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
      case 'hard':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Open Curated Example">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
            {/* Module Filter */}
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
              Module:
              <select
                aria-label="Filter by Module"
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="all">All Modules</option>
                {MODULE_REGISTRY.filter((m) => m.phase === 1).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>

            {/* Difficulty Filter */}
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
              Difficulty:
              <select
                aria-label="Filter by Difficulty"
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
          </div>

          {/* Problem List */}
          <div
            role="region"
            aria-label="Example Problems List"
            className="max-h-[380px] overflow-y-auto space-y-2 pr-1"
          >
            {filteredProblems.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                No examples match the chosen filter criteria.
              </p>
            ) : (
              filteredProblems.map((problem) => (
                <button
                  key={problem.id}
                  type="button"
                  onClick={() => handleSelectProblem(problem)}
                  className="group flex w-full flex-col items-start rounded-lg border border-gray-200 bg-white p-3 text-left transition hover:border-blue-400 hover:bg-blue-50/40 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-600 dark:hover:bg-blue-950/20 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-gray-900 group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-400">
                      {problem.title}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${difficultyBadgeClass(problem.difficulty)}`}
                    >
                      {problem.difficulty}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-gray-500 dark:text-gray-400">
                    {problem.statement}
                  </p>
                  <span className="mt-2 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                    Module: {problem.moduleId}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal when project has unsaved edits */}
      <Modal
        isOpen={Boolean(pendingProblem)}
        onClose={() => setPendingProblem(null)}
        title="Discard Unsaved Changes?"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Your active project contains unsaved modifications. Opening the example{' '}
            <strong className="text-gray-900 dark:text-gray-100 font-semibold">
              &quot;{pendingProblem?.title}&quot;
            </strong>{' '}
            will create a new project and replace your current unsaved state.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingProblem(null)}>
              Keep Editing Current Project
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (pendingProblem) {
                  executeOpenExample(pendingProblem);
                }
              }}
            >
              Discard and Open Example
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
