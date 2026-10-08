/**
 * @file stateDiagram.test.ts
 * Unit tests for StateDiagram conversion, round-trip identity, and structural validation diagnostics.
 */

import { describe, expect, it } from 'vitest';
import type { StateDiagramData } from '../../types/sequential';
import {
  diagramFromTable,
  tableFromDiagram,
  validateDiagram,
} from './stateDiagram';
import { createCanonicalStateTable } from './stateTable';

describe('stateDiagram.ts', () => {
  it('performs table -> diagram -> table identity round trip on valid rows', () => {
    // 3-state Mealy sequence detector (states 0, 1, 2)
    const transitions = new Map<
      number,
      { nextCode: number; mealyOutput: 0 | 1; mooreOutput: 0 | 1 }
    >([
      [0, { nextCode: 0, mealyOutput: 0, mooreOutput: 0 }],
      [1, { nextCode: 1, mealyOutput: 0, mooreOutput: 0 }],
      [2, { nextCode: 0, mealyOutput: 0, mooreOutput: 0 }],
      [3, { nextCode: 2, mealyOutput: 0, mooreOutput: 0 }],
      [4, { nextCode: 0, mealyOutput: 0, mooreOutput: 0 }],
      [5, { nextCode: 1, mealyOutput: 1, mooreOutput: 0 }],
    ]);

    const originalTable = createCanonicalStateTable(
      2,
      [0, 1, 2],
      0,
      true,
      'detector',
      'mealy',
      transitions
    );

    const diagram = diagramFromTable(originalTable);
    expect(diagram.nodes.length).toBe(3);
    expect(diagram.edges.length).toBeGreaterThanOrEqual(1);

    const reconstructedTable = tableFromDiagram(
      diagram,
      2,
      true,
      'mealy',
      'detector'
    );

    // Verify valid rows match original table exactly
    for (const code of [0, 1, 2]) {
      for (const inVal of [0, 1]) {
        const origRow = originalTable.rows.find(
          (r) => r.code === code && r.inputValue === inVal
        );
        const reconRow = reconstructedTable.rows.find(
          (r) => r.code === code && r.inputValue === inVal
        );

        expect(reconRow?.valid).toBe(true);
        expect(reconRow?.nextCode).toBe(origRow?.nextCode);
        expect(reconRow?.mealyOutput).toBe(origRow?.mealyOutput);
      }
    }
  });

  it('validates bad diagrams and catches errors with clean plain-language messages', () => {
    const badDiagram: StateDiagramData = {
      machineKind: 'mealy',
      stateBits: 2,
      initialStateCode: 0,
      nodes: [
        { id: 's0', code: 0, name: 'S0', binaryCode: '00', isInitial: true },
        { id: 's1', code: 1, name: 'S1', binaryCode: '01', isInitial: false },
        { id: 's2', code: 2, name: 'S2', binaryCode: '10', isInitial: false },
      ],
      edges: [
        // s0 transitions to unknown state code 99
        {
          id: 'e1',
          fromCode: 0,
          toCode: 99,
          label: '0/0',
          conditions: [{ inputValue: 0, mealyOutput: 0 }],
          isSelfLoop: false,
        },
        // S1 has conflicting transitions for IN = 1
        {
          id: 'e2',
          fromCode: 1,
          toCode: 0,
          label: '1/0',
          conditions: [{ inputValue: 1, mealyOutput: 0 }],
          isSelfLoop: false,
        },
        {
          id: 'e3',
          fromCode: 1,
          toCode: 2,
          label: '1/1',
          conditions: [{ inputValue: 1, mealyOutput: 1 }],
          isSelfLoop: false,
        },
      ],
    };

    const issues = validateDiagram(badDiagram);
    expect(issues.length).toBeGreaterThanOrEqual(1);

    // Verify error codes
    expect(issues.some((i) => i.code === 'unknown-target')).toBe(true);
    expect(issues.some((i) => i.code === 'conflicting-transition')).toBe(true);
    expect(issues.some((i) => i.code === 'missing-transition')).toBe(true);
    expect(issues.some((i) => i.code === 'unreachable-state')).toBe(true);

    // Verify plain language and no undefined / [object Object]
    for (const issue of issues) {
      expect(issue.message).not.toContain('undefined');
      expect(issue.message).not.toContain('[object');
      expect(issue.message.length).toBeGreaterThan(5);
    }
  });

  it('handles empty diagrams and reports no-states error', () => {
    const emptyDiagram: StateDiagramData = {
      machineKind: 'counter',
      stateBits: 1,
      initialStateCode: 0,
      nodes: [],
      edges: [],
    };

    const issues = validateDiagram(emptyDiagram);
    expect(issues.length).toBe(1);
    expect(issues[0]?.code).toBe('no-states');
    expect(issues[0]?.message).toBe('The state diagram has no states.');
  });
});
