/**
 * @file RepresentationPanel.tsx
 * Fixed-width representations (unsigned, sign-magnitude, 1's and 2's complement).
 * Displays side-by-side interpretations, representable ranges, and carry-chain negation.
 */

import React, { useId, useMemo, useState } from 'react';
import type { Representation, StepRecord } from '../../engine/numberSystems/types';
import {
  encode,
  fits,
  interpretBits,
  range,
  twosComplement,
} from '../../engine/numberSystems/complements';

export interface RepresentationPanelProps {
  initialWidth?: 4 | 8 | 16 | 32;
  initialValue?: string;
  initialMode?: 'decimal' | 'binary';
  onStepEvent?: (event: unknown) => void;
  className?: string;
}

const REPS: readonly { id: Representation; name: string }[] = [
  { id: 'unsigned', name: 'Unsigned' },
  { id: 'sign-magnitude', name: 'Sign-Magnitude' },
  { id: 'ones-complement', name: "One's Complement" },
  { id: 'twos-complement', name: "Two's Complement" },
];

function formatBits(bits: string): string {
  const chunks: string[] = [];
  for (let i = 0; i < bits.length; i += 4) {
    chunks.push(bits.slice(i, i + 4));
  }
  return `(MSB) ${chunks.join(' ')} (LSB)`;
}

interface RepItem {
  id: Representation;
  name: string;
  range: { min: number; max: number };
  fits: boolean;
  bits: string | null;
  value: number;
}

type ParsedState =
  | { ok: false; error: string }
  | {
      ok: true;
      mode: 'decimal' | 'binary';
      results: RepItem[];
      primaryBits: string | null;
    };

