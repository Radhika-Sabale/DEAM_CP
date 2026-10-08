/**
 * @file CircuitSynthesisBanner.tsx
 * Synthesis banner displaying upstream K-Map minimized expressions and synthesis style options.
 */

import type { FC } from 'react';
import type { GeneratorStyle } from '../../engine/circuit/generator';
import { Button } from '../../components/ui/Button';

export interface CircuitSynthesisBannerProps {
  readonly availableExpr: { readonly label: string; readonly isPos: boolean };
  readonly availableStyles: readonly { readonly style: GeneratorStyle; readonly label: string; readonly description: string }[];
  readonly selectedStyle: GeneratorStyle;
  readonly onSelectStyle: (style: GeneratorStyle) => void;
  readonly onGenerate: () => void;
}

export const CircuitSynthesisBanner: FC<CircuitSynthesisBannerProps> = ({
  availableExpr,
  availableStyles,
  selectedStyle,
  onSelectStyle,
  onGenerate,
}) => {
  const isStyleSupported = (style: GeneratorStyle) =>
    availableStyles.some((s) => s.style === style);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/80 p-4 shadow-2xs dark:border-blue-900/60 dark:bg-blue-950/40 text-xs">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white font-bold">
          ∑
        </span>
        <div>
          <span className="font-semibold text-blue-950 dark:text-blue-200">
            Minimized Expression from Upstream Module:
          </span>
          <span className="block font-mono font-bold text-blue-800 dark:text-blue-300 text-sm">
            F = {availableExpr.label}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <label htmlFor="gen-style-select" className="font-semibold text-blue-900 dark:text-blue-200">
            Synthesizer Style:
          </label>
          <select
            id="gen-style-select"
            value={selectedStyle}
            onChange={(e) => onSelectStyle(e.target.value as GeneratorStyle)}
            className="rounded-md border border-blue-300 bg-white px-2 py-1 text-xs text-blue-950 shadow-2xs dark:border-blue-800 dark:bg-gray-900 dark:text-blue-100"
          >
            <option value="sop-and-or" disabled={!isStyleSupported('sop-and-or')}>
              Two-Level SOP (AND-OR)
            </option>
            <option value="nand-only" disabled={!isStyleSupported('nand-only')}>
              Universal NAND-Only
            </option>
            <option value="pos-or-and" disabled={!isStyleSupported('pos-or-and')}>
              Two-Level POS (OR-AND)
            </option>
            <option value="nor-only" disabled={!isStyleSupported('nor-only')}>
              Universal NOR-Only
            </option>
            <option value="direct">Direct AST Tree</option>
          </select>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onGenerate}
          aria-label="Generate circuit schematic from Boolean expression"
        >
          ⚡ Generate Circuit
        </Button>
      </div>
    </div>
  );
};
