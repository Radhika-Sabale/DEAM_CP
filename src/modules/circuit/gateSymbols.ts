/**
 * @file gateSymbols.ts
 * Pure static SVG symbol data, standard ANSI/IEEE geometric paths, inversion bubble metadata,
 * and accessible label definitions for logic gates and circuit components.
 */

import type { CircuitNode, GateType } from '../../types/circuit';

/**
 * Geometric definition of a standard logic gate or schematic symbol.
 */
export interface GateSymbolDefinition {
  readonly type: GateType;
  readonly name: string;
  readonly description: string;
  readonly hasBubble: boolean;
  readonly defaultInputCount: number;
  readonly minInputCount: number;
  readonly maxInputCount: number;
  /**
   * Relative SVG body path for a standard 2-input gate (origin at top-left [0, 0], width 60, height 40).
   * Note: The component scales or stretches the path for multi-input gates.
   */
  readonly path: string;
  /** Optional separate path for XOR input offset arc */
  readonly inputArcPath?: string;
  /** Default symbol dimensions */
  readonly baseWidth: number;
  readonly baseHeight: number;
}

/**
 * Registry of ANSI/IEEE standard logic gate symbol definitions.
 */
export const GATE_SYMBOLS: Record<GateType, GateSymbolDefinition> = {
  AND: {
    type: 'AND',
    name: 'AND Gate',
    description: 'Outputs 1 only when all inputs are 1.',
    hasBubble: false,
    defaultInputCount: 2,
    minInputCount: 2,
    maxInputCount: 8,
    // Flat left back edge from (0,0) to (0,40), straight top edge to (25,0), arc to (25,40), straight bottom back to (0,40)
    path: 'M 0 0 L 25 0 C 45 0 55 10 55 20 C 55 30 45 40 25 40 L 0 40 Z',
    baseWidth: 55,
    baseHeight: 40,
  },
  NAND: {
    type: 'NAND',
    name: 'NAND Gate',
    description: 'Outputs 0 only when all inputs are 1 (Inverted AND).',
    hasBubble: true,
    defaultInputCount: 2,
    minInputCount: 2,
    maxInputCount: 8,
    path: 'M 0 0 L 25 0 C 45 0 55 10 55 20 C 55 30 45 40 25 40 L 0 40 Z',
    baseWidth: 55,
    baseHeight: 40,
  },
  OR: {
    type: 'OR',
    name: 'OR Gate',
    description: 'Outputs 1 when at least one input is 1.',
    hasBubble: false,
    defaultInputCount: 2,
    minInputCount: 2,
    maxInputCount: 8,
    // Curved back edge from (0,0) to (0,40) via (10,20), curved top to (55,20), curved bottom to (0,40)
    path: 'M 0 0 Q 12 20 0 40 Q 28 39 55 20 Q 28 1 0 0 Z',
    baseWidth: 55,
    baseHeight: 40,
  },
  NOR: {
    type: 'NOR',
    name: 'NOR Gate',
    description: 'Outputs 1 only when all inputs are 0 (Inverted OR).',
    hasBubble: true,
    defaultInputCount: 2,
    minInputCount: 2,
    maxInputCount: 8,
    path: 'M 0 0 Q 12 20 0 40 Q 28 39 55 20 Q 28 1 0 0 Z',
    baseWidth: 55,
    baseHeight: 40,
  },
  XOR: {
    type: 'XOR',
    name: 'XOR Gate',
    description: 'Outputs 1 when an odd number of inputs are 1.',
    hasBubble: false,
    defaultInputCount: 2,
    minInputCount: 2,
    maxInputCount: 8,
    // Main OR body shifted right + separate offset back arc
    path: 'M 6 0 Q 18 20 6 40 Q 34 39 60 20 Q 34 1 6 0 Z',
    inputArcPath: 'M 0 0 Q 12 20 0 40',
    baseWidth: 60,
    baseHeight: 40,
  },
  XNOR: {
    type: 'XNOR',
    name: 'XNOR Gate',
    description: 'Outputs 1 when an even number of inputs are 1 (Equivalence).',
    hasBubble: true,
    defaultInputCount: 2,
    minInputCount: 2,
    maxInputCount: 8,
    path: 'M 6 0 Q 18 20 6 40 Q 34 39 60 20 Q 34 1 6 0 Z',
    inputArcPath: 'M 0 0 Q 12 20 0 40',
    baseWidth: 60,
    baseHeight: 40,
  },
  NOT: {
    type: 'NOT',
    name: 'NOT Inverter',
    description: 'Outputs the inverted logic level of its single input.',
    hasBubble: true,
    defaultInputCount: 1,
    minInputCount: 1,
    maxInputCount: 1,
    // Triangle from (0,0) to (45,20) to (0,40)
    path: 'M 0 0 L 45 20 L 0 40 Z',
    baseWidth: 45,
    baseHeight: 40,
  },
  BUFFER: {
    type: 'BUFFER',
    name: 'Buffer',
    description: 'Passes its single input through unchanged.',
    hasBubble: false,
    defaultInputCount: 1,
    minInputCount: 1,
    maxInputCount: 1,
    path: 'M 0 0 L 45 20 L 0 40 Z',
    baseWidth: 45,
    baseHeight: 40,
  },
};

/**
 * Generates an accessible, human-readable description for any circuit node.
 *
 * @param node Circuit schematic node
 * @param outputValue Optional current logic value
 * @returns Accessible descriptive text for screen readers
 */
export function getNodeAccessibleName(node: CircuitNode, outputValue?: string): string {
  const valStr = outputValue !== undefined ? `, output ${outputValue}` : '';

  switch (node.kind) {
    case 'input':
      return `Input toggle ${node.label} (${node.id}), current value ${node.value}`;
    case 'output':
      return `Output probe ${node.label} (${node.id})${valStr}`;
    case 'clock':
      return `Clock source ${node.label} (${node.id}), half period ${node.halfPeriod} units${valStr}`;
    case 'const':
      return `Constant ${node.value} source (${node.id})`;
    case 'gate': {
      const sym = GATE_SYMBOLS[node.gateType];
      const lbl = node.label ? ` '${node.label}'` : '';
      return `${sym.name}${lbl} (${node.id}, ${node.inputCount} inputs)${valStr}`;
    }
  }
}

/**
 * Returns the short visible display symbol for a node.
 *
 * @param node Circuit schematic node
 * @returns Display text (e.g. "NAND", "IN", "OUT", "CLK")
 */
export function getNodeSymbolText(node: CircuitNode): string {
  switch (node.kind) {
    case 'input':
      return node.label || 'IN';
    case 'output':
      return node.label || 'OUT';
    case 'clock':
      return node.label || 'CLK';
    case 'const':
      return String(node.value);
    case 'gate':
      return node.gateType;
  }
}
