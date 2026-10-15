/**
 * @file InterruptPractice.tsx
 * Interactive practice workbench for 8086 interrupt behavior prediction.
 *
 * Students predict IVT address resolution, stack frame ordering, IF/TF flag clearing,
 * hardware priority arbitration, and single-step trap timing.
 * Evaluated by deterministic validators with progressive hints, answer-trap detection,
 * and study test gating.
 */

import { type FC, useMemo, useState } from 'react';
import type { InterruptSession } from './useInterruptSession';
import { StepChecker } from '../../components/feedback/StepChecker';
import { AnswerTrapBanner } from '../../components/feedback/AnswerTrapBanner';
import '../../engine/feedback/validators/interrupts';
import type {
  AnswerTrapFlag,
  IntFlagsAnswer,
  IntFlagsReasoningOption,
  IntFrameAnswer,
  IntFrameReasoningOption,
  IntPriorityAnswer,
  IntPriorityReasoningOption,
  IntTrapTimingAnswer,
  IntTrapTimingReasoningOption,
  IntVectorAnswer,
  IntVectorReasoningOption,
  StepSubmission,
} from '../../types/feedback';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useStudyStore } from '../../store/studyStore';
import { useLogStore } from '../../store/logStore';
import { Button } from '../../components/ui/Button';

export interface InterruptPracticeProps {
  readonly session: InterruptSession;
  readonly className?: string;
}

type InterruptPracticeKind =
  | 'int-vector'
  | 'int-frame'
  | 'int-flags'
  | 'int-priority'
  | 'int-trap-timing';

