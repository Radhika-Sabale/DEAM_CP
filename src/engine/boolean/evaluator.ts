/**
 * @file evaluator.ts
 * Evaluator for Boolean Abstract Syntax Trees.
 *
 * Supports:
 * - Three-valued logic (0, 1, "X") with strict IEEE 1164 / pessimistic simulation semantics.
 * - Dedicated fast path for fully-binary valuations (0 and 1) for high-performance truth-table generation.
 */

import type { BoolNode, LogicValue } from '../../types/ast';

/**
 * Variable assignment map for three-valued logic evaluation.
 */
export type LogicAssignment = Record<string, LogicValue> | ReadonlyMap<string, LogicValue>;

/**
 * Variable assignment map for fast two-valued binary evaluation.
 */
export type BinaryLogicAssignment = Record<string, 0 | 1> | ReadonlyMap<string, 0 | 1>;

/**
 * Retrieves a variable value from an assignment record or map.
 *
 * @param name Variable identifier
 * @param assignment Record or Map of variable valuations
 * @returns Assigned LogicValue
 * @throws Error if the variable is missing from the assignment
 */
function getVarValue(name: string, assignment: LogicAssignment): LogicValue {
  const val = assignment instanceof Map ? assignment.get(name) : (assignment as Record<string, LogicValue>)[name];
  if (val === undefined) {
    throw new Error(`Variable "${name}" is missing from assignment`);
  }
  if (val !== 0 && val !== 1 && val !== 'X') {
    throw new TypeError(`Invalid logic value for variable "${name}": ${String(val)}`);
  }
  return val;
}

/**
 * Three-valued NOT inversion.
 */
function not3(val: LogicValue): LogicValue {
  if (val === 0) return 1;
  if (val === 1) return 0;
  return 'X';
}

/**
 * Fast-path evaluator for binary assignments (0 and 1 only).
 * Performs short-circuiting logic operations directly on integers without string allocations.
 *
 * @param ast Boolean AST node
 * @param assignment Binary variable assignments (0 or 1)
 * @returns Evaluated binary logic value (0 or 1)
 * @throws Error if any referenced variable is missing from the assignment
 */
export function evaluateBinary(ast: BoolNode, assignment: BinaryLogicAssignment): 0 | 1 {
  switch (ast.type) {
    case 'constant':
      return ast.value;

    case 'variable': {
      const val =
        assignment instanceof Map
          ? assignment.get(ast.name)
          : (assignment as Record<string, 0 | 1>)[ast.name];
      if (val === undefined) {
        throw new Error(`Variable "${ast.name}" is missing from assignment`);
      }
      return val;
    }

    case 'not':
      return evaluateBinary(ast.child, assignment) === 1 ? 0 : 1;

    case 'and': {
      for (const child of ast.children) {
        if (evaluateBinary(child, assignment) === 0) return 0;
      }
      return 1;
    }

    case 'or': {
      for (const child of ast.children) {
        if (evaluateBinary(child, assignment) === 1) return 1;
      }
      return 0;
    }

    case 'xor':
      return (evaluateBinary(ast.left, assignment) ^ evaluateBinary(ast.right, assignment)) as 0 | 1;

    case 'nand':
      return evaluateBinary(ast.left, assignment) === 1 && evaluateBinary(ast.right, assignment) === 1 ? 0 : 1;

    case 'nor':
      return evaluateBinary(ast.left, assignment) === 0 && evaluateBinary(ast.right, assignment) === 0 ? 1 : 0;

    case 'xnor':
      return evaluateBinary(ast.left, assignment) === evaluateBinary(ast.right, assignment) ? 1 : 0;
  }
}

/**
 * Evaluates a Boolean AST expression with support for three-valued logic (0, 1, 'X').
 * Adheres to standard pessimism rules:
 * - 0 AND X = 0
 * - 1 OR X = 1
 * - X XOR anything = X
 *
 * @param ast Boolean AST node to evaluate
 * @param assignment Variable valuation map or record
 * @returns Evaluated three-valued logic value
 * @throws Error if any variable in the expression is missing from the assignment
 * @throws TypeError if arguments are invalid
 */
export function evaluate(ast: BoolNode, assignment: LogicAssignment): LogicValue {
  if (!ast || typeof ast !== 'object' || typeof ast.type !== 'string') {
    throw new TypeError(`Expected ast to be a valid BoolNode. Received: ${typeof ast}`);
  }
  if (!assignment || typeof assignment !== 'object') {
    throw new TypeError(`Expected assignment to be an object or Map. Received: ${typeof assignment}`);
  }

  switch (ast.type) {
    case 'constant':
      return ast.value;

    case 'variable':
      return getVarValue(ast.name, assignment);

    case 'not':
      return not3(evaluate(ast.child, assignment));

    case 'and': {
      let hasX = false;
      for (const child of ast.children) {
        const v = evaluate(child, assignment);
        if (v === 0) return 0;
        if (v === 'X') hasX = true;
      }
      return hasX ? 'X' : 1;
    }

    case 'or': {
      let hasX = false;
      for (const child of ast.children) {
        const v = evaluate(child, assignment);
        if (v === 1) return 1;
        if (v === 'X') hasX = true;
      }
      return hasX ? 'X' : 0;
    }

    case 'xor': {
      const left = evaluate(ast.left, assignment);
      const right = evaluate(ast.right, assignment);
      if (left === 'X' || right === 'X') return 'X';
      return left === right ? 0 : 1;
    }

    case 'nand': {
      const left = evaluate(ast.left, assignment);
      const right = evaluate(ast.right, assignment);
      if (left === 0 || right === 0) return 1;
      if (left === 1 && right === 1) return 0;
      return 'X';
    }

    case 'nor': {
      const left = evaluate(ast.left, assignment);
      const right = evaluate(ast.right, assignment);
      if (left === 1 || right === 1) return 0;
      if (left === 0 && right === 0) return 1;
      return 'X';
    }

    case 'xnor': {
      const left = evaluate(ast.left, assignment);
      const right = evaluate(ast.right, assignment);
      if (left === 'X' || right === 'X') return 'X';
      return left === right ? 1 : 0;
    }
  }
}
