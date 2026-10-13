/**
 * @file LockoutCheck.tsx
 * Step 7 component: Lockout & Deadlock Verification and Remediation (Stage 10E).
 *
 * Implements unused state transition table, plain-language summary,
 * student lockout claims checked by seq-lockout-claim, proposal panel with
 * minimal-cost and all-to-initial strategies, confirmation before applying fix,
 * and keep-as-is fallback with warning.
 */

import { type FC, useEffect, useMemo, useState } from 'react';
import type { SequentialDesign } from '../../engine/sequential/counterDesigner';
import { designSequential } from '../../engine/sequential/counterDesigner';
import { analyzeLockout, type LockoutReport } from '../../engine/sequential/lockout';
import { formatCode } from '../../engine/sequential/encoding';
import type { StepContext } from '../../engine/feedback/types';
import '../../engine/feedback/validators/sequentialValidator';
import { useFeedbackStore } from '../../store/feedbackStore';
import type { Diagnosis, StepSubmission, StudentAnswer } from '../../types/feedback';
import { DiagnosisCard } from '../../components/feedback/DiagnosisCard';
import { HintLadder } from '../../components/feedback/HintLadder';
import type { UseSequentialSessionResult } from './useSequentialSession';
import { LockoutFixPanel } from './LockoutFixPanel';
import { LockoutTransitionTable } from './LockoutTransitionTable';

export interface LockoutDraft {
  readonly claimedStates: readonly number[];
  readonly appliedRedirects?: Record<number, number>;
  readonly keptAsIs?: boolean;
}

interface LockoutCheckFormProps {
  readonly referenceDesign: SequentialDesign;
  readonly session: UseSequentialSessionResult;
  readonly className?: string;
}

