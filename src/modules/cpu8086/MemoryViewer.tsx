/**
 * @file MemoryViewer.tsx
 * Virtualized 64 KB memory hex dump table with word view toggle,
 * jump navigation, pointer register markers, and inline byte editing.
 */

import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Memory, MemoryWrite } from '../../engine/cpu8086/memory';
import { readByte, readWord } from '../../engine/cpu8086/memory';
import type { CpuState } from '../../engine/cpu8086/cpuTypes';
import type { Program } from '../../engine/cpu8086/types';
import { Button } from '../../components/ui/Button';

export interface MemoryViewerProps {
  readonly memory: Memory | null;
  readonly lastWrites?: readonly MemoryWrite[];
  readonly cpuState?: CpuState | null;
  readonly program?: Program | null;
  readonly onEditByte?: (address: number, value: number) => void;
  readonly highlightIvt?: boolean;
  readonly className?: string;
}

const BYTES_PER_ROW = 16;
const TOTAL_ROWS = 4096; // 64 KB / 16 bytes
const VISIBLE_ROWS = 16; // Fixed virtual window size for fast rendering

function formatHex16(v: number): string {
  return '0x' + (v & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function formatHex8(v: number): string {
  return (v & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

export const MemoryViewer: FC<MemoryViewerProps> = ({
  memory,
  lastWrites = [],
  cpuState,
  program,
  onEditByte,
  highlightIvt = false,
  className = '',
}) => {
  const [startRow, setStartRow] = useState<number>(0);
  const [isWordView, setIsWordView] = useState<boolean>(false);
  const [gotoQuery, setGotoQuery] = useState<string>('');
  const [gotoError, setGotoError] = useState<string | null>(null);

  const [editingAddr, setEditingAddr] = useState<number | null>(null);
  const [editValStr, setEditValStr] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingAddr !== null) {
      editInputRef.current?.focus();
    }
  }, [editingAddr]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (!activeEl || !containerRef.current?.contains(activeEl)) return;
      if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') return;

      if (e.key === 'PageDown') {
        e.preventDefault();
        setStartRow((r) => Math.min(TOTAL_ROWS - VISIBLE_ROWS, r + VISIBLE_ROWS));
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        setStartRow((r) => Math.max(0, r - VISIBLE_ROWS));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setStartRow(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setStartRow(TOTAL_ROWS - VISIBLE_ROWS);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const writtenSet = useMemo(() => {
    const s = new Set<number>();
    for (const w of lastWrites) s.add(w.address);
    return s;
  }, [lastWrites]);

  const pointerAddrs = useMemo(() => {
    if (!cpuState) return {};
    return {
      bx: cpuState.registers.BX,
      si: cpuState.registers.SI,
      di: cpuState.registers.DI,
      sp: cpuState.registers.SP,
    };
  }, [cpuState]);

  const jumpToAddress = useCallback((targetAddr: number) => {
    const clamped = Math.max(0, Math.min(0xffff, targetAddr));
    const targetRow = Math.floor(clamped / BYTES_PER_ROW);
    const maxStartRow = TOTAL_ROWS - VISIBLE_ROWS;
    setStartRow(Math.max(0, Math.min(maxStartRow, targetRow)));
    setGotoError(null);
  }, []);

  const handleGotoSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setGotoError(null);
    const q = gotoQuery.trim();
    if (!q) return;

    const lower = q.toLowerCase();
    if (lower === 'sp' && pointerAddrs.sp !== undefined) {
      jumpToAddress(pointerAddrs.sp);
      return;
    }
    if (lower === 'bx' && pointerAddrs.bx !== undefined) {
      jumpToAddress(pointerAddrs.bx);
      return;
    }
    if (lower === 'si' && pointerAddrs.si !== undefined) {
      jumpToAddress(pointerAddrs.si);
      return;
    }
    if (lower === 'di' && pointerAddrs.di !== undefined) {
      jumpToAddress(pointerAddrs.di);
      return;
    }

    if (program?.symbols && program.symbols[q]) {
      jumpToAddress(program.symbols[q]?.address ?? 0);
      return;
    }

    const hexVal = q.startsWith('0x') || q.startsWith('0X')
      ? parseInt(q.slice(2), 16)
      : /^[0-9A-Fa-f]+$/.test(q)
        ? parseInt(q, 16)
        : parseInt(q, 10);

    if (!Number.isNaN(hexVal) && hexVal >= 0 && hexVal <= 0xffff) {
      jumpToAddress(hexVal);
    } else {
      setGotoError(`Cannot resolve address or symbol '${q}'.`);
    }
  };

  const handleSaveByte = (addr: number) => {
    setEditError(null);
    const cleaned = editValStr.trim();
    const val = cleaned.startsWith('0x') || cleaned.startsWith('0X')
      ? parseInt(cleaned.slice(2), 16)
      : parseInt(cleaned, 16);

    if (Number.isNaN(val) || val < 0 || val > 0xff) {
      setEditError('Must be a hex byte between 0x00 and 0xFF.');
      return;
    }
    onEditByte?.(addr, val);
    setEditingAddr(null);
    setEditValStr('');
  };

  const rows = useMemo(() => {
    if (!memory) return [];
    const list: { addr: number; bytes: number[] }[] = [];
    for (let i = 0; i < VISIBLE_ROWS; i++) {
      const rowIdx = startRow + i;
      if (rowIdx >= TOTAL_ROWS) break;
      const addr = rowIdx * BYTES_PER_ROW;
      const bytes: number[] = [];
      for (let b = 0; b < BYTES_PER_ROW; b++) {
        bytes.push(readByte(memory, addr + b));
      }
      list.push({ addr, bytes });
    }
    return list;
  }, [memory, startRow]);

  if (!memory) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Memory</h3>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 italic">Assemble a program to view memory contents.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="64 KB memory hex dump viewer with keyboard navigation (PageUp, PageDown, Home, End)"
      className={`rounded-xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 overflow-hidden ${className}`}
    >
      {/* Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900 text-xs">
        <div className="flex items-center gap-1.5">
          <form onSubmit={handleGotoSubmit} className="flex items-center gap-1">
            <label htmlFor="goto-address" className="font-semibold text-gray-600 dark:text-gray-300">Go to:</label>
            <input
              id="goto-address"
              type="text"
              placeholder="hex, label, SP"
              value={gotoQuery}
              onChange={(e) => setGotoQuery(e.target.value)}
              className="w-24 rounded border border-gray-300 px-1.5 py-0.5 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
            <Button variant="secondary" size="sm" type="submit">Go</Button>
          </form>

          <Button variant="ghost" size="sm" onClick={() => jumpToAddress(0x0000)}>Start</Button>
          {highlightIvt && (
            <Button variant="ghost" size="sm" onClick={() => jumpToAddress(0x0000)}>IVT</Button>
          )}
          {pointerAddrs.sp !== undefined && (
            <Button variant="ghost" size="sm" onClick={() => jumpToAddress(pointerAddrs.sp!)}>SP</Button>
          )}
          {program && Object.keys(program.symbols).length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => jumpToAddress(Object.values(program.symbols)[0]?.address ?? 0x0100)}>
              Data
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsWordView(!isWordView)}
            aria-label="Toggle between byte view and little-endian word view"
          >
            {isWordView ? 'Byte View' : 'Word View'}
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStartRow((r) => Math.max(0, r - VISIBLE_ROWS))}
              aria-label="Previous memory page"
            >
              ▲
            </Button>
            <span className="font-mono text-[11px] text-gray-400">
              {formatHex16(startRow * BYTES_PER_ROW)} - {formatHex16((startRow + VISIBLE_ROWS) * BYTES_PER_ROW - 1)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStartRow((r) => Math.min(TOTAL_ROWS - VISIBLE_ROWS, r + VISIBLE_ROWS))}
              aria-label="Next memory page"
            >
              ▼
            </Button>
          </div>
        </div>
      </div>

      {gotoError && (
        <div className="bg-red-50 px-3 py-1 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400" role="alert">
          {gotoError}
        </div>
      )}

      {/* Hex Dump Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono" aria-label="64 KB memory hex dump">
          <caption className="sr-only">
            {isWordView
              ? 'Memory dump in 16-bit little-endian words. Lower address contains least significant byte.'
              : 'Memory dump in 8-bit bytes with ASCII representation and pointer markers.'}
          </caption>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70 text-gray-500 dark:border-gray-800 dark:bg-gray-900/50">
              <th scope="col" className="px-2 py-1 text-left font-semibold">Address</th>
              {isWordView ? (
                <>
                  <th scope="col" className="px-2 py-1 text-center font-semibold">+0</th>
                  <th scope="col" className="px-2 py-1 text-center font-semibold">+2</th>
                  <th scope="col" className="px-2 py-1 text-center font-semibold">+4</th>
                  <th scope="col" className="px-2 py-1 text-center font-semibold">+6</th>
                  <th scope="col" className="px-2 py-1 text-center font-semibold">+8</th>
                  <th scope="col" className="px-2 py-1 text-center font-semibold">+A</th>
                  <th scope="col" className="px-2 py-1 text-center font-semibold">+C</th>
                  <th scope="col" className="px-2 py-1 text-center font-semibold">+E</th>
                </>
              ) : (
                Array.from({ length: 16 }).map((_, col) => (
                  <th key={col} scope="col" className="px-1.5 py-1 text-center font-semibold">
                    {col.toString(16).toUpperCase()}
                  </th>
                ))
              )}
              {!isWordView && <th scope="col" className="px-2 py-1 text-left font-semibold">ASCII</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {rows.map((row) => (
              <tr key={row.addr} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/30">
                <th scope="row" className="px-2 py-1 text-left font-bold text-gray-700 dark:text-gray-300">
                  {formatHex16(row.addr)}
                  {highlightIvt && row.addr < 0x0400 && (
                    <span className="ml-1 text-[9px] font-semibold text-purple-600 dark:text-purple-400">[IVT]</span>
                  )}
                </th>

                {isWordView ? (
                  Array.from({ length: 8 }).map((_, wIdx) => {
                    const wAddr = row.addr + wIdx * 2;
                    const wordVal = readWord(memory, wAddr);
                    const isWritten = writtenSet.has(wAddr) || writtenSet.has(wAddr + 1);

                    return (
                      <td
                        key={wAddr}
                        className={`px-2 py-1 text-center ${
                          isWritten ? 'font-bold text-blue-600 bg-blue-50/60 dark:bg-blue-900/30' : 'text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {formatHex16(wordVal).slice(2)}
                        {isWritten && <span className="sr-only">written</span>}
                      </td>
                    );
                  })
                ) : (
                  row.bytes.map((byte, colIdx) => {
                    const byteAddr = row.addr + colIdx;
                    const isWritten = writtenSet.has(byteAddr);
                    const isBx = pointerAddrs.bx === byteAddr;
                    const isSi = pointerAddrs.si === byteAddr;
                    const isDi = pointerAddrs.di === byteAddr;
                    const isSp = pointerAddrs.sp === byteAddr;

                    return (
                      <td
                        key={byteAddr}
                        tabIndex={0}
                        onClick={() => {
                          setEditingAddr(byteAddr);
                          setEditValStr(formatHex8(byte));
                          setEditError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setEditingAddr(byteAddr);
                            setEditValStr(formatHex8(byte));
                            setEditError(null);
                          }
                        }}
                        className={`relative px-1.5 py-1 text-center cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 ${
                          isWritten ? 'font-bold text-blue-600 bg-blue-50/70 dark:bg-blue-900/30' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <span>{formatHex8(byte)}</span>
                        {isWritten && <span className="sr-only">written</span>}
                        {isBx && <span className="absolute -top-1 right-0 text-[8px] font-bold text-purple-600" title="[BX]">[BX]</span>}
                        {isSi && <span className="absolute -top-1 right-0 text-[8px] font-bold text-green-600" title="[SI]">[SI]</span>}
                        {isDi && <span className="absolute -top-1 right-0 text-[8px] font-bold text-indigo-600" title="[DI]">[DI]</span>}
                        {isSp && <span className="absolute -top-1 right-0 text-[8px] font-bold text-rose-600" title="SP">SP</span>}
                      </td>
                    );
                  })
                )}

                {!isWordView && (
                  <td className="px-2 py-1 text-left text-gray-400 dark:text-gray-500 tracking-wider">
                    {row.bytes.map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('')}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Word View Caption */}
      {isWordView && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-1 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-900/30">
          Little-endian: lower address contains least significant byte.
        </div>
      )}

      {/* Inline Byte Edit Modal / Dialog */}
      {editingAddr !== null && (
        <div
          role="dialog"
          aria-labelledby="edit-byte-heading"
          className="p-3 bg-amber-50 border-t border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 flex flex-wrap items-center gap-2 text-xs"
        >
          <span id="edit-byte-heading" className="font-semibold text-amber-900 dark:text-amber-200">
            Edit byte at {formatHex16(editingAddr)}:
          </span>
          <input
            ref={editInputRef}
            type="text"
            value={editValStr}
            onChange={(e) => setEditValStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveByte(editingAddr);
              if (e.key === 'Escape') setEditingAddr(null);
            }}
            placeholder="Hex byte (e.g. 2A)"
            className="w-20 rounded border border-gray-300 px-2 py-0.5 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <Button variant="primary" size="sm" onClick={() => handleSaveByte(editingAddr)}>Save</Button>
          <Button variant="secondary" size="sm" onClick={() => setEditingAddr(null)}>Cancel</Button>
          {editError && <span className="text-red-600 dark:text-red-400 font-semibold">{editError}</span>}
        </div>
      )}
    </div>
  );
};
