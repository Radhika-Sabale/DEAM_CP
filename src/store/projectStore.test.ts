/**
 * @file projectStore.test.ts
 * Unit tests for projectStore pure functions and state mutations.
 */

import { describe, expect, it } from 'vitest';
import {
  createEmptyDesignProject,
  type DesignProject,
  type ProjectPatch,
} from '../types/designProject';
import {
  addCompletedModule,
  mergeProjectPatch,
} from './projectStore';

describe('projectStore logic', () => {
  it('mergeProjectPatch does not mutate the previous state object', () => {
    const original: DesignProject = createEmptyDesignProject('p1', 'Original');
    original.variables = ['A', 'B'];

    // Freeze original to guarantee runtime immutability check
    Object.freeze(original);

    const patch: ProjectPatch = {
      name: 'Patched Name',
      variables: ['A', 'B', 'C'],
    };

    const updated = mergeProjectPatch(original, patch);

    expect(updated).not.toBe(original);
    expect(updated.name).toBe('Patched Name');
    expect(updated.variables).toEqual(['A', 'B', 'C']);
    expect(original.name).toBe('Original');
    expect(original.variables).toEqual(['A', 'B']);
  });

  it('mergeProjectPatch updates the updatedAt timestamp', async () => {
    const original = createEmptyDesignProject('p2', 'Time Test');
    original.updatedAt = '2020-01-01T00:00:00.000Z';

    const patch: ProjectPatch = {
      name: 'Time Updated',
    };

    const updated = mergeProjectPatch(original, patch);

    expect(updated.updatedAt).not.toBe(original.updatedAt);
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
      new Date(original.updatedAt).getTime()
    );
  });

  it('markModuleCompleted is strictly idempotent', () => {
    const progress1 = addCompletedModule(undefined, 'boolean-tool');
    expect(progress1.completedModules).toEqual(['boolean-tool']);

    const progress2 = addCompletedModule(progress1, 'boolean-tool');
    expect(progress2.completedModules).toEqual(['boolean-tool']);

    const progress3 = addCompletedModule(progress2, 'kmap-solver');
    expect(progress3.completedModules).toEqual(['boolean-tool', 'kmap-solver']);

    const progress4 = addCompletedModule(progress3, 'kmap-solver');
    expect(progress4.completedModules).toEqual(['boolean-tool', 'kmap-solver']);
  });
});
