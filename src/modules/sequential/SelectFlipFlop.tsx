/**
 * @file SelectFlipFlop.tsx
 * Step 1 component: Flip-Flop architecture selection (Stage 10D).
 *
 * Renders an accessible radiogroup for SR, JK, D, and T flip-flops, pre-selected
 * from the project store, with authoritative compact characteristic and excitation
 * tables rendered in semantic HTML <table> elements.
 */

import { type FC } from 'react';
import { inputNames } from '../../engine/flipflop/models';
import { compactTable, excitationTable } from '../../engine/flipflop/tables';
import { useProjectStore } from '../../store/projectStore';
import type { FlipFlopType } from '../../types/sequential';

export interface SelectFlipFlopProps {
  readonly selectedType: FlipFlopType | null;
  readonly onSelectType: (type: FlipFlopType) => void;
  readonly className?: string;
}

const FLIP_FLOP_TYPES: readonly FlipFlopType[] = ['SR', 'JK', 'D', 'T'] as const;

const FLIP_FLOP_DESCRIPTIONS: Record<FlipFlopType, string> = {
  SR: 'Set-Reset: Simplest bistable latch; indeterminate state when S = 1 and R = 1.',
  JK: 'Jack-Kilby: Universal master-slave; toggles when J = 1 and K = 1 without invalid states.',
  D: 'Data / Delay: Single data input; samples and transfers D to Q on the active clock edge.',
  T: 'Toggle: Single toggle input; inverts state when T = 1, holds state when T = 0.',
};

export const SelectFlipFlop: FC<SelectFlipFlopProps> = ({
  selectedType,
  onSelectType,
  className = '',
}) => {
  const applyPatch = useProjectStore((s) => s.applyPatch);

  const handleSelect = (type: FlipFlopType) => {
    applyPatch({ flipFlopType: type });
    onSelectType(type);
  };

  const inNames = selectedType ? inputNames(selectedType) : [];
  const compRows = selectedType ? compactTable(selectedType) : [];
  const excRows = selectedType ? excitationTable(selectedType) : [];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Unset advisory note */}
      {!selectedType && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium">
              No flip-flop selected yet. Choose a flip-flop type to begin.
            </p>
            <a
              href="#/flipflop-simulator"
              className="inline-flex items-center text-xs font-semibold text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Explore in Flip-Flop Module &rarr;
            </a>
          </div>
        </div>
      )}

      {/* Radiogroup for SR / JK / D / T */}
      <div>
        <fieldset>
          <legend className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Target Flip-Flop Architecture
          </legend>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Select the storage element for your sequential circuit design.
          </p>

          <div
            role="radiogroup"
            aria-label="Target Flip-Flop Architecture"
            className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {FLIP_FLOP_TYPES.map((type) => {
              const isChecked = selectedType === type;
              return (
                <label
                  key={type}
                  htmlFor={`ff-radio-${type}`}
                  className={`flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all ${
                    isChecked
                      ? 'border-blue-600 bg-blue-50/60 shadow-xs dark:border-blue-500 dark:bg-blue-950/40'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                      {type} Flip-Flop
                    </span>
                    <input
                      id={`ff-radio-${type}`}
                      type="radio"
                      name="flipFlopSelection"
                      value={type}
                      checked={isChecked}
                      onChange={() => handleSelect(type)}
                      className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-700"
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    {FLIP_FLOP_DESCRIPTIONS[type]}
                  </p>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      {/* Authoritative Tables for Selected Type */}
      {selectedType && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Compact Operation Table */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              {selectedType} Operation Table
            </h4>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              Output state behavior corresponding to input combinations.
            </p>

            <div className="mt-3 overflow-x-auto">
              <table
                className="w-full text-left font-mono text-xs"
                aria-label={`${selectedType} Operation Table`}
              >
                <thead>
                  <tr className="border-b border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-400">
                    {inNames.map((name) => (
                      <th key={name} scope="col" className="px-3 py-1.5 font-bold">
                        {name}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-1.5 font-bold">
                      Q(next)
                    </th>
                    <th scope="col" className="px-3 py-1.5 font-bold">
                      Operation
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {compRows.map((r, i) => (
                    <tr
                      key={i}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                    >
                      {r.inputs.map((val, inIdx) => (
                        <td key={inIdx} className="px-3 py-1.5 text-gray-900 dark:text-gray-100">
                          {val}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 font-bold text-blue-600 dark:text-blue-400">
                        {r.qNextDescription}
                      </td>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">
                        {r.operation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Excitation Table */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              {selectedType} Excitation Table
            </h4>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              Required input values to achieve state transition Q &rarr; Q+.
            </p>

            <div className="mt-3 overflow-x-auto">
              <table
                className="w-full text-left font-mono text-xs"
                aria-label={`${selectedType} Excitation Table`}
              >
                <thead>
                  <tr className="border-b border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-400">
                    <th scope="col" className="px-3 py-1.5 font-bold">
                      Q
                    </th>
                    <th scope="col" className="px-3 py-1.5 font-bold">
                      Q+
                    </th>
                    {inNames.map((name) => (
                      <th key={name} scope="col" className="px-3 py-1.5 font-bold">
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {excRows.map((r, i) => (
                    <tr
                      key={i}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                    >
                      <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100">
                        {r.q}
                      </td>
                      <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100">
                        {r.qNext}
                      </td>
                      {inNames.map((name) => (
                        <td
                          key={name}
                          className={`px-3 py-1.5 font-bold ${
                            r.inputs[name] === 'X'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {String(r.inputs[name])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
