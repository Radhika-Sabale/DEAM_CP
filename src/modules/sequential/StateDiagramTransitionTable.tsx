/**
 * @file StateDiagramTransitionTable.tsx
 * Accessible transitions editing table for state diagram definitions.
 * Provides accessible keyboard dropdown controls for each state condition.
 */

import { type FC } from 'react';
import type { LogicValue } from '../../types/ast';
import type {
  MachineKind,
  StateDiagramData,
  StateDiagramEdge,
} from '../../types/sequential';

export interface TransitionDraftEntry {
  readonly nextCode: number | null;
  readonly mealyOutput: LogicValue;
}

export interface StateDiagramTransitionTableProps {
  readonly validCodes: readonly number[];
  readonly stateNames: Record<number, string>;
  readonly stateBits: number;
  readonly hasInput: boolean;
  readonly inVarName: string;
  readonly inputs: readonly number[];
  readonly machineKind: MachineKind;
  readonly draft: Record<string, TransitionDraftEntry>;
  readonly rowResults: Record<string, { ok: boolean; msg: string }>;
  readonly onCellChange: (key: string, nextCode: number | null, mealyOutput?: LogicValue) => void;
}

function formatCode(code: number, bits: number): string {
  return code.toString(2).padStart(bits, '0');
}

/**
 * Builds a StateDiagramData graph from the student's tabular draft entries.
 */
export function buildDraftDiagram(
  validCodes: readonly number[],
  stateBits: number,
  initialStateCode: number,
  machineKind: 'counter' | 'mealy' | 'moore',
  stateNames: Record<number, string>,
  draft: Record<string, TransitionDraftEntry>
): StateDiagramData {
  const nodes = validCodes.map((code) => ({
    id: `state-${code}`,
    code,
    name: stateNames[code] ?? `S${code}`,
    binaryCode: formatCode(code, stateBits),
    isInitial: code === initialStateCode,
    mooreOutput: machineKind === 'moore' ? (0 as LogicValue) : undefined,
  }));

  const edgeMap = new Map<
    string,
    {
      fromCode: number;
      toCode: number;
      conditions: { inputValue: number; mealyOutput?: LogicValue }[];
    }
  >();

  for (const [key, entry] of Object.entries(draft)) {
    if (entry.nextCode === null) continue;
    const [fromCodeStr, inValStr] = key.split(':');
    const fromCode = Number(fromCodeStr);
    const inVal = Number(inValStr ?? 0);
    const toCode = entry.nextCode;

    const edgeKey = `${fromCode}->${toCode}`;
    const existing = edgeMap.get(edgeKey);
    const cond = {
      inputValue: inVal,
      mealyOutput: machineKind === 'mealy' ? entry.mealyOutput : undefined,
    };

    if (existing) {
      existing.conditions.push(cond);
    } else {
      edgeMap.set(edgeKey, { fromCode, toCode, conditions: [cond] });
    }
  }

  const edges: StateDiagramEdge[] = [];
  let eIdx = 0;
  for (const edge of edgeMap.values()) {
    const labelParts = edge.conditions.map((c) =>
      c.mealyOutput !== undefined ? `${c.inputValue}/${c.mealyOutput}` : `${c.inputValue}`
    );

    edges.push({
      id: `e-${eIdx++}`,
      fromCode: edge.fromCode,
      toCode: edge.toCode,
      label: labelParts.join(', '),
      conditions: edge.conditions,
      isSelfLoop: edge.fromCode === edge.toCode,
    });
  }

  return {
    machineKind,
    stateBits,
    initialStateCode,
    nodes,
    edges,
  };
}

export const StateDiagramTransitionTable: FC<StateDiagramTransitionTableProps> = ({
  validCodes,
  stateNames,
  stateBits,
  hasInput,
  inVarName,
  inputs,
  machineKind,
  draft,
  rowResults,
  onCellChange,
}) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
        State Transition Mapping
      </h4>
      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
        Specify the target next state for each state condition.
      </p>

      <table className="mt-3 w-full text-left font-mono text-xs" aria-label="State Diagram Transitions Editor">
        <thead>
          <tr className="border-b border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-400">
            <th scope="col" className="px-2.5 py-1.5 font-bold">Present State</th>
            {hasInput && <th scope="col" className="px-2.5 py-1.5 font-bold">{inVarName}</th>}
            <th scope="col" className="px-2.5 py-1.5 font-bold">Target State</th>
            {machineKind === 'mealy' && <th scope="col" className="px-2.5 py-1.5 font-bold">Output (Y)</th>}
            <th scope="col" className="px-2.5 py-1.5 font-bold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {validCodes.map((code) => {
            const sName = stateNames[code] ?? `S${code}`;
            const bCode = formatCode(code, stateBits);

            return inputs.map((inVal) => {
              const key = `${code}:${inVal}`;
              const entry = draft[key] ?? { nextCode: null, mealyOutput: 0 };
              const res = rowResults[key];

              return (
                <tr key={key} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                  <td className="px-2.5 py-1.5 font-bold text-gray-900 dark:text-gray-100">
                    {sName} ({bCode})
                  </td>
                  {hasInput && (
                    <td className="px-2.5 py-1.5 font-bold text-blue-600 dark:text-blue-400">
                      {inVal}
                    </td>
                  )}
                  <td className="px-2.5 py-1.5">
                    <select
                      value={entry.nextCode !== null ? String(entry.nextCode) : ''}
                      aria-label={`State ${sName}, ${hasInput ? `${inVarName} = ${inVal}, ` : ''}target state`}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        onCellChange(key, val);
                      }}
                      className="rounded-md border border-gray-300 bg-white p-1 text-xs text-gray-900 shadow-2xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    >
                      <option value="">-- select target --</option>
                      {validCodes.map((tCode) => (
                        <option key={tCode} value={tCode}>
                          {stateNames[tCode] ?? `S${tCode}`} ({formatCode(tCode, stateBits)})
                        </option>
                      ))}
                    </select>
                  </td>
                  {machineKind === 'mealy' && (
                    <td className="px-2.5 py-1.5">
                      <select
                        value={entry.mealyOutput}
                        aria-label={`State ${sName}, ${inVarName} = ${inVal}, Mealy output`}
                        onChange={(e) => onCellChange(key, entry.nextCode, Number(e.target.value) as LogicValue)}
                        className="rounded-md border border-gray-300 bg-white p-1 text-xs text-gray-900 shadow-2xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      >
                        <option value="0">0</option>
                        <option value="1">1</option>
                      </select>
                    </td>
                  )}
                  <td className="px-2.5 py-1.5 text-[11px]">
                    {res ? (
                      res.ok ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓ Correct</span>
                      ) : (
                        <span className="font-semibold text-red-600 dark:text-red-400">✗ {res.msg}</span>
                      )
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
};
