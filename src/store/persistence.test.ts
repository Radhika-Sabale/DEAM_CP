/**
 * @file persistence.test.ts
 * Unit tests for client-side persistence, schema validation, quota handling, and debounced autosave.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyDesignProject,
  CURRENT_SCHEMA_VERSION,
  type DesignProject,
} from '../types/designProject';
import {
  createDebouncedAutosave,
  deleteProjectById,
  listProjectSummaries,
  loadProjectById,
  saveProject,
} from './persistence';

describe('persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('performs save/load round trip successfully', () => {
    const project = createEmptyDesignProject('proj-roundtrip-1', 'Roundtrip Project');
    project.variables = ['A', 'B', 'C'];

    const saveRes = saveProject(project);
    expect(saveRes.ok).toBe(true);

    const loadRes = loadProjectById(project.id);
    expect(loadRes.ok).toBe(true);
    if (loadRes.ok) {
      expect(loadRes.value.id).toBe(project.id);
      expect(loadRes.value.name).toBe('Roundtrip Project');
      expect(loadRes.value.variables).toEqual(['A', 'B', 'C']);
    }

    const summariesRes = listProjectSummaries();
    expect(summariesRes.ok).toBe(true);
    if (summariesRes.ok) {
      expect(summariesRes.value.some((s) => s.id === project.id)).toBe(true);
    }
  });

  it('returns an error result when stored JSON is corrupted', () => {
    localStorage.setItem('delab:v1:projects:corrupt-id', '{ malformed JSON @@');

    const result = loadProjectById('corrupt-id');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CORRUPTED');
      expect(result.error.message).toContain('not valid JSON');
    }
  });

  it('rejects stored project when schemaVersion is newer than current', () => {
    const futureProject = {
      ...createEmptyDesignProject('future-proj-1', 'Future Project'),
      schemaVersion: CURRENT_SCHEMA_VERSION + 99,
    };

    localStorage.setItem(
      'delab:v1:projects:future-proj-1',
      JSON.stringify(futureProject)
    );

    const result = loadProjectById('future-proj-1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNSUPPORTED_VERSION');
      expect(result.error.message).toContain('newer than supported');
    }
  });

  it('gracefully handles QuotaExceededError when saving', () => {
    const project = createEmptyDesignProject('quota-proj-1', 'Quota Project');

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const err = new Error('Quota exceeded');
      err.name = 'QuotaExceededError';
      throw err;
    });

    const result = saveProject(project);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('QUOTA_EXCEEDED');
      expect(result.error.message).toContain('quota exceeded');
    }
  });

  it('ensures debounced autosave fires once for multiple calls within window', async () => {
    vi.useFakeTimers();
    const saveMock = vi.fn();
    const debounced = createDebouncedAutosave(saveMock, 200);

    const p1: DesignProject = createEmptyDesignProject('p1', 'V1');
    const p2: DesignProject = { ...p1, name: 'V2' };
    const p3: DesignProject = { ...p1, name: 'V3' };

    debounced(p1);
    debounced(p2);
    debounced(p3);

    expect(saveMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith(p3);

    debounced.cancel();
    vi.useRealTimers();
  });

  it('deletes project and updates summaries index', () => {
    const project = createEmptyDesignProject('del-proj-1', 'To Delete');
    saveProject(project);

    const deleteRes = deleteProjectById('del-proj-1');
    expect(deleteRes.ok).toBe(true);

    const loadRes = loadProjectById('del-proj-1');
    expect(loadRes.ok).toBe(false);
    if (!loadRes.ok) {
      expect(loadRes.error.code).toBe('NOT_FOUND');
    }

    const summariesRes = listProjectSummaries();
    if (summariesRes.ok) {
      expect(summariesRes.value.some((s) => s.id === 'del-proj-1')).toBe(false);
    }
  });

  it('migrates schemaVersion 1 project to schemaVersion 2 on load', () => {
    const v1Project = {
      schemaVersion: 1,
      id: 'v1-project-1',
      name: 'Old Version 1 Project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      variables: ['A', 'B'],
    };

    localStorage.setItem('delab:v1:projects:v1-project-1', JSON.stringify(v1Project));

    const loadRes = loadProjectById('v1-project-1');
    expect(loadRes.ok).toBe(true);
    if (loadRes.ok) {
      expect(loadRes.value.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(loadRes.value.sequentialSpec).toBeNull();
      expect(loadRes.value.variables).toEqual(['A', 'B']);
    }
  });
});

