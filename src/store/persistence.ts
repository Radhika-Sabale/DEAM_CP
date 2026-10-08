/**
 * @file persistence.ts
 * Robust, client-side localStorage persistence layer for DesignProject entities,
 * schema migration, summary indexing, and debounced autosave.
 */

import {
  CURRENT_SCHEMA_VERSION,
  type DesignProject,
} from '../types/designProject';
import type { LogEvent } from '../types/logging';

/**
 * Standard discriminated Result type for robust error handling without unhandled exceptions.
 */
export type Result<T, E = PersistenceError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * Persistence layer error classification.
 */
export type PersistenceErrorCode =
  | 'NOT_FOUND'
  | 'CORRUPTED'
  | 'UNSUPPORTED_VERSION'
  | 'QUOTA_EXCEEDED'
  | 'STORAGE_UNAVAILABLE';

/**
 * Error detail object returned when persistence operations fail.
 */
export interface PersistenceError {
  readonly code: PersistenceErrorCode;
  readonly message: string;
  readonly details?: string;
}

/**
 * Lightweight project summary metadata for project picker lists.
 */
export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
}

const STORAGE_PREFIX = 'delab:v1:';
const KEY_ACTIVE_PROJECT_ID = `${STORAGE_PREFIX}active_project_id`;
const KEY_SUMMARIES = `${STORAGE_PREFIX}summaries`;
const KEY_EVENT_LOG = `${STORAGE_PREFIX}event_log`;

function getProjectKey(id: string): string {
  return `${STORAGE_PREFIX}projects:${id}`;
}

/**
 * Safely accesses window.localStorage with fallback for sandboxed environments.
 */
function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Saves a project to localStorage and updates the indexed summary list.
 */
