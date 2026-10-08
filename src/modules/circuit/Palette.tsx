/**
 * @file Palette.tsx
 * Component library palette and reference example circuit loader.
 * Allows adding logic gates, terminals, and sources via click, keyboard Enter, or drag-and-drop.
 */

import { type FC, type DragEvent, useState } from 'react';
import type { CircuitGraph, CircuitNode, GateType } from '../../types/circuit';
import {
  fullAdder,
  gatedDLatchNand,
  halfAdder,
  masterSlaveDFlipFlop,
  rippleCarryAdder,
  srLatchNor,
  xorFromNands,
} from '../../engine/circuit/examples';

export interface PaletteProps {
  readonly onAddNode: (kind: CircuitNode['kind'], gateType?: GateType, customValue?: 0 | 1) => void;
  readonly onLoadExample: (graph: CircuitGraph, title: string) => void;
}

interface PaletteItem {
  readonly id: string;
  readonly kind: CircuitNode['kind'];
  readonly gateType?: GateType;
  readonly label: string;
  readonly iconSymbol: string;
  readonly customValue?: 0 | 1;
}

const GATE_ITEMS: readonly PaletteItem[] = [
  { id: 'gate_and', kind: 'gate', gateType: 'AND', label: 'AND Gate', iconSymbol: 'AND' },
  { id: 'gate_nand', kind: 'gate', gateType: 'NAND', label: 'NAND Gate', iconSymbol: 'NAND' },
  { id: 'gate_or', kind: 'gate', gateType: 'OR', label: 'OR Gate', iconSymbol: 'OR' },
  { id: 'gate_nor', kind: 'gate', gateType: 'NOR', label: 'NOR Gate', iconSymbol: 'NOR' },
  { id: 'gate_xor', kind: 'gate', gateType: 'XOR', label: 'XOR Gate', iconSymbol: 'XOR' },
  { id: 'gate_xnor', kind: 'gate', gateType: 'XNOR', label: 'XNOR Gate', iconSymbol: 'XNOR' },
  { id: 'gate_not', kind: 'gate', gateType: 'NOT', label: 'NOT Inverter', iconSymbol: 'NOT' },
];

const SOURCE_ITEMS: readonly PaletteItem[] = [
  { id: 'node_input', kind: 'input', label: 'Input Switch', iconSymbol: 'IN' },
  { id: 'node_output', kind: 'output', label: 'Output Probe', iconSymbol: 'OUT' },
  { id: 'node_clock', kind: 'clock', label: 'Clock Source', iconSymbol: 'CLK' },
  { id: 'node_const0', kind: 'const', customValue: 0, label: 'Constant 0', iconSymbol: '0' },
  { id: 'node_const1', kind: 'const', customValue: 1, label: 'Constant 1', iconSymbol: '1' },
];

export const Palette: FC<PaletteProps> = ({ onAddNode, onLoadExample }) => {
  const [selectedExample, setSelectedExample] = useState<string>('');

  const handleDragStart = (e: DragEvent<HTMLButtonElement>, item: PaletteItem) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        kind: item.kind,
        gateType: item.gateType,
        customValue: item.customValue,
      })
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleSelectExample = (key: string) => {
    setSelectedExample(key);
    switch (key) {
      case 'half-adder':
        onLoadExample(halfAdder(), 'Half Adder');
        break;
      case 'full-adder':
        onLoadExample(fullAdder(), 'Full Adder');
        break;
      case 'ripple-4bit':
        onLoadExample(rippleCarryAdder(4), '4-Bit Ripple Carry Adder');
        break;
      case 'ripple-100bit':
        onLoadExample(rippleCarryAdder(100), '100-Bit Ripple Adder (500 Gates)');
        break;
      case 'xor-nands':
        onLoadExample(xorFromNands(), 'XOR from 4 NANDs');
        break;
      case 'sr-latch':
        onLoadExample(srLatchNor(), 'SR Latch (NOR)');
        break;
      case 'd-latch':
        onLoadExample(gatedDLatchNand(), 'Gated D Latch (NAND)');
        break;
      case 'd-flipflop':
        onLoadExample(masterSlaveDFlipFlop(), 'Master-Slave D Flip-Flop');
        break;
    }
  };

  return (
    <aside
      aria-label="Component Palette & Examples"
      className="flex flex-col gap-5 rounded-xl border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900 w-full sm:w-64 shrink-0"
    >
      {/* Logic Gates Section */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5">
          Logic Gates
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {GATE_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              onClick={() => onAddNode(item.kind, item.gateType)}
              aria-label={`Add ${item.label} to canvas`}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-left text-xs font-semibold text-gray-800 transition hover:border-blue-500 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-400 dark:hover:bg-blue-900/40"
            >
              <span className="inline-flex h-5 w-8 items-center justify-center rounded-sm bg-blue-100 font-mono text-[10px] font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                {item.iconSymbol}
              </span>
              <span className="truncate">{item.gateType}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Inputs / Terminals Section */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5">
          Inputs & Terminals
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {SOURCE_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              onClick={() => onAddNode(item.kind, item.gateType, item.customValue)}
              aria-label={`Add ${item.label} to canvas`}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-left text-xs font-semibold text-gray-800 transition hover:border-blue-500 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-400 dark:hover:bg-blue-900/40"
            >
              <span className="inline-flex h-5 w-7 items-center justify-center rounded-sm bg-emerald-100 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                {item.iconSymbol}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Reference Examples Menu */}
      <div className="border-t border-gray-200 pt-4 dark:border-gray-800">
        <label
          htmlFor="palette-example-select"
          className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1.5"
        >
          Load Reference Example
        </label>
        <select
          id="palette-example-select"
          value={selectedExample}
          onChange={(e) => handleSelectExample(e.target.value)}
          aria-label="Select reference example digital circuit"
          className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 shadow-2xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="" disabled>
            Choose an example circuit...
          </option>
          <option value="half-adder">1-Bit Half Adder (2 gates)</option>
          <option value="full-adder">1-Bit Full Adder (5 gates)</option>
          <option value="ripple-4bit">4-Bit Ripple Carry Adder (20 gates)</option>
          <option value="ripple-100bit">100-Bit Ripple Carry Adder (500 gates)</option>
          <option value="xor-nands">XOR Gate from 4 NANDs</option>
          <option value="sr-latch">SR Latch (NOR)</option>
          <option value="d-latch">Gated D Latch (NAND)</option>
          <option value="d-flipflop">Master-Slave D Flip-Flop</option>
        </select>
      </div>

      {/* Visual Wire Legend */}
      <div className="border-t border-gray-200 pt-4 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-400">
        <h4 className="font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-[10px] mb-2">
          Wire Value Legend
        </h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-6 bg-blue-700 rounded-sm" />
            <span>Thick Solid = Logic High (1)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-[1.5px] w-6 bg-gray-600 rounded-sm" />
            <span>Thin Solid = Logic Low (0)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-6 border-b border-dashed border-amber-600" />
            <span>Dashed = Unknown / Floating (X)</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
