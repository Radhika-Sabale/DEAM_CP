/**
 * @file ExcitationTableEditor.tsx
 * Step 5 component: Flip-Flop Excitation Table Editor (Stage 10E).
 *
 * Implements real table with native select cells, ff-excitation-row validation,
 * accepted-with-note concrete value support, collapsible 9A reminder,
 * and cognitive feedback with DiagnosisCard and HintLadder.
 */

import { type FC, useState } from 'react';
import type { LogicValue } from '../../types/ast';
import type { FlipFlopType } from '../../types/sequential';
import type { SequentialDesign } from '../../engine/sequential/counterDesigner';
import { getMisconception } from '../../engine/feedback/misconceptions';
import type { StepContext } from '../../engine/feedback/types';
import type { FlipFlopValidationContext } from '../../engine/feedback/validators/flipFlopValidator';
import '../../engine/feedback/validators/flipFlopValidator';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';
import type { Diagnosis, StepSubmission } from '../../types/feedback';
import { canonicalToExcitationTable } from './sequentialDataConverters';
import { DiagnosisCard } from '../../components/feedback/DiagnosisCard';
import { HintLadder } from '../../components/feedback/HintLadder';
import type { UseSequentialSessionResult } from './useSequentialSession';
import { ExcitationTableGrid, type ExcitationCellState } from './ExcitationTableGrid';

export type { ExcitationCellState };

/** Builds the validation context for an individual excitation table cell. */
export function excitationCellContext(
  type: FlipFlopType,
  q: LogicValue,
  qNext: LogicValue,
  basePin: string
): StepContext & FlipFlopValidationContext {
  return {
    flipflop: {
      type,
      q,
      qNext,
      inputName: basePin,
    },
  };
}

interface ExcitationTableEditorFormProps {
  readonly referenceDesign: SequentialDesign;
  readonly session: UseSequentialSessionResult;
  readonly className?: string;
}

