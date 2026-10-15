/**
 * @file BinaryArithmeticPanel.tsx
 * Binary arithmetic laboratory panel supporting addition, subtraction,
 * one's complement addition with end-around carry, and sign-magnitude addition.
 * Renders MSB-left carry chains, status flags (C, borrow, N, Z, V), and overflow explanations.
 */

import { type FC, useState } from 'react';
import {
  addBinary,
  type BinaryArithmeticResult,
  onesComplementAdd,
  signMagnitudeAdd,
  subtractBinary,
} from '../../engine/numberSystems';
import { BinaryCarryTable } from './BinaryCarryTable';
import { BinaryFlagsCard } from './BinaryFlagsCard';
import { NonTwosComplementResultView } from './NonTwosComplementResultView';
import { executeAluHandoff } from './binaryArithmeticHandoff';
import { Button } from '../../components/ui/Button';
import { ArrowRightIcon } from '../../components/ui/Icons';

export type ArithmeticOp = 'add' | 'subtract' | 'ones-add' | 'sign-mag-add';

export interface BinaryArithmeticPanelProps {
  readonly initialA?: string;
  readonly initialB?: string;
  readonly initialWidth?: number;
  readonly initialMode?: 'unsigned' | 'signed';
  readonly initialOp?: ArithmeticOp;
  readonly onChange?: (state: { operandA: string; operandB: string; width: number; mode: 'unsigned' | 'signed'; operation: ArithmeticOp }) => void;
  readonly onStepEvent?: (event: unknown) => void;
  readonly className?: string;
}

export function formatBitsWithEnds(bits: string): string {
  const parts: string[] = [];
  let rem = bits;
  while (rem.length > 4) { parts.unshift(rem.slice(-4)); rem = rem.slice(0, -4); }
  if (rem.length > 0) parts.unshift(rem);
  return `(MSB) ${parts.join(' ')} (LSB)`;
}

