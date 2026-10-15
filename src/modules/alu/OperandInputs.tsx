/**
 * @file OperandInputs.tsx
 * Interactive form controls for ALU operation, bit width, and synchronized operand representations.
 */

import { type FC, type ChangeEvent } from 'react';
import type { AluOpId } from '../../types/designProject';
import { maxValueForWidth, toBinaryString } from '../../engine/common/bitUtils';
import { Button } from '../../components/ui/Button';

export type AluWidth = 4 | 8;

export interface OperandInputsProps {
  readonly op: AluOpId;
  readonly width: AluWidth;
  readonly a: number;
  readonly b: number;
  readonly shiftCount?: number;
  readonly onOpChange: (op: AluOpId) => void;
  readonly onWidthChange: (width: AluWidth) => void;
  readonly onAChange: (a: number) => void;
  readonly onBChange: (b: number) => void;
  readonly onShiftCountChange?: (count: number) => void;
  readonly onRandomize: () => void;
}

const ALU_OPS: { id: AluOpId; label: string; group: 'Arithmetic' | 'Logic' | 'Shift / Rotate' }[] = [
  { id: 'ADD', label: 'ADD (Addition)', group: 'Arithmetic' },
  { id: 'SUB', label: 'SUB (Subtraction with borrow)', group: 'Arithmetic' },
  { id: 'CMP', label: 'CMP (Compare: A - B, flags only)', group: 'Arithmetic' },
  { id: 'INC', label: 'INC (Increment A by 1)', group: 'Arithmetic' },
  { id: 'DEC', label: 'DEC (Decrement A by 1)', group: 'Arithmetic' },
  { id: 'AND', label: 'AND (Bitwise AND)', group: 'Logic' },
  { id: 'OR', label: 'OR (Bitwise OR)', group: 'Logic' },
  { id: 'XOR', label: 'XOR (Bitwise XOR)', group: 'Logic' },
  { id: 'NOT', label: 'NOT (One’s complement bitwise NOT)', group: 'Logic' },
  { id: 'SHL', label: 'SHL (Shift Left Logical)', group: 'Shift / Rotate' },
  { id: 'SHR', label: 'SHR (Shift Right Logical)', group: 'Shift / Rotate' },
  { id: 'SAR', label: 'SAR (Shift Right Arithmetic)', group: 'Shift / Rotate' },
  { id: 'ROL', label: 'ROL (Rotate Left)', group: 'Shift / Rotate' },
  { id: 'ROR', label: 'ROR (Rotate Right)', group: 'Shift / Rotate' },
];

function formatNibble(binStr: string): string {
  const parts: string[] = [];
  for (let i = 0; i < binStr.length; i += 4) {
    parts.push(binStr.slice(i, i + 4));
  }
  return parts.join(' ');
}

export const OperandInputs: FC<OperandInputsProps> = ({
  op,
  width,
  a,
  b,
  shiftCount = 1,
  onOpChange,
  onWidthChange,
  onAChange,
  onBChange,
  onShiftCountChange,
  onRandomize,
}) => {
  const maxVal = maxValueForWidth(width);
  const isUnary = op === 'NOT' || op === 'INC' || op === 'DEC';
  const isShift = ['SHL', 'SHR', 'SAR', 'ROL', 'ROR'].includes(op);

  const handleAChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const raw = parseInt(e.target.value, 10);
    if (!Number.isNaN(raw)) {
      onAChange(Math.max(0, Math.min(maxVal, raw)));
    }
  };

  const handleBChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const raw = parseInt(e.target.value, 10);
    if (!Number.isNaN(raw)) {
      onBChange(Math.max(0, Math.min(maxVal, raw)));
    }
  };

  const handleShiftChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    const cnt = parseInt(e.target.value, 10);
    if (onShiftCountChange && !Number.isNaN(cnt)) {
      onShiftCountChange(cnt);
    }
  };

  const aBin = toBinaryString(a, width);
  const bBin = toBinaryString(b, width);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
          ALU Control & Operands
        </h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">
            <span>Width:</span>
            <select
              aria-label="ALU Bit Width"
              value={width}
              onChange={(e) => onWidthChange(Number(e.target.value) as AluWidth)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value={4}>4-bit slice</option>
              <option value={8}>8-bit byte</option>
            </select>
          </label>

          <Button variant="secondary" size="sm" onClick={onRandomize}>
            Randomize
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor="alu-op-select"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300"
          >
            Operation (AluOpId)
          </label>
          <select
            id="alu-op-select"
            aria-label="ALU Operation"
            value={op}
            onChange={(e) => onOpChange(e.target.value as AluOpId)}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            {ALU_OPS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="alu-operand-a"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300"
          >
            Operand A (0..{maxVal})
          </label>
          <input
            id="alu-operand-a"
            type="number"
            min={0}
            max={maxVal}
            value={a}
            onChange={handleAChange}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <div className="mt-1 flex items-center justify-between text-xs text-gray-500 font-mono">
            <span>(MSB) {formatNibble(aBin)} (LSB)</span>
            <span>0x{a.toString(16).toUpperCase()}</span>
          </div>
        </div>

        <div>
          {isUnary ? (
            <div className="rounded-md border border-dashed border-gray-200 p-3 text-center text-xs text-gray-400 dark:border-gray-800">
              Unary operation — Operand B not used
            </div>
          ) : isShift ? (
            <div>
              <label
                htmlFor="alu-shift-count"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300"
              >
                Shift Count (1..{width})
              </label>
              <select
                id="alu-shift-count"
                value={shiftCount}
                onChange={handleShiftChange}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                {Array.from({ length: width }, (_, i) => i + 1).map((cnt) => (
                  <option key={cnt} value={cnt}>
                    {cnt} bit{cnt > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label
                htmlFor="alu-operand-b"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300"
              >
                Operand B (0..{maxVal})
              </label>
              <input
                id="alu-operand-b"
                type="number"
                min={0}
                max={maxVal}
                value={b}
                onChange={handleBChange}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <div className="mt-1 flex items-center justify-between text-xs text-gray-500 font-mono">
                <span>(MSB) {formatNibble(bBin)} (LSB)</span>
                <span>0x{b.toString(16).toUpperCase()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
