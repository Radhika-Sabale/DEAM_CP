/**
 * @file stateDiagram.ts
 * Bidirectional conversion between State Table and State Diagram graph representations,
 * edge condition merging, and diagram structural validation (Stage 10A).
 */

import type { LogicValue } from '../../types/ast';
import type {
  CanonicalStateTable,
  MachineKind,
  StateDiagramData,
  StateDiagramEdge,
  StateDiagramNode,
} from '../../types/sequential';
import { formatCode, inputVariableNames, rowIndex } from './encoding';
import { createCanonicalStateTable, tableRow } from './stateTable';

/** Diagram validation diagnostic with severity and plain-language explanation. */
export interface DiagramValidationIssue {
  readonly severity: 'error' | 'warning';
  readonly code:
    | 'no-states'
    | 'duplicate-state-name'
    | 'unknown-target'
    | 'missing-transition'
    | 'conflicting-transition'
    | 'unreachable-state';
  readonly message: string;
}

/**
 * Converts a CanonicalStateTable into a StateDiagramData graph representation.
 * Valid states become nodes; transitions sharing origin and destination are merged into multi-condition edges.
 *
 * @param table Canonical state table
 * @param stateNames Optional custom display names for states
 * @returns StateDiagramData graph model
 */
export function diagramFromTable(
  table: CanonicalStateTable,
  stateNames?: Readonly<Record<number, string>>
): StateDiagramData {
  const nodes: StateDiagramNode[] = [];
  const inVar = inputVariableNames(table.inputKind)[0] ?? 'IN';

  // 1. Build nodes for valid states only
  for (const code of table.validCodes) {
    const sName = stateNames?.[code] ?? table.stateNames[code] ?? `S${code}`;
    const bCode = formatCode(code, table.stateBits);

    // Get Moore output if Moore machine
    let mooreOutput: LogicValue | undefined = undefined;
    if (table.machineKind === 'moore') {
      const sampleRow = tableRow(table, code, 0);
      mooreOutput = sampleRow?.mooreOutput ?? 0;
    }

    nodes.push({
      id: `state-${code}`,
      code,
      name: sName,
      binaryCode: bCode,
      isInitial: code === table.initialStateCode,
      mooreOutput,
    });
  }

  // 2. Group transitions by (fromCode, toCode)
  type EdgeBucket = {
    readonly fromCode: number;
    readonly toCode: number;
    readonly conditions: {
      readonly inputValue: number;
      readonly mealyOutput?: LogicValue;
    }[];
  };

  const edgeMap = new Map<string, EdgeBucket>();

  for (const code of table.validCodes) {
    const inputs = table.hasInput ? ([0, 1] as const) : ([0] as const);

    for (const inVal of inputs) {
      const row = tableRow(table, code, inVal);
      if (row && row.valid && typeof row.nextCode === 'number') {
        const key = `${code}->${row.nextCode}`;
        const existing = edgeMap.get(key);

        const cond = {
          inputValue: inVal,
          mealyOutput: table.machineKind === 'mealy' ? row.mealyOutput : undefined,
        };

        if (existing) {
          existing.conditions.push(cond);
        } else {
          edgeMap.set(key, {
            fromCode: code,
            toCode: row.nextCode,
            conditions: [cond],
          });
        }
      }
    }
  }

  // 3. Format edge labels
  const edges: StateDiagramEdge[] = [];
  let edgeCounter = 0;

  for (const bucket of edgeMap.values()) {
    const labelParts = bucket.conditions.map((c) => {
      if (!table.hasInput) {
        return '';
      }
      if (table.machineKind === 'mealy') {
        const outStr = c.mealyOutput === 'X' ? 'X' : String(c.mealyOutput ?? 0);
        return `${c.inputValue}/${outStr}`;
      }
      return `${inVar}=${c.inputValue}`;
    });

    const label = labelParts.filter((p) => p.length > 0).join(', ');

    edges.push({
      id: `edge-${edgeCounter++}-${bucket.fromCode}-${bucket.toCode}`,
      fromCode: bucket.fromCode,
      toCode: bucket.toCode,
      label,
      conditions: bucket.conditions,
      isSelfLoop: bucket.fromCode === bucket.toCode,
    });
  }

  return {
    machineKind: table.machineKind,
    stateBits: table.stateBits,
    initialStateCode: table.initialStateCode,
    nodes,
    edges,
  };
}

/**
 * Reconstructs a CanonicalStateTable from a StateDiagramData model.
 * Inverts diagramFromTable, guaranteeing identity on valid rows.
 *
 * @param diagram State diagram data
 * @param stateBits Number of state bits
 * @param hasInput Whether the machine has an external input
 * @param machineKind FSM classification
 * @param inputKind Category of input variable
 * @returns Reconstructed CanonicalStateTable
 */
