/**
 * @file StateDiagramEditor.tsx
 * Step 3 component: Accessible Tabular State Diagram Editor (Stage 10D).
 *
 * Justification: Editing is table-based because tabular transition specification
 * guarantees 100% formal state coverage, complete keyboard navigation, and full
 * screen-reader accessibility that graphical drag-and-drop canvases cannot provide.
 */

import { type FC, useMemo, useState } from 'react';
import type { SequentialDesign } from '../../engine/sequential/counterDesigner';
import { formatCode, inputVariableNames } from '../../engine/sequential/encoding';
import { validateDiagram } from '../../engine/sequential/stateDiagram';
import { verifyDiagram } from '../../engine/sequential/verifyStepTable';
import type { LogicValue } from '../../types/ast';
import { stateDiagramDataToDiagram } from './sequentialDataConverters';
import type { UseSequentialSessionResult } from './useSequentialSession';
import { StateDiagramView } from './StateDiagramView';
import {
  StateDiagramTransitionTable,
  buildDraftDiagram,
  type TransitionDraftEntry,
} from './StateDiagramTransitionTable';

export type { TransitionDraftEntry };
export { buildDraftDiagram };

interface SyncDiagramEditorFormProps {
  readonly referenceDesign: SequentialDesign;
  readonly session: UseSequentialSessionResult;
  readonly className?: string;
}

