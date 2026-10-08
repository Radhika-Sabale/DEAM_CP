/**
 * @file generator.ts
 * Expression-to-circuit schematic synthesizer.
 *
 * Implements:
 * - Multi-output synthesis with shared variable ports and constants.
 * - Architecture styles: direct, sop-and-or, pos-or-and, nand-only, nor-only.
 * - Fan-in tree decomposition for gates exceeding maxFanIn.
 * - Single-variable inverter sharing and canonical subexpression memoization.
 * - Final aesthetic graph layout via layoutCircuit.
 */

import type { BoolNode } from '../../types/ast';
import type { CircuitGraph, CircuitNode, CircuitWire, GateType } from '../../types/circuit';
import {
  canonicalSubexprKey,
  convertToUniversalStyle,
  isPosForm,
  isSopForm,
} from './generatorStyles';
import type {
  GenerateCircuitRequest,
  GenerateCircuitResponse,
  GeneratorStyle,
} from './generatorTypes';
import { layoutCircuit } from './layout';

export type {
  GenerateCircuitRequest,
  GenerateCircuitResponse,
  GenerateCircuitResult,
  GenerateCircuitError,
  GeneratorStyle,
} from './generatorTypes';

/**
 * Synthesizes a digital circuit schematic graph from one or more Boolean expressions.
 *
 * @param request Synthesis parameters and target expressions
 * @returns Discriminated synthesis result containing the laid-out CircuitGraph or structured error
 */