export const BinaryArithmeticPanel: FC<BinaryArithmeticPanelProps> = ({
  initialA = '0111',
  initialB = '0101',
  initialWidth = 4,
  initialMode = 'signed',
  initialOp = 'add',
  onChange,
  className = '',
}) => {
  const [operandA, setOperandA] = useState<string>(initialA);
  const [operandB, setOperandB] = useState<string>(initialB);
  const [width, setWidth] = useState<number>(initialWidth);
  const [mode, setMode] = useState<'unsigned' | 'signed'>(initialMode);
  const [operation, setOperation] = useState<ArithmeticOp>(initialOp);

  const notifyChange = (nextA: string, nextB: string, nextW: number, nextM: 'unsigned' | 'signed', nextOp: ArithmeticOp) => {
    onChange?.({ operandA: nextA, operandB: nextB, width: nextW, mode: nextM, operation: nextOp });
  };

  function parseOperandInput(val: string, targetWidth: number): string | number {
    const clean = val.trim();
    if (/^[01]+$/.test(clean) && clean.length === targetWidth) return clean;
    const parsed = parseInt(clean, 10);
    return Number.isNaN(parsed) ? clean : parsed;
  }

  const opA = parseOperandInput(operandA, width);
  const opB = parseOperandInput(operandB, width);

  let computeResult:
    | { ok: true; binaryRes?: BinaryArithmeticResult; onesRes?: unknown; smRes?: unknown }
    | { ok: false; error: string };

  if (operation === 'add') {
    const r = addBinary(opA, opB, width, mode);
    computeResult = r.ok ? { ok: true, binaryRes: r.value } : { ok: false, error: r.error.message };
  } else if (operation === 'subtract') {
    const r = subtractBinary(opA, opB, width, mode);
    computeResult = r.ok ? { ok: true, binaryRes: r.value } : { ok: false, error: r.error.message };
  } else if (operation === 'ones-add') {
    const r = onesComplementAdd(opA, opB, width);
    computeResult = r.ok ? { ok: true, onesRes: r.value } : { ok: false, error: r.error.message };
  } else {
    const r = signMagnitudeAdd(opA, opB, width);
    computeResult = r.ok ? { ok: true, smRes: r.value } : { ok: false, error: r.error.message };
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Configuration Controls */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs">
        <div>
          <label htmlFor="arith-op-a" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Operand A (dec or bin)
          </label>
          <input
            id="arith-op-a"
            type="text"
            value={operandA}
            onChange={(e) => {
              setOperandA(e.target.value);
              notifyChange(e.target.value, operandB, width, mode, operation);
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 font-mono text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="arith-op-b" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Operand B (dec or bin)
          </label>
          <input
            id="arith-op-b"
            type="text"
            value={operandB}
            onChange={(e) => {
              setOperandB(e.target.value);
              notifyChange(operandA, e.target.value, width, mode, operation);
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 font-mono text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="arith-width" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Bit Width
          </label>
          <select
            id="arith-width"
            value={width}
            onChange={(e) => {
              const w = parseInt(e.target.value, 10);
              setWidth(w);
              notifyChange(operandA, operandB, w, mode, operation);
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none"
          >
            <option value={4}>4-bit</option>
            <option value={8}>8-bit</option>
            <option value={16}>16-bit</option>
            <option value={32}>32-bit</option>
          </select>
        </div>

        <div>
          <label htmlFor="arith-op" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Operation
          </label>
          <select
            id="arith-op"
            value={operation}
            onChange={(e) => {
              const op = e.target.value as ArithmeticOp;
              setOperation(op);
              notifyChange(operandA, operandB, width, mode, op);
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none"
          >
            <option value="add">Two&apos;s Complement Add</option>
            <option value="subtract">Two&apos;s Complement Subtract</option>
            <option value="ones-add">One&apos;s Complement Add (End-around carry)</option>
            <option value="sign-mag-add">Sign-Magnitude Add</option>
          </select>
        </div>
      </div>

      {/* Mode Selector for 2's Complement */}
      {(operation === 'add' || operation === 'subtract') && (
        <fieldset className="flex items-center gap-4 text-xs">
          <legend className="font-semibold text-gray-700 dark:text-gray-300 mr-2">Interpretation Mode:</legend>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="arith-mode"
              value="signed"
              checked={mode === 'signed'}
              onChange={() => {
                setMode('signed');
                notifyChange(operandA, operandB, width, 'signed', operation);
              }}
            />
            <span className="text-gray-800 dark:text-gray-200">Signed (Two&apos;s Complement)</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="arith-mode"
              value="unsigned"
              checked={mode === 'unsigned'}
              onChange={() => {
                setMode('unsigned');
                notifyChange(operandA, operandB, width, 'unsigned', operation);
              }}
            />
            <span className="text-gray-800 dark:text-gray-200">Unsigned</span>
          </label>
        </fieldset>
      )}

      {/* ALU Inter-Module Handoff Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
            Hardware Datapath Exploration
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            Step through the ripple-carry adder circuit and gate traces in the ALU module.
          </p>
          {operation !== 'add' && operation !== 'subtract' && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mt-1">
              The ALU executes two&apos;s complement arithmetic and does not support one&apos;s complement or sign-magnitude modes.
            </p>
          )}
        </div>
        <div>
          <Button
            variant="primary"
            size="sm"
            disabled={operation !== 'add' && operation !== 'subtract'}
            onClick={() => {
              if (operation === 'add' || operation === 'subtract') {
                executeAluHandoff(operation, opA, opB, width);
              }
            }}
            rightIcon={<ArrowRightIcon className="h-4 w-4" />}
          >
            Try this in the ALU
          </Button>
        </div>
      </div>

      {/* Computation Result View */}
      {!computeResult.ok ? (
        <div role="alert" className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300">
          <span className="font-bold">Error:</span> {computeResult.error}
        </div>
      ) : computeResult.binaryRes ? (
        <div className="space-y-4">
          {/* Status Flags Panel */}
          <BinaryFlagsCard
            flags={computeResult.binaryRes.flags}
            overflowExplanation={computeResult.binaryRes.overflowExplanation}
          />

          {/* Results Summary */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Result</h4>
            <p className="font-mono text-lg font-bold text-blue-600 dark:text-blue-400">
              {formatBitsWithEnds(computeResult.binaryRes.resultBits)}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
              Unsigned value: <span className="font-mono font-semibold">{computeResult.binaryRes.unsignedValue}</span> | Signed (2&apos;s complement): <span className="font-mono font-semibold">{computeResult.binaryRes.signedValue}</span>
            </p>
          </div>

          {/* Carry Chain Grid (MSB Left) */}
          <BinaryCarryTable carryChain={computeResult.binaryRes.carryChain} width={width} />
        </div>
      ) : (
        <NonTwosComplementResultView
          onesRes={computeResult.onesRes}
          smRes={computeResult.smRes}
        />
      )}
    </div>
  );
};
