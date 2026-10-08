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
  while (rem.length > 4) {
    parts.unshift(rem.slice(-4));
    rem = rem.slice(0, -4);
  }
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
    if (/^[01]+$/.test(clean) && clean.length === targetWidth) {
      return clean;
    }
    const parsed = parseInt(clean, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
    return clean;
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
              const val = e.target.value;
              setOperandA(val);
              notifyChange(val, operandB, width, mode, operation);
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
              const val = e.target.value;
              setOperandB(val);
              notifyChange(operandA, val, width, mode, operation);
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

      {/* Computation Result View */}
      {!computeResult.ok ? (
        <div role="alert" className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300">
          <span className="font-bold">Error:</span> {computeResult.error}
        </div>
      ) : computeResult.binaryRes ? (
        <div className="space-y-4">
          {/* Status Flags Panel */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Condition Flags</h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-sm font-mono">
              <div className={`p-2.5 rounded-lg border ${computeResult.binaryRes.flags.C === 1 ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40' : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40'}`}>
                <div className="text-xs font-sans text-gray-500 dark:text-gray-400">C (carry)</div>
                <div className="text-base font-bold text-gray-900 dark:text-gray-100">C: {computeResult.binaryRes.flags.C}</div>
              </div>
              <div className={`p-2.5 rounded-lg border ${computeResult.binaryRes.flags.borrow === 1 ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40' : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40'}`}>
                <div className="text-xs font-sans text-gray-500 dark:text-gray-400">Borrow (8086 convention)</div>
                <div className="text-base font-bold text-gray-900 dark:text-gray-100">Borrow: {computeResult.binaryRes.flags.borrow}</div>
              </div>
              <div className={`p-2.5 rounded-lg border ${computeResult.binaryRes.flags.N === 1 ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/40' : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40'}`}>
                <div className="text-xs font-sans text-gray-500 dark:text-gray-400">N (negative)</div>
                <div className="text-base font-bold text-gray-900 dark:text-gray-100">N: {computeResult.binaryRes.flags.N}</div>
              </div>
              <div className={`p-2.5 rounded-lg border ${computeResult.binaryRes.flags.Z === 1 ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/40' : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40'}`}>
                <div className="text-xs font-sans text-gray-500 dark:text-gray-400">Z (zero)</div>
                <div className="text-base font-bold text-gray-900 dark:text-gray-100">Z: {computeResult.binaryRes.flags.Z}</div>
              </div>
              <div className={`p-2.5 rounded-lg border ${computeResult.binaryRes.flags.V === 1 ? 'border-red-400 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200' : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40'}`}>
                <div className="text-xs font-sans text-gray-500 dark:text-gray-400">V (overflow)</div>
                <div className="text-base font-bold">V (overflow): {computeResult.binaryRes.flags.V}</div>
              </div>
            </div>

            {computeResult.binaryRes.overflowExplanation && (
              <div role="status" className="mt-3 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                <span className="font-bold">Explanation:</span> {computeResult.binaryRes.overflowExplanation}
              </div>
            )}
          </div>

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
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs overflow-x-auto">
            <table className="w-full text-center text-sm font-mono border-collapse" aria-label="Binary carry chain">
              <caption className="sr-only">Binary arithmetic carry chain with bit-by-bit stages</caption>
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                  <th scope="row" className="px-3 py-2 text-left">Bit Position</th>
                  {computeResult.binaryRes.carryChain.slice().reverse().map((step) => (
                    <th key={step.position} scope="col" className="px-2 py-2">
                      Bit {step.position} {step.position === width - 1 ? '(MSB)' : step.position === 0 ? '(LSB)' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                <tr>
                  <th scope="row" className="px-3 py-1.5 text-left font-sans text-xs text-gray-500">Carry In</th>
                  {computeResult.binaryRes.carryChain.slice().reverse().map((s) => (
                    <td key={s.position} className="px-2 py-1.5 text-gray-500">{s.carryIn}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className="px-3 py-1.5 text-left font-sans text-xs text-gray-700 dark:text-gray-300 font-semibold">A</th>
                  {computeResult.binaryRes.carryChain.slice().reverse().map((s) => (
                    <td key={s.position} className="px-2 py-1.5 font-bold text-gray-900 dark:text-gray-100">{s.a}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className="px-3 py-1.5 text-left font-sans text-xs text-gray-700 dark:text-gray-300 font-semibold">B</th>
                  {computeResult.binaryRes.carryChain.slice().reverse().map((s) => (
                    <td key={s.position} className="px-2 py-1.5 font-bold text-gray-900 dark:text-gray-100">{s.b}</td>
                  ))}
                </tr>
                <tr className="bg-blue-50/50 dark:bg-blue-900/20 font-bold">
                  <th scope="row" className="px-3 py-1.5 text-left font-sans text-xs text-blue-800 dark:text-blue-300">Sum (S)</th>
                  {computeResult.binaryRes.carryChain.slice().reverse().map((s) => (
                    <td key={s.position} className="px-2 py-1.5 text-blue-600 dark:text-blue-400 font-bold">{s.sum}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className="px-3 py-1.5 text-left font-sans text-xs text-gray-500">Carry Out</th>
                  {computeResult.binaryRes.carryChain.slice().reverse().map((s) => (
                    <td key={s.position} className="px-2 py-1.5 text-gray-500">{s.carryOut}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : computeResult.onesRes ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">One&apos;s Complement Addition Result</h4>
          <p className="font-mono text-base font-bold text-blue-600 dark:text-blue-400">
            {formatBitsWithEnds((computeResult.onesRes as { finalBits: string }).finalBits)}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Initial Sum: <span className="font-mono">{(computeResult.onesRes as { initialSumBits: string }).initialSumBits}</span> | End-around carry: <span className="font-mono">{(computeResult.onesRes as { endAroundCarry: number }).endAroundCarry}</span> | Value: <span className="font-mono">{(computeResult.onesRes as { finalValue: number }).finalValue}</span>
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Sign-Magnitude Addition Result</h4>
          <p className="font-mono text-base font-bold text-blue-600 dark:text-blue-400">
            {formatBitsWithEnds((computeResult.smRes as { resultBits: string }).resultBits)}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Sign: <span className="font-mono">{(computeResult.smRes as { resultSign: number }).resultSign}</span> | Magnitude: <span className="font-mono">{(computeResult.smRes as { resultMag: number }).resultMag}</span> | Overflow: <span className="font-mono">{String((computeResult.smRes as { overflow: boolean }).overflow)}</span>
          </p>
        </div>
      )}
    </div>
  );
};
