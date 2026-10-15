/**
 * @file RegisterPanel.tsx
 * Displays the 8086 register file as a real HTML table with 16-bit and 8-bit views,
 * change markers with text, IP instruction display, and initial state editing.
 */

import { type FC, useMemo, useState } from 'react';
import type { CpuState, RegisterChange } from '../../engine/cpu8086/cpuTypes';
import { getReg, is16BitRegister } from '../../engine/cpu8086/registers';
import type { Program, RegisterName } from '../../engine/cpu8086/types';
import { Button } from '../../components/ui/Button';

export interface RegisterPanelProps {
  readonly cpuState: CpuState | null;
  readonly lastChanges?: readonly RegisterChange[];
  readonly program?: Program | null;
  readonly onSetRegister?: (name: RegisterName, value: number) => void;
  readonly className?: string;
}

type RegRow = {
  readonly name16: RegisterName;
  readonly high?: RegisterName;
  readonly low?: RegisterName;
};

const REGISTER_ROWS: readonly RegRow[] = [
  { name16: 'AX', high: 'AH', low: 'AL' },
  { name16: 'BX', high: 'BH', low: 'BL' },
  { name16: 'CX', high: 'CH', low: 'CL' },
  { name16: 'DX', high: 'DH', low: 'DL' },
  { name16: 'SI' },
  { name16: 'DI' },
  { name16: 'SP' },
  { name16: 'IP' },
];

