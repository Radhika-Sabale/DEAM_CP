/**
 * @file DiagnosticsPanel.tsx
 * Real-time circuit diagnostic inspection panel displaying netlist errors, warnings,
 * and floating pins with accessible severity indicators and canvas focus highlighting.
 */

import type { FC } from 'react';
import type { CircuitDiagnostic } from '../../types/circuit';

export interface DiagnosticsPanelProps {
  readonly diagnostics: readonly CircuitDiagnostic[];
  readonly onSelectDiagnosticElements?: (nodeIds: readonly string[], wireIds: readonly string[]) => void;
}

export const DiagnosticsPanel: FC<DiagnosticsPanelProps> = ({
  diagnostics,
  onSelectDiagnosticElements,
}) => {
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warnCount = diagnostics.filter((d) => d.severity === 'warning').length;
  const infoCount = diagnostics.filter((d) => d.severity === 'info').length;

  const summaryText =
    diagnostics.length === 0
      ? 'No diagnostic problems found in circuit netlist.'
      : `${diagnostics.length} diagnostic issues (${errorCount} errors, ${warnCount} warnings, ${infoCount} notices).`;

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
      {/* Header & Live Summary */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Netlist Diagnostics & Validation
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Static topological rule checks for floating pins, drivers, and loops.
          </p>
        </div>

        <span
          aria-live="polite"
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            errorCount > 0
              ? 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200'
              : warnCount > 0
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
          }`}
        >
          {errorCount > 0 ? '❌ Error' : warnCount > 0 ? '⚠️ Warning' : '✓ Valid'}
        </span>
      </div>

      {/* Screen reader summary announcement */}
      <div aria-live="polite" className="sr-only">
        {summaryText}
      </div>

      {/* Diagnostics List */}
      {diagnostics.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-gray-500 dark:text-gray-400">
          <span className="text-2xl mb-1 text-emerald-500">✓</span>
          <span className="font-semibold text-gray-800 dark:text-gray-200">No problems found</span>
          <span>All pins are driven, references are valid, and logic levels are properly constrained.</span>
        </div>
      ) : (
        <ul className="space-y-2.5" aria-label="Circuit Diagnostics List">
          {diagnostics.map((diag, idx) => {
            const isError = diag.severity === 'error';
            const isWarn = diag.severity === 'warning';

            return (
              <li key={`${diag.code}_${idx}`}>
                <button
                  type="button"
                  onClick={() => onSelectDiagnosticElements?.(diag.nodeIds, diag.wireIds)}
                  className={`w-full text-left rounded-lg border p-3 text-xs transition hover:shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                    isError
                      ? 'border-red-200 bg-red-50/70 hover:bg-red-100/60 dark:border-red-900/50 dark:bg-red-950/30'
                      : isWarn
                      ? 'border-amber-200 bg-amber-50/70 hover:bg-amber-100/60 dark:border-amber-900/50 dark:bg-amber-950/30'
                      : 'border-blue-200 bg-blue-50/70 hover:bg-blue-100/60 dark:border-blue-900/50 dark:bg-blue-950/30'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="font-bold shrink-0">
                      {isError ? '❌ ERROR' : isWarn ? '⚠️ WARNING' : 'ℹ️ INFO'}
                    </span>
                    <div className="flex-1">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        [{diag.code}]
                      </span>{' '}
                      <span className="text-gray-800 dark:text-gray-200">{diag.message}</span>
                      {diag.nodeIds.length > 0 && (
                        <div className="mt-1 font-mono text-[11px] text-gray-500 dark:text-gray-400">
                          Referenced Nodes: {diag.nodeIds.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