const SyncDiagramEditorForm: FC<SyncDiagramEditorFormProps> = ({
  referenceDesign,
  session,
  className = '',
}) => {
  const { state, updateDraft, markVerified } = session;
  const { table, stateNames } = referenceDesign;
  const { validCodes, stateBits, hasInput, machineKind, inputKind, initialStateCode } = table;
  const inVarName = inputVariableNames(inputKind)[0] ?? 'IN';
  const inputs: readonly number[] = hasInput ? [0, 1] : [0];

  // Component-local draft state
  const rawDraft = (state.steps.diagram.draft as Record<string, TransitionDraftEntry>) ?? {};
  const [draft, setDraft] = useState<Record<string, TransitionDraftEntry>>(() => {
    const initial: Record<string, TransitionDraftEntry> = {};
    for (const code of validCodes) {
      for (const inVal of inputs) {
        const key = `${code}:${inVal}`;
        initial[key] = rawDraft[key] ?? { nextCode: null, mealyOutput: 0 };
      }
    }
    return initial;
  });

  const [rowResults, setRowResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [generalIssues, setGeneralIssues] = useState<readonly string[]>([]);

  // Build live diagram from draft
  const draftDiagram = useMemo(
    () => buildDraftDiagram(validCodes, stateBits, initialStateCode, machineKind, stateNames, draft),
    [validCodes, stateBits, initialStateCode, machineKind, stateNames, draft]
  );

  // Unused state codes
  const totalCapacity = 1 << stateBits;
  const validSet = new Set(validCodes);
  const unusedCodes: number[] = [];
  for (let c = 0; c < totalCapacity; c++) {
    if (!validSet.has(c)) unusedCodes.push(c);
  }

  const handleCellChange = (key: string, nextCode: number | null, mealyOutput?: LogicValue) => {
    const updated = {
      ...draft,
      [key]: {
        nextCode,
        mealyOutput: mealyOutput !== undefined ? mealyOutput : (draft[key]?.mealyOutput ?? 0),
      },
    };
    setDraft(updated);
    updateDraft('diagram', updated);
  };

  const handleCheck = () => {
    const issues = validateDiagram(draftDiagram);
    const vRes = verifyDiagram(draftDiagram, table);
    const errMsgs = [
      ...issues.map((i) => i.message),
      ...(!vRes.summary.allCorrect
        ? vRes.items
            .filter((it) => it.status === 'incorrect' || it.status === 'missing')
            .map((it) => it.message ?? `Transition ${it.id} is ${it.status}`)
        : []),
    ];
    setGeneralIssues(errMsgs);

    const nextRowRes: Record<string, { ok: boolean; msg: string }> = {};

    for (const code of validCodes) {
      for (const inVal of inputs) {
        const key = `${code}:${inVal}`;
        const refRow = table.rows.find(
          (r) => r.code === code && (!hasInput || r.inputValue === inVal)
        );
        const entry = draft[key];
        const isNextCorrect =
          refRow !== undefined &&
          entry !== undefined &&
          entry.nextCode !== null &&
          entry.nextCode === refRow.nextCode;
        const isMealyCorrect =
          !hasInput ||
          machineKind !== 'mealy' ||
          (entry !== undefined && refRow !== undefined && entry.mealyOutput === refRow.mealyOutput);

        if (isNextCorrect && isMealyCorrect) {
          nextRowRes[key] = { ok: true, msg: 'Correct' };
        } else {
          const exp = refRow?.nextCode !== undefined ? `S${refRow.nextCode}` : '?';
          const got = entry?.nextCode !== null && entry?.nextCode !== undefined ? `S${entry.nextCode}` : 'none';
          nextRowRes[key] = {
            ok: false,
            msg: `Expected ${exp}, got ${got}`,
          };
        }
      }
    }
    setRowResults(nextRowRes);

    const allRowsCorrect = Object.values(nextRowRes).every((r) => r.ok);
    if (allRowsCorrect && errMsgs.length === 0) {
      markVerified('diagram', draft, { stateDiagram: stateDiagramDataToDiagram(draftDiagram) });
    }
  };

  const handleShowMe = () => {
    const solved: Record<string, TransitionDraftEntry> = {};
    for (const row of table.rows) {
      if (row.valid && typeof row.nextCode === 'number') {
        const inVal = hasInput ? (row.inputValue ?? 0) : 0;
        const key = `${row.code}:${inVal}`;
        solved[key] = { nextCode: row.nextCode, mealyOutput: row.mealyOutput === 1 ? 1 : 0 };
      }
    }
    setDraft(solved);
    updateDraft('diagram', solved);
    const solvedDiag = buildDraftDiagram(validCodes, stateBits, initialStateCode, machineKind, stateNames, solved);
    markVerified('diagram', solved, { stateDiagram: stateDiagramDataToDiagram(solvedDiag) });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Design Rationale Callout */}
      <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300">
        <p className="font-semibold text-gray-900 dark:text-gray-100">Why table-based transition editing?</p>
        <p className="mt-0.5">
          Editing is table-based because tabular transition specification guarantees 100% formal state coverage, complete keyboard navigation, and full screen-reader accessibility that graphical drag-and-drop canvases cannot provide.
        </p>
      </div>

      {/* Grid: Left Transitions Table, Right Live SVG View */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Accessible Transitions Specification Table */}
        <div className="space-y-4">
          <StateDiagramTransitionTable
            validCodes={validCodes}
            stateNames={stateNames}
            stateBits={stateBits}
            hasInput={hasInput}
            inVarName={inVarName}
            inputs={inputs}
            machineKind={machineKind}
            draft={draft}
            rowResults={rowResults}
            onCellChange={handleCellChange}
          />

          {/* Unused states list */}
          {unusedCodes.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gray-800 dark:bg-gray-900">
              <h5 className="text-[11px] font-bold text-gray-600 dark:text-gray-400">Unused States ({unusedCodes.length})</h5>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                Codes: {unusedCodes.map((c) => `S${c} (${formatCode(c, stateBits)})`).join(', ')} —{' '}
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  unused: treated as don't-care in the next step
                </span>.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCheck}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Check Diagram
            </button>
            <button
              type="button"
              onClick={handleShowMe}
              className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 shadow-2xs hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/60"
            >
              Show me
            </button>
          </div>

          {/* General Issues Display */}
          {generalIssues.length > 0 && (
            <div role="alert" aria-live="assertive" className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              <p className="font-bold">Diagram Incompleteness:</p>
              <ul className="mt-1 list-disc pl-5">
                {generalIssues.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Live SVG Diagram View */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Live Diagram Preview
          </h4>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Updates in real time from your transition selections.
          </p>
          <StateDiagramView diagram={draftDiagram} className="mt-3" />
        </div>
      </div>
    </div>
  );
};

export interface StateDiagramEditorProps {
  readonly session: UseSequentialSessionResult;
  readonly className?: string;
}

export const StateDiagramEditor: FC<StateDiagramEditorProps> = ({ session, className = '' }) => {
  const { referenceDesign, asyncDesign, state } = session;

  if (asyncDesign || (state.spec?.kind === 'counter' && state.spec.style === 'async')) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-blue-200 bg-blue-50/70 p-6 text-blue-900 shadow-xs dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
      >
        <h3 className="text-base font-bold">Asynchronous Ripple Counter Design</h3>
        <p className="mt-2 text-xs leading-relaxed">
          Asynchronous ripple counters follow a fixed binary ripple pattern; see the design on the next step.
        </p>
      </div>
    );
  }

  if (!referenceDesign) {
    return <div className="p-4 text-xs text-gray-500">Define a valid synchronous machine specification first.</div>;
  }

  return <SyncDiagramEditorForm referenceDesign={referenceDesign} session={session} className={className} />;
};