const ExcitationTableEditorForm: FC<ExcitationTableEditorFormProps> = ({
  referenceDesign,
  session,
  className = '',
}) => {
  const { updateDraft, markVerified, markAssisted } = session;
  const submitStep = useFeedbackStore((s) => s.submitStep);
  const logEvent = useLogStore((s) => s.logEvent);

  const { excitation } = referenceDesign;
  const { flipFlop, hasInput, rows, functionColumns } = excitation;

  // Cells keyed by `${rowCode}:${inVal}:${colName}`
  const [cells, setCells] = useState<Record<string, ExcitationCellState>>({});
  const [lastFailedStepKey, setLastFailedStepKey] = useState<string | null>(null);
  const [lastDiagnosis, setLastDiagnosis] = useState<Diagnosis | null>(null);
  const [tableStatus, setTableStatus] = useState<string | null>(null);

  const handleCellChange = (key: string, value: string) => {
    const updated = { ...cells, [key]: { value } };
    setCells(updated);
    updateDraft('excitation', updated);
  };

  const handleCheck = () => {
    let allCorrect = true;
    const nextCells: Record<string, ExcitationCellState> = { ...cells };
    let firstFailKey: string | null = null;
    let firstFailDiag: Diagnosis | null = null;

    for (const row of rows) {
      if (!row.valid) continue;
      const inVal = hasInput ? (row.inputValue ?? 0) : 0;

      for (const trans of row.transitions) {
        const bit = trans.bitIndex;
        const q = trans.q;
        const qNext = trans.qNext;

        // Base pin names for the flip-flop
        const basePins = flipFlop === 'JK' ? ['J', 'K']
          : flipFlop === 'SR' ? ['S', 'R']
          : flipFlop === 'D' ? ['D']
          : ['T'];

        for (const basePin of basePins) {
          const colName = `${basePin}${bit}`;
          const cellKey = `${row.code}:${inVal}:${colName}`;
          const studentStr = cells[cellKey]?.value ?? '';
          const studentVal: LogicValue = studentStr === '1' ? 1 : studentStr === '0' ? 0 : studentStr === 'X' ? 'X' : 'X';
          const expectedVal = trans.inputs[colName] ?? 'X';

          const stepKey = 'ff-excitation-row';
          const submission: StepSubmission = {
            moduleId: 'sequential-designer',
            stepId: stepKey,
            studentAnswer: {
              kind: 'excitation-entry',
              flipFlop,
              presentState: String(q),
              nextState: String(qNext),
              inputValues: { [basePin]: studentVal },
            },
            timestamp: new Date().toISOString(),
          };

          const ctx = excitationCellContext(flipFlop, q, qNext, basePin);
          const res = submitStep(submission, ctx as unknown as StepContext);

          if (res.ok) {
            const isAcceptedWithNote = expectedVal === 'X' && (studentVal === 0 || studentVal === 1);
            nextCells[cellKey] = {
              value: studentStr,
              isCorrect: true,
              isAcceptedWithNote,
            };
          } else {
            allCorrect = false;
            const diag = res.diagnoses[0];
            let errorMsg = diag?.hint ?? 'Incorrect excitation value';
            if (diag?.misconceptionTag === 'confused-q-and-qnext') {
              const entry = getMisconception('confused-q-and-qnext');
              errorMsg = entry.title;
            } else if (diag?.misconceptionTag === 'wrong-excitation-table') {
              const entry = getMisconception('wrong-excitation-table');
              errorMsg = entry.title;
            }
            nextCells[cellKey] = { value: studentStr, isCorrect: false, errorMsg };

            // Prioritize diagnosing filled cells with misconceptions
            if (studentStr !== '') {
              if (!firstFailDiag || diag?.misconceptionTag === 'confused-q-and-qnext') {
                firstFailKey = 'ff-excitation-row';
                firstFailDiag = diag ?? null;
              }
            } else if (!firstFailKey) {
              firstFailKey = 'ff-excitation-row';
              firstFailDiag = diag ?? null;
            }
          }
        }
      }
    }

    setCells(nextCells);
    setLastFailedStepKey(firstFailKey);
    setLastDiagnosis(firstFailDiag);

    if (allCorrect) {
      setTableStatus('Verified: All excitation inputs verified.');
      markVerified('excitation', nextCells, { excitationTable: canonicalToExcitationTable(excitation) });
    } else {
      setTableStatus('Incomplete or errors found in excitation table.');
    }
  };

  const handleShowMe = () => {
    const filled: Record<string, ExcitationCellState> = {};
    for (const row of rows) {
      if (!row.valid) continue;
      const inVal = hasInput ? (row.inputValue ?? 0) : 0;
      for (const col of functionColumns) {
        const val = row.flipFlopInputs[col.name];
        if (val !== undefined) {
          const key = `${row.code}:${inVal}:${col.name}`;
          filled[key] = { value: String(val), isCorrect: true };
        }
      }
    }

    setCells(filled);
    updateDraft('excitation', filled);
    logEvent({
      eventType: 'hint-used',
      moduleId: 'sequential-designer',
      stepId: 'excitation',
      level: 3,
    });
    setTableStatus('Assisted: Correct excitation table entries loaded.');
    markAssisted('excitation', filled, { excitationTable: canonicalToExcitationTable(excitation) });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Flip-Flop Excitation Table
        </h4>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Determine the required excitation inputs (0, 1, X) for each flip-flop to achieve each state transition.
        </p>
      </div>

      <ExcitationTableGrid
        table={excitation}
        cells={cells}
        onCellChange={handleCellChange}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCheck}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Check Excitation Table
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

      {lastDiagnosis && lastFailedStepKey && (
        <div className="space-y-4">
          <DiagnosisCard diagnosis={lastDiagnosis} />
          <HintLadder stepKey={lastFailedStepKey} />
        </div>
      )}
    </div>
  );
};

export interface ExcitationTableEditorProps {
  readonly session: UseSequentialSessionResult;
  readonly className?: string;
}

export const ExcitationTableEditor: FC<ExcitationTableEditorProps> = ({ session, className = '' }) => {
  if (!session.referenceDesign) {
    return <div className="p-4 text-xs text-gray-500">Define a valid sequential specification first.</div>;
  }
  return <ExcitationTableEditorForm referenceDesign={session.referenceDesign} session={session} className={className} />;
};
