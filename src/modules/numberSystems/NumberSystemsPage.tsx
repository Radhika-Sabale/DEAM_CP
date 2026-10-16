/**
 * @file NumberSystemsPage.tsx
 * Top-level Number Systems Module UI.
 * Provides four educational tabs: Converter, Representations, Codes, and Arithmetic.
 * Persists user inputs to localStorage (delab:v1:numbersystems_state) without modifying DesignProject.
 */

import React, { useEffect, useId, useMemo, useState } from 'react';
import { Tabs } from '../../components/ui/Tabs';
import { convertRadix } from '../../engine/numberSystems/convert';
import { generateRadixConversionSteps } from '../../engine/numberSystems/steps';
import { useUiStore } from '../../store/uiStore';
import { BinaryArithmeticPanel } from './BinaryArithmeticPanel';
import { CodesPanel } from './CodesPanel';
import { ConversionSteps } from './ConversionSteps';
import { NumberSystemsPractice } from './NumberSystemsPractice';
import { RepresentationPanel } from './RepresentationPanel';

export interface NumberSystemsPageProps {
  /** Optional callback for step events (reserved for Stage 6 interactive tutor). */
  onStepEvent?: (event: unknown) => void;
  className?: string;
}

const STORAGE_KEY = 'delab:v1:numbersystems_state';

interface PersistedState {
  activeTab: string;
  fromRadix: number;
  inputStr: string;
  targetRadix: number;
}

function loadPersistedState(): PersistedState {
  const fallback: PersistedState = {
    activeTab: 'converter',
    fromRadix: 10,
    inputStr: '156',
    targetRadix: 2,
  };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...fallback, ...JSON.parse(raw) };
    }
  } catch {
    // Ignore storage parse error
  }
  return fallback;
}

export const NumberSystemsPage: React.FC<NumberSystemsPageProps> = ({
  onStepEvent,
  className = '',
}) => {
  const [persisted, setPersisted] = useState<PersistedState>(loadPersistedState);
  const setModule = useUiStore((s) => s.setModule);

  const inputId = useId();
  const fromRadixId = useId();
  const targetRadixId = useId();

  // Save to localStorage on change
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
      }
    } catch {
      // Ignore storage error
    }
  }, [persisted]);

  const { activeTab, fromRadix, inputStr, targetRadix } = persisted;

  // Live conversions for standard radices (2, 8, 10, 16)
  const standardConversions = useMemo(() => {
    return [2, 8, 10, 16].map((radix) => ({
      radix,
      label: radix === 2 ? 'Binary (Base 2)' : radix === 8 ? 'Octal (Base 8)' : radix === 10 ? 'Decimal (Base 10)' : 'Hex (Base 16)',
      res: convertRadix(inputStr, fromRadix, radix),
    }));
  }, [inputStr, fromRadix]);

  const targetConversion = useMemo(() => {
    return generateRadixConversionSteps(inputStr, fromRadix, targetRadix);
  }, [inputStr, fromRadix, targetRadix]);

  const firstConv = standardConversions[0];
  const parseError = firstConv && !firstConv.res.ok ? firstConv.res.error : null;

  const converterTabContent = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-border bg-card">
        <div>
          <label htmlFor={fromRadixId} className="block text-xs font-semibold text-foreground mb-1">
            From Radix
          </label>
          <select
            id={fromRadixId}
            value={fromRadix}
            onChange={(e) => setPersisted((s) => ({ ...s, fromRadix: Number(e.target.value) }))}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground"
          >
            <option value={2}>Base 2 (Binary)</option>
            <option value={8}>Base 8 (Octal)</option>
            <option value={10}>Base 10 (Decimal)</option>
            <option value={16}>Base 16 (Hexadecimal)</option>
            <option value={3}>Base 3 (Ternary)</option>
            <option value={5}>Base 5</option>
            <option value={12}>Base 12 (Duodecimal)</option>
            <option value={36}>Base 36 (Alphanumeric)</option>
          </select>
        </div>

        <div>
          <label htmlFor={inputId} className="block text-xs font-semibold text-foreground mb-1">
            Input Number
          </label>
          <input
            id={inputId}
            type="text"
            value={inputStr}
            onChange={(e) => setPersisted((s) => ({ ...s, inputStr: e.target.value }))}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground font-mono"
            placeholder="e.g. 156"
          />
        </div>

        <div>
          <label htmlFor={targetRadixId} className="block text-xs font-semibold text-foreground mb-1">
            Target Radix for Steps
          </label>
          <select
            id={targetRadixId}
            value={targetRadix}
            onChange={(e) => setPersisted((s) => ({ ...s, targetRadix: Number(e.target.value) }))}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground"
          >
            <option value={2}>Base 2 (Binary)</option>
            <option value={8}>Base 8 (Octal)</option>
            <option value={10}>Base 10 (Decimal)</option>
            <option value={16}>Base 16 (Hexadecimal)</option>
          </select>
        </div>
      </div>

      {parseError && (
        <div role="alert" aria-live="polite" className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-sm space-y-2">
          <div className="font-semibold text-destructive">{parseError.message}</div>
          {parseError.position !== undefined && (
            <div className="font-mono text-xs bg-background/80 p-2 rounded border border-border">
              <div>{inputStr}</div>
              <div className="text-destructive font-bold">
                {' '.repeat(Math.max(0, parseError.position))}^ (Invalid digit at position {parseError.position})
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live Standard Radix Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {standardConversions.map((conv) => (
          <div key={conv.radix} className="p-4 rounded-xl border border-border bg-card space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">{conv.label}</span>
            <div className="text-lg font-bold text-foreground font-mono truncate">
              {conv.res.ok ? conv.res.value.fullResult : '—'}
            </div>
          </div>
        ))}
      </div>

      {/* Steps Component */}
      {targetConversion.ok && (
        <ConversionSteps
          steps={targetConversion.value.steps}
          isExact={targetConversion.value.isExact}
          isRepeating={targetConversion.value.isRepeating}
          repeatingCycle={targetConversion.value.repeatingCycle}
          targetRadix={targetRadix}
          onStepEvent={onStepEvent}
        />
      )}
    </div>
  );

  const tabs = [
    { id: 'converter', label: 'Converter', content: converterTabContent },
    {
      id: 'representations',
      label: 'Representations',
      content: <RepresentationPanel onStepEvent={onStepEvent} />,
    },
    { id: 'codes', label: 'Codes', content: <CodesPanel onStepEvent={onStepEvent} /> },
    {
      id: 'arithmetic',
      label: 'Arithmetic',
      content: <BinaryArithmeticPanel onStepEvent={onStepEvent} />,
    },
    {
      id: 'practice',
      label: 'Practice',
      content: <NumberSystemsPractice onStepEvent={onStepEvent} />,
    },
  ];

  return (
    <div className={`max-w-6xl mx-auto px-4 py-6 space-y-6 ${className}`}>
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Number Systems</h1>
      </header>

      <Tabs
        tabs={tabs}
        value={activeTab}
        onChange={(tabId) => setPersisted((s) => ({ ...s, activeTab: tabId }))}
      />

      {/* Plain text pointer with normal navigation link; no pipeline handoff */}
      <footer className="pt-6 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
        <span>Teaching Module &bull; No pipeline handoff</span>
        <div className="flex items-center gap-2">
          <span>Next:</span>
          <button
            type="button"
            onClick={() => setModule('boolean-tool')}
            className="font-semibold text-primary underline hover:text-primary/80 focus:outline-none focus:ring-2 focus:ring-primary rounded"
          >
            Boolean Expression Tool &rarr;
          </button>
        </div>
      </footer>
    </div>
  );
};