export const RepresentationPanel: React.FC<RepresentationPanelProps> = ({
  initialWidth = 8,
  initialValue = '-128',
  initialMode = 'decimal',
  className = '',
}) => {
  const [width, setWidth] = useState<4 | 8 | 16 | 32>(initialWidth);
  const [mode, setMode] = useState<'decimal' | 'binary'>(initialMode);
  const [inputValue, setInputValue] = useState<string>(initialValue);

  const inputId = useId();
  const widthId = useId();
  const modeId = useId();

  const parsed = useMemo<ParsedState>(() => {
    const raw = inputValue.trim();
    if (!raw) return { ok: false, error: 'Please enter a value' };

    if (mode === 'decimal') {
      const isNegZero = Object.is(Number(raw), -0) || raw === '-0';
      const num = parseInt(raw, 10);
      if (Number.isNaN(num)) return { ok: false, error: 'Invalid integer input' };
      const effectiveNum = isNegZero ? -0 : num;

      const results = REPS.map((rep) => {
        const r = range(width, rep.id);
        const fitsInRep = fits(effectiveNum, width, rep.id);
        const encoded = fitsInRep ? encode(effectiveNum, width, rep.id) : null;
        return {
          ...rep,
          range: r,
          fits: fitsInRep,
          bits: encoded?.ok ? encoded.value : null,
          value: effectiveNum,
        };
      });

      // Primary bit pattern for complement negation trace (prefer two's complement)
      const tcResult = results.find((r) => r.id === 'twos-complement');
      const primaryBits = tcResult?.bits ?? results.find((r) => r.bits !== null)?.bits ?? null;

      return { ok: true, mode: 'decimal' as const, num: effectiveNum, results, primaryBits };
    } else {
      const clean = raw.replace(/[\s_]/g, '');
      if (!/^[01]+$/.test(clean)) return { ok: false, error: 'Expected binary digits (0 and 1)' };
      if (clean.length > width) return { ok: false, error: `Binary string exceeds width (${width} bits)` };
      const padded = clean.padStart(width, '0');
      const interp = interpretBits(padded, width);
      if (!interp.ok) return { ok: false, error: interp.error.message };

      const results = REPS.map((rep) => {
        const r = range(width, rep.id);
        let decVal = 0;
        if (rep.id === 'unsigned') decVal = interp.value.unsigned;
        else if (rep.id === 'sign-magnitude') decVal = interp.value.signMagnitude;
        else if (rep.id === 'ones-complement') decVal = interp.value.onesComplement;
        else decVal = interp.value.twosComplement;

        return {
          ...rep,
          range: r,
          fits: true,
          bits: padded,
          value: decVal,
        };
      });

      return { ok: true, mode: 'binary' as const, bits: padded, results, primaryBits: padded };
    }
  }, [inputValue, mode, width]);

  const negationInfo = useMemo(() => {
    if (!parsed.ok || !parsed.primaryBits) return null;
    return twosComplement(parsed.primaryBits);
  }, [parsed]);

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-border bg-card">
        <div>
          <label htmlFor={widthId} className="block text-xs font-semibold text-foreground mb-1">
            Bit Width
          </label>
          <select
            id={widthId}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value) as 4 | 8 | 16 | 32)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground"
          >
            {[4, 8, 16, 32].map((w) => (
              <option key={w} value={w}>
                {w}-bit
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={modeId} className="block text-xs font-semibold text-foreground mb-1">
            Input Mode
          </label>
          <select
            id={modeId}
            value={mode}
            onChange={(e) => setMode(e.target.value as 'decimal' | 'binary')}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground"
          >
            <option value="decimal">Decimal Value</option>
            <option value="binary">Binary Bit Pattern</option>
          </select>
        </div>

        <div>
          <label htmlFor={inputId} className="block text-xs font-semibold text-foreground mb-1">
            {mode === 'decimal' ? 'Integer Value' : 'Binary String'}
          </label>
          <input
            id={inputId}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground font-mono"
            placeholder={mode === 'decimal' ? '-128' : '10000000'}
          />
        </div>
      </div>

      {!parsed.ok && (
        <div role="alert" className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
          {parsed.error}
        </div>
      )}

      {parsed.ok && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {parsed.results.map((rep) => (
              <div
                key={rep.id}
                className="p-4 rounded-xl border border-border bg-card space-y-2 flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-semibold text-foreground text-sm">{rep.name}</h3>
                  <div className="text-xs text-muted-foreground mt-1">
                    Representable range: [{rep.range.min}, {rep.range.max}]
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border">
                  {rep.fits ? (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Decoded Value:</div>
                      <div className="text-lg font-bold text-foreground">
                        {Object.is(rep.value, -0) ? '-0' : rep.value}
                      </div>
                      {rep.bits && (
                        <div className="text-xs font-mono text-primary break-all">
                          {formatBits(rep.bits)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-destructive">
                      does not fit in {width}-bit range
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {negationInfo && parsed.primaryBits && (
            <div className="p-4 rounded-xl border border-border bg-card space-y-4">
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  Two&apos;s Complement Negation of Bit Pattern {formatBits(parsed.primaryBits)}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Step 1: Invert all bits (1&apos;s complement). Step 2: Add 1 to LSB through the carry chain.
                </p>
              </div>

              {negationInfo.overflow && (
                <div role="alert" className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                  Warning: Negating the most negative value (-{Math.pow(2, width - 1)} in {width}-bit) overflows because +{Math.pow(2, width - 1)} cannot be represented in {width}-bit two&apos;s complement.
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <caption className="sr-only">Two&apos;s Complement Invert-then-Add-One Steps</caption>
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th scope="col" className="py-2 px-3">Step</th>
                      <th scope="col" className="py-2 px-3">Bit Position</th>
                      <th scope="col" className="py-2 px-3">Operation / Detail</th>
                      <th scope="col" className="py-2 px-3">Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    {negationInfo.steps.map((st: StepRecord, idx: number) => {
                      const pos = (st.inputs as Record<string, unknown>)?.['position'];
                      return (
                        <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-1.5 px-3 font-mono">{idx + 1}</td>
                          <td className="py-1.5 px-3 font-mono">{pos !== undefined ? String(pos) : '—'}</td>
                          <td className="py-1.5 px-3">{st.description}</td>
                          <td className="py-1.5 px-3 font-mono font-semibold text-primary">
                            {JSON.stringify(st.output)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground">Negated Result:</span>
                <span className="font-bold text-foreground">{formatBits(negationInfo.result)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
