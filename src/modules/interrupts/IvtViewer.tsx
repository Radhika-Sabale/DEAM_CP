/**
 * @file IvtViewer.tsx
 * Interactive inspection table for the 8086 Interrupt Vector Table (IVT).
 *
 * Shows all 256 vectors (0x0000 - 0x03FF), their calculation (n * 4),
 * decoded CS:IP handler targets, installed vs unset status, and architectural categories.
 */

import { type FC, useMemo, useState } from 'react';
import type { Memory } from '../../engine/cpu8086/memory';
import { readByte } from '../../engine/cpu8086/memory';
import type { Program } from '../../engine/cpu8086/types';
import { listVectors, RESERVED_VECTOR_NAMES, type IvtEntry } from '../../engine/interrupts';
import { Button } from '../../components/ui/Button';

export interface IvtViewerProps {
  readonly memory: Memory | null;
  readonly program?: Program | null;
  readonly onSelectVector?: (vector: number, address: number) => void;
  readonly onJumpToHandler?: (handlerIp: number) => void;
  readonly className?: string;
}

type FilterMode = 'all' | 'installed' | 'dedicated';

function formatHex16(v: number): string {
  return '0x' + (v & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function formatHex8(v: number): string {
  return '0x' + (v & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

export const IvtViewer: FC<IvtViewerProps> = ({
  memory,
  program,
  onSelectVector,
  onJumpToHandler,
  className = '',
}) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const pageSize = 16;

  // Build reverse map from handler instruction IP to symbol / line
  const symbolMap = useMemo(() => {
    const map = new Map<number, { name: string; line?: number }>();
    if (!program) return map;
    for (const [sym, info] of Object.entries(program.symbols)) {
      map.set(info.address, { name: sym });
    }
    for (const [ipStr, instr] of Object.entries(program.instructions)) {
      const ip = parseInt(ipStr, 10);
      const existing = map.get(ip);
      if (existing) {
        existing.line = instr.sourceLine;
      }
    }
    return map;
  }, [program]);

  // Decode all 256 vector entries from current memory
  const allVectors = useMemo<readonly IvtEntry[]>(() => {
    if (!memory) return [];
    return listVectors((addr) => readByte(memory, addr));
  }, [memory]);

  // Apply filters and search
  const filteredVectors = useMemo(() => {
    return allVectors.filter((entry) => {
      if (filterMode === 'installed' && !entry.isInstalled) return false;
      if (filterMode === 'dedicated' && entry.vector > 4) return false;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const vecDec = entry.vector.toString();
      const vecHex = entry.vector.toString(16).toLowerCase();
      const name = entry.name?.toLowerCase() ?? '';
      const sym = symbolMap.get(entry.ip)?.name.toLowerCase() ?? '';

      return (
        vecDec.includes(q) ||
        vecHex.includes(q) ||
        name.includes(q) ||
        sym.includes(q) ||
        formatHex16(entry.address).toLowerCase().includes(q)
      );
    });
  }, [allVectors, filterMode, searchQuery, symbolMap]);

  const totalPages = Math.max(1, Math.ceil(filteredVectors.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageEntries = useMemo(() => {
    const start = currentPage * pageSize;
    return filteredVectors.slice(start, start + pageSize);
  }, [filteredVectors, currentPage, pageSize]);

  if (!memory) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 ${className}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Interrupt Vector Table (IVT)</h3>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 italic">Assemble a program to inspect IVT vectors 0–255.</p>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="8086 Interrupt Vector Table viewer"
      className={`rounded-xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 overflow-hidden ${className}`}
    >
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-gray-700 dark:text-gray-300">IVT (0x0000–0x03FF):</span>
          <div className="inline-flex rounded-md shadow-2xs" role="group">
            <button
              type="button"
              onClick={() => { setFilterMode('all'); setPage(0); }}
              className={`px-2 py-0.5 text-xs font-medium rounded-l-md border ${
                filterMode === 'all'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'
              }`}
            >
              All (256)
            </button>
            <button
              type="button"
              onClick={() => { setFilterMode('installed'); setPage(0); }}
              className={`px-2 py-0.5 text-xs font-medium border-t border-b border-r ${
                filterMode === 'installed'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'
              }`}
            >
              Installed ({allVectors.filter((v) => v.isInstalled).length})
            </button>
            <button
              type="button"
              onClick={() => { setFilterMode('dedicated'); setPage(0); }}
              className={`px-2 py-0.5 text-xs font-medium rounded-r-md border ${
                filterMode === 'dedicated'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700'
              }`}
            >
              Dedicated (0–4)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search vector, name, hex..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            aria-label="Search interrupt vectors"
            className="w-36 rounded border border-gray-300 px-2 py-0.5 font-mono text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              aria-label="Previous page of vectors"
            >
              Previous
            </Button>
            <span className="font-mono text-[11px] text-gray-500">
              {currentPage + 1}/{totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              aria-label="Next page of vectors"
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Vectors Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono" aria-label="8086 Interrupt Vector Table entries">
          <caption className="sr-only">
            Interrupt Vector Table with 256 entries. Each vector uses 4 bytes at address vector times 4.
          </caption>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70 text-gray-500 dark:border-gray-800 dark:bg-gray-900/50">
              <th scope="col" className="px-2 py-1.5 text-left font-semibold">Vector</th>
              <th scope="col" className="px-2 py-1.5 text-left font-semibold">Address (n × 4)</th>
              <th scope="col" className="px-2 py-1.5 text-left font-semibold">Target (CS:IP)</th>
              <th scope="col" className="px-2 py-1.5 text-left font-semibold">Label / Handler</th>
              <th scope="col" className="px-2 py-1.5 text-left font-semibold">Classification</th>
              <th scope="col" className="px-2 py-1.5 text-left font-semibold">Status</th>
              <th scope="col" className="px-2 py-1.5 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {pageEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-400 dark:text-gray-500 italic">
                  No interrupt vectors match the selected criteria.
                </td>
              </tr>
            ) : (
              pageEntries.map((entry) => {
                const targetSym = symbolMap.get(entry.ip);
                const dedicatedName = RESERVED_VECTOR_NAMES[entry.vector];
                const classification =
                  dedicatedName !== undefined
                    ? `Dedicated: ${dedicatedName}`
                    : entry.vector >= 5 && entry.vector <= 31
                      ? 'Intel Reserved'
                      : 'User / Hardware';

                return (
                  <tr
                    key={entry.vector}
                    className={`hover:bg-gray-50/80 dark:hover:bg-gray-800/30 ${
                      entry.isInstalled ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''
                    }`}
                  >
                    <td className="px-2 py-1.5 font-bold text-gray-800 dark:text-gray-200">
                      {entry.vector} <span className="text-[10px] text-gray-400 font-normal">({formatHex8(entry.vector)})</span>
                    </td>
                    <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400 font-medium">
                      {formatHex16(entry.address)}
                    </td>
                    <td className="px-2 py-1.5 font-bold text-gray-900 dark:text-gray-100">
                      0000:{formatHex16(entry.ip).slice(2)}
                    </td>
                    <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">
                      {targetSym ? (
                        <span className="font-semibold text-purple-600 dark:text-purple-400">
                          {targetSym.name}
                          {targetSym.line !== undefined && (
                            <span className="text-[10px] text-gray-400 ml-1">(line {targetSym.line})</span>
                          )}
                        </span>
                      ) : entry.isInstalled ? (
                        <span className="text-gray-500 italic">raw IP: {formatHex16(entry.ip)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400">
                      {classification}
                    </td>
                    <td className="px-2 py-1.5">
                      {entry.isInstalled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <span aria-hidden="true">●</span>
                          Installed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
                          <span aria-hidden="true">○</span>
                          Unset
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSelectVector?.(entry.vector, entry.address)}
                        aria-label={`View vector ${entry.vector} in memory at address ${formatHex16(entry.address)}`}
                        className="text-[11px] px-1.5 py-0.5"
                      >
                        IVT
                      </Button>
                      {entry.isInstalled && onJumpToHandler && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onJumpToHandler(entry.ip)}
                          aria-label={`Jump to handler for vector ${entry.vector} at ${formatHex16(entry.ip)}`}
                          className="text-[11px] px-1.5 py-0.5"
                        >
                          Handler
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pedagogy Footer */}
      <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-1.5 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-900/30 flex items-center justify-between">
        <span>Address = vector × 4. Each entry holds 2 bytes IP followed by 2 bytes CS (little-endian).</span>
        <span className="font-semibold text-gray-600 dark:text-gray-400">Total Vectors: 256 (0x00–0xFF)</span>
      </div>
    </div>
  );
};
