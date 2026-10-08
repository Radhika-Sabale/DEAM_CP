/**
 * @file ExpressionInput.tsx
 * Accessible Boolean expression input with 200ms debounced live parsing,
 * multi-channel syntax error visualization (caret indicator, position text, underline),
 * an on-screen operator and variable palette, and syntax guidance disclosure.
 */

import {
  type ChangeEvent,
  type FC,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { parse, type ParseResult } from '../../engine/boolean';

export interface ExpressionInputProps {
  /** Accessible DOM id for the text input */
  readonly id?: string;
  /** Visible label text for the input */
  readonly label?: string;
  /** Current raw expression string value */
  readonly value: string;
  /** Handler invoked when input string changes */
  readonly onChange: (value: string) => void;
  /** Optional callback fired when debounced parsing completes */
  readonly onParsed?: (result: ParseResult) => void;
  /** Placeholder hint text */
  readonly placeholder?: string;
  /** Disables input and palette buttons */
  readonly disabled?: boolean;
}

/** Standard operator buttons available on the palette */
const OPERATORS = [
  { char: "'", label: "NOT (postfix prime)", title: "NOT / Complement (')" },
  { char: '+', label: 'OR (+)', title: 'OR (+)' },
  { char: '·', label: 'AND (·)', title: 'AND (·)' },
  { char: '⊕', label: 'XOR (⊕)', title: 'XOR (⊕)' },
  { char: '(', label: 'Open parenthesis', title: 'Open parenthesis (' },
  { char: ')', label: 'Close parenthesis', title: 'Close parenthesis )' },
] as const;

export const ExpressionInput: FC<ExpressionInputProps> = ({
  id,
  label = 'Boolean Expression',
  value,
  onChange,
  onParsed,
  placeholder = "e.g. A'B + C(D xor E)",
  disabled = false,
}) => {
  const generatedId = useId();
  const inputId = id ?? `expr-input-${generatedId}`;
  const errorId = `expr-error-${generatedId}`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  // Debounced live parsing (200 ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = value.trim();
      if (!trimmed) {
        setParseResult(null);
        onParsed?.({
          ok: false,
          error: { message: 'Expression is empty', position: 0, length: 0 },
        });
        return;
      }
      const result = parse(value);
      setParseResult(result);
      onParsed?.(result);
    }, 200);

    return () => clearTimeout(timer);
  }, [value, onParsed]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onChange(e.target.value);
  };

  /** Inserts text at current input cursor position */
  const insertAtCursor = useCallback(
    (textToInsert: string): void => {
      const el = inputRef.current;
      const start = el ? el.selectionStart ?? value.length : value.length;
      const end = el ? el.selectionEnd ?? value.length : value.length;

      const nextVal = value.slice(0, start) + textToInsert + value.slice(end);
      onChange(nextVal);

      // Re-focus and advance cursor
      requestAnimationFrame(() => {
        if (el) {
          el.focus();
          const nextPos = start + textToInsert.length;
          el.setSelectionRange(nextPos, nextPos);
        }
      });
    },
    [value, onChange]
  );

  // Extract variable letters present in expression, or fallback to common set
  const detectedVars = Array.from(
    new Set(value.match(/[A-Za-z][A-Za-z0-9]*/g) ?? [])
  ).sort();
  const paletteVariables =
    detectedVars.length > 0 ? detectedVars : ['A', 'B', 'C', 'D'];

  const hasError = parseResult !== null && !parseResult.ok;
  const parseError = hasError ? parseResult.error : null;

  return (
    <div className="w-full space-y-2.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-gray-900 dark:text-gray-100"
        >
          {label}
        </label>
        {parseResult && parseResult.ok && (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            [Valid Syntax] ({parseResult.variables.length} variable
            {parseResult.variables.length === 1 ? '' : 's'}:{' '}
            {parseResult.variables.join(', ') || 'none'})
          </span>
        )}
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          aria-label={label}
          className={`w-full rounded-lg border px-3.5 py-2.5 font-mono text-sm tracking-wide transition-colors focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:opacity-60 dark:bg-gray-950 dark:text-gray-100 ${
            hasError
              ? 'border-red-500 focus:border-red-500 focus:ring-red-400/30 dark:border-red-600'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-400/30 dark:border-gray-700 dark:focus:border-blue-500'
          }`}
        />
      </div>

      {/* Operator and Variable Palette */}
      <div
        className="flex flex-wrap items-center gap-1.5 pt-0.5"
        role="group"
        aria-label="Expression symbol palette"
      >
        <span className="mr-1 text-xs font-medium text-gray-500 dark:text-gray-400">
          Insert:
        </span>
        {OPERATORS.map((op) => (
          <button
            key={op.char}
            type="button"
            disabled={disabled}
            onClick={() => insertAtCursor(op.char)}
            title={op.title}
            aria-label={`Insert ${op.label}`}
            className="inline-flex min-h-[30px] min-w-[30px] items-center justify-center rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs font-semibold text-gray-800 transition hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {op.char}
          </button>
        ))}

        <span className="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-700" aria-hidden="true" />

        {paletteVariables.map((v) => (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => insertAtCursor(v)}
            title={`Insert variable ${v}`}
            aria-label={`Insert variable ${v}`}
            className="inline-flex min-h-[30px] min-w-[30px] items-center justify-center rounded border border-blue-200 bg-blue-50 px-2 py-1 font-mono text-xs font-semibold text-blue-700 transition hover:bg-blue-100 active:bg-blue-200 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60"
          >
            {v}
          </button>
        ))}
      </div>

      {/* Inline Multi-Channel Diagnostic Error */}
      {parseError && (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300"
        >
          <div className="flex items-center gap-1.5 font-semibold">
            <span aria-hidden="true">[Syntax Error]</span>
            <span>
              Position {parseError.position + 1}: {parseError.message}
            </span>
          </div>

          {/* Monospace caret indicator line: not relying on colour alone */}
          {value.length > 0 && (
            <div
              className="mt-2 overflow-x-auto rounded bg-white/70 p-2 font-mono text-xs dark:bg-gray-900/80"
              aria-hidden="true"
            >
              <div className="whitespace-pre text-gray-800 dark:text-gray-200">
                {value}
              </div>
              <div className="whitespace-pre font-bold text-red-600 dark:text-red-400">
                {' '.repeat(Math.max(0, parseError.position))}
                {'^'.repeat(Math.max(1, parseError.length))}
                <span className="ml-2 font-sans font-normal text-red-700 dark:text-red-300">
                  (error here)
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Accepted Syntax Disclosure */}
      <details className="pt-1 text-xs text-gray-600 dark:text-gray-400">
        <summary className="cursor-pointer font-medium text-blue-600 hover:underline dark:text-blue-400">
          Accepted syntax and operator precedence table
        </summary>
        <div className="mt-2 space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs dark:border-gray-800 dark:bg-gray-900/60">
          <p className="font-semibold text-gray-800 dark:text-gray-200">
            Precedence (Highest to Lowest):
          </p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              <span className="font-mono font-semibold">Postfix '</span> — Inversion / NOT (e.g.{' '}
              <code className="rounded bg-gray-200 px-1 dark:bg-gray-800">A'</code> or{' '}
              <code className="rounded bg-gray-200 px-1 dark:bg-gray-800">(A+B)'</code>)
            </li>
            <li>
              <span className="font-mono font-semibold">Prefix !, ~, not</span> — Prefix NOT (e.g.{' '}
              <code className="rounded bg-gray-200 px-1 dark:bg-gray-800">!A</code>,{' '}
              <code className="rounded bg-gray-200 px-1 dark:bg-gray-800">not A</code>)
            </li>
            <li>
              <span className="font-mono font-semibold">AND (·, *, &, and, juxtaposition)</span>,{' '}
              <span className="font-mono font-semibold">NAND (nand)</span> — (e.g.{' '}
              <code className="rounded bg-gray-200 px-1 dark:bg-gray-800">AB</code>,{' '}
              <code className="rounded bg-gray-200 px-1 dark:bg-gray-800">A · B</code>,{' '}
              <code className="rounded bg-gray-200 px-1 dark:bg-gray-800">A nand B</code>)
            </li>
            <li>
              <span className="font-mono font-semibold">XOR (⊕, ^, xor)</span>,{' '}
              <span className="font-mono font-semibold">XNOR (xnor)</span> — (e.g.{' '}
              <code className="rounded bg-gray-200 px-1 dark:bg-gray-800">A ⊕ B</code>,{' '}
              <code className="rounded bg-gray-200 px-1 dark:bg-gray-800">A xor B</code>)
            </li>
            <li>
              <span className="font-mono font-semibold">OR (+, |, or)</span>,{' '}
              <span className="font-mono font-semibold">NOR (nor)</span> — (e.g.{' '}
              <code className="rounded bg-gray-200 px-1 dark:bg-gray-800">A + B</code>,{' '}
              <code className="rounded bg-gray-200 px-1 dark:bg-gray-800">A nor B</code>)
            </li>
          </ol>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Constants <code className="font-mono font-bold">0</code> and{' '}
            <code className="font-mono font-bold">1</code> are accepted. Parentheses{' '}
            <code className="font-mono font-bold">( )</code> override precedence.
          </p>
        </div>
      </details>
    </div>
  );
};
