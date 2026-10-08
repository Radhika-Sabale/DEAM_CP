/**
 * @file StateTableEditor.tsx
 * Step 4 component: State Transition Table Editor with per-cell validation (Stage 10D).
 *
 * Implements real <table> elements, tab navigation without arrow focus traps,
 * full accessible names including row and column per cell, confused-q-and-qnext
 * catalog title diagnosis, Show me auto-complete, and unused state don't-care rows.
 */

import { type FC, useState } from 'react';
import type { SequentialDesign } from '../../engine/sequential/counterDesigner';
import { inputVariableNames } from '../../engine/sequential/encoding';
import { getMisconception } from '../../engine/feedback/misconceptions';
import '../../engine/feedback/validators/sequentialValidator';
import type { StepContext } from '../../engine/feedback/types';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';
import type { Diagnosis, StepSubmission } from '../../types/feedback';
import { canonicalToStateTable } from './sequentialDataConverters';
import { DiagnosisCard } from '../../components/feedback/DiagnosisCard';
import { HintLadder } from '../../components/feedback/HintLadder';
import type { UseSequentialSessionResult } from './useSequentialSession';
import { StateTableGrid, type CellState } from './StateTableGrid';

export type { CellState };

interface StateTableEditorFormProps {
  readonly referenceDesign: SequentialDesign;
  readonly session: UseSequentialSessionResult;
  readonly className?: string;
}

