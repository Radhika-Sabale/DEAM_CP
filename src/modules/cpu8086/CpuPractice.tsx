/**
 * @file CpuPractice.tsx
 * Interactive practice workbench for 8086 CPU instruction prediction.
 * Students predict register values, status flags, next IP, or stack changes
 * evaluated by deterministic domain validators with progressive hints,
 * answer-trap detection, and test gating.
 */

import { type FC, useMemo, useState } from 'react';
import type { CpuSession } from './useCpuSession';
import { StepChecker } from '../../components/feedback/StepChecker';
import { AnswerTrapBanner } from '../../components/feedback/AnswerTrapBanner';
import { CpuPracticeTrace } from './CpuPracticeTrace';
import '../../engine/feedback/validators/cpu8086';
import type {
  AnswerTrapFlag,
  CpuFlagAnswer,
  CpuNextIpAnswer,
  CpuRegisterAnswer,
  CpuStackAnswer,
  FlagName,
  StepSubmission,
} from '../../types/feedback';
import { getReg } from '../../engine/cpu8086/registers';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useStudyStore } from '../../store/studyStore';
import { useLogStore } from '../../store/logStore';
import { Button } from '../../components/ui/Button';

export interface CpuPracticeProps {
  readonly session: CpuSession;
  readonly className?: string;
}

type PracticeKind = 'register' | 'flag' | 'stack' | 'next-ip';

