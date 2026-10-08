/**
 * @file registry.test.ts
 * Unit tests for module registry definitions, key validation against DesignProject,
 * and handoff readiness verification.
 */

import { describe, expect, it } from 'vitest';
import {
  createEmptyDesignProject,
  type DesignProject,
} from '../types/designProject';
import {
  checkHandoffReadiness,
  getModule,
  MODULE_REGISTRY,
} from './registry';

describe('module registry', () => {
  it('ensures every reads and writes key exists on DesignProject', () => {
    const sampleProject = createEmptyDesignProject('sample', 'Key Checker');

    // Create an explicit set of valid keys on DesignProject
    const validProjectKeys = new Set<string>([
      'schemaVersion',
      'id',
      'name',
      'createdAt',
      'updatedAt',
      'variables',
      'expression',
      'truthTable',
      'minimizedExpression',
      'kmap',
      'circuit',
      'flipFlopType',
      'stateDiagram',
      'stateTable',
      'excitationTable',
      'nextStateEquations',
      'simulationTrace',
      'pipelineProgress',
      'lastHandoff',
    ]);

    // Verify sample project keys are known
    for (const key of Object.keys(sampleProject)) {
      expect(validProjectKeys.has(key)).toBe(true);
    }

    for (const mod of MODULE_REGISTRY) {
      for (const readKey of mod.reads) {
        expect(
          validProjectKeys.has(readKey),
          `Module "${mod.id}" reads invalid key "${readKey}"`
        ).toBe(true);
      }

      for (const writeKey of mod.writes) {
        expect(
          validProjectKeys.has(writeKey),
          `Module "${mod.id}" writes invalid key "${writeKey}"`
        ).toBe(true);
      }
    }
  });

  it('ensures every nextModules ID exists in the registry', () => {
    const allIds = new Set(MODULE_REGISTRY.map((m) => m.id));

    for (const mod of MODULE_REGISTRY) {
      for (const nextId of mod.nextModules) {
        expect(
          allIds.has(nextId),
          `Module "${mod.id}" links to unknown nextModule "${nextId}"`
        ).toBe(true);
      }
    }
  });

  it('checkHandoffReadiness returns missing prerequisite items for empty project', () => {
    const empty = createEmptyDesignProject();

    // boolean -> kmap
    const boolToKmap = checkHandoffReadiness(empty, 'boolean-tool', 'kmap-solver');
    expect(boolToKmap.length).toBeGreaterThan(0);
    expect(boolToKmap[0]).toContain('Boolean expression or generate a Truth Table');

    // kmap -> circuit
    const kmapToCircuit = checkHandoffReadiness(empty, 'kmap-solver', 'circuit-simulator');
    expect(kmapToCircuit.length).toBeGreaterThan(0);
    expect(kmapToCircuit[0]).toContain('minimized SOP or POS');

    // flipflop -> sequential
    const ffToSeq = checkHandoffReadiness(empty, 'flipflop-simulator', 'sequential-designer');
    expect(ffToSeq.length).toBeGreaterThan(0);
    expect(ffToSeq[0]).toContain('flip-flop type');

    // sequential -> kmap
    const seqToKmap = checkHandoffReadiness(empty, 'sequential-designer', 'kmap-solver');
    expect(seqToKmap.length).toBeGreaterThan(0);
    expect(seqToKmap[0]).toContain('Excitation Table');

    // sequential -> circuit
    const seqToCircuit = checkHandoffReadiness(empty, 'sequential-designer', 'circuit-simulator');
    expect(seqToCircuit.length).toBeGreaterThan(0);
    expect(seqToCircuit[0]).toContain('next-state input equations');
  });

  it('checkHandoffReadiness returns no missing items when project is filled with required state', () => {
    const filled: DesignProject = {
      ...createEmptyDesignProject('filled-1', 'Filled'),
      variables: ['A', 'B'],
      expression: {
        type: 'and',
        children: [{ type: 'variable', name: 'A' }, { type: 'variable', name: 'B' }],
      },
      truthTable: {
        variables: ['A', 'B'],
        rows: [
          { index: 0, inputs: [0, 0], output: 0 },
          { index: 1, inputs: [0, 1], output: 0 },
          { index: 2, inputs: [1, 0], output: 0 },
          { index: 3, inputs: [1, 1], output: 1 },
        ],
      },
      minimizedExpression: {
        sop: {
          ast: { type: 'variable', name: 'A' },
          text: 'A',
        },
        pos: null,
      },
      flipFlopType: 'JK',
      excitationTable: {
        rows: [
          {
            presentState: '0',
            nextState: '1',
            flipFlopInputs: { Q0: { J: 1, K: 'X' } },
          },
        ],
      },
      nextStateEquations: {
        Q0_next: { type: 'variable', name: 'D' },
      },
    };

    expect(checkHandoffReadiness(filled, 'boolean-tool', 'kmap-solver')).toEqual([]);
    expect(checkHandoffReadiness(filled, 'kmap-solver', 'circuit-simulator')).toEqual([]);
    expect(checkHandoffReadiness(filled, 'flipflop-simulator', 'sequential-designer')).toEqual([]);
    expect(checkHandoffReadiness(filled, 'sequential-designer', 'kmap-solver')).toEqual([]);
    expect(checkHandoffReadiness(filled, 'sequential-designer', 'circuit-simulator')).toEqual([]);
  });

  it('retrieves module definition by id', () => {
    const mod = getModule('boolean-tool');
    expect(mod).toBeDefined();
    expect(mod?.title).toBe('Boolean Expression Analysis');
  });
});
