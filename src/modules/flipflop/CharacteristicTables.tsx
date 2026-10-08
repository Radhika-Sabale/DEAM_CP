/**
 * @file CharacteristicTables.tsx
 * Tabulated reference views for flip-flops: Characteristic Truth Tables, Compact Operation Tables,
 * Excitation Synthesis Tables, and Characteristic Boolean Equations.
 * Includes accessible current-row indicator, warning badges on invalid states, and don't-care footnotes.
 */

import { type FC, useMemo } from 'react';
import type { FlipFlopType } from '../../types/sequential';
import { inputNames } from '../../engine/flipflop/models';
import {
  characteristicEquation,
  characteristicTable,
  compactTable,
  excitationTable,
} from '../../engine/flipflop/tables';
import { Tabs, type TabItem } from '../../components/ui/Tabs';

export interface CharacteristicTablesProps {
  readonly type: FlipFlopType;
  readonly currentRowIndex?: number;
  readonly className?: string;
}

export const CharacteristicTables: FC<CharacteristicTablesProps> = ({
  type,
  currentRowIndex = -1,
  className = '',
}) => {
  const names = useMemo(() => inputNames(type), [type]);
  const charRows = useMemo(() => characteristicTable(type), [type]);
  const compRows = useMemo(() => compactTable(type), [type]);
  const excRows = useMemo(() => excitationTable(type), [type]);
  const equation = useMemo(() => characteristicEquation(type), [type]);

  const tabs: readonly TabItem[] = [
    {
      id: 'characteristic',
      label: 'Characteristic table',
      content: (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead className="bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th scope="col" className="p-2.5 font-bold uppercase tracking-wider text-[11px]">
                    #
                  </th>
                  {names.map((name) => (
                    <th
                      key={name}
                      scope="col"
                      className="p-2.5 font-bold uppercase tracking-wider text-[11px]"
                    >
                      {name}
                    </th>
                  ))}
                  <th scope="col" className="p-2.5 font-bold uppercase tracking-wider text-[11px]">
                    Q (present state)
                  </th>
                  <th scope="col" className="p-2.5 font-bold uppercase tracking-wider text-[11px]">
                    Q+ (next state)
                  </th>
                  <th scope="col" className="p-2.5 font-bold uppercase tracking-wider text-[11px] font-sans">
                    Operation
                  </th>
                  <th scope="col" className="p-2.5 font-bold uppercase tracking-wider text-[11px] font-sans text-right">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {charRows.map((row) => {
                  const isCurrent = row.index === currentRowIndex;

                  return (
                    <tr
                      key={row.index}
                      className={`transition-colors ${
                        isCurrent
                          ? 'bg-blue-50/80 font-bold dark:bg-blue-950/40'
                          : row.invalid
                          ? 'bg-amber-50/50 dark:bg-amber-950/20'
                          : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/30'
                      }`}
                    >
                      <td className="p-2.5 text-gray-500">{row.index}</td>
                      {row.inputs.map((val, idx) => (
                        <td key={idx} className="p-2.5 font-bold text-gray-900 dark:text-gray-100">
                          {val}
                        </td>
                      ))}
                      <td className="p-2.5 text-gray-700 dark:text-gray-300">{row.q}</td>
                      <td className="p-2.5 font-bold text-blue-600 dark:text-blue-400">
                        {row.qNext}
                      </td>
                      <td className="p-2.5 font-sans text-gray-700 dark:text-gray-300">
                        {row.operation}
                      </td>
                      <td className="p-2.5 text-right font-sans">
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                            <span aria-hidden="true">&bull;</span> Current
                          </span>
                        )}
                        {row.invalid && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                            <span aria-hidden="true">⚠</span> Invalid
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            * Complete truth table ordered by binary value of (inputs..., Q). Q denotes the present state and Q+ denotes the next state.
          </p>
        </div>
      ),
    },
    {
      id: 'operation',
      label: 'Operation table',
      content: (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead className="bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  {names.map((name) => (
                    <th
                      key={name}
                      scope="col"
                      className="p-2.5 font-bold uppercase tracking-wider text-[11px]"
                    >
                      {name}
                    </th>
                  ))}
                  <th scope="col" className="p-2.5 font-bold uppercase tracking-wider text-[11px]">
                    Q+ (next state)
                  </th>
                  <th scope="col" className="p-2.5 font-bold uppercase tracking-wider text-[11px] font-sans">
                    Operation Summary
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {compRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    {row.inputs.map((val, inIdx) => (
                      <td key={inIdx} className="p-2.5 font-bold text-gray-900 dark:text-gray-100">
                        {val}
                      </td>
                    ))}
                    <td className="p-2.5 font-bold text-blue-600 dark:text-blue-400">
                      {row.qNextDescription}
                    </td>
                    <td className="p-2.5 font-sans text-gray-700 dark:text-gray-300">
                      {row.operation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      id: 'excitation',
      label: 'Excitation table',
      content: (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead className="bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <tr>
                  <th scope="col" className="p-2.5 font-bold uppercase tracking-wider text-[11px]">
                    Q (present state)
                  </th>
                  <th scope="col" className="p-2.5 font-bold uppercase tracking-wider text-[11px]">
                    Q+ (next state)
                  </th>
                  {names.map((name) => (
                    <th
                      key={name}
                      scope="col"
                      className="p-2.5 font-bold uppercase tracking-wider text-[11px] text-blue-600 dark:text-blue-400"
                    >
                      Required {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {excRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="p-2.5 font-bold text-gray-900 dark:text-gray-100">{row.q}</td>
                    <td className="p-2.5 font-bold text-gray-900 dark:text-gray-100">{row.qNext}</td>
                    {names.map((name) => {
                      const val = row.inputs[name] ?? 'X';
                      return (
                        <td
                          key={name}
                          className={`p-2.5 font-bold ${
                            val === 'X'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            * Footnote: X = don&apos;t care: either 0 or 1 works.
          </p>
        </div>
      ),
    },
    {
      id: 'equation',
      label: 'Characteristic equation',
      content: (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-950/40 text-xs">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Authoritative Next-State Boolean Equation
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-lg font-bold text-blue-600 dark:text-blue-400">
                Q+ = {equation.text}
              </span>
            </div>
          </div>

          {equation.constraint && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <span className="font-bold">Operational Constraint: </span>
              <span className="font-mono">{equation.constraint}</span> (prevents forbidden state).
            </div>
          )}

          {equation.alternateForms && equation.alternateForms.length > 0 && (
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                Alternate Equivalent Expressions:
              </span>
              <ul className="mt-1 list-inside list-disc space-y-1 font-mono text-gray-800 dark:text-gray-200">
                {equation.alternateForms.map((alt, idx) => (
                  <li key={idx}>Q+ = {alt.text}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-gray-200 pt-3 dark:border-gray-800 text-gray-600 dark:text-gray-400 text-[11px] leading-relaxed">
            <p>
              <strong>Pedagogical Note:</strong> In sequential circuit analysis, <em>Q</em> represents the present stored memory state prior to the clock edge, while <em>Q+</em> (also written as <em>Q<sub>next</sub></em> or <em>Q(t+1)</em>) represents the resulting next state after clock triggering.
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      <div className="border-b border-gray-100 pb-3 dark:border-gray-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Characteristic & Excitation Tables
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Explore complete state transitions, compact operation modes, excitation lookups, and Boolean equations.
        </p>
      </div>

      <div className="mt-4">
        <Tabs tabs={tabs} defaultValue="characteristic" />
      </div>
    </div>
  );
};