function formatHex16(v: number): string {
  return '0x' + (v & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function formatHex8(v: number): string {
  return '0x' + (v & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

function formatBin16(v: number): string {
  return (v & 0xffff).toString(2).padStart(16, '0');
}

export const RegisterPanel: FC<RegisterPanelProps> = ({
  cpuState,
  lastChanges = [],
  program,
  onSetRegister,
  className = '',
}) => {
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editReg, setEditReg] = useState<RegisterName>('AX');
  const [editValueStr, setEditValueStr] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);

  const changesByName = useMemo(() => {
    const map = new Map<RegisterName, RegisterChange>();
    for (const rc of lastChanges) {
      map.set(rc.name, rc);
    }
    return map;
  }, [lastChanges]);

  const ipInfo = useMemo(() => {
    if (!cpuState || !program) return null;
    const ip = cpuState.registers.IP;
    const inst = program.instructions[ip];
    if (!inst) return null;
    return `Line ${inst.sourceLine}: ${inst.sourceText}`;
  }, [cpuState, program]);

  const handleApplyEdit = () => {
    setEditError(null);
    const cleaned = editValueStr.trim();
    if (!cleaned) {
      setEditError('Enter a hex or decimal number.');
      return;
    }
    const val = cleaned.startsWith('0x') || cleaned.startsWith('0X')
      ? parseInt(cleaned.slice(2), 16)
      : /^[0-9A-Fa-f]+$/.test(cleaned) && /[A-Fa-f]/.test(cleaned)
        ? parseInt(cleaned, 16)
        : parseInt(cleaned, 10);

    if (Number.isNaN(val) || val < 0) {
      setEditError('Invalid initial-state edit: must be a positive integer.');
      return;
    }
    const maxVal = is16BitRegister(editReg) ? 0xffff : 0xff;
    if (val > maxVal) {
      setEditError(`Value out of range (max ${formatHex16(maxVal)}).`);
      return;
    }

    onSetRegister?.(editReg, val);
    setEditValueStr('');
    setEditError(null);
  };

  if (!cpuState) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Registers</h3>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 italic">Assemble a program to view register state.</p>
      </div>
    );
  }

  const regs = cpuState.registers;

  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 dark:border-gray-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Register File</h3>
        {onSetRegister && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsEditMode(!isEditMode);
              setEditError(null);
            }}
            aria-label="Toggle set initial register state mode"
          >
            {isEditMode ? 'Done' : 'Set initial state'}
          </Button>
        )}
      </div>

      {isEditMode && (
        <div className="p-3 bg-amber-50/70 border-b border-amber-200 dark:border-amber-900/50 dark:bg-amber-950/20 text-xs space-y-2">
          <p className="text-[11px] text-amber-800 dark:text-amber-300">
            <strong>Note:</strong> Editing register values resets execution history.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="edit-reg-name" className="sr-only">Select Register</label>
            <select
              id="edit-reg-name"
              value={editReg}
              onChange={(e) => setEditReg(e.target.value as RegisterName)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              {REGISTER_ROWS.map((r) => (
                <option key={r.name16} value={r.name16}>{r.name16}</option>
              ))}
              <option value="AL">AL</option>
              <option value="AH">AH</option>
              <option value="BL">BL</option>
              <option value="BH">BH</option>
              <option value="CL">CL</option>
              <option value="CH">CH</option>
              <option value="DL">DL</option>
              <option value="DH">DH</option>
            </select>

            <label htmlFor="edit-reg-value" className="sr-only">Register Value</label>
            <input
              id="edit-reg-value"
              type="text"
              placeholder="Hex value (e.g. 0x1A)"
              value={editValueStr}
              onChange={(e) => setEditValueStr(e.target.value)}
              className="w-32 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <Button variant="primary" size="sm" onClick={handleApplyEdit}>
              Set
            </Button>
          </div>
          {editError && (
            <p className="text-[11px] font-semibold text-red-600 dark:text-red-400" role="alert">
              {editError}
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs" aria-label="8086 Register values">
          <caption className="sr-only">
            Values of the 8086 registers in hex, decimal, and binary, with changed markers.
          </caption>
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
              <th scope="col" className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">Reg</th>
              <th scope="col" className="px-2 py-1.5 text-right font-semibold text-gray-500 dark:text-gray-400">Hex</th>
              <th scope="col" className="px-2 py-1.5 text-right font-semibold text-gray-500 dark:text-gray-400">Dec</th>
              <th scope="col" className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">High / Low</th>
              <th scope="col" className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">Binary</th>
              <th scope="col" className="px-2 py-1.5 text-left font-semibold text-gray-500 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {REGISTER_ROWS.map((row) => {
              const val16 = getReg(regs, row.name16);
              const change16 = changesByName.get(row.name16);
              const changeHi = row.high ? changesByName.get(row.high) : undefined;
              const changeLo = row.low ? changesByName.get(row.low) : undefined;
              const isChanged = !!(change16 || changeHi || changeLo);

              return (
                <tr
                  key={row.name16}
                  className={
                    isChanged
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                  }
                >
                  <td className="px-2 py-1 font-mono font-bold text-gray-900 dark:text-gray-100">
                    {row.name16}
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-gray-800 dark:text-gray-200">
                    {formatHex16(val16)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono text-gray-600 dark:text-gray-400">
                    {val16}
                  </td>
                  <td className="px-2 py-1 font-mono text-gray-500 dark:text-gray-400">
                    {row.high && row.low ? (
                      <span>
                        {row.high}: {formatHex8(getReg(regs, row.high))} | {row.low}: {formatHex8(getReg(regs, row.low))}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-2 py-1 font-mono text-[10px] text-gray-400 dark:text-gray-500 tracking-wider">
                    {formatBin16(val16)}
                  </td>
                  <td className="px-2 py-1 text-[11px]">
                    {row.name16 === 'IP' && ipInfo ? (
                      <span className="font-mono text-amber-700 dark:text-amber-300">
                        {ipInfo}
                      </span>
                    ) : isChanged ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                        <span>changed</span>
                        {change16 && (
                          <span className="text-[10px] text-gray-400">
                            (was {formatHex16(change16.old)})
                          </span>
                        )}
                        {!change16 && changeLo && (
                          <span className="text-[10px] text-gray-400">
                            ({row.low} was {formatHex8(changeLo.old)})
                          </span>
                        )}
                        {!change16 && changeHi && (
                          <span className="text-[10px] text-gray-400">
                            ({row.high} was {formatHex8(changeHi.old)})
                          </span>
                        )}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
