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

  it('accepts projects with no alu field or alu: null without bumping schema version', () => {
    const legacyNoAlu = JSON.stringify({
      schemaVersion: 2,
      id: 'legacy-no-alu',
      name: 'Old Export',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const parsed1 = parseProjectJson(legacyNoAlu);
    expect(parsed1.ok).toBe(true);

    const legacyNullAlu = JSON.stringify({
      schemaVersion: 2,
      id: 'legacy-null-alu',
      name: 'Null Alu Export',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      alu: null,
    });
    const parsed2 = parseProjectJson(legacyNullAlu);
    expect(parsed2.ok).toBe(true);
  });

  it('preserves valid alu state across export and import round-trip', () => {
    const project = createEmptyDesignProject('alu-proj-1', 'ALU Workbench');
    project.alu = {
      op: 'SUB',
      width: 8,
      a: 128,
      b: 1,
      shiftCount: 1,
      previousC: 0,
    };

    const exported = exportProjectToJson(project);
    const imported = importProject(exported);
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.value.alu).toEqual(project.alu);
    }
  });

  it('rejects malformed alu with readable field-specific diagnostics', () => {
    const badAluJson = JSON.stringify({
      schemaVersion: 2,
      id: 'bad-alu-proj',
      name: 'Bad Alu',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      alu: {
        op: 'INVALID_OP',
        width: 32, // out of range 2..16
        a: -5, // negative
        b: 'not-a-number',
      },
    });

    const res = parseProjectJson(badAluJson);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('VALIDATION_FAILED');
      const fields = res.error.fieldErrors?.map((e) => e.field) ?? [];
      expect(fields).toContain('alu.op');
      expect(fields).toContain('alu.width');
      expect(fields).toContain('alu.a');
      expect(fields).toContain('alu.b');
    }
  });

  it('performs export and import round trip with cpu8086 state', () => {
    const project = createEmptyDesignProject('cpu8086-proj-1', '8086 CPU Lab');
    project.cpu8086 = {
      source: 'MOV AX, 10\nADD AX, 20\nHLT',
      breakpoints: [1, 2],
    };

    const exported = exportProjectToJson(project);
    const imported = importProject(exported);
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.value.cpu8086).toEqual(project.cpu8086);
    }
  });

  it('accepts projects without cpu8086 or with null cpu8086 (backward compatibility)', () => {
    const oldProjectJson = JSON.stringify({
      schemaVersion: 2,
      id: 'legacy-project',
      name: 'Legacy Project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // cpu8086 is omitted
    });

    const parsed = parseProjectJson(oldProjectJson);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.cpu8086).toBeUndefined();
    }

    const nullCpuJson = JSON.stringify({
      schemaVersion: 2,
      id: 'null-cpu-project',
      name: 'Null CPU Project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cpu8086: null,
    });

    const parsedNull = parseProjectJson(nullCpuJson);
    expect(parsedNull.ok).toBe(true);
    if (parsedNull.ok) {
      expect(parsedNull.value.cpu8086).toBeNull();
    }
  });

  it('rejects malformed cpu8086 with field-specific diagnostics', () => {
    const badCpuJson = JSON.stringify({
      schemaVersion: 2,
      id: 'bad-cpu-proj',
      name: 'Bad CPU',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cpu8086: {
        source: 12345, // not a string
        breakpoints: [0, -1, 'line3'], // must be positive integers
      },
    });

    const res = parseProjectJson(badCpuJson);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('VALIDATION_FAILED');
      const fields = res.error.fieldErrors?.map((e) => e.field) ?? [];
      expect(fields).toContain('cpu8086.source');
      expect(fields).toContain('cpu8086.breakpoints');
    }
  });

  it('preserves interrupts slice in export/import round trip', () => {
    const project = createEmptyDesignProject('intr-proj-1', 'Interrupt Project');
    project.interrupts = {
      source: 'STI\nINT 32\nIRET',
      breakpoints: [2],
      scenario: [
        { atTick: 5, kind: 'nmi' },
        { atTick: 12, kind: 'intr', vector: 64 },
      ],
    };

    const exported = exportProjectToJson(project);
    const imported = importProject(exported);
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.value.interrupts).toEqual(project.interrupts);
    }
  });

  it('accepts projects without interrupts or with null interrupts (backward compatibility)', () => {
    const oldProjectJson = JSON.stringify({
      schemaVersion: 2,
      id: 'legacy-project-no-intr',
      name: 'Legacy Project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // interrupts omitted
    });

    const parsed = parseProjectJson(oldProjectJson);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.interrupts).toBeUndefined();
    }

    const nullIntrJson = JSON.stringify({
      schemaVersion: 2,
      id: 'null-intr-project',
      name: 'Null Interrupt Project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      interrupts: null,
    });

    const parsedNull = parseProjectJson(nullIntrJson);
    expect(parsedNull.ok).toBe(true);
    if (parsedNull.ok) {
      expect(parsedNull.value.interrupts).toBeNull();
    }
  });

  it('rejects malformed interrupts with field-specific diagnostics', () => {
    const badIntrJson = JSON.stringify({
      schemaVersion: 2,
      id: 'bad-intr-proj',
      name: 'Bad Interrupts',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      interrupts: {
        source: 99999, // not a string
        breakpoints: [-5], // not positive
        scenario: [
          { atTick: -1, kind: 'invalid-kind' }, // negative tick, wrong kind
          { atTick: 10, kind: 'intr', vector: 999 }, // vector out of range
        ],
      },
    });

    const res = parseProjectJson(badIntrJson);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('VALIDATION_FAILED');
      const fields = res.error.fieldErrors?.map((e) => e.field) ?? [];
      expect(fields).toContain('interrupts.source');
      expect(fields).toContain('interrupts.breakpoints');
      expect(fields).toContain('interrupts.scenario[0].atTick');
      expect(fields).toContain('interrupts.scenario[0].kind');
      expect(fields).toContain('interrupts.scenario[1].vector');
    }
  });
});


