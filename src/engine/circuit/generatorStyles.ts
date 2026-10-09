/**
 * @file generatorStyles.ts
 * Expression pattern validation (SOP/POS) and universal NAND/NOR conversion mapping.
 */

import type { BoolNode } from '../../types/ast';
import { toNandOnlyForm, toNorOnlyForm } from '../boolean/universalGates';

/**
 * Checks if an AST node is a literal (variable or complemented variable).
 *
 * @param node Boolean AST node
 * @returns True if node is a literal
 */
export function isLiteral(node: BoolNode): boolean {
  if (node.type === 'variable') return true;
  if (node.type === 'not' && node.child.type === 'variable') return true;
  return false;
}

/**
 * Checks if an AST node is a product term (literal, constant, or AND of literals).
 *
 * @param node Boolean AST node
 * @returns True if node is a valid product term
 */
export function isProductTerm(node: BoolNode): boolean {
  if (node.type === 'constant' || isLiteral(node)) return true;
  if (node.type === 'and') {
    return node.children.every((c) => isLiteral(c) || c.type === 'constant');
  }
  return false;
}

/**
 * Checks if an AST expression is in Sum-Of-Products (SOP) standard shape.
 *
 * @param node Boolean AST expression root
 * @returns True if expression matches SOP structure
 */
export function isSopForm(node: BoolNode): boolean {
  if (isProductTerm(node)) return true;
  if (node.type === 'or') {
    return node.children.every(isProductTerm);
  }
  return false;
}

/**
 * Checks if an AST node is a sum term (literal, constant, or OR of literals).
 *
 * @param node Boolean AST node
 * @returns True if node is a valid sum term
 */
export function isSumTerm(node: BoolNode): boolean {
  if (node.type === 'constant' || isLiteral(node)) return true;
  if (node.type === 'or') {
    return node.children.every((c) => isLiteral(c) || c.type === 'constant');
  }
  return false;
}

/**
 * Checks if an AST expression is in Product-Of-Sums (POS) standard shape.
 *
 * @param node Boolean AST expression root
 * @returns True if expression matches POS structure
 */
export function isPosForm(node: BoolNode): boolean {
  if (isSumTerm(node)) return true;
  if (node.type === 'and') {
    return node.children.every(isSumTerm);
  }
  return false;
}

/**
 * Applies universal gate transformation for NAND-only or NOR-only synthesis.
 *
 * @param ast Root expression node
 * @param style 'nand-only' | 'nor-only'
 * @returns Transformed Boolean AST
 */
export function convertToUniversalStyle(
  ast: BoolNode,
  style: 'nand-only' | 'nor-only'
): BoolNode {
  if (style === 'nand-only') {
    return toNandOnlyForm(ast).root;
  }
  return toNorOnlyForm(ast).root;
}

/**
 * Computes a structural canonical key for common subexpression sharing.
 * Commutative gates sort operand child keys alphabetically.
 *
 * @param node Boolean AST node
 * @returns Deterministic canonical key string
 */
export function canonicalSubexprKey(node: BoolNode): string {
  switch (node.type) {
    case 'constant':
      return `const:${node.value}`;
    case 'variable':
      return `var:${node.name}`;
    case 'not':
      return `not(${canonicalSubexprKey(node.child)})`;
    case 'and': {
      const keys = node.children.map(canonicalSubexprKey).sort();
      return `and(${keys.join(',')})`;
    }
    case 'or': {
      const keys = node.children.map(canonicalSubexprKey).sort();
      return `or(${keys.join(',')})`;
    }
    case 'xor': {
      const keys = [canonicalSubexprKey(node.left), canonicalSubexprKey(node.right)].sort();
      return `xor(${keys.join(',')})`;
    }
    case 'xnor': {
      const keys = [canonicalSubexprKey(node.left), canonicalSubexprKey(node.right)].sort();
      return `xnor(${keys.join(',')})`;
    }
    case 'nand': {
      const keys = [canonicalSubexprKey(node.left), canonicalSubexprKey(node.right)].sort();
      return `nand(${keys.join(',')})`;
    }
    case 'nor': {
      const keys = [canonicalSubexprKey(node.left), canonicalSubexprKey(node.right)].sort();
      return `nor(${keys.join(',')})`;
    }
  }
}
