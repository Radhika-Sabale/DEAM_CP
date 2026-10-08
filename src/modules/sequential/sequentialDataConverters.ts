/**
 * @file sequentialDataConverters.ts
 * Type conversion helpers between canonical engine representations and UI/project shapes.
 */

import type { LogicValue } from '../../types/ast';
import type {
  CanonicalExcitationTable,
  CanonicalStateTable,
  ExcitationTable,
  ExcitationTableRow,
  StateDiagram,
  StateDiagramData,
  StateTable,
  StateTableRow,
} from '../../types/sequential';
import { formatCode } from '../../engine/sequential/encoding';

/**
 * Converts a CanonicalStateTable to the standard StateTable project shape.
 */
export function canonicalToStateTable(canonical: CanonicalStateTable): StateTable {
  const rows: StateTableRow[] = canonical.rows.map((r) => {
    const pres = r.stateName;
    const next = typeof r.nextCode === 'number'
      ? r.nextStateName
      : String(r.nextCode);

    let outStr: string | undefined = undefined;
    if (canonical.machineKind === 'moore') {
      outStr = r.mooreOutput === 'X' ? 'X' : String(r.mooreOutput);
    } else if (canonical.machineKind === 'mealy') {
      outStr = r.mealyOutput === 'X' ? 'X' : String(r.mealyOutput);
    }

    return {
      presentState: pres,
      input: r.inputName !== undefined
        ? String(r.inputValue)
        : (canonical.hasInput ? String(r.inputValue) : undefined),
      nextState: next,
      output: outStr,
    };
  });

  return { rows };
}

/**
 * Converts a CanonicalExcitationTable to the standard ExcitationTable project shape.
 */
export function canonicalToExcitationTable(canonical: CanonicalExcitationTable): ExcitationTable {
  const rows: ExcitationTableRow[] = canonical.rows.map((r) => {
    const pres = formatCode(r.code, canonical.stateBits);
    const next = typeof r.nextCode === 'number'
      ? formatCode(r.nextCode, canonical.stateBits)
      : 'X';

    const flipFlopInputs: Record<string, Record<string, LogicValue>> = {};
    for (const t of r.transitions) {
      flipFlopInputs[`Q${t.bitIndex}`] = t.inputs;
    }

    return {
      presentState: pres,
      nextState: next,
      flipFlopInputs,
    };
  });

  return { rows };
}

/**
 * Converts internal StateDiagramData to standard StateDiagram shape.
 */
export function stateDiagramDataToDiagram(data: StateDiagramData): StateDiagram {
  return {
    machineKind: data.machineKind,
    initialStateId: `state-${data.initialStateCode}`,
    states: data.nodes.map((s) => ({
      id: s.id,
      name: s.name,
      binaryCode: s.binaryCode,
      mooreOutput: s.mooreOutput !== undefined ? String(s.mooreOutput) : undefined,
    })),
    transitions: data.edges.map((t) => ({
      id: t.id,
      fromStateId: `state-${t.fromCode}`,
      toStateId: `state-${t.toCode}`,
      inputCondition: t.label,
      mealyOutput: t.conditions[0]?.mealyOutput !== undefined
        ? String(t.conditions[0]?.mealyOutput)
        : undefined,
    })),
  };
}
