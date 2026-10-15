/**
 * @file CodeEditor.tsx
 * Assembly code editor with line numbers, breakpoint gutters, error table,
 * sample program selection, and keyboard navigation.
 */

import { type FC, useCallback, useId, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { SAMPLE_PROGRAMS, type SampleProgram } from './samplePrograms';

export interface CodeEditorProps {
  readonly source: string;
  readonly onSourceChange: (s: string) => void;
  readonly currentLine: number;
  readonly breakpoints: ReadonlySet<number>;
  readonly onToggleBreakpoint: (line: number) => void;
  readonly errors?: readonly {
    readonly line: number;
    readonly column?: number;
    readonly message: string;
    readonly code?: string;
  }[];
  readonly readOnly?: boolean;
  readonly className?: string;
}

export const CodeEditor: FC<CodeEditorProps> = ({
  source,
  onSourceChange,
  currentLine,
  breakpoints,
  onToggleBreakpoint,
  errors = [],
  readOnly = false,
  className = '',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorId = useId();
  const [selectedLine, setSelectedLine] = useState<number>(1);
  const [pendingSample, setPendingSample] = useState<SampleProgram | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  const lines = useMemo(() => source.split('\n'), [source]);
  const lineCount = lines.length;

  const errorsByLine = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of errors) {
      if (!map.has(e.line)) map.set(e.line, e.message);
    }
    return map;
  }, [errors]);

  const jumpToLineColumn = useCallback(
    (targetLine: number, targetCol = 1) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      let charIdx = 0;
      for (let i = 0; i < targetLine - 1 && i < lines.length; i++) {
        charIdx += (lines[i]?.length ?? 0) + 1; // +1 for newline
      }
      charIdx += Math.max(0, targetCol - 1);
      textarea.focus();
      textarea.setSelectionRange(charIdx, charIdx);
      setSelectedLine(targetLine);
    },
    [lines]
  );

  const handleSelectSample = (sampleId: string) => {
    if (!sampleId) return;
    const sample = SAMPLE_PROGRAMS.find((p) => p.id === sampleId);
    if (!sample) return;
    if (source.trim().length > 0 && source.trim() !== sample.source.trim()) {
      setPendingSample(sample);
      setShowConfirmModal(true);
      setTimeout(() => cancelBtnRef.current?.focus(), 50);
    } else {
      onSourceChange(sample.source);
    }
  };

  const handleNewProgram = () => {
    if (source.trim().length > 0) {
      setPendingSample({ id: 'empty', title: 'New empty program', description: '', source: '' });
      setShowConfirmModal(true);
      setTimeout(() => cancelBtnRef.current?.focus(), 50);
    } else {
      onSourceChange('');
    }
  };

  const confirmReplace = () => {
    if (pendingSample) onSourceChange(pendingSample.source);
    setShowConfirmModal(false);
    setPendingSample(null);
  };

  const cancelReplace = () => {
    setShowConfirmModal(false);
    setPendingSample(null);
  };

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-950 overflow-hidden ${className}`}
      role="group"
      aria-label="Assembly code editor"
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <label htmlFor={`${editorId}-sample`} className="text-xs font-semibold text-gray-600 dark:text-gray-300">
            Samples:
          </label>
          <select
            id={`${editorId}-sample`}
            aria-label="Load sample program"
            defaultValue=""
            onChange={(e) => {
              handleSelectSample(e.target.value);
              e.target.value = '';
            }}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 shadow-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="" disabled>
              Select sample program…
            </option>
            {SAMPLE_PROGRAMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <Button variant="ghost" size="sm" onClick={handleNewProgram} aria-label="New empty program">
            New
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleBreakpoint(selectedLine)}
            aria-label={`Toggle breakpoint on line ${selectedLine}`}
          >
            Toggle BP (Line {selectedLine})
          </Button>
          <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        </div>
      </div>

      {/* Editor Body */}
      <div className="relative flex overflow-auto max-h-[380px]">
        {/* Gutter */}
        <div
          className="select-none shrink-0 border-r border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 font-mono text-xs"
          role="list"
          aria-label="Line numbers and breakpoints"
        >
          {lines.map((_, idx) => {
            const lineNum = idx + 1;
            const isCurrent = lineNum === currentLine;
            const hasBp = breakpoints.has(lineNum);
            const errorMsg = errorsByLine.get(lineNum);

            return (
              <div key={lineNum} role="listitem">
                <button
                  type="button"
                  aria-label={`Line ${lineNum}${hasBp ? ', breakpoint set' : ''}${isCurrent ? ', next instruction' : ''}${errorMsg ? ', Error: ' + errorMsg : ''}`}
                  onClick={() => {
                    setSelectedLine(lineNum);
                    onToggleBreakpoint(lineNum);
                  }}
                  className={`flex items-center gap-1 px-1.5 cursor-pointer w-full text-left hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    isCurrent
                      ? 'bg-amber-100 dark:bg-amber-900/30'
                      : errorMsg
                        ? 'bg-red-50 dark:bg-red-950/30'
                        : ''
                  }`}
                  style={{ height: '1.5rem', lineHeight: '1.5rem' }}
                >
                  {/* Breakpoint indicator with glyph and text label */}
                  <span className="w-5 text-center shrink-0">
                    {hasBp ? (
                      <span className="text-[10px] font-bold text-red-600 dark:text-red-400" title="Breakpoint">
                        ●<span className="sr-only">breakpoint</span>
                      </span>
                    ) : (
                      <span className="inline-block w-2" />
                    )}
                  </span>

                  {/* Line Number */}
                  <span
                    className={`w-5 text-right text-[11px] ${
                      isCurrent
                        ? 'font-bold text-amber-700 dark:text-amber-300'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {lineNum}
                  </span>

                  {/* Next instruction arrow + screen reader words */}
                  <span className="w-4 text-center shrink-0">
                    {isCurrent && (
                      <span className="text-amber-600 dark:text-amber-400 font-bold" title="Next instruction">
                        ▶<span className="sr-only">next</span>
                      </span>
                    )}
                  </span>

                  {/* Error badge in gutter with icon AND text */}
                  <span className="w-10 shrink-0 text-left">
                    {errorMsg && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 dark:text-red-400">
                        ⚠<span>Error</span>
                      </span>
                    )}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          id={`${editorId}-textarea`}
          aria-label="8086 Assembly source code editor"
          value={source}
          onChange={(e) => onSourceChange(e.target.value)}
          onClick={(e) => {
            const pos = e.currentTarget.selectionStart;
            const upToPos = source.slice(0, pos);
            const line = upToPos.split('\n').length;
            setSelectedLine(line);
          }}
          onKeyUp={(e) => {
            const pos = e.currentTarget.selectionStart;
            const upToPos = source.slice(0, pos);
            const line = upToPos.split('\n').length;
            setSelectedLine(line);
          }}
          readOnly={readOnly}
          spellCheck={false}
          autoComplete="off"
          wrap="off"
          className="flex-1 resize-none bg-transparent p-2 font-mono text-sm leading-6 text-gray-900 outline-none dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 min-h-[220px]"
          style={{ lineHeight: '1.5rem', tabSize: 8 }}
          placeholder="; Enter 8086 assembly source code here&#10;MOV AX, 5&#10;ADD AX, 3&#10;HLT"
        />
      </div>

      {/* Assembler Errors Table */}
      {errors.length > 0 && (
        <div
          role="region"
          aria-label="Assembler error list"
          aria-live="polite"
          className="border-t border-red-200 bg-red-50/70 p-3 dark:border-red-900/60 dark:bg-red-950/30 overflow-x-auto"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-red-600 dark:text-red-400 font-bold text-xs" aria-hidden="true">⚠</span>
            <h4 className="text-xs font-bold text-red-800 dark:text-red-300">
              Assembler Errors ({errors.length})
            </h4>
          </div>
          <table className="w-full text-left text-xs border border-red-200 dark:border-red-900 bg-white dark:bg-gray-900">
            <caption className="sr-only">Assembler errors table with line, column, message and code</caption>
            <thead>
              <tr className="border-b border-red-200 bg-red-100/50 dark:border-red-900 dark:bg-red-950/50">
                <th scope="col" className="px-2 py-1 text-center font-semibold text-red-900 dark:text-red-200">Line</th>
                <th scope="col" className="px-2 py-1 text-center font-semibold text-red-900 dark:text-red-200">Col</th>
                <th scope="col" className="px-2 py-1 font-semibold text-red-900 dark:text-red-200">Code</th>
                <th scope="col" className="px-2 py-1 font-semibold text-red-900 dark:text-red-200">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100 dark:divide-red-900/40">
              {errors.map((e, idx) => (
                <tr
                  key={`${e.line}-${e.column ?? 1}-${idx}`}
                  onClick={() => jumpToLineColumn(e.line, e.column ?? 1)}
                  tabIndex={0}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter') jumpToLineColumn(e.line, e.column ?? 1);
                  }}
                  className="cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/40 focus:bg-red-100 dark:focus:bg-red-900/50"
                  aria-label={`Error at line ${e.line}, column ${e.column ?? 1}: ${e.message}. Click to jump.`}
                >
                  <td className="px-2 py-1 text-center font-mono text-red-700 dark:text-red-300 font-semibold">{e.line}</td>
                  <td className="px-2 py-1 text-center font-mono text-red-600 dark:text-red-400">{e.column ?? 1}</td>
                  <td className="px-2 py-1 font-mono text-[11px] text-gray-500 dark:text-gray-400">{e.code ?? 'error'}</td>
                  <td className="px-2 py-1 font-mono text-xs text-red-800 dark:text-red-200">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-replace-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-4">
            <h3 id="confirm-replace-title" className="text-base font-bold text-gray-900 dark:text-gray-100">
              Replace Current Program?
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Loading &quot;{pendingSample?.title}&quot; will overwrite your current assembly code. Any unsaved edits will be lost.
            </p>
            <div className="flex justify-end gap-2">
              <Button ref={cancelBtnRef} variant="secondary" size="sm" onClick={cancelReplace}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={confirmReplace}>
                Replace
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