export function tableFromDiagram(
  diagram: StateDiagramData,
  stateBits: number,
  hasInput: boolean,
  machineKind: MachineKind,
  inputKind: 'none' | 'counter-up-down' | 'detector' = 'none'
): CanonicalStateTable {
  const validCodes = diagram.nodes.map((n) => n.code);
  const stateNames: Record<number, string> = {};
  for (const node of diagram.nodes) {
    stateNames[node.code] = node.name;
  }

  const transitions = new Map<
    number,
    {
      readonly nextCode: number;
      readonly mealyOutput?: LogicValue;
      readonly mooreOutput?: LogicValue;
    }
  >();

  // Map Moore outputs from nodes
  const nodeMooreOutputs = new Map<number, LogicValue>();
  for (const node of diagram.nodes) {
    if (node.mooreOutput !== undefined) {
      nodeMooreOutputs.set(node.code, node.mooreOutput);
    }
  }

  for (const edge of diagram.edges) {
    for (const cond of edge.conditions) {
      const idx = rowIndex(edge.fromCode, cond.inputValue, hasInput);
      const mooreOut = nodeMooreOutputs.get(edge.fromCode) ?? 0;

      transitions.set(idx, {
        nextCode: edge.toCode,
        mealyOutput: cond.mealyOutput ?? 0,
        mooreOutput: mooreOut,
      });
    }
  }

  return createCanonicalStateTable(
    stateBits,
    validCodes,
    diagram.initialStateCode,
    hasInput,
    inputKind,
    machineKind,
    transitions,
    stateNames
  );
}

/**
 * Validates a StateDiagramData graph model for missing transitions, duplicate names,
 * invalid targets, and unreachable states. Returns plain-language messages.
 *
 * @param diagram State diagram graph to validate
 * @returns Array of validation issues
 */
export function validateDiagram(diagram: StateDiagramData): readonly DiagramValidationIssue[] {
  const issues: DiagramValidationIssue[] = [];

  if (diagram.nodes.length === 0) {
    return [
      {
        severity: 'error',
        code: 'no-states',
        message: 'The state diagram has no states.',
      },
    ];
  }

  // 1. Check duplicate state names or codes
  const seenCodes = new Set<number>();
  const seenNames = new Set<string>();

  for (const node of diagram.nodes) {
    if (seenCodes.has(node.code)) {
      issues.push({
        severity: 'error',
        code: 'duplicate-state-name',
        message: `Duplicate state code ${node.code} found for state '${node.name}'.`,
      });
    }
    seenCodes.add(node.code);

    if (seenNames.has(node.name)) {
      issues.push({
        severity: 'warning',
        code: 'duplicate-state-name',
        message: `Multiple states share the same name '${node.name}'.`,
      });
    }
    seenNames.add(node.name);
  }

  // 2. Check edges for unknown target codes and conflicting inputs
  const nodeCodes = new Set(diagram.nodes.map((n) => n.code));

  // Map from stateCode -> set of outgoing inputs
  const inputsSeen = new Map<number, Set<number>>();

  for (const edge of diagram.edges) {
    if (!nodeCodes.has(edge.fromCode)) {
      issues.push({
        severity: 'error',
        code: 'unknown-target',
        message: `Transition originates from unknown state code ${edge.fromCode}.`,
      });
    }

    if (!nodeCodes.has(edge.toCode)) {
      issues.push({
        severity: 'error',
        code: 'unknown-target',
        message: `Transition targets unknown state code ${edge.toCode}.`,
      });
    }

    let seenForNode = inputsSeen.get(edge.fromCode);
    if (!seenForNode) {
      seenForNode = new Set<number>();
      inputsSeen.set(edge.fromCode, seenForNode);
    }

    for (const cond of edge.conditions) {
      if (seenForNode.has(cond.inputValue)) {
        const fromNode = diagram.nodes.find((n) => n.code === edge.fromCode);
        const name = fromNode?.name ?? `S${edge.fromCode}`;
        issues.push({
          severity: 'error',
          code: 'conflicting-transition',
          message: `State ${name} has multiple conflicting arrows for input ${cond.inputValue}.`,
        });
      }
      seenForNode.add(cond.inputValue);
    }
  }

  // 3. Check for missing transitions from each node (if machine has input)
  const isInputMachine = diagram.edges.some((e) => e.conditions.some((c) => c.inputValue !== 0)) || diagram.machineKind !== 'counter';

  if (isInputMachine) {
    for (const node of diagram.nodes) {
      const seen = inputsSeen.get(node.code) ?? new Set<number>();
      for (const requiredInput of [0, 1]) {
        if (!seen.has(requiredInput)) {
          issues.push({
            severity: 'error',
            code: 'missing-transition',
            message: `State ${node.name} has no arrow for IN = ${requiredInput}.`,
          });
        }
      }
    }
  }

  // 4. Reachability check from initial state
  const reachable = new Set<number>();
  const queue: number[] = [diagram.initialStateCode];
  reachable.add(diagram.initialStateCode);

  while (queue.length > 0) {
    const curr = queue.shift();
    if (curr === undefined) break;

    for (const edge of diagram.edges) {
      if (edge.fromCode === curr && !reachable.has(edge.toCode)) {
        reachable.add(edge.toCode);
        queue.push(edge.toCode);
      }
    }
  }

  for (const node of diagram.nodes) {
    if (!reachable.has(node.code)) {
      issues.push({
        severity: 'warning',
        code: 'unreachable-state',
        message: `State ${node.name} is unreachable from initial state.`,
      });
    }
  }

  return issues;
}