export function generateCircuit(request: GenerateCircuitRequest): GenerateCircuitResponse {
  if (request.outputs.length === 0) {
    return {
      ok: false,
      error: {
        code: 'no-outputs',
        message: 'At least one output expression must be provided for circuit generation.',
      },
    };
  }

  const maxFanIn = Math.min(8, Math.max(2, request.maxFanIn ?? 4));
  const shareInverters = request.shareInverters ?? true;
  const shareSubexprs = request.shareSubexpressions ?? true;
  const requestedStyle: GeneratorStyle = request.style ?? 'direct';

  const notes: string[] = [];
  let styleApplied: GeneratorStyle = requestedStyle;

  // Validate declared input variables coverage
  const declaredVars = new Set(request.variables);
  for (const out of request.outputs) {
    const usedVars = collectVariables(out.expr);
    for (const v of usedVars) {
      if (!declaredVars.has(v)) {
        return {
          ok: false,
          error: {
            code: 'unknown-variable',
            message: `Expression for output "${out.name}" references variable "${v}" which is not in the declared variables list.`,
          },
        };
      }
    }
  }

  // Validate and select style
  if (requestedStyle === 'sop-and-or') {
    for (const out of request.outputs) {
      if (!isSopForm(out.expr)) {
        styleApplied = 'direct';
        notes.push(
          `Expression for output "${out.name}" is not in standard SOP shape; fell back to direct style.`
        );
        break;
      }
    }
  } else if (requestedStyle === 'pos-or-and') {
    for (const out of request.outputs) {
      if (!isPosForm(out.expr)) {
        styleApplied = 'direct';
        notes.push(
          `Expression for output "${out.name}" is not in standard POS shape; fell back to direct style.`
        );
        break;
      }
    }
  }

  // Circuit builder state
  const nodes: CircuitNode[] = [];
  const wires: CircuitWire[] = [];
  let nodeSeq = 1;
  let wireSeq = 1;

  // 1. Create input nodes (strictly in request order)
  const inputMap = new Map<string, string>();
  for (const v of request.variables) {
    const id = `in_${v}`;
    nodes.push({ id, kind: 'input', label: v, x: 0, y: 0 });
    inputMap.set(v, id);
  }

  // 2. Constants lookup
  const constMap = new Map<0 | 1, string>();
  const getConstDriver = (val: 0 | 1): string => {
    const existing = constMap.get(val);
    if (existing) return existing;
    const id = `const_${val}`;
    nodes.push({ id, kind: 'const', value: val, x: 0, y: 0 });
    constMap.set(val, id);
    return id;
  };

  // 3. Shared inverters and subexpressions memo
  const sharedInverterMap = new Map<string, string>();
  const subexprMemo = new Map<string, string>();

  const addWire = (fromNodeId: string, toNodeId: string, toPin: number): void => {
    wires.push({
      id: `w_${wireSeq++}`,
      from: { nodeId: fromNodeId, pin: 0 },
      to: { nodeId: toNodeId, pin: toPin },
    });
  };

  const createGateNode = (gateType: GateType, inputCount: number): string => {
    const id = `g_${gateType.toLowerCase()}_${nodeSeq++}`;
    nodes.push({
      id,
      kind: 'gate',
      gateType,
      inputCount,
      x: 0,
      y: 0,
    });
    return id;
  };

  // Wide gate fan-in decomposition helper
  const buildDecomposedTree = (
    baseType: GateType,
    rootType: GateType,
    drivers: readonly string[]
  ): string => {
    if (drivers.length === 0) return getConstDriver(0);
    if (drivers.length === 1) {
      if (rootType === baseType) return drivers[0] ?? '';
      const gateId = createGateNode(rootType, 1);
      addWire(drivers[0] ?? '', gateId, 0);
      return gateId;
    }

    let currentLayer: string[] = [...drivers];

    while (currentLayer.length > maxFanIn) {
      const nextLayer: string[] = [];
      for (let i = 0; i < currentLayer.length; i += maxFanIn) {
        const chunk = currentLayer.slice(i, i + maxFanIn);
        if (chunk.length === 1) {
          nextLayer.push(chunk[0] ?? '');
        } else {
          const gateId = createGateNode(baseType, chunk.length);
          chunk.forEach((d, pin) => addWire(d, gateId, pin));
          nextLayer.push(gateId);
        }
      }
      currentLayer = nextLayer;
    }

    if (currentLayer.length === 1 && rootType === baseType) {
      return currentLayer[0] ?? '';
    }

    const finalGateId = createGateNode(rootType, currentLayer.length);
    currentLayer.forEach((d, pin) => addWire(d, finalGateId, pin));
    return finalGateId;
  };

  // Recursive AST synthesizer
  const synthesizeNode = (ast: BoolNode): string => {
    const key = canonicalSubexprKey(ast);
    if (shareSubexprs && subexprMemo.has(key)) {
      return subexprMemo.get(key) ?? '';
    }

    let driverId = '';

    switch (ast.type) {
      case 'constant':
        driverId = getConstDriver(ast.value);
        break;

      case 'variable':
        driverId = inputMap.get(ast.name) ?? getConstDriver(0);
        break;

      case 'not': {
        if (styleApplied === 'nand-only') {
          const childDriver = synthesizeNode(ast.child);
          const gateId = createGateNode('NAND', 2);
          addWire(childDriver, gateId, 0);
          addWire(childDriver, gateId, 1);
          driverId = gateId;
        } else if (styleApplied === 'nor-only') {
          const childDriver = synthesizeNode(ast.child);
          const gateId = createGateNode('NOR', 2);
          addWire(childDriver, gateId, 0);
          addWire(childDriver, gateId, 1);
          driverId = gateId;
        } else if (ast.child.type === 'variable' && shareInverters) {
          const vName = ast.child.name;
          const cachedInv = sharedInverterMap.get(vName);
          if (cachedInv) {
            driverId = cachedInv;
          } else {
            const vDriver = inputMap.get(vName) ?? getConstDriver(0);
            const gateId = createGateNode('NOT', 1);
            addWire(vDriver, gateId, 0);
            sharedInverterMap.set(vName, gateId);
            driverId = gateId;
          }
        } else {
          const childDriver = synthesizeNode(ast.child);
          const gateId = createGateNode('NOT', 1);
          addWire(childDriver, gateId, 0);
          driverId = gateId;
        }
        break;
      }

      case 'and': {
        const childDrivers = ast.children.map(synthesizeNode);
        driverId = buildDecomposedTree('AND', 'AND', childDrivers);
        break;
      }

      case 'or': {
        const childDrivers = ast.children.map(synthesizeNode);
        driverId = buildDecomposedTree('OR', 'OR', childDrivers);
        break;
      }

      case 'xor': {
        const leftDriver = synthesizeNode(ast.left);
        const rightDriver = synthesizeNode(ast.right);
        driverId = buildDecomposedTree('XOR', 'XOR', [leftDriver, rightDriver]);
        break;
      }

      case 'xnor': {
        const leftDriver = synthesizeNode(ast.left);
        const rightDriver = synthesizeNode(ast.right);
        driverId = buildDecomposedTree('XOR', 'XNOR', [leftDriver, rightDriver]);
        break;
      }

      case 'nand': {
        const leftDriver = synthesizeNode(ast.left);
        const rightDriver = synthesizeNode(ast.right);
        if (styleApplied === 'nand-only') {
          const gateId = createGateNode('NAND', 2);
          addWire(leftDriver, gateId, 0);
          addWire(rightDriver, gateId, 1);
          driverId = gateId;
        } else {
          driverId = buildDecomposedTree('AND', 'NAND', [leftDriver, rightDriver]);
        }
        break;
      }

      case 'nor': {
        const leftDriver = synthesizeNode(ast.left);
        const rightDriver = synthesizeNode(ast.right);
        if (styleApplied === 'nor-only') {
          const gateId = createGateNode('NOR', 2);
          addWire(leftDriver, gateId, 0);
          addWire(rightDriver, gateId, 1);
          driverId = gateId;
        } else {
          driverId = buildDecomposedTree('OR', 'NOR', [leftDriver, rightDriver]);
        }
        break;
      }
    }

    if (shareSubexprs) {
      subexprMemo.set(key, driverId);
    }
    return driverId;
  };

  // 4. Synthesize all outputs
  for (const out of request.outputs) {
    let targetAst = out.expr;
    if (styleApplied === 'nand-only') {
      targetAst = convertToUniversalStyle(out.expr, 'nand-only');
    } else if (styleApplied === 'nor-only') {
      targetAst = convertToUniversalStyle(out.expr, 'nor-only');
    }

    const driverId = synthesizeNode(targetAst);
    const outNodeId = `out_${out.name}`;
    nodes.push({ id: outNodeId, kind: 'output', label: out.name, x: 0, y: 0 });
    addWire(driverId, outNodeId, 0);
  }

  // 5. Layout synthesis and gate count
  const rawGraph: CircuitGraph = { nodes, wires };
  const graph = layoutCircuit(rawGraph);
  const gateCount = graph.nodes.filter((n) => n.kind === 'gate').length;

  return {
    ok: true,
    graph,
    gateCount,
    styleApplied,
    notes,
  };
}

/**
 * Extracts variable names from an AST expression.
 */
function collectVariables(node: BoolNode): Set<string> {
  const set = new Set<string>();
  const walk = (n: BoolNode): void => {
    switch (n.type) {
      case 'constant':
        break;
      case 'variable':
        set.add(n.name);
        break;
      case 'not':
        walk(n.child);
        break;
      case 'and':
      case 'or':
        n.children.forEach(walk);
        break;
      case 'xor':
      case 'xnor':
      case 'nand':
      case 'nor':
        walk(n.left);
        walk(n.right);
        break;
    }
  };
  walk(node);
  return set;
}
