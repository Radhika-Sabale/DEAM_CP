/**
 * @file BooleanPage.tsx
 * Primary laboratory viewport for Boolean analysis, truth tables, algebraic simplification,
 * equivalence validation, and universal logic gate synthesis.
 * Wires local state directly to the global project store and pipeline stepper.
 */

import { type FC, useCallback, useEffect, useState } from 'react';
import type { BoolNode, TruthTable } from '../../types/ast';
import {
  buildTruthTable,
  parse,
  type ParseResult,
  toString,
} from '../../engine/boolean';
import { SendToNextButton } from '../../components/layout/SendToNextButton';
import { Tabs } from '../../components/ui/Tabs';
import { selectCurrentProject, useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { BooleanPractice } from './BooleanPractice';
import { EquivalencePanel } from './EquivalencePanel';
import { ExpressionInput } from './ExpressionInput';
import { SimplificationSteps } from './SimplificationSteps';
import { TruthTableView } from './TruthTableView';
import { UniversalGatePanel } from './UniversalGatePanel';

export interface BooleanPageProps {
  /**
   * Laboratory pedagogical event and telemetry hook.
   * Reserved for Stage 6 Feedback Engine.
   */
  readonly onStepEvent?: (event: unknown) => void;
}

export const BooleanPage: FC<BooleanPageProps> = ({ onStepEvent }) => {
  const project = useProjectStore(selectCurrentProject);
  const applyPatch = useProjectStore((state) => state.applyPatch);
  const setModule = useUiStore((state) => state.setModule);

  // Initialize expression text from persisted project AST or canonical table
  const [expressionText, setExpressionText] = useState<string>(() => {
    if (project.expression) {
      return toString(project.expression);
    }
    return '';
  });

  const [currentAst, setCurrentAst] = useState<BoolNode | null>(
    project.expression ?? null
  );
  const [truthTable, setTruthTable] = useState<TruthTable | null>(
    project.truthTable ?? null
  );

  // Sync if project changes externally (e.g. reload or project switch)
  useEffect(() => {
    if (project.expression) {
      const formatted = toString(project.expression);
      setExpressionText(formatted);
      setCurrentAst(project.expression);
    }
    if (project.truthTable) {
      setTruthTable(project.truthTable);
    }
  }, [project.id, project.expression, project.truthTable]);

  // Handle live parsed AST update and mirror into project store
  const handleParsed = useCallback(
    (result: ParseResult): void => {
      if (result.ok) {
        setCurrentAst(result.ast);
        const ttResult = buildTruthTable(result.ast, result.variables);
        const newTable = ttResult.ok ? ttResult.table : null;
        setTruthTable(newTable);

        applyPatch({
          expression: result.ast,
          variables: result.variables,
          truthTable: newTable,
        });
      } else {
        setCurrentAst(null);
      }
    },
    [applyPatch]
  );

  // Direct truth table authored by student without expression
  const handleTableChange = useCallback(
    (newTable: TruthTable): void => {
      setTruthTable(newTable);
      applyPatch({
        truthTable: newTable,
        variables: newTable.variables,
      });
    },
    [applyPatch]
  );

  // Student applies the algebraically simplified expression
  const handleApplySimplified = useCallback(
    (simplifiedAst: BoolNode): void => {
      const formatted = toString(simplifiedAst);
      setExpressionText(formatted);
      setCurrentAst(simplifiedAst);

      const parsed = parse(formatted);
      const vars = parsed.ok ? parsed.variables : project.variables ?? [];
      const ttRes = buildTruthTable(simplifiedAst, vars);
      const newTable = ttRes.ok ? ttRes.table : null;
      setTruthTable(newTable);

      // Writes back to expression; does NOT touch minimizedExpression
      applyPatch({
        expression: simplifiedAst,
        variables: vars,
        truthTable: newTable,
      });
    },
    [applyPatch, project.variables]
  );

  const variables = project.variables ?? truthTable?.variables ?? [];
  const rowCount = truthTable?.rows.length ?? 0;

  const tabs = [
    {
      id: 'expr-table',
      label: 'Expression & Truth Table',
      content: (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <ExpressionInput
              value={expressionText}
              onChange={setExpressionText}
              onParsed={handleParsed}
              placeholder="e.g. A'B + C(D xor E)"
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">
              Truth Table & Canonical SOP/POS
            </h3>
            <TruthTableView
              table={truthTable}
              onTableChange={handleTableChange}
              editable={true}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'simplify',
      label: 'Simplify',
      content: (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <SimplificationSteps
            ast={currentAst}
            onApplySimplified={handleApplySimplified}
            onNavigateToKMap={() => setModule('kmap-solver')}
          />
        </div>
      ),
    },
    {
      id: 'equivalence',
      label: 'Equivalence',
      content: (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <EquivalencePanel initialExpression={expressionText} />
        </div>
      ),
    },
    {
      id: 'universal-gates',
      label: 'NAND / NOR',
      content: (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <UniversalGatePanel ast={currentAst} />
        </div>
      ),
    },
    {
      id: 'practice',
      label: 'Practice Simplification',
      content: (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <BooleanPractice onStepEvent={onStepEvent} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Boolean Expression Analysis
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Symbolic AST evaluation, step-by-step algebraic laws, truth tables, and universal gate synthesis.
          </p>
        </div>

        {/* Send to Next Module with Handoff Summary */}
        <div className="flex flex-col items-end gap-1">
          <SendToNextButton />
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            Carried over to K-Map: Variables ({variables.join(', ') || 'none'}) and Truth Table ({rowCount} rows).
          </span>
        </div>
      </div>

      <Tabs tabs={tabs} defaultValue="expr-table" />
    </div>
  );
};
