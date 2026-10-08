/**
 * @file flipFlopModuleLogic.test.ts
 * Unit tests for Flip-Flop module contract, prerequisite validation, and patch builders.
 */

import { describe, expect, it } from 'vitest';
import { createEmptyDesignProject } from '../../types/designProject';
import {
  createFlipFlopPatch,
  createFlipFlopStorePatch,
  extractFlipFlopInputs,
  flipFlopModuleContract,
  flipFlopModuleDefinition,
  getCounterDesignAdvisory,
  validateFlipFlopPrerequisites,
} from './flipFlopModuleLogic';

describe('flipFlopModuleLogic', () => {
  it('defines the correct module metadata in definition and contract', () => {
    expect(flipFlopModuleDefinition.id).toBe('flipflop-simulator');
    expect(flipFlopModuleDefinition.reads).toEqual([]);
    expect(flipFlopModuleDefinition.writes).toEqual(['flipFlopType']);
    expect(flipFlopModuleDefinition.nextModules).toEqual(['sequential-designer']);
    expect(flipFlopModuleContract.definition).toBe(flipFlopModuleDefinition);
  });

  it('extracts inputs and generates patches correctly', () => {
    const proj = createEmptyDesignProject();
    proj.flipFlopType = 'JK';

    const inputs = extractFlipFlopInputs(proj);
    expect(inputs.flipFlopType).toBe('JK');

    const patch = createFlipFlopPatch({ flipFlopType: 'D' });
    expect(patch).toEqual({ flipFlopType: 'D' });

    const storePatch = createFlipFlopStorePatch('T');
    expect(storePatch).toEqual({ flipFlopType: 'T' });
  });

  it('validates prerequisites with plain language message when no flip-flop is selected', () => {
    const emptyProj = createEmptyDesignProject();
    expect(emptyProj.flipFlopType).toBeNull();

    const result = validateFlipFlopPrerequisites(emptyProj);
    expect(result).not.toBeNull();
    expect(result?.[0]).toBe('Choose a flip-flop type (SR, JK, D or T) before continuing.');

    emptyProj.flipFlopType = 'SR';
    expect(validateFlipFlopPrerequisites(emptyProj)).toBeNull();
  });

  it('returns non-blocking advisory note for level-triggered modes and null for edge-triggered', () => {
    expect(getCounterDesignAdvisory('rising')).toBeNull();
    expect(getCounterDesignAdvisory('falling')).toBeNull();
    expect(getCounterDesignAdvisory('level-high')).toBe(
      'Counter design assumes edge-triggered flip-flops; level-triggered JK and T can race around.'
    );
    expect(getCounterDesignAdvisory('level-low')).toBe(
      'Counter design assumes edge-triggered flip-flops; level-triggered JK and T can race around.'
    );
  });
});
