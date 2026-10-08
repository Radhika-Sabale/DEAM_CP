/**
 * @file universalGates.ts
 * NAND-only and NOR-only conversion for Boolean ASTs.
 *
 * DESIGN PRINCIPLE: Correctness comes from exact algorithms, never from guesswork.
 * Every conversion rule is a local, pattern-based structural transformation on the AST.
 * After EVERY conversion the engine re-verifies equivalence with `areEquivalent`
 * (truth-table check) and throws if the conversion was unsound.
 *
 * Conversion rules used (De Morgan / universal-gate duals):
 *   NAND-only (binary inputs only):
 *     NOT(x)       = x NAND x
 *     x AND y      = (x NAND y) NAND (x NAND y)
 *     x OR y       = (x NAND x) NAND (y NAND y)
 *
 *   NOR-only (binary inputs only):
 *     NOT(x)       = x NOR x
 *     x OR y       = (x NOR y) NOR (x NOR y)
 *     x AND y      = (x NOR x) NOR (y NOR y)
 *
 * Pipeline per expression:
 *   1. toNandNorNormal – expand XOR/XNOR/NAND/NOR into NOT/AND/OR.
 *   2. binarize        – fold n-ary AND/OR into left-associative binary trees.
 *   3. toNandOnly / toNorOnly – apply the 3 two-input substitution rules above.
 */

import type { BoolNode, NandOnlyForm, NorOnlyForm } from '../../types/ast';
import { areEquivalent } from './equivalence';
import { toString } from './printer';

// ---------------------------------------------------------------------------
// Step 1 – normalise: expand XOR/XNOR/NAND/NOR into NOT/AND/OR only
// ---------------------------------------------------------------------------

