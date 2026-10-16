/**
 * @file AluPage.tsx
 * Top-level laboratory page for the Arithmetic Logic Unit (ALU) module.
 */

import { type FC, useMemo, useState } from 'react';
import type { AluOpId, AluState } from '../../types/designProject';
import { useProjectStore } from '../../store/projectStore';
import { execute } from '../../engine/alu/alu';
import { Tabs } from '../../components/ui/Tabs';
import { OperandInputs, type AluWidth } from './OperandInputs';
import { FlagsPanel } from './FlagsPanel';
import { GateTraceView } from './GateTraceView';
import { AluPractice } from './AluPractice';
import { Button } from '../../components/ui/Button';
import { useUiStore } from '../../store/uiStore';
import { programFromAluOperation } from '../../engine/cpu8086/aluProgram';

function formatNibble(binStr: string): string {
  const parts: string[] = [];
  for (let i = 0; i < binStr.length; i += 4) {
    parts.push(binStr.slice(i, i + 4));
  }
  return parts.join(' ');
}

export const AluPage: FC = () => {
  const project = useProjectStore((s) => s.project);
  const applyPatch = useProjectStore((s) => s.applyPatch);

  const initialAlu: AluState = useMemo(() => {
    return (
      project.alu ?? {
        op: 'ADD',
        width: 4,
        a: 5,
        b: 3,
        shiftCount: 1,
      }
    );
  }, [project.alu]);

  const [state, setState] = useState<AluState>(initialAlu);

  const updateState = (patch: Partial<AluState>): void => {
    const next: AluState = { ...state, ...patch };
    setState(next);
    applyPatch({ alu: next });
  };

  const handleRandomize = (): void => {
    const maxVal = (1 << state.width) - 1;
    const nextA = Math.floor(Math.random() * (maxVal + 1));
    const nextB = Math.floor(Math.random() * (maxVal + 1));
    updateState({ a: nextA, b: nextB });
  };

  const execution = useMemo(() => {
    return execute(state.op, state.a, state.b, state.width, {
      shiftCount: state.shiftCount ?? 1,
    });
  }, [state.op, state.a, state.b, state.width, state.shiftCount]);

  const tabs = [
    {
      id: 'explore',
      label: 'Explore ALU',
      content: (
        <div className="space-y-6">
          <OperandInputs
            op={state.op}
            width={state.width as AluWidth}
            a={state.a}
            b={state.b}
            shiftCount={state.shiftCount}
            onOpChange={(op: AluOpId) => updateState({ op })}
            onWidthChange={(width: AluWidth) => {
              const maxVal = (1 << width) - 1;
              updateState({
                width,
                a: Math.min(state.a, maxVal),
                b: Math.min(state.b, maxVal),
              });
            }}
            onAChange={(a: number) => updateState({ a })}
            onBChange={(b: number) => updateState({ b })}
            onShiftCountChange={(shiftCount: number) => updateState({ shiftCount })}
            onRandomize={handleRandomize}
          />

          {execution.ok && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  ALU Output Bus
                </h3>
                {execution.result.isDiscarded && (
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    CMP: Result Discarded (Flags Updated Only)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Binary Bits
                  </span>
                  <div className="mt-1 font-mono text-base font-bold text-blue-600 dark:text-blue-400">
                    (MSB) {formatNibble(execution.result.bits)} (LSB)
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Unsigned Decimal & Hex
                  </span>
                  <div className="mt-1 font-mono text-base font-bold text-gray-900 dark:text-gray-100">
                    {execution.result.unsigned} (0x{execution.result.unsigned.toString(16).toUpperCase()})
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Signed Two's Complement
                  </span>
                  <div className="mt-1 font-mono text-base font-bold text-gray-900 dark:text-gray-100">
                    {execution.result.signed}
                  </div>
                </div>
              </div>
            </div>
          )}

          {execution.ok && (
            <FlagsPanel
              flags={execution.flags}
              explanations={execution.flagExplanations}
              op={state.op}
              compareRelations={
                state.op === 'CMP'
                  ? {
                      equal: execution.flags.Z === 1,
                      notEqual: execution.flags.Z === 0,
                      below: execution.flags.C === 1,
                      belowOrEqual: execution.flags.C === 1 || execution.flags.Z === 1,
                      above: execution.flags.C === 0 && execution.flags.Z === 0,
                      aboveOrEqual: execution.flags.C === 0,
                      less: (execution.flags.S ^ (execution.flags.O === 'undefined' ? 0 : execution.flags.O)) === 1,
                      lessOrEqual:
                        (execution.flags.S ^ (execution.flags.O === 'undefined' ? 0 : execution.flags.O)) === 1 ||
                        execution.flags.Z === 1,
                      greater:
                        (execution.flags.S ^ (execution.flags.O === 'undefined' ? 0 : execution.flags.O)) === 0 &&
                        execution.flags.Z === 0,
                      greaterOrEqual:
                        (execution.flags.S ^ (execution.flags.O === 'undefined' ? 0 : execution.flags.O)) === 0,
                    }
                  : undefined
              }
            />
          )}
        </div>
      ),
    },
    {
      id: 'carry-chain',
      label: 'Carry Chain Datapath',
      content: (
        <GateTraceView
          carryChain={execution.ok ? execution.carryChain : undefined}
          gateTrace={execution.ok ? execution.gateTrace : undefined}
          width={state.width}
        />
      ),
    },
    {
      id: 'practice',
      label: 'Practice & Predict',
      content: <AluPractice width={state.width} />,
    },
  ];

  const aluHandoff = useMemo(() => programFromAluOperation(state), [state]);

  const handleRunIn8086 = (): void => {
    if (!aluHandoff.available) return;
    applyPatch({
      alu: state,
      lastHandoff: {
        from: 'alu',
        to: '8086-cpu',
        timestamp: new Date().toISOString(),
        summary: `Handoff from alu to 8086-cpu: ${state.op} (${state.width}-bit)`,
      },
    });
    useProjectStore.getState().markModuleCompleted('alu');
    useUiStore.getState().setModule('8086-cpu');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div className="border-b border-gray-200 pb-4 dark:border-gray-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Arithmetic Logic Unit (ALU)
          </h1>
        </div>

        <div className="flex flex-col items-end gap-1">
          <Button
            variant="primary"
            size="md"
            disabled={!aluHandoff.available}
            onClick={handleRunIn8086}
            aria-label="Run in 8086"
          >
            Run in 8086
          </Button>
          {!aluHandoff.available && (
            <p className="max-w-xs text-right text-xs text-amber-600 dark:text-amber-400">
              {aluHandoff.reason}
            </p>
          )}
        </div>
      </div>

      <Tabs tabs={tabs} defaultValue="explore" />
    </div>
  );
};