const LockoutCheckForm: FC<LockoutCheckFormProps> = ({
  referenceDesign,
  session,
  className = '',
}) => {
  const { updateDraft, markVerified } = session;
  const submitStep = useFeedbackStore((s) => s.submitStep);

  const initialDraft = (session.state.steps.lockout.draft as LockoutDraft | null) ?? {
    claimedStates: [],
  };

  const [claimedStates, setClaimedStates] = useState<number[]>([...initialDraft.claimedStates]);
  const [appliedRedirects, setAppliedRedirects] = useState<Record<number, number> | undefined>(
    initialDraft.appliedRedirects
  );
  const [keptAsIs, setKeptAsIs] = useState<boolean>(!!initialDraft.keptAsIs);

  const [lastDiagnosis, setLastDiagnosis] = useState<Diagnosis | null>(null);
  const [claimVerified, setClaimVerified] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Active design: baseline or re-derived if redirects applied
  const activeDesign = useMemo(() => {
    if (!appliedRedirects || Object.keys(appliedRedirects).length === 0) {
      return referenceDesign;
    }
    const fixedRes = designSequential(referenceDesign.spec, { unusedRedirects: appliedRedirects });
    return fixedRes.ok ? fixedRes.design : referenceDesign;
  }, [referenceDesign, appliedRedirects]);

  const { table, equations } = activeDesign;
  const flipFlop = activeDesign.spec.flipFlop;
  const stateBits = table.stateBits;

  // Run lockout analysis on active design
  const lockoutReport: LockoutReport = useMemo(() => {
    return analyzeLockout({ table, equations, flipFlop });
  }, [table, equations, flipFlop]);

  const { unusedStates, isSelfCorrecting, lockedStates, indeterminateStates, maxStepsToValid } = lockoutReport;

  // Plain-language summary sentence
  const summaryText = useMemo(() => {
    if (unusedStates.length === 0) {
      return 'No unused states exist; all 2^N states are part of the normal operation sequence.';
    }
    if (isSelfCorrecting) {
      return `No lockout: every unused state returns to a valid state within ${maxStepsToValid ?? 1} clock pulses.`;
    }
    const problematic = [...lockedStates, ...indeterminateStates]
      .sort((a, b) => a - b)
      .map((c) => formatCode(c, stateBits));
    return `States ${problematic.join(', ')} can lock out.`;
  }, [unusedStates.length, isSelfCorrecting, maxStepsToValid, lockedStates, indeterminateStates, stateBits]);

  // When no unused states exist in the counter design, lockout is impossible; auto-verify step
  useEffect(() => {
    if (unusedStates.length === 0 && session.state.steps.lockout.status !== 'verified') {
      markVerified('lockout', { claimedStates: [] });
    }
  }, [unusedStates.length, session.state.steps.lockout.status, markVerified]);

  const toggleClaimedState = (code: number) => {
    const next = claimedStates.includes(code)
      ? claimedStates.filter((c) => c !== code)
      : [...claimedStates, code].sort((a, b) => a - b);
    setClaimedStates(next);
    updateDraft('lockout', {
      claimedStates: next,
      appliedRedirects,
      keptAsIs,
    });
  };

  const handleCheckClaim = () => {
    const submission: StepSubmission = {
      moduleId: 'sequential-designer',
      stepId: 'seq-lockout-claim',
      studentAnswer: {
        kind: 'seq-lockout-claim',
        claimedStates,
        lockedStates: claimedStates,
      } as unknown as StudentAnswer,
      timestamp: new Date().toISOString(),
    };

    const ctx = {
      sequential: {
        spec: session.state.spec ?? undefined,
        unusedRedirects: appliedRedirects,
      },
    };

    const res = submitStep(submission, ctx as unknown as StepContext);
    if (res.ok) {
      setClaimVerified(true);
      setLastDiagnosis(null);

      if (isSelfCorrecting || keptAsIs || (appliedRedirects && Object.keys(appliedRedirects).length > 0)) {
        setStatusMessage('Verified: Lockout claim correct and resolution confirmed.');
        markVerified('lockout', { claimedStates, appliedRedirects, keptAsIs });
      } else {
        setStatusMessage('Lockout claim correct! Apply a fix or choose "Keep as is" to complete verification.');
      }
    } else {
      setClaimVerified(false);
      const diag = res.diagnoses[0];
      setLastDiagnosis(diag ?? null);
      setStatusMessage(diag?.fullExplanation ?? diag?.hint ?? 'Incorrect lockout claim.');
    }
  };

  const handleApplyFix = (redirects: Record<number, number>) => {
    setAppliedRedirects(redirects);
    setKeptAsIs(false);
    const newDraft: LockoutDraft = { claimedStates, appliedRedirects: redirects, keptAsIs: false };
    updateDraft('lockout', newDraft);
    setStatusMessage('Verified: Lockout remediation completed successfully.');
    markVerified('lockout', newDraft);
  };

  const handleKeepAsIs = () => {
    setKeptAsIs(true);
    const newDraft: LockoutDraft = { claimedStates, appliedRedirects, keptAsIs: true };
    updateDraft('lockout', newDraft);

    if (claimVerified) {
      setStatusMessage('Verified: Kept as is with warning.');
      markVerified('lockout', newDraft);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header and Plain Language Summary */}
      <div>
        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Unused State Lockout Analysis
        </h4>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Verify whether power-on glitches or noise can trap the sequential circuit in unhandled states.
        </p>
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs font-semibold text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
          {summaryText}
        </div>
      </div>

      {/* Unused States Transition Table */}
      <LockoutTransitionTable unusedStates={unusedStates} stateBits={stateBits} />

      {/* Student Lockout Claim Checkbox Group */}
      {unusedStates.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <h5 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Student Lockout Claim:
          </h5>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Select which unused state codes you claim can lock out or produce indeterminate transitions:
          </p>

          <div className="mt-3 flex flex-wrap gap-4">
            {unusedStates.map((u) => (
              <label key={u.code} className="inline-flex items-center gap-2 text-xs font-mono text-gray-800 dark:text-gray-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={claimedStates.includes(u.code)}
                  onChange={() => toggleClaimedState(u.code)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
                />
                <span>S{u.code} ({u.binaryCode})</span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleCheckClaim}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Check Lockout Claim
            </button>
            {claimVerified && (
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Claim correct!
              </span>
            )}
          </div>
        </div>
      )}

      {/* Diagnosis & HintLadder if wrong claim */}
      {lastDiagnosis && (
        <div className="space-y-4">
          <DiagnosisCard diagnosis={lastDiagnosis} />
          <HintLadder stepKey="seq-lockout-claim" />
        </div>
      )}

      {/* Fix Proposal Panel */}
      {(!isSelfCorrecting || appliedRedirects) && (
        <LockoutFixPanel
          spec={referenceDesign.spec}
          stateBits={stateBits}
          onApplyFix={handleApplyFix}
          onKeepAsIs={handleKeepAsIs}
          isKeptAsIs={keptAsIs}
          isFixApplied={!!appliedRedirects && Object.keys(appliedRedirects).length > 0}
        />
      )}

      {/* Overall Status Line */}
      {statusMessage && (
        <div role="status" aria-live="polite" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {statusMessage}
        </div>
      )}
    </div>
  );
};

export interface LockoutCheckProps {
  readonly session: UseSequentialSessionResult;
  readonly className?: string;
}

export const LockoutCheck: FC<LockoutCheckProps> = ({ session, className = '' }) => {
  if (!session.referenceDesign) {
    return <div className="p-4 text-xs text-gray-500">Define a valid sequential specification first.</div>;
  }
  return <LockoutCheckForm referenceDesign={session.referenceDesign} session={session} className={className} />;
};