export const InterruptPractice: FC<InterruptPracticeProps> = ({
  session,
  className = '',
}) => {
  const [kind, setKind] = useState<InterruptPracticeKind>('int-vector');

  // Vector prediction state
  const [vectorNum, setVectorNum] = useState<string>('32'); // 0x20
  const [vectorAddr, setVectorAddr] = useState<string>('0x0080');
  const [vectorHandlerIp, setVectorHandlerIp] = useState<string>('0x0100');
  const [vectorReason, setVectorReason] = useState<IntVectorReasoningOption>('vector-times-four');

  // Frame prediction state
  const [frameTop, setFrameTop] = useState<string>('return-ip');
  const [frameMiddle, setFrameMiddle] = useState<string>('return-cs');
  const [frameBottom, setFrameBottom] = useState<string>('flags');
  const [frameSize, setFrameSize] = useState<string>('6');
  const [frameReason, setFrameReason] = useState<IntFrameReasoningOption>('flags-cs-ip-pushed-downward');

  // Flags prediction state
  const [flagsContext, setFlagsContext] = useState<'after-entry' | 'after-iret'>('after-entry');
  const [entryIf, setEntryIf] = useState<0 | 1>(0);
  const [entryTf, setEntryTf] = useState<0 | 1>(0);
  const [afterIretIf, setAfterIretIf] = useState<0 | 1>(1);
  const [afterIretTf, setAfterIretTf] = useState<0 | 1>(0);
  const [flagsReason, setFlagsReason] = useState<IntFlagsReasoningOption>('hardware-clears-if-tf');

  // Priority prediction state
  const [priorityWinner, setPriorityWinner] = useState<'single-step' | 'nmi' | 'intr'>('nmi');
  const [priorityReason, setPriorityReason] = useState<IntPriorityReasoningOption>('nmi-higher-than-intr');

  // Trap timing state
  const [firesNextInstr, setFiresNextInstr] = useState<boolean>(true);
  const [stepsInHandler, setStepsInHandler] = useState<boolean>(false);
  const [trapReason, setTrapReason] = useState<IntTrapTimingReasoningOption>('trap-after-next-instruction');

  // Trap detection & test gating
  const [trapFlag, setTrapFlag] = useState<AnswerTrapFlag | null>(null);
  const [predictionHistory, setPredictionHistory] = useState<boolean[]>([]);
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);

  const pretestUnlocked = useStudyStore((s) => s.pretestUnlocked);
  const posttestUnlocked = useStudyStore((s) => s.posttestUnlocked);
  const isTestInProgress = pretestUnlocked || posttestUnlocked;

  const stepKey = `int-practice-${kind}-${session.cpuState?.ticks ?? 0}`;

  const currentInstr = useMemo(() => {
    if (!session.program || !session.cpuState) return null;
    const ip = session.cpuState.registers.IP;
    return session.program.instructions[ip] ?? null;
  }, [session.program, session.cpuState]);

  const buildSubmission = (): StepSubmission => {
    setRevealedAnswer(null);

    if (kind === 'int-vector') {
      const v = parseInt(vectorNum, 10) || 0;
      const addr = vectorAddr.startsWith('0x') || vectorAddr.startsWith('0X')
        ? parseInt(vectorAddr.slice(2), 16)
        : parseInt(vectorAddr, 10) || 0;
      const handler = vectorHandlerIp.startsWith('0x') || vectorHandlerIp.startsWith('0X')
        ? parseInt(vectorHandlerIp.slice(2), 16)
        : parseInt(vectorHandlerIp, 10) || 0;

      const ans: IntVectorAnswer = {
        kind: 'int-vector',
        vector: v,
        vectorAddress: addr,
        handlerIp: handler,
        installed: true,
        reasoning: vectorReason,
      };
      return {
        moduleId: 'interrupt-controller',
        stepId: stepKey,
        studentAnswer: ans,
        timestamp: new Date().toISOString(),
      };
    }

    if (kind === 'int-frame') {
      const initialSp = session.cpuState?.registers.SP ?? 0xfffe;
      const parsedSize = parseInt(frameSize, 10) || 6;
      const computedSp = initialSp - parsedSize;

      const getWordValue = (val: string): number => {
        if (val === 'return-ip') return session.cpuState?.registers.IP ?? 0x0100;
        if (val === 'return-cs') return session.lastInterruptRecord?.returnCs ?? 0x0000;
        return 0x0202; // flags
      };

      const ans: IntFrameAnswer = {
        kind: 'int-frame',
        phase: 'entry',
        sp: computedSp,
        words: [getWordValue(frameTop), getWordValue(frameMiddle), getWordValue(frameBottom)],
        reasoning: frameReason,
      };
      return {
        moduleId: 'interrupt-controller',
        stepId: stepKey,
        studentAnswer: ans,
        timestamp: new Date().toISOString(),
      };
    }

    if (kind === 'int-flags') {
      const ans: IntFlagsAnswer = {
        kind: 'int-flags',
        context: flagsContext,
        ifValue: flagsContext === 'after-entry' ? entryIf : afterIretIf,
        tfValue: flagsContext === 'after-entry' ? entryTf : afterIretTf,
        reasoning: flagsReason,
      };
      return {
        moduleId: 'interrupt-controller',
        stepId: stepKey,
        studentAnswer: ans,
        timestamp: new Date().toISOString(),
      };
    }

    if (kind === 'int-priority') {
      const pending: ('nmi' | 'intr' | 'software' | 'single-step')[] =
        priorityWinner === 'single-step' ? ['single-step', 'nmi', 'intr'] : ['nmi', 'intr'];

      const serviced: ('nmi' | 'intr' | 'software' | 'single-step')[] =
        priorityWinner === 'single-step'
          ? ['single-step', 'nmi', 'intr']
          : priorityWinner === 'nmi'
            ? ['nmi', 'intr']
            : ['intr', 'nmi'];

      const ans: IntPriorityAnswer = {
        kind: 'int-priority',
        pendingKinds: pending,
        servicedOrder: serviced,
        reasoning: priorityReason,
      };
      return {
        moduleId: 'interrupt-controller',
        stepId: stepKey,
        studentAnswer: ans,
        timestamp: new Date().toISOString(),
      };
    }

    // int-trap-timing
    const currentIp = session.cpuState?.registers.IP ?? 0x0100;
    const ans: IntTrapTimingAnswer = {
      kind: 'int-trap-timing',
      tfSetAtIp: currentIp,
      trapFiresAfterIp: firesNextInstr ? currentIp + 1 : currentIp,
      reasoning: trapReason,
    };
    return {
      moduleId: 'interrupt-controller',
      stepId: stepKey,
      studentAnswer: ans,
      timestamp: new Date().toISOString(),
    };
  };

  const handleShowAnswer = () => {
    if (isTestInProgress) return;
    useFeedbackStore.getState().requestHint(stepKey);
    useLogStore.getState().logEvent({
      eventType: 'hint-used',
      moduleId: 'interrupt-controller',
      stepId: stepKey,
      level: 3,
    });

    if (kind === 'int-vector') {
      const v = parseInt(vectorNum, 10) || 0;
      setRevealedAnswer(`Expected address: 0x${(v * 4).toString(16).toUpperCase().padStart(4, '0')}, reason: n * 4`);
    } else if (kind === 'int-frame') {
      setRevealedAnswer('Expected order: [TOS/SP+0: Return IP, SP+2: Return CS, SP+4: FLAGS]. Total size = 6 bytes.');
    } else if (kind === 'int-flags') {
      setRevealedAnswer('Expected: Entry IF=0, TF=0 (cleared on entry); Restored from stack on IRET.');
    } else if (kind === 'int-priority') {
      setRevealedAnswer('Expected priority order: 1. Single-Step Trap → 2. NMI → 3. INTR (if IF=1).');
    } else if (kind === 'int-trap-timing') {
      setRevealedAnswer('Expected: Fires after the instruction following POPF/STI. Does NOT step inside handler.');
    }
  };

  const handleStepSuccess = () => {
    const nextSeq = [...predictionHistory, true];
    setPredictionHistory(nextSeq);
    if (nextSeq.length >= 3) {
      const hasFailure = nextSeq.slice(0, -1).some((ok) => !ok);
      if (hasFailure) {
        setTrapFlag({
          finalAnswerCorrect: true,
          inconsistentSteps: [stepKey],
          notes: 'Correct interrupt prediction reached after incorrect intermediate steps.',
        });
      }
    }
  };

  return (
    <div className={`space-y-5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
            Interrupt Adaptive Practice Workbench
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Predict vector addresses, stack frames, flag clearing, priority order, and single-step trap timing.
          </p>
        </div>

        <span className="font-mono text-xs text-gray-400">
          Predictions: {predictionHistory.length}
        </span>
      </div>

      {/* Answer Trap Banner */}
      {trapFlag && (
        <AnswerTrapBanner flag={trapFlag} onDismiss={() => setTrapFlag(null)} />
      )}

      {/* Program Instruction Status */}
      <div className="rounded-lg bg-gray-50 p-3 font-mono text-xs dark:bg-gray-800/60 flex items-center justify-between">
        <div>
          <span className="font-semibold text-gray-500">Current Instruction (IP): </span>
          <span className="font-bold text-blue-600 dark:text-blue-400">
            {currentInstr ? `Line ${currentInstr.sourceLine}: ${currentInstr.sourceText}` : 'Assemble a program first'}
          </span>
        </div>
        <span className="text-[11px] text-gray-500 font-mono">
          IF={session.pendingLines.ifFlag} TF={session.pendingLines.tfFlag} NMI={session.pendingLines.nmi ? '1' : '0'} INTR={session.pendingLines.intr ? '1' : '0'}
        </span>
      </div>

      {/* Practice Topic Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Topic:</span>
        {(
          [
            ['int-vector', 'Vector Address (n × 4)'],
            ['int-frame', 'Interrupt Frame (Stack)'],
            ['int-flags', 'IF & TF Behavior'],
            ['int-priority', 'Priority Arbitration'],
            ['int-trap-timing', 'TF Trap Timing'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              setRevealedAnswer(null);
            }}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              kind === k
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* StepChecker Integration */}
      <StepChecker
        moduleId="interrupt-controller"
        stepId={stepKey}
        title={`Predict ${kind.replace('int-', '').toUpperCase()} Behavior`}
        buildSubmission={buildSubmission}
        context={
          session.cpuState && session.program
            ? {
                interrupts: {
                  cpuState: session.cpuState,
                  program: session.program,
                  scenario: session.scenario,
                },
              }
            : undefined
        }
        onSuccess={handleStepSuccess}
        renderInput={({ isSubmitting }) => (
          <div className="space-y-3 pt-2 text-xs">
            {/* 1. Vector Address Prediction */}
            {kind === 'int-vector' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="int-vec-num" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Interrupt Vector Number (0–255):
                  </label>
                  <input
                    id="int-vec-num"
                    type="number"
                    min="0"
                    max="255"
                    value={vectorNum}
                    onChange={(e) => setVectorNum(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                </div>

                <div>
                  <label htmlFor="int-vec-addr" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Expected IVT Start Address:
                  </label>
                  <input
                    id="int-vec-addr"
                    type="text"
                    placeholder="e.g. 0x0080"
                    value={vectorAddr}
                    onChange={(e) => setVectorAddr(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                </div>

                <div>
                  <label htmlFor="int-vec-handler-ip" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Expected Handler IP:
                  </label>
                  <input
                    id="int-vec-handler-ip"
                    type="text"
                    placeholder="e.g. 0x0100"
                    value={vectorHandlerIp}
                    onChange={(e) => setVectorHandlerIp(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                </div>

                <div>
                  <label htmlFor="int-vec-reason" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Calculation Reason:
                  </label>
                  <select
                    id="int-vec-reason"
                    value={vectorReason}
                    onChange={(e) => setVectorReason(e.target.value as IntVectorReasoningOption)}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="vector-times-four">Address = vector × 4 (4 bytes per vector: 2 IP + 2 CS)</option>
                    <option value="vector-times-two">Address = vector × 2 (2 bytes per vector)</option>
                    <option value="vector-plus-four">Address = vector + 4</option>
                    <option value="none">Fixed / other address</option>
                  </select>
                </div>
              </div>
            )}

            {/* 2. Interrupt Frame Prediction */}
            {kind === 'int-frame' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="frame-top" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Top of Stack [SP + 0]:
                  </label>
                  <select
                    id="frame-top"
                    value={frameTop}
                    onChange={(e) => setFrameTop(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="return-ip">Return IP (last pushed word)</option>
                    <option value="return-cs">Return CS</option>
                    <option value="flags">Saved FLAGS</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="frame-middle" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Middle of Frame [SP + 2]:
                  </label>
                  <select
                    id="frame-middle"
                    value={frameMiddle}
                    onChange={(e) => setFrameMiddle(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="return-cs">Return CS (middle pushed word)</option>
                    <option value="return-ip">Return IP</option>
                    <option value="flags">Saved FLAGS</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="frame-bottom" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Bottom of Frame [SP + 4]:
                  </label>
                  <select
                    id="frame-bottom"
                    value={frameBottom}
                    onChange={(e) => setFrameBottom(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="flags">Saved FLAGS (first pushed word)</option>
                    <option value="return-cs">Return CS</option>
                    <option value="return-ip">Return IP</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="frame-size" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Total Frame Size (Bytes):
                  </label>
                  <input
                    id="frame-size"
                    type="number"
                    value={frameSize}
                    onChange={(e) => setFrameSize(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label htmlFor="frame-reason" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Push Order Reason:
                  </label>
                  <select
                    id="frame-reason"
                    value={frameReason}
                    onChange={(e) => setFrameReason(e.target.value as IntFrameReasoningOption)}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="flags-cs-ip-pushed-downward">FLAGS pushed 1st, then CS, then IP (reversed by IRET)</option>
                    <option value="ip-cs-flags-reversed">IP pushed 1st, then CS, then FLAGS</option>
                    <option value="ret-pops-ip-only">RET pops IP only (2 bytes)</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
            )}

            {/* 3. IF & TF Flags Prediction */}
            {kind === 'int-flags' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2 sm:col-span-4">
                  <label htmlFor="flags-context" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Evaluation Point:
                  </label>
                  <select
                    id="flags-context"
                    value={flagsContext}
                    onChange={(e) => setFlagsContext(e.target.value as 'after-entry' | 'after-iret')}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="after-entry">After Interrupt Entry (Hardware ISR Dispatch)</option>
                    <option value="after-iret">After IRET (Return from Interrupt)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="entry-if" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    IF on Entry:
                  </label>
                  <select
                    id="entry-if"
                    value={entryIf}
                    onChange={(e) => setEntryIf(parseInt(e.target.value, 10) as 0 | 1)}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value={0}>0 (Cleared automatically)</option>
                    <option value={1}>1 (Remains set)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="entry-tf" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    TF on Entry:
                  </label>
                  <select
                    id="entry-tf"
                    value={entryTf}
                    onChange={(e) => setEntryTf(parseInt(e.target.value, 10) as 0 | 1)}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value={0}>0 (Cleared automatically)</option>
                    <option value={1}>1 (Remains set)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="iret-if" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    IF after IRET:
                  </label>
                  <select
                    id="iret-if"
                    value={afterIretIf}
                    onChange={(e) => setAfterIretIf(parseInt(e.target.value, 10) as 0 | 1)}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value={1}>Restored from stack (1)</option>
                    <option value={0}>Restored from stack (0)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="iret-tf" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    TF after IRET:
                  </label>
                  <select
                    id="iret-tf"
                    value={afterIretTf}
                    onChange={(e) => setAfterIretTf(parseInt(e.target.value, 10) as 0 | 1)}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value={0}>Restored from stack (0)</option>
                    <option value={1}>Restored from stack (1)</option>
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-4">
                  <label htmlFor="flags-reason" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Flags Rule:
                  </label>
                  <select
                    id="flags-reason"
                    value={flagsReason}
                    onChange={(e) => setFlagsReason(e.target.value as IntFlagsReasoningOption)}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="hardware-clears-if-tf">Hardware automatically clears IF and TF to 0 on entry</option>
                    <option value="iret-restores-flags">IRET restores saved IF and TF from stack</option>
                    <option value="flags-unaffected">Flags remain unaffected</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
            )}

            {/* 4. Priority Prediction */}
            {kind === 'int-priority' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="prio-winner" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Next Recognized Interrupt:
                  </label>
                  <select
                    id="prio-winner"
                    value={priorityWinner}
                    onChange={(e) => setPriorityWinner(e.target.value as 'single-step' | 'nmi' | 'intr')}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="single-step">Single-Step Trap (Priority 1)</option>
                    <option value="nmi">NMI (Priority 2, Non-Maskable)</option>
                    <option value="intr">INTR (Priority 3, Maskable)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="prio-reason" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Arbitration Rule:
                  </label>
                  <select
                    id="prio-reason"
                    value={priorityReason}
                    onChange={(e) => setPriorityReason(e.target.value as IntPriorityReasoningOption)}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="nmi-higher-than-intr">NMI &gt; INTR (Non-maskable has priority)</option>
                    <option value="intr-higher-than-nmi">INTR &gt; NMI</option>
                    <option value="software-preempts-hardware">Software &gt; Hardware</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
            )}

            {/* 5. Trap Timing Prediction */}
            {kind === 'int-trap-timing' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="trap-fires" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Fires on Next Instruction:
                  </label>
                  <select
                    id="trap-fires"
                    value={firesNextInstr ? 'yes' : 'no'}
                    onChange={(e) => setFiresNextInstr(e.target.value === 'yes')}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="yes">Yes (after next instruction completes)</option>
                    <option value="no">No</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="trap-handler" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Steps Inside Interrupt Handler:
                  </label>
                  <select
                    id="trap-handler"
                    value={stepsInHandler ? 'yes' : 'no'}
                    onChange={(e) => setStepsInHandler(e.target.value === 'yes')}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="no">No (TF cleared automatically on interrupt entry)</option>
                    <option value="yes">Yes (continues single-stepping ISR)</option>
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label htmlFor="trap-reason" className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Trap Timing Rule:
                  </label>
                  <select
                    id="trap-reason"
                    value={trapReason}
                    onChange={(e) => setTrapReason(e.target.value as IntTrapTimingReasoningOption)}
                    disabled={isSubmitting}
                    className="w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="trap-after-next-instruction">Trap fires after the instruction following POPF/STI completes</option>
                    <option value="trap-immediately-on-popf">Trap fires immediately on the instruction setting TF</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={handleShowAnswer}
                disabled={isSubmitting || isTestInProgress}
                title={isTestInProgress ? 'Answers cannot be revealed during study evaluation.' : undefined}
              >
                {isTestInProgress ? 'Test In Progress' : 'Show Answer'}
              </Button>

              {revealedAnswer && (
                <span className="font-mono text-xs text-purple-700 dark:text-purple-300">
                  {revealedAnswer}
                </span>
              )}
            </div>
          </div>
        )}
      />
    </div>
  );
};
