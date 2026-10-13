/**
 * @file TruthTableView.tsx
 * Accessible truth table viewer and direct editor supporting up to 6 variables (64 rows).
 * Provides interactive 0 -> 1 -> X output cycling, don't-care visibility toggle,
 * and canonical SOP/POS notation exports with one-click copy buttons.
 */

import { type FC, useId, useMemo, useState } from 'react';
import type { LogicValue, TruthTable } from '../../types/ast';
import {
  canonicalPOS,
  canonicalSOP,
  tableFromMinterms,
} from '../../engine/boolean';

export interface TruthTableViewProps {
  /** The TruthTable to display */
  readonly table: TruthTable | null;
  /** Optional callback fired when student edits rows by clicking output cells */
  readonly onTableChange?: (table: TruthTable) => void;
  /** Whether student can click outputs to cycle them */
  readonly editable?: boolean;
}

export const TruthTableView: FC<TruthTableViewProps> = ({
  table,
  onTableChange,
  editable = true,
}) => {
  const [showDontCares, setShowDontCares] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const filterId = useId();

  // Compute canonical representations when table changes
  const canonical = useMemo(() => {
    if (!table || table.rows.length === 0) return null;
    const sop = canonicalSOP(table);
    const pos = canonicalPOS(table);
    return { sop, pos };
  }, [table]);

  const copyToClipboard = async (text: string, key: string): Promise<void> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
      }
    } catch {
      // Fallback if clipboard API is restricted
    }
  };

  if (!table || table.rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        No truth table available. Enter a valid expression above or create one.
      </div>
    );
  }

  // Interactive output cycling: 0 -> 1 -> X (if allowed) -> 0
  const handleCycleOutput = (rowIndex: number, current: LogicValue): void => {
    if (!editable || !onTableChange) return;

    let next: LogicValue;
    if (current === 0) {
      next = 1;
    } else if (current === 1) {
      next = showDontCares ? 'X' : 0;
    } else {
      next = 0;
    }

    const minterms: number[] = [];
    const dontCares: number[] = [];

    for (const r of table.rows) {
      const out = r.index === rowIndex ? next : r.output;
      if (out === 1) minterms.push(r.index);
      if (out === 'X') dontCares.push(r.index);
    }

    const res = tableFromMinterms(table.variables, minterms, dontCares);
    if (res.ok) {
      onTableChange(res.table);
    }
  };

  const visibleRows = showDontCares
    ? table.rows
    : table.rows.filter((r) => r.output !== 'X');

  return (
    <div className="space-y-4">
      {/* Controls & Don't Care Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-800 dark:bg-gray-900/40">
        <div className="flex items-center gap-2">
          <input
            id={filterId}
            type="checkbox"
            checked={showDontCares}
            onChange={(e) => setShowDontCares(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor={filterId} className="font-medium text-gray-800 dark:text-gray-200">
            Show and allow Don't-Cares (X)
          </label>
        </div>
        <div className="text-gray-500 dark:text-gray-400">
          Showing {visibleRows.length} of {table.rows.length} rows ({table.variables.length} variables)
          {editable && ' • Click any output to cycle: 0 → 1 → X'}
        </div>
      </div>

      {/* Real HTML <table> with sticky header for up to 64 rows */}
      <div
        className="max-h-96 overflow-y-auto overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800"
        aria-label="Truth Table with keyboard navigation"
      >
        <table className="w-full border-collapse text-left font-mono text-xs">
          <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-100 font-semibold text-gray-700 shadow-xs dark:border-gray-800 dark:bg-gray-800 dark:text-gray-200">
            <tr>
              <th scope="col" className="px-3 py-2">
                Index (m)
              </th>
              {table.variables.map((v) => (
                <th key={v} scope="col" className="px-3 py-2 text-center">
                  {v}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-center font-bold">
                Output (F)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800/60 dark:bg-gray-950">
            {visibleRows.map((row) => {
              const isOne = row.output === 1;
              const isZero = row.output === 0;
              const isX = row.output === 'X';

              return (
                <tr
                  key={row.index}
                  className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/50 ${
                    isOne ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                  }`}
                >
                  <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">
                    m{row.index}
                  </td>
                  {row.inputs.map((bit, bitIdx) => (
                    <td key={bitIdx} className="px-3 py-1.5 text-center text-gray-800 dark:text-gray-200">
                      {bit}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-center">
                    {editable ? (
                      <button
                        type="button"
                        onClick={() => handleCycleOutput(row.index, row.output)}
                        aria-label={`Row ${row.index}, output ${row.output}. Press Enter or click to cycle.`}
                        className={`inline-flex min-w-[70px] items-center justify-center rounded px-2 py-0.5 text-xs font-semibold shadow-xs transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          isOne
                            ? 'border border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : isZero
                              ? 'border border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                              : 'border border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'
                        }`}
                      >
                        {isOne && '1 [High]'}
                        {isZero && '0 [Low]'}
                        {isX && 'X [Don’t Care]'}
                      </button>
                    ) : (
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {row.output}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Canonical Forms & Minterm/Maxterm Lists */}
      {canonical && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Canonical SOP */}
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                Canonical SOP (Σm)
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(canonical.sop.sigmaM, 'sigma')}
                aria-label="Copy Sigma minterm representation"
                className="rounded border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {copiedKey === 'sigma' ? '[Copied!]' : 'Copy Σm'}
              </button>
            </div>
            <div className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
              {canonical.sop.sigmaM}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-1.5 dark:border-gray-800">
              <span className="text-[11px] text-gray-500">Expanded SOP:</span>
              <button
                type="button"
                onClick={() => copyToClipboard(canonical.sop.expanded, 'sop-exp')}
                aria-label="Copy expanded Sum of Products expression"
                className="text-[11px] text-blue-600 hover:underline dark:text-blue-400"
              >
                {copiedKey === 'sop-exp' ? '[Copied!]' : 'Copy expanded'}
              </button>
            </div>
            <div className="mt-0.5 max-h-16 overflow-y-auto font-mono text-xs text-gray-800 dark:text-gray-200">
              {canonical.sop.expanded}
            </div>
          </div>

          {/* Canonical POS */}
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                Canonical POS (ΠM)
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(canonical.pos.piM, 'pi')}
                aria-label="Copy Pi maxterm representation"
                className="rounded border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {copiedKey === 'pi' ? '[Copied!]' : 'Copy ΠM'}
              </button>
            </div>
            <div className="font-mono text-xs font-semibold text-purple-600 dark:text-purple-400">
              {canonical.pos.piM}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-1.5 dark:border-gray-800">
              <span className="text-[11px] text-gray-500">Expanded POS:</span>
              <button
                type="button"
                onClick={() => copyToClipboard(canonical.pos.expanded, 'pos-exp')}
                aria-label="Copy expanded Product of Sums expression"
                className="text-[11px] text-blue-600 hover:underline dark:text-blue-400"
              >
                {copiedKey === 'pos-exp' ? '[Copied!]' : 'Copy expanded'}
              </button>
            </div>
            <div className="mt-0.5 max-h-16 overflow-y-auto font-mono text-xs text-gray-800 dark:text-gray-200">
              {canonical.pos.expanded}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
