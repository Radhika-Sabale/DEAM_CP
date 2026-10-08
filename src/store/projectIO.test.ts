/**
 * @file projectIO.test.ts
 * Unit tests for project JSON import/export, field path validation errors, and ID deduplication.
 */

import { describe, expect, it } from 'vitest';
import { createEmptyDesignProject } from '../types/designProject';
import {
  exportProjectToJson,
  importProject,
  parseProjectJson,
} from './projectIO';

describe('projectIO', () => {
  it('performs export then import round trip equal to original', () => {
    const original = createEmptyDesignProject('export-roundtrip-1', 'Adder Design');
    original.variables = ['A', 'B', 'Cin'];
    original.expression = {
      type: 'xor',
      left: { type: 'variable', name: 'A' },
      right: { type: 'variable', name: 'B' },
    };

    const exportedJson = exportProjectToJson(original);
    const importRes = importProject(exportedJson, []);

    expect(importRes.ok).toBe(true);
    if (importRes.ok) {
      expect(importRes.value).toEqual(original);
    }
  });

  it('reports invalid field path by name when validation fails', () => {
    // Missing required fields and bad types
    const badJson = JSON.stringify({
      schemaVersion: 1,
      // Missing id
      name: 12345, // Invalid type
      createdAt: 'not-a-date', // Invalid ISO date
      updatedAt: new Date().toISOString(),
      variables: [1, 2, 3], // Should be strings
      expression: 'not-an-object', // Should be object
    });

    const result = parseProjectJson(badJson);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
      const fields = result.error.fieldErrors?.map((e) => e.field) ?? [];
      expect(fields).toContain('id');
      expect(fields).toContain('name');
      expect(fields).toContain('createdAt');
      expect(fields).toContain('variables');
      expect(fields).toContain('expression');
    }
  });

  it('assigns a fresh ID when imported project ID already exists locally', () => {
    const project = createEmptyDesignProject('existing-id-123', 'My Circuit');
    const exportedJson = exportProjectToJson(project);

    // Existing IDs include project.id
    const importRes = importProject(exportedJson, ['existing-id-123', 'other-id']);

    expect(importRes.ok).toBe(true);
    if (importRes.ok) {
      expect(importRes.value.id).not.toBe('existing-id-123');
      expect(importRes.value.id.startsWith('proj-')).toBe(true);
      expect(importRes.value.name).toContain('(Imported)');
      expect(importRes.value.variables).toEqual(project.variables);
    }
  });

  it('handles invalid JSON syntax gracefully', () => {
    const result = parseProjectJson('invalid JSON string :::');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_JSON');
    }
  });

  it('preserves sequentialSpec in export/import round trip', () => {
    const project = createEmptyDesignProject('seq-proj-1', 'Sequential Machine');
    project.sequentialSpec = {
      kind: 'counter',
      flipFlop: 'JK',
      style: 'sync',
      direction: 'up',
      modulus: 8,
    };

    const exported = exportProjectToJson(project);
    const imported = importProject(exported);
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.value.sequentialSpec).toEqual({
        kind: 'counter',
        flipFlop: 'JK',
        style: 'sync',
        direction: 'up',
        modulus: 8,
      });
    }
  });

  it('migrates schemaVersion 1 imported JSON to current schemaVersion', () => {
    const v1Json = JSON.stringify({
      schemaVersion: 1,
      id: 'old-v1-json',
      name: 'Legacy Project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      variables: ['X'],
    });

    const parsed = parseProjectJson(v1Json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.schemaVersion).toBe(2);
      expect(parsed.value.sequentialSpec).toBeNull();
    }
  });
});
