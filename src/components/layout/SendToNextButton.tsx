/**
 * @file SendToNextButton.tsx
 * Pipeline transition control that validates handoff prerequisites against the shared
 * project model and transitions state to downstream modules with accessible error guidance.
 */

import { type FC, useId, useState } from 'react';
import {
  checkHandoffReadiness,
  getNextModules,
  type ModuleEntry,
} from '../../modules/registry';
import { selectCurrentProject, useProjectStore } from '../../store/projectStore';
import { selectCurrentModule, useUiStore } from '../../store/uiStore';
import type { ProjectPatch } from '../../types/designProject';
import { Button } from '../ui/Button';
import { ArrowRightIcon, ChevronDownIcon } from '../ui/Icons';

export interface SendToNextButtonProps {
  /** Optional patch emitted by current module during handoff */
  pendingPatch?: ProjectPatch;
}

export const SendToNextButton: FC<SendToNextButtonProps> = ({ pendingPatch }) => {
  const currentModule = useUiStore(selectCurrentModule);
  const setModule = useUiStore((state) => state.setModule);
  const pushToast = useUiStore((state) => state.pushToast);

  const project = useProjectStore(selectCurrentProject);
  const applyPatch = useProjectStore((state) => state.applyPatch);
  const markModuleCompleted = useProjectStore((state) => state.markModuleCompleted);

  const [menuOpen, setMenuOpen] = useState(false);
  const errorDescriptionId = useId();

  const nextModules = getNextModules(currentModule);

  if (nextModules.length === 0) {
    return null; // Terminal module reached
  }

  const executeHandoff = (target: ModuleEntry): void => {
    const missing = checkHandoffReadiness(project, currentModule, target.id);
    if (missing.length > 0) {
      pushToast({
        level: 'warning',
        title: 'Prerequisites Not Met',
        message: missing.join(' '),
      });
      return;
    }

    // Apply pending module data and record handoff metadata
    const finalPatch: ProjectPatch = {
      ...(pendingPatch ?? {}),
      lastHandoff: {
        from: currentModule,
        to: target.id,
        timestamp: new Date().toISOString(),
        summary: `Handoff from ${currentModule} to ${target.id}`,
      },
    };

    applyPatch(finalPatch);
    markModuleCompleted(currentModule);
    setModule(target.id);

    pushToast({
      level: 'success',
      title: 'Handoff Successful',
      message: `Completed ${currentModule} and navigated to ${target.title}.`,
    });
  };

  // Single target destination
  if (nextModules.length === 1) {
    const target = nextModules[0] as ModuleEntry;
    const missing = checkHandoffReadiness(project, currentModule, target.id);
    const isReady = missing.length === 0;

    return (
      <div className="flex flex-col items-end gap-1.5">
        <Button
          variant="primary"
          size="md"
          disabled={!isReady}
          aria-describedby={!isReady ? errorDescriptionId : undefined}
          onClick={() => executeHandoff(target)}
          rightIcon={<ArrowRightIcon className="h-4 w-4" />}
        >
          Send to {target.title}
        </Button>
        {!isReady && (
          <p
            id={errorDescriptionId}
            className="max-w-xs text-right text-xs text-amber-600 dark:text-amber-400"
          >
            {missing[0]}
          </p>
        )}
      </div>
    );
  }

  // Multiple possible target destinations (e.g. Sequential Designer -> K-Map or Circuit)
  return (
    <div className="relative inline-block text-left">
      <Button
        variant="primary"
        size="md"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        rightIcon={<ChevronDownIcon className="h-4 w-4" />}
      >
        Send to Next Module...
      </Button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-64 origin-top-right rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-800 dark:bg-gray-900"
        >
          {nextModules.map((target) => {
            const missing = checkHandoffReadiness(project, currentModule, target.id);
            const isReady = missing.length === 0;

            return (
              <button
                key={target.id}
                role="menuitem"
                type="button"
                disabled={!isReady}
                onClick={() => {
                  setMenuOpen(false);
                  executeHandoff(target);
                }}
                className="flex w-full flex-col rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-transparent dark:hover:bg-gray-800"
              >
                <div className="flex items-center justify-between font-semibold text-gray-900 dark:text-gray-100">
                  <span>{target.title}</span>
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </div>
                {!isReady && (
                  <span className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    {missing[0]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
