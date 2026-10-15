/**
 * @file GateTraceView.tsx
 * Ripple-carry stage table, gate-level datapath traces, and protected Circuit Simulator export.
 */

import { type FC, useState } from 'react';
import type { CarryChainModel, GateTraceStep } from '../../engine/alu/types';
import { buildAdderSubtractorCircuit } from '../../engine/alu/adderCircuit';
import { ReplaceCircuitModal } from './ReplaceCircuitModal';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { Button } from '../../components/ui/Button';

export interface GateTraceViewProps {
  readonly carryChain?: CarryChainModel;
  readonly gateTrace?: readonly GateTraceStep[];
  readonly width: number;
}

export const GateTraceView: FC<GateTraceViewProps> = ({
  carryChain,
  gateTrace,
  width,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedGates, setExpandedGates] = useState(false);

  const project = useProjectStore((s) => s.project);
  const applyPatch = useProjectStore((s) => s.applyPatch);
  const markModuleCompleted = useProjectStore((s) => s.markModuleCompleted);
  const setModule = useUiStore((s) => s.setModule);
  const pushToast = useUiStore((s) => s.pushToast);

  const handleOpenAdderClick = (): void => {
    if (project.circuit !== null && project.circuit !== undefined) {
      setModalOpen(true);
    } else {
      performCircuitHandoff();
    }
  };

  const performCircuitHandoff = (): void => {
    const circuit = buildAdderSubtractorCircuit(width);
    applyPatch({
      circuit,
      lastHandoff: {
        from: 'alu',
        to: 'circuit-simulator',
        timestamp: new Date().toISOString(),
        summary: `Synthesized ${width}-bit Ripple-Carry Adder/Subtractor schematic from ALU datapath.`,
      },
    });

    markModuleCompleted('alu');
    setModule('circuit-simulator');
    setModalOpen(false);

    pushToast({
      level: 'success',
      title: 'Adder Circuit Exported',
      message: `Generated ${width}-bit adder/subtractor schematic in Circuit Simulator.`,
    });
  };

  if (!carryChain || !carryChain.bits || carryChain.bits.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        Carry chain datapath is active for arithmetic ADD and SUB operations.
      </div>
    );
  }

  // Bits displayed with MSB on left (reversed from bitIndex order 0..W-1)
  const displayBits = [...carryChain.bits].reverse();

  return (
    <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Ripple-Carry Adder/Subtractor Datapath ({width}-bit)
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Full-adder stages connected in series with propagate (P) and generate (G) signals.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={handleOpenAdderClick}>
          Open adder in Circuit Simulator
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-center text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 font-semibold">
              <th scope="col" className="px-3 py-2 text-left text-gray-600 dark:text-gray-300">
                Signal
              </th>
              {displayBits.map((b) => (
                <th key={b.bitIndex} scope="col" className="px-3 py-2 font-mono text-gray-800 dark:text-gray-200">
                  Bit {b.bitIndex} {b.bitIndex === width - 1 ? '(MSB)' : b.bitIndex === 0 ? '(LSB)' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
            <tr>
              <th scope="row" className="px-3 py-1.5 text-left font-sans text-gray-600 dark:text-gray-400">
                Carry In (Cin)
              </th>
              {displayBits.map((b) => (
                <td key={b.bitIndex} className="px-3 py-1.5 text-blue-600 dark:text-blue-400 font-semibold">
                  {b.carryIn}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-3 py-1.5 text-left font-sans text-gray-600 dark:text-gray-400">
                Operand A
              </th>
              {displayBits.map((b) => (
                <td key={b.bitIndex} className="px-3 py-1.5 text-gray-700 dark:text-gray-300">
                  {b.a}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-3 py-1.5 text-left font-sans text-gray-600 dark:text-gray-400">
                Effective B
              </th>
              {displayBits.map((b) => (
                <td key={b.bitIndex} className="px-3 py-1.5 text-gray-700 dark:text-gray-300">
                  {b.b}
                </td>
              ))}
            </tr>
            <tr className="bg-blue-50/40 dark:bg-blue-950/20 font-bold">
              <th scope="row" className="px-3 py-1.5 text-left font-sans text-blue-900 dark:text-blue-200">
                Sum (S)
              </th>
              {displayBits.map((b) => (
                <td key={b.bitIndex} className="px-3 py-1.5 text-blue-700 dark:text-blue-300">
                  {b.sum}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-3 py-1.5 text-left font-sans text-gray-600 dark:text-gray-400">
                Carry Out (Cout)
              </th>
              {displayBits.map((b) => (
                <td key={b.bitIndex} className="px-3 py-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                  {b.carryOut}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {gateTrace && gateTrace.length > 0 && (
        <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Gate-Level Trace Details ({gateTrace.length} gates)
            </span>
            <button
              type="button"
              onClick={() => setExpandedGates(!expandedGates)}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {expandedGates ? 'Hide details' : 'Show details'}
            </button>
          </div>

          {expandedGates && (
            <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-xs dark:border-gray-700 dark:bg-gray-800/50 space-y-1">
              {gateTrace.map((g) => (
                <div key={g.id} className="flex items-center justify-between py-0.5">
                  <span className="text-gray-600 dark:text-gray-300">
                    [{g.gate}] {g.id}: inputs=[{g.inputs.map((i) => `${i.name}=${i.value}`).join(', ')}]
                  </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {g.output.name} = {g.output.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ReplaceCircuitModal
        isOpen={modalOpen}
        onCancel={() => setModalOpen(false)}
        onConfirm={performCircuitHandoff}
      />
    </div>
  );
};
