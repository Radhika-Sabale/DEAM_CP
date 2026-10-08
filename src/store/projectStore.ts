/**
 * @file projectStore.ts
 * Global Zustand store managing the single shared DesignProject state,
 * project metadata summaries, patch application, and completion tracking.
 */

import { create } from 'zustand';
import {
  createEmptyDesignProject,
  type DesignProject,
  type ModuleId,
  type PipelineProgress,
  type ProjectPatch,
} from '../types/designProject';
import {
  deleteProjectById,
  listProjectSummaries,
  loadActiveProjectId,
  loadProjectById,
  type ProjectSummary,
  saveActiveProjectId,
  saveProject,
} from './persistence';

/**
 * Pure function that immutably applies a ProjectPatch to a DesignProject,
 * updating updatedAt and guaranteeing no in-place mutation of the previous object.
 *
 * @param project The current DesignProject
 * @param patch The incoming patch object
 * @returns A new DesignProject instance with patch merged
 */
export function mergeProjectPatch(
  project: DesignProject,
  patch: ProjectPatch
): DesignProject {
  const now = new Date().toISOString();
  return {
    ...project,
    ...patch,
    id: project.id,
    schemaVersion: project.schemaVersion,
    createdAt: project.createdAt,
    updatedAt: now,
  };
}

/**
 * Pure function to idempotently mark a module as completed in PipelineProgress.
 *
 * @param progress Existing pipeline progress or undefined
 * @param moduleId Module identifier to mark completed
 * @returns New PipelineProgress instance
 */
export function addCompletedModule(
  progress: PipelineProgress | undefined,
  moduleId: ModuleId
): PipelineProgress {
  const currentCompleted = progress?.completedModules ?? [];
  if (currentCompleted.includes(moduleId)) {
    return (
      progress ?? {
        completedModules: [moduleId],
      }
    );
  }
  return {
    completedModules: [...currentCompleted, moduleId],
    activeModule: progress?.activeModule,
  };
}

/**
 * Zustand project state interface.
 */
export interface ProjectState {
  /** The currently loaded DesignProject */
  project: DesignProject;
  /** Indexed project summaries for project switching */
  summaries: readonly ProjectSummary[];
  /** True when unsaved changes exist in memory */
  isDirty: boolean;

  /** Actions */
  createProject: (name?: string) => DesignProject;
  loadProject: (id: string) => boolean;
  setProject: (project: DesignProject) => void;
  renameProject: (newName: string) => void;
  deleteProject: (id: string) => void;
  applyPatch: (patch: ProjectPatch) => void;
  markModuleCompleted: (moduleId: ModuleId) => void;
  resetProject: () => void;
  refreshSummaries: () => void;
  markClean: () => void;
}

/**
 * Initializes starting project from storage or creates a fresh default.
 */
function getInitialProject(): DesignProject {
  const activeIdResult = loadActiveProjectId();
  if (activeIdResult.ok && activeIdResult.value) {
    const loaded = loadProjectById(activeIdResult.value);
    if (loaded.ok) {
      return loaded.value;
    }
  }

  const summariesResult = listProjectSummaries();
  if (summariesResult.ok && summariesResult.value.length > 0) {
    const firstId = summariesResult.value[0]?.id;
    if (firstId) {
      const loaded = loadProjectById(firstId);
      if (loaded.ok) {
        return loaded.value;
      }
    }
  }

  const fresh = createEmptyDesignProject();
  saveProject(fresh);
  saveActiveProjectId(fresh.id);
  return fresh;
}

function getInitialSummaries(): readonly ProjectSummary[] {
  const result = listProjectSummaries();
  return result.ok ? result.value : [];
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: getInitialProject(),
  summaries: getInitialSummaries(),
  isDirty: false,

  createProject: (name = 'New Project') => {
    const id = `proj-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const newProject = createEmptyDesignProject(id, name);
    saveProject(newProject);
    saveActiveProjectId(id);

    set({
      project: newProject,
      isDirty: false,
    });
    get().refreshSummaries();
    return newProject;
  },

  loadProject: (id: string) => {
    const result = loadProjectById(id);
    if (result.ok) {
      saveActiveProjectId(id);
      set({
        project: result.value,
        isDirty: false,
      });
      return true;
    }
    return false;
  },

  setProject: (project: DesignProject) => {
    saveProject(project);
    saveActiveProjectId(project.id);
    set({
      project,
      isDirty: false,
    });
    get().refreshSummaries();
  },

  renameProject: (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    set((state) => {
      const updated = {
        ...state.project,
        name: trimmed,
        updatedAt: new Date().toISOString(),
      };
      return { project: updated, isDirty: true };
    });
  },

  deleteProject: (id: string) => {
    deleteProjectById(id);
    const { project } = get();

    if (project.id === id) {
      // Re-initialize with new project
      const fresh = createEmptyDesignProject();
      saveProject(fresh);
      saveActiveProjectId(fresh.id);
      set({
        project: fresh,
        isDirty: false,
      });
    }
    get().refreshSummaries();
  },

  applyPatch: (patch: ProjectPatch) => {
    set((state) => {
      const updated = mergeProjectPatch(state.project, patch);
      return { project: updated, isDirty: true };
    });
  },

  markModuleCompleted: (moduleId: ModuleId) => {
    set((state) => {
      const currentCompleted = state.project.pipelineProgress?.completedModules ?? [];
      if (currentCompleted.includes(moduleId)) {
        return state; // No-op if already marked completed
      }
      const updatedProgress = addCompletedModule(
        state.project.pipelineProgress,
        moduleId
      );
      const updatedProject: DesignProject = {
        ...state.project,
        pipelineProgress: updatedProgress,
        updatedAt: new Date().toISOString(),
      };
      return { project: updatedProject, isDirty: true };
    });
  },

  resetProject: () => {
    set((state) => {
      const clean = createEmptyDesignProject(
        state.project.id,
        state.project.name
      );
      clean.createdAt = state.project.createdAt;
      clean.updatedAt = new Date().toISOString();
      return { project: clean, isDirty: true };
    });
  },

  refreshSummaries: () => {
    const result = listProjectSummaries();
    if (result.ok) {
      set({ summaries: result.value });
    }
  },

  markClean: () => {
    set({ isDirty: false });
  },
}));

/**
 * Small exported selectors to minimize React component re-renders.
 */
export const selectCurrentProject = (state: ProjectState): DesignProject =>
  state.project;

export const selectProjectSummaries = (
  state: ProjectState
): readonly ProjectSummary[] => state.summaries;

export const selectIsDirty = (state: ProjectState): boolean => state.isDirty;

export const selectVariables = (state: ProjectState): readonly string[] =>
  state.project.variables ?? [];

export const selectExpression = (state: ProjectState) =>
  state.project.expression;

export const selectTruthTable = (state: ProjectState) =>
  state.project.truthTable;

export const selectMinimizedExpression = (state: ProjectState) =>
  state.project.minimizedExpression;

export const selectCircuit = (state: ProjectState) => state.project.circuit;

export const selectPipelineProgress = (
  state: ProjectState
): PipelineProgress | undefined => state.project.pipelineProgress;

export const selectCompletedModules = (
  state: ProjectState
): readonly ModuleId[] =>
  state.project.pipelineProgress?.completedModules ?? [];
