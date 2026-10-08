/**
 * @file CodesPanel.tsx
 * Educational panel for BCD encodings, packed/unpacked formats,
 * BCD addition with +0110 correction steps, and Binary <-> Gray XOR derivations.
 */

import React, { useId, useMemo, useState } from 'react';
import type { BCDCode, BCDFormat } from '../../engine/numberSystems/types';
import {
  bcdAdd,
  binaryToGrayWithSteps,
  decimalToBcd,
  grayToBinaryWithSteps,
} from '../../engine/numberSystems/bcd';

export interface CodesPanelProps {
  onStepEvent?: (event: unknown) => void;
  className?: string;
}

function formatBits(bits: string): string {
  const chunks: string[] = [];
  for (let i = 0; i < bits.length; i += 4) {
    chunks.push(bits.slice(i, i + 4));
  }
  return `(MSB) ${chunks.join(' ')} (LSB)`;
}

export const CodesPanel: React.FC<CodesPanelProps> = ({ className = '' }) => {
  const [activeSection, setActiveSection] = useState<'bcd' | 'gray'>('bcd');

  // BCD state
  const [bcdCode, setBcdCode] = useState<BCDCode>('8421');
  const [bcdFormat, setBcdFormat] = useState<BCDFormat>('packed');
  const [decInput, setDecInput] = useState<string>('98');
  const [addA, setAddA] = useState<string>('9');
  const [addB, setAddB] = useState<string>('8');

  // Gray state
  const [grayMode, setGrayMode] = useState<'bin2gray' | 'gray2bin'>('bin2gray');
  const [grayInput, setGrayInput] = useState<string>('1101');

  const bcdCodeId = useId();
  const bcdFormatId = useId();
  const bcdInputId = useId();
  const bcdAddAId = useId();
  const bcdAddBId = useId();
  const grayInputId = useId();

  // BCD conversion calculation
  const bcdConv = useMemo(() => {
    return decimalToBcd(decInput, bcdCode, bcdFormat);
  }, [decInput, bcdCode, bcdFormat]);

  // BCD addition calculation
  const bcdAddResult = useMemo(() => {
    const encA = decimalToBcd(addA, '8421', 'packed');
    const encB = decimalToBcd(addB, '8421', 'packed');
    if (!encA.ok) return { ok: false as const, error: { message: `Operand A: ${encA.error.message}` } };
    if (!encB.ok) return { ok: false as const, error: { message: `Operand B: ${encB.error.message}` } };
    const res = bcdAdd(encA.value.bits, encB.value.bits);
    return res;
  }, [addA, addB]);

  // Gray calculation
  const grayResult = useMemo(() => {
    return grayMode === 'bin2gray'
      ? binaryToGrayWithSteps(grayInput)
      : grayToBinaryWithSteps(grayInput);
  }, [grayInput, grayMode]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Subtab navigation */}
      <div className="flex border-b border-border gap-2" role="tablist" aria-label="Codes Subsections">
        <button
          role="tab"
          aria-selected={activeSection === 'bcd'}
          onClick={() => setActiveSection('bcd')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSection === 'bcd'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          BCD Codes &amp; Addition
        </button>
        <button
          role="tab"
          aria-selected={activeSection === 'gray'}
          onClick={() => setActiveSection('gray')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSection === 'gray'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Reflected Gray Code
        </button>
      </div>

      {activeSection === 'bcd' && (
        <div className="space-y-6">
          {/* Conversion Section */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-4">
            <h3 className="font-semibold text-foreground text-sm">Decimal to BCD Conversion</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor={bcdCodeId} className="block text-xs font-semibold text-foreground mb-1">Code Scheme</label>
                <select
                  id={bcdCodeId}
                  aria-label="Code Scheme"
                  value={bcdCode}
                  onChange={(e) => setBcdCode(e.target.value as BCDCode)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground"
                >
                  <option value="8421">8421 (Standard BCD)</option>
                  <option value="excess-3">Excess-3 (Self-Complementing)</option>
                  <option value="2421">2421 (Aiken)</option>
                  <option value="84-2-1">84-2-1 (Negative Weights)</option>
                </select>
              </div>

              <div>
                <label htmlFor={bcdFormatId} className="block text-xs font-semibold text-foreground mb-1">Packaging Format</label>
                <select
                  id={bcdFormatId}
                  aria-label="Packaging Format"
                  value={bcdFormat}
                  onChange={(e) => setBcdFormat(e.target.value as BCDFormat)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground"
                >
                  <option value="packed">Packed (4 bits per digit)</option>
                  <option value="unpacked">Unpacked (8 bits per digit)</option>
                </select>
              </div>

              <div>
                <label htmlFor={bcdInputId} className="block text-xs font-semibold text-foreground mb-1">
                  Decimal Digits
                </label>
                <input
                  id={bcdInputId}
                  type="text"
                  value={decInput}
                  onChange={(e) => setDecInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground font-mono"
                  placeholder="e.g. 98"
                />
              </div>
            </div>

            {bcdConv.ok ? (
              <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
                <div className="text-muted-foreground">Encoded BCD Bit String:</div>
                <div className="font-mono text-sm font-bold text-primary break-all">
                  {formatBits(bcdConv.value.bits)}
                </div>
              </div>
            ) : (
              <div role="alert" className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                {bcdConv.error.message}
              </div>
            )}
          </div>

          {/* BCD Addition Section */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm">BCD (8421) Addition with +0110 Correction</h3>
              <p className="text-xs text-muted-foreground mt-1">
                When a nibble sum &gt; 9 (1001) or generates a raw carry, +0110 (6) is added to correct the digit and propagate carry.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor={bcdAddAId} className="block text-xs font-semibold text-foreground mb-1">Operand A (Decimal)</label>
                <input
                  id={bcdAddAId}
                  type="text"
                  value={addA}
                  onChange={(e) => setAddA(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground font-mono"
                />
              </div>
              <div>
                <label htmlFor={bcdAddBId} className="block text-xs font-semibold text-foreground mb-1">Operand B (Decimal)</label>
                <input
                  id={bcdAddBId}
                  type="text"
                  value={addB}
                  onChange={(e) => setAddB(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground font-mono"
                />
              </div>
            </div>

            {bcdAddResult.ok ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <caption className="sr-only">BCD Addition Steps with Correction</caption>
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th scope="col" className="py-2 px-3">Step</th>
                        <th scope="col" className="py-2 px-3">Operation / Detail</th>
                        <th scope="col" className="py-2 px-3">Correction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bcdAddResult.value.steps.map((st, idx) => {
                        const out = st.output as Record<string, unknown>;
                        const needsCorr = out?.['needsCorrection'] === true;
                        return (
                          <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 px-3 font-mono">{idx + 1}</td>
                            <td className="py-2 px-3">{st.description}</td>
                            <td className="py-2 px-3 font-semibold">
                              {needsCorr ? (
                                <span className="text-warning text-amber-500 font-bold">+0110 (correction applied)</span>
                              ) : (
                                <span className="text-muted-foreground">None</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-muted/40 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-muted-foreground">Decimal Sum: </span>
                    <span className="font-bold text-foreground text-sm">{bcdAddResult.value.sumDigits}</span>
                  </div>
                  <div className="font-mono text-primary font-semibold">
                    {formatBits(bcdAddResult.value.bcdBits)}
                  </div>
                </div>
              </div>
            ) : (
              <div role="alert" className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                {bcdAddResult.error.message}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection === 'gray' && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm">Reflected Gray Code Converter</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {grayMode === 'bin2gray'
                  ? 'Binary to Gray: G[0] = B[0], G[i] = B[i-1] ⊕ B[i]'
                  : 'Gray to Binary: B[0] = G[0], B[i] = B[i-1] ⊕ G[i]'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGrayMode('bin2gray')}
                className={`px-3 py-1.5 text-xs rounded-lg border font-medium ${
                  grayMode === 'bin2gray'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-foreground border-border'
                }`}
              >
                Binary &rarr; Gray
              </button>
              <button
                type="button"
                onClick={() => setGrayMode('gray2bin')}
                className={`px-3 py-1.5 text-xs rounded-lg border font-medium ${
                  grayMode === 'gray2bin'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-foreground border-border'
                }`}
              >
                Gray &rarr; Binary
              </button>
            </div>
          </div>

          <div>
            <label htmlFor={grayInputId} className="block text-xs font-semibold text-foreground mb-1">
              {grayMode === 'bin2gray' ? 'Binary Input' : 'Gray Code Input'}
            </label>
            <input
              id={grayInputId}
              type="text"
              value={grayInput}
              onChange={(e) => setGrayInput(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground font-mono"
              placeholder="e.g. 1101"
            />
          </div>

          {grayResult.ok ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <caption className="sr-only">Gray Code Conversion XOR Steps</caption>
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th scope="col" className="py-2 px-3">Bit Position</th>
                      <th scope="col" className="py-2 px-3">XOR Derivation</th>
                      <th scope="col" className="py-2 px-3">Result Bit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grayResult.value.steps.map((st, idx) => {
                      const out = st.output as Record<string, unknown>;
                      const bit = out?.['grayBit'] ?? out?.['binBit'];
                      return (
                        <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-3 font-mono">{idx}</td>
                          <td className="py-2 px-3">{st.description}</td>
                          <td className="py-2 px-3 font-mono font-bold text-primary">{String(bit ?? '')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg text-xs flex items-center justify-between">
                <span className="text-muted-foreground">
                  {grayMode === 'bin2gray' ? 'Resulting Gray String:' : 'Resulting Binary String:'}
                </span>
                <span className="font-mono text-sm font-bold text-foreground">
                  {formatBits(
                    'gray' in grayResult.value ? grayResult.value.gray : grayResult.value.binary
                  )}
                </span>
              </div>
            </div>
          ) : (
            <div role="alert" className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
              {grayResult.error.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