function toNandNorNormal(node: BoolNode): BoolNode {
  switch (node.type) {
    case 'constant':
    case 'variable':
      return node;

    case 'not':
      return { type: 'not', child: toNandNorNormal(node.child) };

    case 'and':
      return { type: 'and', children: node.children.map(toNandNorNormal) };

    case 'or':
      return { type: 'or', children: node.children.map(toNandNorNormal) };

    case 'nand': {
      const l = toNandNorNormal(node.left);
      const r = toNandNorNormal(node.right);
      return { type: 'not', child: { type: 'and', children: [l, r] } };
    }

    case 'nor': {
      const l = toNandNorNormal(node.left);
      const r = toNandNorNormal(node.right);
      return { type: 'not', child: { type: 'or', children: [l, r] } };
    }

    case 'xor': {
      // x XOR y = (x AND y') OR (x' AND y)
      const x = toNandNorNormal(node.left);
      const y = toNandNorNormal(node.right);
      return {
        type: 'or',
        children: [
          { type: 'and', children: [x, { type: 'not', child: y }] },
          { type: 'and', children: [{ type: 'not', child: x }, y] },
        ],
      };
    }

    case 'xnor': {
      // x XNOR y = (x AND y) OR (x' AND y')
      const x = toNandNorNormal(node.left);
      const y = toNandNorNormal(node.right);
      return {
        type: 'or',
        children: [
          { type: 'and', children: [x, y] },
          { type: 'and', children: [{ type: 'not', child: x }, { type: 'not', child: y }] },
        ],
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Step 2 – binarize: fold n-ary AND/OR into left-associative binary trees.
// Required because the NAND/NOR substitutions are defined for exactly 2 inputs.
// ---------------------------------------------------------------------------

function binarize(node: BoolNode): BoolNode {
  switch (node.type) {
    case 'constant':
    case 'variable':
      return node;
    case 'not':
      return { type: 'not', child: binarize(node.child) };
    case 'and':
    case 'or': {
      const kids = node.children.map(binarize);
      // fold left: ((A op B) op C) op D …
      return kids.slice(1).reduce<BoolNode>(
        (acc, k) => ({ type: node.type, children: [acc, k] }),
        kids[0]!
      );
    }
    default:
      return node;
  }
}

// ---------------------------------------------------------------------------
// Step 3a – NAND-only conversion (input must have binary AND/OR/NOT only)
// ---------------------------------------------------------------------------

function toNandOnly(node: BoolNode): BoolNode {
  switch (node.type) {
    case 'constant':
    case 'variable':
      return node;

    case 'not': {
      // NOT(x) = x NAND x
      const x = toNandOnly(node.child);
      return { type: 'nand', left: x, right: x };
    }

    case 'and': {
      // x AND y = NOT(x NAND y) = (x NAND y) NAND (x NAND y)
      // children.length === 2 after binarize
      const x = toNandOnly(node.children[0]!);
      const y = toNandOnly(node.children[1]!);
      const nandXY: BoolNode = { type: 'nand', left: x, right: y };
      return { type: 'nand', left: nandXY, right: nandXY };
    }

    case 'or': {
      // x OR y = (x NAND x) NAND (y NAND y)
      // children.length === 2 after binarize
      const x = toNandOnly(node.children[0]!);
      const y = toNandOnly(node.children[1]!);
      const nx: BoolNode = { type: 'nand', left: x, right: x };
      const ny: BoolNode = { type: 'nand', left: y, right: y };
      return { type: 'nand', left: nx, right: ny };
    }

    default:
      return node;
  }
}

// ---------------------------------------------------------------------------
// Step 3b – NOR-only conversion (input must have binary AND/OR/NOT only)
// ---------------------------------------------------------------------------

function toNorOnly(node: BoolNode): BoolNode {
  switch (node.type) {
    case 'constant':
    case 'variable':
      return node;

    case 'not': {
      // NOT(x) = x NOR x
      const x = toNorOnly(node.child);
      return { type: 'nor', left: x, right: x };
    }

    case 'or': {
      // x OR y = NOT(x NOR y) = (x NOR y) NOR (x NOR y)
      // children.length === 2 after binarize
      const x = toNorOnly(node.children[0]!);
      const y = toNorOnly(node.children[1]!);
      const norXY: BoolNode = { type: 'nor', left: x, right: y };
      return { type: 'nor', left: norXY, right: norXY };
    }

    case 'and': {
      // x AND y = (x NOR x) NOR (y NOR y)
      // children.length === 2 after binarize
      const x = toNorOnly(node.children[0]!);
      const y = toNorOnly(node.children[1]!);
      const nx: BoolNode = { type: 'nor', left: x, right: x };
      const ny: BoolNode = { type: 'nor', left: y, right: y };
      return { type: 'nor', left: nx, right: ny };
    }

    default:
      return node;
  }
}

// ---------------------------------------------------------------------------
// Gate counter
// ---------------------------------------------------------------------------

function countGates(node: BoolNode, gateType: 'nand' | 'nor'): number {
  switch (node.type) {
    case 'constant':
    case 'variable':
      return 0;
    case 'nand':
    case 'nor':
      return (
        (node.type === gateType ? 1 : 0) +
        countGates(node.left, gateType) +
        countGates(node.right, gateType)
      );
    case 'not':
      return countGates(node.child, gateType);
    case 'and':
    case 'or':
      return node.children.reduce((s, c) => s + countGates(c, gateType), 0);
    case 'xor':
    case 'xnor':
      return countGates(node.left, gateType) + countGates(node.right, gateType);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Converts any Boolean AST into an equivalent expression using only NAND gates.
 *
 * Pipeline: normalize → binarize → NAND-only substitution.
 * Post-conversion equivalence is verified via truth-table check.
 *
 * @param ast Input Boolean AST
 * @returns NandOnlyForm with the converted AST, gate count, and printable expression
 * @throws Error if the conversion produces an inequivalent result (internal bug)
 */
export function toNandOnlyForm(ast: BoolNode): NandOnlyForm {
  const normalized = toNandNorNormal(ast);
  const binary = binarize(normalized);
  const root = toNandOnly(binary);

  if (!areEquivalent(ast, root)) {
    throw new Error(
      `[universalGates] NAND-only conversion produced an inequivalent result. ` +
        `This is an internal bug. Please report it.`
    );
  }

  const gateCount = countGates(root, 'nand');
  const expressionText = toString(root, 'words');

  return { root, gateCount, expressionText };
}

/**
 * Converts any Boolean AST into an equivalent expression using only NOR gates.
 *
 * Pipeline: normalize → binarize → NOR-only substitution.
 * Post-conversion equivalence is verified via truth-table check.
 *
 * @param ast Input Boolean AST
 * @returns NorOnlyForm with the converted AST, gate count, and printable expression
 * @throws Error if the conversion produces an inequivalent result (internal bug)
 */
export function toNorOnlyForm(ast: BoolNode): NorOnlyForm {
  const normalized = toNandNorNormal(ast);
  const binary = binarize(normalized);
  const root = toNorOnly(binary);

  if (!areEquivalent(ast, root)) {
    throw new Error(
      `[universalGates] NOR-only conversion produced an inequivalent result. ` +
        `This is an internal bug. Please report it.`
    );
  }

  const gateCount = countGates(root, 'nor');
  const expressionText = toString(root, 'words');

  return { root, gateCount, expressionText };
}
