/**
 * @file EquivalencePanel.tsx
 * Compares two Boolean expressions for truth-table equivalence.
 * Identifies counterexample assignments on mismatch and renders a side-by-side
 * discrepancy table comparing the outputs of both expressions for all differing valuations.
 */

import { type FC, useMemo, useState } from 'react';
import type { BoolNode } from '../../types/ast';
import {
  areEquivalent,
  evaluateBinary,
  parse,
} from '../../engine/boolean';
import { ExpressionInput } from './ExpressionInput';

export interface EquivalencePanelProps {
  /** Initial expression for input 1 (typically the active project expression) */
  readonly initialExpression?: string;
}

interface DifferingRow {
  readonly index: number;
  readonly assignment: Record<string, 0 | 1>;
  readonly out1: 0 | 1;
  readonly out2: 0 | 1;
}

type ComparisonResult =
  | { readonly kind: 'error'; readonly error: string }
  | { readonly kind: 'equivalent' }
  | {
      readonly kind: 'different';
      readonly differingRows: readonly DifferingRow[];
      readonly variables: readonly string[];
    };

/** Recursively extracts unique sorted variable names from an AST */
function getAstVariables(node: BoolNode): string[] {
  const vars = new Set<string>();
  function walk(n: BoolNode): void {
    if (n.type === 'variable') vars.add(n.name);
    else if (n.type === 'not') walk(n.child);
    else if (n.type === 'and' || n.type === 'or') n.children.forEach(walk);
    else if ('left' in n && 'right' in n) {
      walk(n.left);
      walk(n.right);
    }
  }
  walk(node);
  return Array.from(vars).sort();
}

export const EquivalencePanel: FC<EquivalencePanelProps> = ({
  initialExpression = '',
}) => {
  const [expr1, setExpr1] = useState(initialExpression);
  const [expr2, setExpr2] = useState('');

  // Parse both expressions
  const parse1 = useMemo(() => (expr1.trim() ? parse(expr1) : null), [expr1]);
  const parse2 = useMemo(() => (expr2.trim() ? parse(expr2) : null), [expr2]);

  // Equivalence analysis
  const comparison = useMemo<ComparisonResult | null>(() => {
    if (!parse1 || !parse2 || !parse1.ok || !parse2.ok) return null;

    const ast1 = parse1.ast;
    const ast2 = parse2.ast;

    let isEq = false;
    try {
      isEq = areEquivalent(ast1, ast2);
    } catch {
      return { kind: 'error', error: 'Too many variables to compare (exceeds limit)' };
    }

    if (isEq) {
      return { kind: 'equivalent' };
    }

    // Identify differing rows and first counterexample
    const vars = Array.from(
      new Set([...getAstVariables(ast1), ...getAstVariables(ast2)])
    ).sort();
    const n = vars.length;
    const total = 1 << n;
    const differingRows: DifferingRow[] = [];

    for (let mask = 0; mask < total; mask++) {
      const assignment: Record<string, 0 | 1> = {};
      for (let i = 0; i < n; i++) {
        const v = vars[i];
        if (v !== undefined) {
          assignment[v] = ((mask >> (n - 1 - i)) & 1) as 0 | 1;
        }
      }
      const out1 = evaluateBinary(ast1, assignment);
      const out2 = evaluateBinary(ast2, assignment);

      if (out1 !== out2) {
        differingRows.push({ index: mask, assignment, out1, out2 });
      }
    }

    return { kind: 'different', differingRows, variables: vars };
  }, [parse1, parse2]);

  const firstDiff = comparison && comparison.kind === 'different'
    ? comparison.differingRows[0]
    : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <ExpressionInput
            id="equiv-expr-1"
            label="Expression 1"
            value={expr1}
            onChange={setExpr1}
            placeholder="e.g. A + B"
          />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <ExpressionInput
            id="equiv-expr-2"
            label="Expression 2"
            value={expr2}
            onChange={setExpr2}
            placeholder="e.g. (A'B')'"
          />
        </div>
      </div>

      {/* Comparison Outcome Banner */}
      {comparison && (
        <div
          role="status"
          aria-live="polite"
          className="space-y-4 rounded-lg border p-4 text-xs"
        >
          {comparison.kind === 'error' ? (
            <div className="font-semibold text-amber-700 dark:text-amber-400">
              [Warning] {comparison.error}
            </div>
          ) : comparison.kind === 'equivalent' ? (
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              <span className="font-bold text-sm" aria-label="Result: Equivalent">
                [Equivalent]
              </span>
              <span>
                Both expressions produce identical outputs across all possible input valuations.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md bg-red-50 p-3 text-red-800 dark:bg-red-950/50 dark:text-red-300">
                <div className="font-bold text-sm" aria-label="Result: Not equivalent">
                  [Not Equivalent]
                </div>
                <div className="mt-1">
                  The expressions produce different outputs for {comparison.differingRows.length}{' '}
                  input combination{comparison.differingRows.length === 1 ? '' : 's'}.
                </div>

                {firstDiff && (
                  <div className="mt-2 rounded bg-white/70 p-2 font-mono text-xs dark:bg-gray-900/80">
                    <span className="font-semibold">Counterexample:</span>{' '}
                    {Object.entries(firstDiff.assignment)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(', ')}{' '}
                    → Expression 1 ={' '}
                    <strong>{firstDiff.out1 === 1 ? '1 [High]' : '0 [Low]'}</strong>, Expression
                    2 = <strong>{firstDiff.out2 === 1 ? '1 [High]' : '0 [Low]'}</strong>
                  </div>
                )}
              </div>

              {/* Differing Rows Table */}
              <div>
                <div className="mb-2 font-semibold text-gray-800 dark:text-gray-200">
                  Differing Combinations ({comparison.differingRows.length} rows):
                </div>
                <div
                  className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800"
                  aria-label="Table of differing valuations between expressions"
                >
                  <table className="w-full border-collapse font-mono text-xs">
                    <thead className="sticky top-0 border-b border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-200">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left">
                          Index
                        </th>
                        {comparison.variables.map((v) => (
                          <th key={v} scope="col" className="px-3 py-2 text-center">
                            {v}
                          </th>
                        ))}
                        <th scope="col" className="px-3 py-2 text-center font-bold">
                          Expr 1 Output
                        </th>
                        <th scope="col" className="px-3 py-2 text-center font-bold">
                          Expr 2 Output
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
                      {comparison.differingRows.map((row) => (
                        <tr key={row.index} className="hover:bg-red-50/40 dark:hover:bg-red-950/20">
                          <td className="px-3 py-1.5 text-gray-500">m{row.index}</td>
                          {comparison.variables.map((v) => (
                            <td key={v} className="px-3 py-1.5 text-center text-gray-800 dark:text-gray-200">
                              {row.assignment[v]}
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-center font-semibold text-gray-900 dark:text-gray-100">
                            {row.out1 === 1 ? '1 [High]' : '0 [Low]'}
                          </td>
                          <td className="px-3 py-1.5 text-center font-semibold text-gray-900 dark:text-gray-100">
                            {row.out2 === 1 ? '1 [High]' : '0 [Low]'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
