import type { FC } from 'react';
import type { GateType } from '../../types/circuit';
import { GATE_SYMBOLS } from './gateSymbols';
import { CIRCUIT_GATE_STROKE_WIDTH } from '../../engine/circuit/geometry';

export type CircuitSymbol = GateType | 'BUFFER' | 'INPUT' | 'OUTPUT' | 'CLOCK' | 'CONST0' | 'CONST1';

export const GateSymbolGraphic: FC<{ symbol: CircuitSymbol; className?: string; x?: number; y?: number; width?: number; height?: number }> = ({ symbol, className, x, y, width = 56, height = 36 }) => {
  const size = { x, y, width, height, viewBox: '0 0 44 28', preserveAspectRatio: 'none' as const, strokeWidth: CIRCUIT_GATE_STROKE_WIDTH };
  if (symbol === 'INPUT') return <svg {...size} className={className} aria-hidden="true"><path fill="none" d="M3 14h10m0 0 12-8m0 8h16"/><circle fill="none" cx="4" cy="14" r="1.5"/><circle fill="none" cx="41" cy="14" r="1.5"/><path fill="none" d="m12 15 13-9"/></svg>;
  if (symbol === 'OUTPUT') return <svg {...size} className={className} aria-hidden="true"><path fill="none" d="M2 14h9m22 0h9"/><circle fill="none" cx="22" cy="14" r="10"/><path fill="none" d="m17 9 10 10m0-10L17 19"/><circle fill="none" cx="2" cy="14" r="1.5"/><circle fill="none" cx="42" cy="14" r="1.5"/></svg>;
  if (symbol === 'BUFFER') return <svg {...size} className={className} aria-hidden="true"><path fill="none" d="M4 3 38 14 4 25Z"/><path fill="none" d="M1 14h3m34 0h5"/></svg>;
  if (symbol === 'CLOCK') return <svg {...size} className={className} aria-hidden="true"><path fill="none" d="M2 22h7V7h9v15h9V7h9v15h6"/></svg>;
  if (symbol === 'CONST0' || symbol === 'CONST1') return <svg {...size} className={className} aria-hidden="true"><circle fill="none" cx="22" cy="14" r="11"/><text x="22" y="18" textAnchor="middle">{symbol.endsWith('1') ? '1' : '0'}</text></svg>;
  const gate = GATE_SYMBOLS[symbol];
  return <svg {...size} className={className} aria-hidden="true"><g transform="scale(.72 .7)" fill="none" stroke="currentColor" strokeWidth={CIRCUIT_GATE_STROKE_WIDTH}><path d={gate.path}/>{gate.inputArcPath && <path d={gate.inputArcPath} />}{gate.hasBubble && <circle cx={gate.baseWidth + 5} cy={gate.baseHeight / 2} r="4"/>}</g></svg>;
};