export function saveProject(project: DesignProject): Result<void> {
  const storage = getStorage();
  if (!storage) {
    return {
      ok: false,
      error: {
        code: 'STORAGE_UNAVAILABLE',
        message: 'localStorage is disabled, blocked, or unavailable.',
      },
    };
  }

  try {
    const serialized = JSON.stringify(project);
    storage.setItem(getProjectKey(project.id), serialized);

    // Update summaries index
    const summariesResult = listProjectSummaries();
    const existingSummaries = summariesResult.ok ? [...summariesResult.value] : [];
    const index = existingSummaries.findIndex((s) => s.id === project.id);

    const updatedSummary: ProjectSummary = {
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt,
    };

    if (index >= 0) {
      existingSummaries[index] = updatedSummary;
    } else {
      existingSummaries.push(updatedSummary);
    }

    storage.setItem(KEY_SUMMARIES, JSON.stringify(existingSummaries));
    return { ok: true, value: undefined };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      return {
        ok: false,
        error: {
          code: 'QUOTA_EXCEEDED',
          message: 'localStorage storage quota exceeded. Please export or delete older projects.',
          details: err.message,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'STORAGE_UNAVAILABLE',
        message: 'Failed to write project to local storage.',
        details: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Loads a project by ID, validating schema version and JSON integrity.
 */
export function loadProjectById(id: string): Result<DesignProject> {
  const storage = getStorage();
  if (!storage) {
    return {
      ok: false,
      error: {
        code: 'STORAGE_UNAVAILABLE',
        message: 'localStorage is unavailable.',
      },
    };
  }

  try {
    const raw = storage.getItem(getProjectKey(id));
    if (!raw) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Project with ID "${id}" was not found.`,
        },
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        error: {
          code: 'CORRUPTED',
          message: `Project data for "${id}" is not valid JSON.`,
        },
      };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return {
        ok: false,
        error: {
          code: 'CORRUPTED',
          message: `Project data for "${id}" is malformed.`,
        },
      };
    }

    const candidate = parsed as Partial<DesignProject>;
    if (typeof candidate.schemaVersion !== 'number') {
      return {
        ok: false,
        error: {
          code: 'CORRUPTED',
          message: 'Project is missing a schemaVersion number.',
        },
      };
    }

    if (candidate.schemaVersion > CURRENT_SCHEMA_VERSION) {
      return {
        ok: false,
        error: {
          code: 'UNSUPPORTED_VERSION',
          message: `Project schemaVersion ${candidate.schemaVersion} is newer than supported version ${CURRENT_SCHEMA_VERSION}.`,
        },
      };
    }

    // Run migrations if candidate.schemaVersion < CURRENT_SCHEMA_VERSION
    let migratedProject = candidate as DesignProject;
    if (candidate.schemaVersion < CURRENT_SCHEMA_VERSION) {
      migratedProject = {
        ...candidate,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        sequentialSpec: candidate.sequentialSpec ?? null,
      } as DesignProject;
    }
    return { ok: true, value: migratedProject };
  } catch (err: unknown) {
    return {
      ok: false,
      error: {
        code: 'STORAGE_UNAVAILABLE',
        message: 'Failed to read from local storage.',
        details: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Lists all project summaries stored in the local index.
 */
export function listProjectSummaries(): Result<readonly ProjectSummary[]> {
  const storage = getStorage();
  if (!storage) {
    return { ok: true, value: [] };
  }

  try {
    const raw = storage.getItem(KEY_SUMMARIES);
    if (!raw) {
      return { ok: true, value: [] };
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return { ok: true, value: [] };
    }
    const summaries: ProjectSummary[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as ProjectSummary).id === 'string' &&
        typeof (item as ProjectSummary).name === 'string' &&
        typeof (item as ProjectSummary).updatedAt === 'string'
      ) {
        summaries.push({
          id: (item as ProjectSummary).id,
          name: (item as ProjectSummary).name,
          updatedAt: (item as ProjectSummary).updatedAt,
        });
      }
    }
    return { ok: true, value: summaries };
  } catch {
    return { ok: true, value: [] };
  }
}

/**
 * Deletes a project by ID and removes its entry from the summaries index.
 */
export function deleteProjectById(id: string): Result<void> {
  const storage = getStorage();
  if (!storage) {
    return {
      ok: false,
      error: {
        code: 'STORAGE_UNAVAILABLE',
        message: 'localStorage is unavailable.',
      },
    };
  }

  try {
    storage.removeItem(getProjectKey(id));

    const summariesResult = listProjectSummaries();
    if (summariesResult.ok) {
      const remaining = summariesResult.value.filter((s) => s.id !== id);
      storage.setItem(KEY_SUMMARIES, JSON.stringify(remaining));
    }

    // Clear active project pointer if it was deleted
    const activeResult = loadActiveProjectId();
    if (activeResult.ok && activeResult.value === id) {
      storage.removeItem(KEY_ACTIVE_PROJECT_ID);
    }

    return { ok: true, value: undefined };
  } catch (err: unknown) {
    return {
      ok: false,
      error: {
        code: 'STORAGE_UNAVAILABLE',
        message: 'Failed to delete project from storage.',
        details: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Saves the active project ID to remember the user's current project across reloads.
 */
export function saveActiveProjectId(id: string): Result<void> {
  const storage = getStorage();
  if (!storage) {
    return {
      ok: false,
      error: {
        code: 'STORAGE_UNAVAILABLE',
        message: 'localStorage is unavailable.',
      },
    };
  }

  try {
    storage.setItem(KEY_ACTIVE_PROJECT_ID, id);
    return { ok: true, value: undefined };
  } catch (err: unknown) {
    return {
      ok: false,
      error: {
        code: 'STORAGE_UNAVAILABLE',
        message: 'Failed to save active project ID.',
        details: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Loads the active project ID from storage.
 */
export function loadActiveProjectId(): Result<string | null> {
  const storage = getStorage();
  if (!storage) {
    return { ok: true, value: null };
  }

  try {
    const id = storage.getItem(KEY_ACTIVE_PROJECT_ID);
    return { ok: true, value: id };
  } catch {
    return { ok: true, value: null };
  }
}

/**
 * Pure debounced autosave helper returning a cancelable, flushable function.
 *
 * @param saveCallback Callback function invoked when timer elapses
 * @param delayMs Delay in milliseconds
 */
export function createDebouncedAutosave(
  saveCallback: (project: DesignProject) => void,
  delayMs = 1000
): {
  (project: DesignProject): void;
  cancel: () => void;
  flush: (project: DesignProject) => void;
} {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastProject: DesignProject | null = null;

  const debounced = function (project: DesignProject): void {
    lastProject = project;
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      if (lastProject) {
        saveCallback(lastProject);
      }
    }, delayMs);
  };

  debounced.cancel = function (): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    lastProject = null;
  };

  debounced.flush = function (project: DesignProject): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    lastProject = null;
    saveCallback(project);
  };

  return debounced;
}

/**
 * Saves telemetry events to localStorage under a dedicated versioned log key.
 */
export function saveEventLog(events: readonly LogEvent[]): Result<void> {
  const storage = getStorage();
  if (!storage) {
    return {
      ok: false,
      error: { code: 'STORAGE_UNAVAILABLE', message: 'localStorage is unavailable.' },
    };
  }

  try {
    storage.setItem(KEY_EVENT_LOG, JSON.stringify(events));
    return { ok: true, value: undefined };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      return {
        ok: false,
        error: {
          code: 'QUOTA_EXCEEDED',
          message: 'localStorage quota exceeded while saving event log.',
          details: err.message,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'STORAGE_UNAVAILABLE',
        message: 'Failed to write event log to localStorage.',
        details: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Loads telemetry events from localStorage under the dedicated versioned log key.
 */
export function loadEventLog(): Result<readonly LogEvent[]> {
  const storage = getStorage();
  if (!storage) {
    return { ok: true, value: [] };
  }

  try {
    const raw = storage.getItem(KEY_EVENT_LOG);
    if (!raw) {
      return { ok: true, value: [] };
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return {
        ok: false,
        error: { code: 'CORRUPTED', message: 'Event log data is corrupted or not an array.' },
      };
    }
    return { ok: true, value: parsed as readonly LogEvent[] };
  } catch (err: unknown) {
    return {
      ok: false,
      error: {
        code: 'CORRUPTED',
        message: 'Failed to parse event log JSON.',
        details: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Clears stored event logs from localStorage.
 */
export function clearEventLog(): Result<void> {
  const storage = getStorage();
  if (!storage) {
    return {
      ok: false,
      error: { code: 'STORAGE_UNAVAILABLE', message: 'localStorage is unavailable.' },
    };
  }

  try {
    storage.removeItem(KEY_EVENT_LOG);
    return { ok: true, value: undefined };
  } catch (err: unknown) {
    return {
      ok: false,
      error: {
        code: 'STORAGE_UNAVAILABLE',
        message: 'Failed to clear event log from storage.',
        details: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
