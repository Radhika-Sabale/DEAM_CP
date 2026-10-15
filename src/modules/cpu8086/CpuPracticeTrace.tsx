/**
 * @file CpuPracticeTrace.tsx
 * "Trace it" mode component for 8086 CPU practice.
 * Students fill an execution trace table of register values across N instructions,
 * with each cell validated as a pedagogical step.
 */

import { type FC, useState } from 'react';
import type { CpuSession } from './useCpuSession';
import { StepChecker } from '../../components/feedback/StepChecker';
import type { CpuRegisterAnswer, StepSubmission } from '../../types/feedback';
import { step } from '../../engine/cpu8086/cpu';
import type { CpuState, StepResult } from '../../engine/cpu8086/cpuTypes';

export interface CpuPracticeTraceProps {
  readonly session: CpuSession;
  readonly className?: string;
}

export const CpuPracticeTrace: FC<CpuPracticeTraceProps> = ({ session, className = '' }) => {
  const { program, cpuState } = session;
  const [predictedAX, setPredictedAX] = useState<string>('');
  const [predictedBX, setPredictedBX] = useState<string>('');
  const [stepIdx, setStepIdx] = useState<number>(0);

  if (!program || !cpuState) {
    return (
      <div className={`p-4 text-xs text-gray-400 dark:text-gray-500 italic ${className}`}>
        Assemble a program to begin the register trace practice.
      </div>
    );
  }

  // Pre-calculate step results for trace steps
  const simSteps: { pre: CpuState; post: CpuState; instrText: string }[] = [];
  let curr = cpuState;
  for (let i = 0; i < 3; i++) {
    if (curr.halted || curr.fault) break;
    const ip = curr.registers.IP;
    const instr = program.instructions[ip];
    if (!instr) break;
    const res: StepResult = step(curr, program);
    simSteps.push({ pre: curr, post: res.state, instrText: instr.sourceText });
    curr = res.state;
  }

  const activeSim = simSteps[stepIdx] ?? simSteps[0];

  const buildTraceSubmissionAX = (): StepSubmission => {
    const val = parseInt(predictedAX, 16) || parseInt(predictedAX, 10) || 0;
    const ans: CpuRegisterAnswer = {
      kind: 'cpu-register',
      register: 'AX',
      value: val,
    };
    return {
      moduleId: '8086-cpu',
      stepId: `trace-ax-step-${stepIdx}`,
      studentAnswer: ans,
      timestamp: new Date().toISOString(),
    };
  };

  const buildTraceSubmissionBX = (): StepSubmission => {
    const val = parseInt(predictedBX, 16) || parseInt(predictedBX, 10) || 0;
    const ans: CpuRegisterAnswer = {
      kind: 'cpu-register',
      register: 'BX',
      value: val,
    };
    return {
      moduleId: '8086-cpu',
      stepId: `trace-bx-step-${stepIdx}`,
      studentAnswer: ans,
      timestamp: new Date().toISOString(),
    };
  };

  return (
    <div className={`space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      <div className="border-b border-gray-100 pb-2 dark:border-gray-800">
        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Trace It Mode: Multi-Instruction Execution Table
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Predict register values after each instruction execution.
        </p>
      </div>

      {activeSim ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-gray-50 p-2.5 font-mono text-xs dark:bg-gray-800/60">
            <span className="font-semibold text-gray-500">Step {stepIdx + 1}: </span>
            <span className="font-bold text-blue-600 dark:text-blue-400">{activeSim.instrText}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StepChecker
              moduleId="8086-cpu"
              stepId={`trace-ax-step-${stepIdx}`}
              title="Predicted AX"
              description="Enter expected AX value after instruction"
              buildSubmission={buildTraceSubmissionAX}
              context={{ cpu8086: { state: activeSim.pre, program } }}
              renderInput={({ isSubmitting }) => (
                <input
                  type="text"
                  placeholder="Hex (e.g. 0x05)"
                  value={predictedAX}
                  onChange={(e) => setPredictedAX(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded border border-gray-300 p-1.5 font-mono text-xs dark:border-gray-700 dark:bg-gray-800"
                />
              )}
            />

            <StepChecker
              moduleId="8086-cpu"
              stepId={`trace-bx-step-${stepIdx}`}
              title="Predicted BX"
              description="Enter expected BX value after instruction"
              buildSubmission={buildTraceSubmissionBX}
              context={{ cpu8086: { state: activeSim.pre, program } }}
              renderInput={({ isSubmitting }) => (
                <input
                  type="text"
                  placeholder="Hex (e.g. 0x00)"
                  value={predictedBX}
                  onChange={(e) => setPredictedBX(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded border border-gray-300 p-1.5 font-mono text-xs dark:border-gray-700 dark:bg-gray-800"
                />
              )}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={stepIdx <= 0}
              onClick={() => setStepIdx((i) => i - 1)}
              className="rounded bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 disabled:opacity-40 dark:bg-gray-800 dark:text-gray-300"
            >
              Previous Instruction
            </button>
            <button
              type="button"
              disabled={stepIdx >= simSteps.length - 1}
              onClick={() => setStepIdx((i) => i + 1)}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
            >
              Next Instruction
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400">No instructions available to trace.</p>
      )}
    </div>
  );
};
