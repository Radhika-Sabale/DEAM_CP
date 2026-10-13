/**
 * @file App.tsx
 * Top-level application component composing the AppShell, hash-based navigation listener,
 * debounced project autosave, and lazy-loaded module placeholder viewports.
 */

import {
  type FC,
  Suspense,
  useEffect,
} from 'react';
import { AppShell } from './components/layout/AppShell';
import { SendToNextButton } from './components/layout/SendToNextButton';
import { useTheme } from './hooks/useTheme';
import { getModule, MODULE_REGISTRY } from './modules/registry';
import { createDebouncedAutosave, saveProject } from './store/persistence';
import { useProjectStore } from './store/projectStore';
import { selectCurrentModule, useUiStore } from './store/uiStore';
import type { ModuleId } from './types/designProject';

export const App: FC = () => {
  // Initialize theme synchronization with OS/storage
  useTheme();

  const currentModuleId = useUiStore(selectCurrentModule);
  const setModule = useUiStore((state) => state.setModule);

  // We use client-side window.location.hash for routing so the app remains fully static and offline-capable without a server or router package.
  useEffect(() => {
    const handleHashSync = (): void => {
      const raw = window.location.hash.replace(/^#\/?/, '');
      const aliasMap: Record<string, ModuleId> = {
        boolean: 'boolean-tool',
        'boolean-tool': 'boolean-tool',
        kmap: 'kmap-solver',
        'kmap-solver': 'kmap-solver',
        circuit: 'circuit-simulator',
        'circuit-simulator': 'circuit-simulator',
        flipflop: 'flipflop-simulator',
        'flipflop-simulator': 'flipflop-simulator',
        sequential: 'sequential-designer',
        'sequential-designer': 'sequential-designer',
        'number-systems': 'number-systems',
        practice: 'practice',
        quiz: 'quiz',
        'prepost-test': 'prepost-test',
        'sus-survey': 'sus-survey',
        'teacher-dashboard': 'teacher-dashboard',
        alu: 'alu',
        '8086-cpu': '8086-cpu',
        'interrupt-controller': 'interrupt-controller',
      };
      const resolved =
        aliasMap[raw] ||
        (MODULE_REGISTRY.some((m) => m.id === raw) ? (raw as ModuleId) : undefined);
      if (resolved) {
        setModule(resolved);
      }
    };

    // Sync on initial load
    if (window.location.hash) {
      handleHashSync();
    } else {
      window.location.hash = `#${currentModuleId}`;
    }

    window.addEventListener('hashchange', handleHashSync);
    return () => {
      window.removeEventListener('hashchange', handleHashSync);
    };
  }, [currentModuleId, setModule]);

  // Wire debounced background autosave to persist changes safely without interrupting UI typing
  useEffect(() => {
    const debouncedSave = createDebouncedAutosave((p) => {
      saveProject(p);
      useProjectStore.getState().markClean();
    }, 1200);

    const unsubscribe = useProjectStore.subscribe((state) => {
      if (state.isDirty) {
        debouncedSave(state.project);
      }
    });

    return () => {
      debouncedSave.cancel();
      unsubscribe();
    };
  }, []);

  const activeModule = getModule(currentModuleId);
  const ActiveComponent = activeModule?.component;

  return (
    <AppShell>
      <div className="space-y-6">
        <Suspense
          fallback={
            <div
              role="status"
              className="flex items-center justify-center p-12 text-sm text-gray-500"
            >
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mr-2" />
              Loading module...
            </div>
          }
        >
          {ActiveComponent ? (
            <ActiveComponent />
          ) : (
            <div className="p-8 text-center text-red-600">
              Module "{currentModuleId}" not found.
            </div>
          )}
        </Suspense>

        {/* Transition Handoff Button */}
        <div className="flex justify-end border-t border-gray-200 pt-4 dark:border-gray-800">
          <SendToNextButton />
        </div>
      </div>
    </AppShell>
  );
};

export default App;
