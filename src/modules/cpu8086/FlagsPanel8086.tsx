/**
 * @file FlagsPanel8086.tsx
 * Displays the 8086 CPU status flags (ZF, CF, SF, OF, IF, TF) with educational descriptions,
 * "undefined" shown as the word, and the subtraction borrow convention notice.
 */

import { type FC, useMemo } from 'react';
import type { CpuFlags, FlagChange } from '../../engine/cpu8086/cpuTypes';

export interface FlagsPanel8086Props {
  readonly flags: CpuFlags | null;
  readonly lastChanges?: readonly FlagChange[];
  readonly faultMessage?: string | null;
  readonly useInterruptDescriptions?: boolean;
  readonly className?: string;
}

interface FlagDescriptor {
  readonly key: keyof CpuFlags;
  readonly label: string;
  readonly fullName: string;
  readonly description: string;
}

const FLAG_DESCRIPTORS: readonly FlagDescriptor[] = [
  { key: 'Z', label: 'ZF', fullName: 'Zero Flag', description: 'Set (1) if arithmetic or logic result is zero' },
  { key: 'C', label: 'CF', fullName: 'Carry / Borrow', description: 'Set (1) on unsigned overflow or subtraction borrow' },
  { key: 'S', label: 'SF', fullName: 'Sign Flag', description: 'Copy of result MSB (1 if negative in two’s complement)' },
  { key: 'O', label: 'OF', fullName: 'Overflow Flag', description: 'Set (1) on signed two’s complement overflow' },
  { key: 'I', label: 'IF', fullName: 'Interrupt Flag', description: 'Reserved (enabled/disabled interrupt handling)' },
  { key: 'T', label: 'TF', fullName: 'Trap Flag', description: 'Reserved (single-step debug trap)' },
];

export const FlagsPanel8086: FC<FlagsPanel8086Props> = ({
  flags,
  lastChanges = [],
  faultMessage,
  useInterruptDescriptions = false,
  className = '',
}) => {
  const descriptors = useMemo(() => {
    if (!useInterruptDescriptions) return FLAG_DESCRIPTORS;
    return FLAG_DESCRIPTORS.map((d) => {
      if (d.key === 'I') {
        return { ...d, description: '1: INTR interrupts recognized; 0: INTR masked' };
      }
      if (d.key === 'T') {
        return { ...d, description: '1: Single-step trap fires after each instruction' };
      }
      return d;
    });
  }, [useInterruptDescriptions]);
  const changedSet = useMemo(() => {
    const s = new Set<string>();
    for (const fc of lastChanges) {
      s.add(fc.name);
    }
    return s;
  }, [lastChanges]);

  if (!flags) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status Flags</h3>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 italic">Assemble a program to view flag state.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 dark:border-gray-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status Flags</h3>
        <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
          ZF:{String(flags.Z)} CF:{String(flags.C)} SF:{String(flags.S)} OF:{String(flags.O)}
        </span>
      </div>

      {/* Flags Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3">
        {descriptors.map((desc) => {
          const val = flags[desc.key];
          const isChanged = changedSet.has(desc.key);
          const isUndefined = val === 'undefined';

          return (
            <div
              key={desc.key}
              className={`rounded-lg border p-2.5 transition-colors ${
                isUndefined
                  ? 'border-amber-300 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30'
                  : isChanged
                    ? 'border-blue-300 bg-blue-50/80 dark:border-blue-800 dark:bg-blue-950/30'
                    : 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-gray-800 dark:text-gray-200">
                  {desc.label}
                </span>
                <span
                  className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                    isUndefined
                      ? 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
                      : val === 1
                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {isUndefined ? 'undefined' : val}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">
                {desc.fullName}
              </div>
              {isChanged && (
                <div className="mt-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  changed
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fault Alert if undefined flag branch attempted */}
      {faultMessage && (
        <div role="alert" className="border-t border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          <strong>Fault:</strong> {faultMessage}
        </div>
      )}

      {/* Convention notice */}
      <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-2 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-900/30">
        <p className="font-mono">CF = borrow on subtraction (8086)</p>
      </div>
    </div>
  );
};
