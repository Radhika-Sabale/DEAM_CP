/**
 * @file sequentialModuleLogic.test.ts
 * Unit tests for Sequential Designer module logic:
 * - Patch generator strictly writes only allowed sequential fields.
 * - Prerequisite validation returns clear, readable error messages for all missing items.
 * - Re-derives reference design from project spec without trusting derived artifacts.
 * - K-Map pipeline handoff constructs valid TruthTable with don't-cares and resets downstream fields.
 * - Full JSON export/import and schema round-trip testing.
 */

import { describe, expect, it } from 'vitest';
import type { BoolNode } from '../../types/ast';
import type { SequentialSpec } from '../../types/sequential';
import { createEmptyDesignProject } from '../../types/designProject';
import { exportProjectToJson, parseProjectJson } from '../../store/projectIO';
import { mergeProjectPatch } from '../../store/projectStore';
import {
  canonicalToExcitationTable,
  canonicalToStateTable,
  checkSequentialReadiness,
  createKMapHandoffPatch,
  createSequentialPatch,
  designFromProject,
  extractSequentialInputs,
  sequentialModuleDefinition,
  validateSequentialPrerequisites,
} from './sequentialModuleLogic';

describe('sequentialModuleLogic.ts', () => {
  it('module definition adheres to architectural contract and permitted keys', () => {
    expect(sequentialModuleDefinition.id).toBe('sequential-designer');
    expect(sequentialModuleDefinition.writes).toEqual([
      'sequentialSpec',
      'stateDiagram',
      'stateTable',
      'excitationTable',
      'nextStateEquations',
      'simulationTrace',
      'pipelineProgress',
    ]);
    expect(sequentialModuleDefinition.nextModules).toContain('kmap-solver');
  });

  it('patch generators write ONLY permitted sequential keys (no leakage to circuit, kmap, variables)', () => {
    const project = createEmptyDesignProject();
    const spec: SequentialSpec = { kind: 'counter', direction: 'up', modulus: 4, flipFlop: 'D', style: 'sync' };

    const patch = createSequentialPatch({
      sequentialSpec: spec,
    });

    // Check patch keys
    const patchKeys = Object.keys(patch);
    for (const k of patchKeys) {
      expect(sequentialModuleDefinition.writes).toContain(k);
    }

    // Merge patch and verify downstream fields remain clean
    const updated = mergeProjectPatch(project, patch);
    expect(updated.sequentialSpec).toEqual(spec);
    expect(updated.kmap).toBeNull();
    expect(updated.minimizedExpression).toBeNull();
    expect(updated.circuit).toBeNull();
  });

  it('extractSequentialInputs reads relevant sub-state accurately', () => {
    const project = createEmptyDesignProject();
    project.flipFlopType = 'JK';
    project.sequentialSpec = { kind: 'counter', modulus: 8, flipFlop: 'JK', style: 'sync' };

    const inputs = extractSequentialInputs(project);
    expect(inputs.flipFlopType).toBe('JK');
    expect(inputs.sequentialSpec?.kind === 'counter' ? inputs.sequentialSpec.modulus : undefined).toBe(8);
  });

  it('designFromProject re-derives the authoritative design from spec', () => {
    const project = createEmptyDesignProject();
    project.flipFlopType = 'T';
    project.sequentialSpec = { kind: 'counter', direction: 'up', modulus: 4, style: 'sync' };

    const design = designFromProject(project);
    expect(design).not.toBeNull();
    expect(design?.table.stateCount).toBe(4);
    expect(design?.equations.length).toBe(2);
  });

  it('prerequisite validation reports granular errors in sequence', () => {
    const project = createEmptyDesignProject();

    // 1. Missing flipFlopType
    let errors = validateSequentialPrerequisites(project);
    expect(errors).toContain('Choose a flip-flop type first.');

    // 2. Set flip-flop, missing spec
    project.flipFlopType = 'D';
    errors = validateSequentialPrerequisites(project);
    expect(errors).toContain('Define a counter or detector first.');

    // 3. Set spec, missing state table
    project.sequentialSpec = { kind: 'counter', direction: 'up', modulus: 4, style: 'sync' };
    errors = validateSequentialPrerequisites(project);
    expect(errors).toContain('Complete the state table.');

    // 4. Derive design and populate valid state table, missing excitation
    const design = designFromProject(project);
    expect(design).not.toBeNull();
    if (!design) return;

    project.stateTable = canonicalToStateTable(design.table);
    errors = validateSequentialPrerequisites(project);
    expect(errors).toContain('Complete the excitation table.');

    // 5. Populate excitation, missing equations
    project.excitationTable = canonicalToExcitationTable(design.excitation);
    errors = validateSequentialPrerequisites(project);
    expect(errors).toContain('Derive the equations.');

    // 6. Populate equations -> All ready
    const eqMap: Record<string, BoolNode> = {};
    for (const eq of design.equations) {
      eqMap[eq.name] = eq.expression;
    }
    project.nextStateEquations = eqMap;

    const report = checkSequentialReadiness(project);
    expect(report.isReady).toBe(true);
    expect(report.blockingErrors.length).toBe(0);
  });

  it('createKMapHandoffPatch constructs valid TruthTable and clears downstream stale fields', () => {
    const project = createEmptyDesignProject();
    project.flipFlopType = 'D';
    project.sequentialSpec = { kind: 'counter', direction: 'up', modulus: 4, style: 'sync' };

    // Hand off D0 to K-map
    const handoff = createKMapHandoffPatch(project, 'D0');
    expect(handoff.ok).toBe(true);
    if (!handoff.ok || !handoff.patch) return;

    expect(handoff.targetFunction).toBe('D0');
    expect(handoff.variableCount).toBe(2);

    const patch = handoff.patch;
    expect(patch.variables).toEqual(['Q1', 'Q0']);
    expect(patch.truthTable?.rows.length).toBe(4);
    // Downstream cache invalidation
    expect(patch.kmap).toBeNull();
    expect(patch.minimizedExpression).toBeNull();
    expect(patch.circuit).toBeNull();
    expect(patch.lastHandoff?.to).toBe('kmap-solver');
  });

  it('exportProjectToJson and parseProjectJson preserve sequential design state', () => {
    const project = createEmptyDesignProject('test-proj', 'Sequential FSM');
    project.flipFlopType = 'JK';
    project.sequentialSpec = { kind: 'detector', pattern: '101', machine: 'mealy', overlapping: true, flipFlop: 'JK' };

    const json = exportProjectToJson(project);
    const importRes = parseProjectJson(json);

    expect(importRes.ok).toBe(true);
    if (!importRes.ok) return;

    expect(importRes.value.flipFlopType).toBe('JK');
    expect(importRes.value.sequentialSpec?.kind).toBe('detector');
    if (importRes.value.sequentialSpec?.kind === 'detector') {
      expect(importRes.value.sequentialSpec.pattern).toBe('101');
    }
  });
});