export const CpuPractice: FC<CpuPracticeProps> = ({ session, className = '' }) => {
  const [practiceTab, setPracticeTab] = useState<'predict' | 'trace'>('predict');
  const [kind, setKind] = useState<PracticeKind>('register');

  // Input states
  const [regName, setRegName] = useState('AX');
  const [regValue, setRegValue] = useState('');
  const [selectedFlag, setSelectedFlag] = useState<FlagName>('Z');
  const [flagValue, setFlagValue] = useState<0 | 1 | 'undefined'>(1);
  const [nextIpValue, setNextIpValue] = useState('');
  const [stackSp, setStackSp] = useState('');
  const [stackAddr, setStackAddr] = useState('');
  const [stackVal, setStackVal] = useState('');

  // Answer trap & assisted tracking
  const [trapFlag, setTrapFlag] = useState<AnswerTrapFlag | null>(null);
  const [predictionHistory, setPredictionHistory] = useState<boolean[]>([]);
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);

  const pretestUnlocked = useStudyStore((s) => s.pretestUnlocked);
  const posttestUnlocked = useStudyStore((s) => s.posttestUnlocked);
  const isTestInProgress = pretestUnlocked || posttestUnlocked;

  const currentInstr = useMemo(() => {
    if (!session.program || !session.cpuState) return null;
    const ip = session.cpuState.registers.IP;
    return session.program.instructions[ip] ?? null;
  }, [session.program, session.cpuState]);

  const stepKey = `cpu-${kind}-${session.cpuState?.registers.IP ?? 0}`;

  const buildSubmission = (): StepSubmission => {
    setRevealedAnswer(null);
    if (kind === 'register') {
      const parsedVal = regValue.startsWith('0x') || regValue.startsWith('0X')
        ? parseInt(regValue.slice(2), 16)
        : parseInt(regValue, 10) || 0;
      const ans: CpuRegisterAnswer = {
        kind: 'cpu-register',
        register: regName as 'AX',
        value: parsedVal,
      };
      return {
        moduleId: '8086-cpu',
        stepId: stepKey,
        studentAnswer: ans,
        timestamp: new Date().toISOString(),
      };
    }

    if (kind === 'flag') {
      const ans: CpuFlagAnswer = {
        kind: 'cpu-flag',
        flag: selectedFlag,
        value: flagValue,
      };
      return {
        moduleId: '8086-cpu',
        stepId: stepKey,
        studentAnswer: ans,
        timestamp: new Date().toISOString(),
      };
    }

    if (kind === 'stack') {
      const sp = parseInt(stackSp, 16) || parseInt(stackSp, 10) || 0;
      const addr = parseInt(stackAddr, 16) || parseInt(stackAddr, 10) || 0;
      const val = parseInt(stackVal, 16) || parseInt(stackVal, 10) || 0;
      const ans: CpuStackAnswer = {
        kind: 'cpu-stack',
        op: 'push',
        sp,
        address: addr,
        value: val,
      };
      return {
        moduleId: '8086-cpu',
        stepId: stepKey,
        studentAnswer: ans,
        timestamp: new Date().toISOString(),
      };
    }

    // next-ip
    const parsedIp = parseInt(nextIpValue, 16) || parseInt(nextIpValue, 10) || 0;
    const ans: CpuNextIpAnswer = {
      kind: 'cpu-next-ip',
      nextIp: parsedIp,
    };
    return {
      moduleId: '8086-cpu',
      stepId: stepKey,
      studentAnswer: ans,
      timestamp: new Date().toISOString(),
    };
  };

  const handleShowAnswer = () => {
    if (isTestInProgress) return;
    // Log level 3 assisted equivalent
    useFeedbackStore.getState().requestHint(stepKey);
    useLogStore.getState().logEvent({
      eventType: 'hint-used',
      moduleId: '8086-cpu',
      stepId: stepKey,
      level: 3,
    });

    if (kind === 'register' && session.cpuState) {
      setRevealedAnswer(`Expected ${regName}: 0x${getReg(session.cpuState.registers, regName as 'AX').toString(16).toUpperCase()}`);
    } else if (kind === 'flag' && session.cpuState) {
      setRevealedAnswer(`Expected ${selectedFlag}: ${session.cpuState.flags[selectedFlag]}`);
    } else if (kind === 'stack' && session.cpuState) {
      setRevealedAnswer(`Expected SP: 0x${((session.cpuState.registers.SP - 2) & 0xffff).toString(16).toUpperCase()}`);
    } else if (kind === 'next-ip' && session.cpuState) {
      setRevealedAnswer(`Expected Next IP: ${session.cpuState.registers.IP + 1}`);
    }
  };

  const handleStepSuccess = () => {
    const nextSeq = [...predictionHistory, true];
    setPredictionHistory(nextSeq);
    // Check answer trap after sequence of 3-5 predictions
    if (nextSeq.length >= 3) {
      const hasFailure = nextSeq.slice(0, -1).some((ok) => !ok);
      if (hasFailure) {
        setTrapFlag({
          finalAnswerCorrect: true,
          inconsistentSteps: [stepKey],
          notes: 'Correct final prediction reached after incorrect intermediate steps.',
        });
      }
    }
  };

  if (practiceTab === 'trace') {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPracticeTab('predict')}>
            ← Back to Predict Mode
          </Button>
        </div>
        <CpuPracticeTrace session={session} />
      </div>
    );
  }

  return (
    <div className={`space-y-5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      {/* Header and Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
            Adaptive Practice Workbench
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Predict machine state changes after instruction execution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPracticeTab('trace')}
            aria-label="Switch to multi-step trace table mode"
          >
            Trace It Table Mode →
          </Button>
        </div>
      </div>

      {/* Answer Trap Alert Banner */}
      {trapFlag && (
        <AnswerTrapBanner flag={trapFlag} onDismiss={() => setTrapFlag(null)} />
      )}

      {/* Current Instruction Display */}
      <div className="rounded-lg bg-gray-50 p-3 font-mono text-xs dark:bg-gray-800/60 flex items-center justify-between">
        <div>
          <span className="font-semibold text-gray-500">Current Instruction (IP): </span>
          <span className="font-bold text-blue-600 dark:text-blue-400">
            {currentInstr ? `Line ${currentInstr.sourceLine}: ${currentInstr.sourceText}` : 'Assemble a program first'}
          </span>
        </div>
        <span className="text-[11px] text-gray-400">
          Predictions: {predictionHistory.length}
        </span>
      </div>

      {/* Prediction Category Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Predict:</span>
        {(['register', 'flag', 'stack', 'next-ip'] as const).map((k) => (
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
            {k === 'register' ? 'Register' : k === 'flag' ? 'Status Flag' : k === 'stack' ? 'Stack (PUSH)' : 'Next IP'}
          </button>
        ))}
      </div>

      {/* Step Checker with progressive hints */}
      <StepChecker
        moduleId="8086-cpu"
        stepId={stepKey}
        title={`Predict ${kind.toUpperCase()} after instruction`}
        buildSubmission={buildSubmission}
        context={session.cpuState && session.program ? { cpu8086: { state: session.cpuState, program: session.program } } : undefined}
        onSuccess={handleStepSuccess}
        renderInput={({ isSubmitting }) => (
          <div className="space-y-3 pt-2">
            {kind === 'register' && (
              <div className="flex items-center gap-2">
                <select
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="rounded border border-gray-300 bg-white p-1.5 text-xs dark:border-gray-700 dark:bg-gray-800"
                >
                  {['AX', 'BX', 'CX', 'DX', 'AL', 'AH', 'BL', 'BH', 'SI', 'DI', 'SP'].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Value (e.g. 0x05 or 5)"
                  value={regValue}
                  onChange={(e) => setRegValue(e.target.value)}
                  disabled={isSubmitting}
                  className="w-40 rounded border border-gray-300 p-1.5 font-mono text-xs dark:border-gray-700 dark:bg-gray-800"
                />
              </div>
            )}

            {kind === 'flag' && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedFlag}
                  onChange={(e) => setSelectedFlag(e.target.value as FlagName)}
                  className="rounded border border-gray-300 bg-white p-1.5 text-xs dark:border-gray-700 dark:bg-gray-800"
                >
                  {(['Z', 'C', 'S', 'O'] as const).map((f) => (
                    <option key={f} value={f}>{f} Flag</option>
                  ))}
                </select>
                <select
                  value={String(flagValue)}
                  onChange={(e) => setFlagValue(e.target.value === 'undefined' ? 'undefined' : (parseInt(e.target.value, 10) as 0 | 1))}
                  className="rounded border border-gray-300 bg-white p-1.5 text-xs dark:border-gray-700 dark:bg-gray-800"
                >
                  <option value="0">0 (Cleared)</option>
                  <option value="1">1 (Set)</option>
                  <option value="undefined">undefined</option>
                </select>
              </div>
            )}

            {kind === 'stack' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label htmlFor="stack-sp" className="text-[11px] text-gray-500">Predicted SP:</label>
                  <input
                    id="stack-sp"
                    type="text"
                    placeholder="Hex SP (e.g. 0xFFFE)"
                    value={stackSp}
                    onChange={(e) => setStackSp(e.target.value)}
                    className="w-full rounded border border-gray-300 p-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label htmlFor="stack-addr" className="text-[11px] text-gray-500">Write Address:</label>
                  <input
                    id="stack-addr"
                    type="text"
                    placeholder="Hex Addr (e.g. 0xFFFE)"
                    value={stackAddr}
                    onChange={(e) => setStackAddr(e.target.value)}
                    className="w-full rounded border border-gray-300 p-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label htmlFor="stack-val" className="text-[11px] text-gray-500">Pushed Word:</label>
                  <input
                    id="stack-val"
                    type="text"
                    placeholder="Value (e.g. 0x0005)"
                    value={stackVal}
                    onChange={(e) => setStackVal(e.target.value)}
                    className="w-full rounded border border-gray-300 p-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-800"
                  />
                </div>
              </div>
            )}

            {kind === 'next-ip' && (
              <div className="flex items-center gap-2">
                <label htmlFor="predict-ip" className="text-xs text-gray-600 dark:text-gray-300">Next IP:</label>
                <input
                  id="predict-ip"
                  type="text"
                  placeholder="Address (e.g. 2)"
                  value={nextIpValue}
                  onChange={(e) => setNextIpValue(e.target.value)}
                  disabled={isSubmitting}
                  className="w-32 rounded border border-gray-300 p-1.5 font-mono text-xs dark:border-gray-700 dark:bg-gray-800"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShowAnswer}
                disabled={isTestInProgress}
                aria-label="Reveal step answer (disabled during active diagnostic test)"
              >
                {isTestInProgress ? 'Show answer (disabled in test)' : 'Show answer'}
              </Button>
              {revealedAnswer && (
                <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
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
