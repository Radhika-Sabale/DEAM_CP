/**
 * @file TruthTableCompare.tsx
 * Levelized truth table extraction and comparative verification panel.
 * Evaluates synthesized circuit netlists against expected Boolean specifications,
 * highlights mismatches, classifies failure heuristics, and logs completion telemetry.
 */

import { useMemo, useState, type FC, useEffect, useRef } from 'react';
import type { LogicValue } from '../../types/ast';
import type { CircuitGraph } from '../../types/circuit';
import type { DesignProject } from '../../types/designProject';
import { parse } from '../../engine/boolean';
import { buildTruthTable } from '../../engine/boolean/truthTable';
import { compareCircuitToIntended } from '../../engine/circuit/compare';
import { extractTruthTable } from '../../engine/circuit/extractTruthTable';
import { useLogStore } from '../../store/logStore';

export interface TruthTableCompareProps {
  readonly graph: CircuitGraph;
  readonly project: DesignProject;
}

export const TruthTableCompare: FC<TruthTableCompareProps> = ({ graph, project }) => {
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  const [useCustomExpr, setUseCustomExpr] = useState<boolean>(false);
  const [customExprText, setCustomExprText] = useState<string>('');
  const [customParseError, setCustomParseError] = useState<string | null>(null);

  const hasLoggedMatchRef = useRef<boolean>(false);

  // 1. Extract truth table from schematic graph
  const extractResult = useMemo(() => {
    return extractTruthTable(graph);
  }, [graph]);

  // Set default selected output when outputs are available
  useEffect(() => {
    if (extractResult.ok && extractResult.table.outputs.length > 0) {
      if (!selectedOutput || !extractResult.table.outputs.includes(selectedOutput)) {
        setSelectedOutput(extractResult.table.outputs[0] ?? '');
      }
    }
  }, [extractResult, selectedOutput]);

  // 2. Derive intended specification from Project or Custom Expression
  const intendedSpec = useMemo<{
    readonly variables: readonly string[];
    readonly column: readonly LogicValue[];
    readonly label: string;
    readonly error?: string;
  } | null>(() => {
    if (useCustomExpr && customExprText.trim()) {
      const parsed = parse(customExprText);
      if (!parsed.ok) {
        setCustomParseError(`Syntax error at position ${parsed.error.position}: ${parsed.error.message}`);
        return null;
      }
      setCustomParseError(null);

      const tt = buildTruthTable(parsed.ast, parsed.variables);
      if (!tt.ok) {
        return { variables: [], column: [], label: 'Custom', error: tt.error };
      }
      return {
        variables: tt.table.variables,
        column: tt.table.rows.map((r) => r.output),
        label: `Expression: ${customExprText}`,
      };
    }

    // Default: Derive from project
    if (project.truthTable && project.truthTable.rows.length > 0) {
      return {
        variables: project.truthTable.variables,
        column: project.truthTable.rows.map((r) => r.output),
        label: 'Intended Truth Table from Project',
      };
    }

    if (project.minimizedExpression?.sop?.ast) {
      const tt = buildTruthTable(project.minimizedExpression.sop.ast, project.variables);
      if (tt.ok) {
        return {
          variables: tt.table.variables,
          column: tt.table.rows.map((r) => r.output),
          label: `Minimized SOP: ${project.minimizedExpression.sop.text}`,
        };
      }
    }

    if (project.expression) {
      const tt = buildTruthTable(project.expression, project.variables);
      if (tt.ok) {
        return {
          variables: tt.table.variables,
          column: tt.table.rows.map((r) => r.output),
          label: 'Boolean Expression from Project',
        };
      }
    }

    return null;
  }, [useCustomExpr, customExprText, project]);

  // 3. Perform comparison if both extracted table and intended specification are available
  const comparisonResult = useMemo(() => {
    if (!extractResult.ok || !intendedSpec || intendedSpec.error || !selectedOutput) {
      return null;
    }

    return compareCircuitToIntended(extractResult.table, selectedOutput, {
      variables: intendedSpec.variables,
      column: intendedSpec.column,
    });
  }, [extractResult, intendedSpec, selectedOutput]);

  // Log session completion telemetry when first matching
  useEffect(() => {
    if (comparisonResult && comparisonResult.status === 'match' && !hasLoggedMatchRef.current) {
      hasLoggedMatchRef.current = true;
      useLogStore.getState().logEvent({
        eventType: 'module-completed',
        moduleId: 'circuit-simulator',
        durationMs: 0,
      });
    }
  }, [comparisonResult, selectedOutput]);

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Truth Table Verification & Comparison
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-[11px]">
            Exhaustive static evaluation comparing simulated circuit logic with intended specification.
          </p>
        </div>

        {/* Output Selector for Multi-Output Circuits */}
        {extractResult.ok && extractResult.table.outputs.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="compare-output-select" className="font-semibold text-gray-700 dark:text-gray-300">
              Output Terminal:
            </label>
            <select
              id="compare-output-select"
              value={selectedOutput}
              onChange={(e) => setSelectedOutput(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              {extractResult.table.outputs.map((out) => (
                <option key={out} value={out}>
                  Output {out}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Intended Specification Selector / Input */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/40 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-700 dark:text-gray-300 text-[11px] uppercase tracking-wider">
            Target Reference Specification
          </span>
          <label className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={useCustomExpr}
              onChange={(e) => setUseCustomExpr(e.target.checked)}
              className="rounded-sm text-blue-600 focus:ring-blue-500"
            />
            <span>Custom Expression</span>
          </label>
        </div>

        {useCustomExpr ? (
          <div className="space-y-1">
            <input
              type="text"
              value={customExprText}
              placeholder="e.g. A' B + A B' (XOR) or A B + C D"
              onChange={(e) => setCustomExprText(e.target.value)}
              aria-label="Custom Boolean target expression"
              className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 font-mono"
            />
            {customParseError && (
              <p className="text-[11px] text-red-600 dark:text-red-400">{customParseError}</p>
            )}
          </div>
        ) : (
          <div className="text-gray-800 dark:text-gray-200 font-medium">
            {intendedSpec?.label || 'No project truth table or expression found. Check upstream Boolean or K-Map modules.'}
          </div>
        )}
      </div>

      {/* Extraction Diagnostics / Error Message */}
      {!extractResult.ok && (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <div className="font-bold flex items-center gap-1.5 mb-1">
            <span>Truth Table Extraction Unavailable:</span>
          </div>
          <p>{extractResult.error.message}</p>
        </div>
      )}

      {/* Comparison Incomparable Message */}
      {comparisonResult && comparisonResult.status === 'incomparable' && (
        <div
          role="alert"
          className="rounded-lg border border-blue-300 bg-blue-50 p-4 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
        >
          <div className="font-bold mb-1">Variable Mismatch:</div>
          <p>{comparisonResult.message}</p>
        </div>
      )}

      {/* Comparison Success / Failure Summary & Heuristics */}
      {comparisonResult && comparisonResult.status !== 'incomparable' && (
        <div className="space-y-3">
          <div
            className={`flex items-center gap-2 rounded-lg p-3 font-semibold ${
              comparisonResult.status === 'match'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200'
            }`}
          >
            <span>{comparisonResult.status === 'match' ? 'Match' : 'Mismatch'}</span>
            <span>
              {comparisonResult.status === 'match'
                ? 'Complete Match! Circuit output matches target specification across all rows.'
                : `Mismatch detected across ${comparisonResult.mismatchCount} row(s).`}
            </span>
          </div>

          {/* Likely Cause Diagnostic Notes */}
          {comparisonResult.likelyCauses.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-800 dark:bg-amber-950/30 space-y-1">
              <span className="font-bold text-amber-900 dark:text-amber-200 block text-[11px] uppercase">
                Diagnostic Pattern Hints:
              </span>
              {comparisonResult.likelyCauses.map((cause, idx) => (
                <p key={idx} className="text-amber-800 dark:text-amber-300">
                  • {cause.message}
                </p>
              ))}
            </div>
          )}

          {/* Real HTML Comparison Table */}
          <div className="overflow-x-auto max-h-72 overflow-y-auto border border-gray-200 rounded-lg dark:border-gray-800">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th scope="col" className="p-2 font-mono font-bold text-[11px] text-gray-600 dark:text-gray-300">
                    Row
                  </th>
                  {intendedSpec?.variables.map((v) => (
                    <th key={v} scope="col" className="p-2 font-mono font-bold text-[11px] text-gray-700 dark:text-gray-200">
                      {v}
                    </th>
                  ))}
                  <th scope="col" className="p-2 font-mono font-bold text-[11px] text-blue-700 dark:text-blue-300">
                    Intended
                  </th>
                  <th scope="col" className="p-2 font-mono font-bold text-[11px] text-purple-700 dark:text-purple-300">
                    Actual ({selectedOutput})
                  </th>
                  <th scope="col" className="p-2 font-bold text-[11px] text-gray-700 dark:text-gray-200 text-right">
                    Verification Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                {comparisonResult.rows.map((row) => {
                  const isMatch = row.status === 'match';
                  const isMismatch = row.status === 'mismatch';

                  return (
                    <tr
                      key={row.index}
                      className={
                        isMismatch
                          ? 'bg-red-50/60 dark:bg-red-950/30'
                          : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/30'
                      }
                    >
                      <td className="p-2 text-gray-400 font-semibold">{row.index}</td>
                      {row.inputs.map((b, bIdx) => (
                        <td key={bIdx} className="p-2 text-gray-800 dark:text-gray-200">
                          {b}
                        </td>
                      ))}
                      <td className="p-2 font-bold text-blue-800 dark:text-blue-300">
                        {row.intended}
                      </td>
                      <td
                        className={`p-2 font-bold ${
                          isMismatch
                            ? 'text-red-700 dark:text-red-400 underline'
                            : 'text-purple-800 dark:text-purple-300'
                        }`}
                      >
                        {row.actual}
                      </td>
                      <td className="p-2 text-right font-sans">
                        <span
                          className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-bold ${
                            isMatch
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                              : isMismatch
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                          }`}
                        >
                          {isMatch ? 'Match' : isMismatch ? 'Mismatch' : row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