const StateTableEditorForm: FC<StateTableEditorFormProps> = ({
  referenceDesign,
  session,
  className = '',
}) => {
  const { updateDraft, markVerified, markAssisted } = session;
  const submitStep = useFeedbackStore((s) => s.submitStep);
  const logEvent = useLogStore((s) => s.logEvent);

  const { table, stateNames } = referenceDesign;
  const { validCodes, stateBits, hasInput, machineKind, inputKind } = table;
  const inVarName = inputVariableNames(inputKind)[0] ?? (inputKind === 'counter-up-down' ? 'DN' : 'IN');
  const hasOutput = machineKind === 'mealy' || machineKind === 'moore';
  const totalCodes = 1 << stateBits;
  const validSet = new Set(validCodes);

  // Unused state codes
  const unusedCodes: number[] = [];
  for (let c = 0; c < totalCodes; c++) {
    if (!validSet.has(c)) unusedCodes.push(c);
  }

  // Cell states: keyed by `${code}:${inVal}:next` or `${code}:${inVal}:output`
  const [cells, setCells] = useState<Record<string, CellState>>({});
  const [lastFailedStepKey, setLastFailedStepKey] = useState<string | null>(null);
  const [lastDiagnosis, setLastDiagnosis] = useState<Diagnosis | null>(null);
  const [tableStatus, setTableStatus] = useState<string | null>(null);

  const handleCellChange = (key: string, value: string) => {
    const updated = { ...cells, [key]: { value } };
    setCells(updated);
    updateDraft('table', updated);
  };

  const handleCheck = () => {
    let allCorrect = true;
    const nextCells: Record<string, CellState> = { ...cells };
    let firstFailKey: string | null = null;
    let firstFailDiag: Diagnosis | null = null;

    for (const row of table.rows) {
      if (!row.valid) continue;
      const inVal = hasInput ? (row.inputValue ?? 0) : 0;
      const nextKey = `${row.code}:${inVal}:next`;
      const studentNext = cells[nextKey]?.value ?? '';

      // Validate next state cell via evaluateStep / feedbackStore
      const stepKey = `seq-state-table-${row.code}-${inVal}-next`;
      const submission: StepSubmission = {
        moduleId: 'sequential-designer',
        stepId: stepKey,
        studentAnswer: {
          kind: 'seq-state-table-cell' as unknown as 'state-table-row',
          presentState: String(row.code),
          nextState: studentNext,
        },
        timestamp: new Date().toISOString(),
      };

      const context = {
        sequential: {
          spec: session.state.spec ?? undefined,
          code: row.code,
          input: inVal,
          field: 'next' as const,
        },
      };

      const res = submitStep(submission, context as unknown as StepContext);
      if (res.ok) {
        nextCells[nextKey] = { value: studentNext, isCorrect: true };
      } else {
        allCorrect = false;
        const diag = res.diagnoses[0];
        let errorMsg = diag?.hint ?? 'Incorrect next state';
        if (diag?.misconceptionTag === 'confused-q-and-qnext') {
          const entry = getMisconception('confused-q-and-qnext');
          errorMsg = entry.title;
        }
        nextCells[nextKey] = { value: studentNext, isCorrect: false, errorMsg };
        if (!firstFailKey) {
          firstFailKey = stepKey;
          firstFailDiag = diag ?? null;
        }
      }

      // Output check if Mealy
      if (machineKind === 'mealy') {
        const outKey = `${row.code}:${inVal}:output`;
        const studentOut = cells[outKey]?.value ?? '';
        const outStepKey = `seq-state-table-${row.code}-${inVal}-output`;
        const outSub: StepSubmission = {
          moduleId: 'sequential-designer',
          stepId: outStepKey,
          studentAnswer: {
            kind: 'seq-state-table-cell' as unknown as 'state-table-row',
            presentState: String(row.code),
            nextState: studentNext,
            output: studentOut,
          },
          timestamp: new Date().toISOString(),
        };
        const outRes = submitStep(outSub, {
          sequential: {
            spec: session.state.spec ?? undefined,
            code: row.code,
            input: inVal,
            field: 'output' as const,
          },
        } as unknown as StepContext);
        if (outRes.ok) {
          nextCells[outKey] = { value: studentOut, isCorrect: true };
        } else {
          allCorrect = false;
          nextCells[outKey] = {
            value: studentOut,
            isCorrect: false,
            errorMsg: outRes.diagnoses[0]?.hint ?? 'Incorrect output',
          };
          if (!firstFailKey) {
            firstFailKey = outStepKey;
            firstFailDiag = outRes.diagnoses[0] ?? null;
          }
        }
      }
    }

    setCells(nextCells);
    setLastFailedStepKey(firstFailKey);
    setLastDiagnosis(firstFailDiag);

    if (allCorrect) {
      setTableStatus('Verified: All transitions and outputs verified.');
      markVerified('table', nextCells, { stateTable: canonicalToStateTable(table) });
    } else {
      setTableStatus('Incomplete or errors found in state table transitions.');
    }
  };

  const handleShowMe = () => {
    const filled: Record<string, CellState> = {};
    for (const row of table.rows) {
      if (!row.valid) continue;
      const inVal = hasInput ? (row.inputValue ?? 0) : 0;
      const nextKey = `${row.code}:${inVal}:next`;
      filled[nextKey] = { value: String(row.nextCode), isCorrect: true };
      if (machineKind === 'mealy') {
        const outKey = `${row.code}:${inVal}:output`;
        filled[outKey] = { value: String(row.mealyOutput), isCorrect: true };
      }
    }

    setCells(filled);
    updateDraft('table', filled);
    logEvent({
      eventType: 'hint-used',
      moduleId: 'sequential-designer',
      stepId: 'table',
      level: 3,
    });
    setTableStatus('Assisted: Correct state table entries loaded.');
    markAssisted('table', filled, { stateTable: canonicalToStateTable(table) });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* State Table Header and Description */}
      <div>
        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          State Transition Table
        </h4>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Determine the resulting next state and output for each present state and input condition.
        </p>
      </div>

      {/* Main Table Container */}
      <StateTableGrid
        table={table}
        validCodes={validCodes}
        unusedCodes={unusedCodes}
        stateNames={stateNames}
        stateBits={stateBits}
        hasInput={hasInput}
        inVarName={inVarName}
        hasOutput={hasOutput}
        machineKind={machineKind}
        cells={cells}
        onCellChange={handleCellChange}
      />

      {/* Action Buttons & Status Line */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCheck}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Check State Table
          </button>
          <button
            type="button"
            onClick={handleShowMe}
            className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 shadow-2xs hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/60"
          >
            Show me
          </button>
        </div>

        {tableStatus && (
          <span role="status" aria-live="polite" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {tableStatus}
          </span>
        )}
      </div>

      {/* Cognitive Diagnosis Card & Hint Ladder for Last Wrong Cell */}
      {lastDiagnosis && lastFailedStepKey && (
        <div className="space-y-4">
          <DiagnosisCard diagnosis={lastDiagnosis} />
          <HintLadder stepKey={lastFailedStepKey} />
        </div>
      )}
    </div>
  );
};

export interface StateTableEditorProps {
  readonly session: UseSequentialSessionResult;
  readonly className?: string;
}

export const StateTableEditor: FC<StateTableEditorProps> = ({ session, className = '' }) => {
  if (!session.referenceDesign) {
    return <div className="p-4 text-xs text-gray-500">Define a valid sequential specification first.</div>;
  }
  return <StateTableEditorForm referenceDesign={session.referenceDesign} session={session} className={className} />;
};
