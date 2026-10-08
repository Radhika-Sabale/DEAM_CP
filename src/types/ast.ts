/**
 * @file ast.ts
 * Type definitions for Boolean expressions, Abstract Syntax Trees (AST),
 * truth tables, canonical forms, and symbolic simplification steps.
 *
 * Immutability policy:
 * AST nodes, spans, truth table entries, and canonical representations are marked
 * readonly because expression trees and canonical outputs must be treated as immutable
 * value objects by the symbolic simplification engine, truth-table generators, and parsers.
 */

/**
 * Three-valued logic representation used across the virtual laboratory:
 * - 0: False / Low / Ground
 * - 1: True / High / VCC
 * - "X": Don't Care / High-Impedance / Undefined
 */
export type LogicValue = 0 | 1 | 'X';

/**
 * Character span within source code string for localized diagnostic reporting.
 */
export interface SourceSpan {
  /** 0-based character index where the token/expression begins */
  readonly start: number;
  /** 0-based character index where the token/expression ends (exclusive) */
  readonly end: number;
}

/**
 * Syntax or semantic parsing error with exact source position.
 */
export interface ParseError {
  /** Human-readable description of parse failure */
  readonly message: string;
  /** 0-based offset where the error occurred */
  readonly position: number;
  /** Number of characters in the erroneous token span */
  readonly length: number;
}

/**
 * Constant logic literal node (0 or 1).
 */
export interface ConstantNode {
  readonly type: 'constant';
  readonly value: 0 | 1;
  readonly span?: SourceSpan;
}

/**
 * Variable identifier node (e.g., "A", "B", "in0").
 */
export interface VariableNode {
  readonly type: 'variable';
  readonly name: string;
  readonly span?: SourceSpan;
}

/**
 * Unary Boolean NOT inversion node.
 */
export interface NotNode {
  readonly type: 'not';
  readonly child: BoolNode;
  readonly span?: SourceSpan;
}

/**
 * N-ary Boolean AND node.
 * We choose n-ary children arrays for AND and OR operators to align directly
 * with canonical Sum-Of-Products (SOP) products and Product-Of-Sums (POS) sums,
 * preventing deeply skewed binary trees during multi-variable expansion.
 */
export interface AndNode {
  readonly type: 'and';
  readonly children: readonly BoolNode[];
  readonly span?: SourceSpan;
}

/**
 * N-ary Boolean OR node.
 * N-ary children simplify associative aggregation and K-Map term extraction.
 */
export interface OrNode {
  readonly type: 'or';
  readonly children: readonly BoolNode[];
  readonly span?: SourceSpan;
}

/**
 * Binary Exclusive-OR node.
 */
export interface XorNode {
  readonly type: 'xor';
  readonly left: BoolNode;
  readonly right: BoolNode;
  readonly span?: SourceSpan;
}

/**
 * Binary NAND node.
 */
export interface NandNode {
  readonly type: 'nand';
  readonly left: BoolNode;
  readonly right: BoolNode;
  readonly span?: SourceSpan;
}

/**
 * Binary NOR node.
 */
export interface NorNode {
  readonly type: 'nor';
  readonly left: BoolNode;
  readonly right: BoolNode;
  readonly span?: SourceSpan;
}

/**
 * Binary Exclusive-NOR (equivalence) node.
 */
export interface XnorNode {
  readonly type: 'xnor';
  readonly left: BoolNode;
  readonly right: BoolNode;
  readonly span?: SourceSpan;
}

/**
 * Discriminated union of all Boolean Abstract Syntax Tree node types.
 */
export type BoolNode =
  | ConstantNode
  | VariableNode
  | NotNode
  | AndNode
  | OrNode
  | XorNode
  | NandNode
  | NorNode
  | XnorNode;

/**
 * Individual row of a truth table.
 */
export interface TruthTableRow {
  /** 0-based integer decimal index corresponding to binary valuation (e.g. 0 to 2^n - 1) */
  readonly index: number;
  /** Binary input values ordered strictly by the parent TruthTable.variables array */
  readonly inputs: readonly (0 | 1)[];
  /** Evaluated output value, allowing 'X' for explicit don't-care rows */
  readonly output: LogicValue;
}

/**
 * Full truth table representation for an expression or combinational block.
 */
export interface TruthTable {
  /** Alphabetical or custom ordered variable names corresponding to column inputs */
  readonly variables: readonly string[];
  /** Rows indexed from 0 to (2^variables.length - 1) */
  readonly rows: readonly TruthTableRow[];
}

/**
 * Single literal in a canonical minterm or maxterm product/sum.
 */
export interface LiteralTerm {
  /** Variable symbol */
  readonly variable: string;
  /** True if the literal appears in inverted/complemented form */
  readonly negated: boolean;
}

/**
 * Product term in a Sum of Products (SOP) expression.
 */
export interface ProductTerm {
  /** Ordered literals making up this product term */
  readonly literals: readonly LiteralTerm[];
  /** Associated decimal minterm index if canonical (e.g. m3) */
  readonly mintermIndex?: number;
}

/**
 * Sum term in a Product of Sums (POS) expression.
 */
export interface SumTerm {
  /** Ordered literals making up this sum term */
  readonly literals: readonly LiteralTerm[];
  /** Associated decimal maxterm index if canonical (e.g. M2) */
  readonly maxtermIndex?: number;
}

/**
 * Canonical Sum of Products (SOP) definition.
 */
export interface CanonicalSop {
  /** Structured product terms */
  readonly terms: readonly ProductTerm[];
  /** Numeric minterm indices (Sigma m) */
  readonly minterms: readonly number[];
  /** Optional don't care indices (Sigma d) */
  readonly dontCares: readonly number[];
  /** AST representation of the full SOP expression */
  readonly expression: BoolNode;
}

/**
 * Canonical Product of Sums (POS) definition.
 */
export interface CanonicalPos {
  /** Structured sum terms */
  readonly terms: readonly SumTerm[];
  /** Numeric maxterm indices (Pi M) */
  readonly maxterms: readonly number[];
  /** Optional don't care indices (Pi d) */
  readonly dontCares: readonly number[];
  /** AST representation of the full POS expression */
  readonly expression: BoolNode;
}

/**
 * Complete canonical formulation including minterm, maxterm, and don't-care lists.
 */
export interface CanonicalForms {
  readonly minterms: readonly number[];
  readonly maxterms: readonly number[];
  readonly dontCares: readonly number[];
  readonly sop: CanonicalSop;
  readonly pos: CanonicalPos;
}

/**
 * Standard algebraic Boolean simplification laws supported by the step-by-step engine.
 */
export type BooleanLaw =
  | 'de-morgan'
  | 'absorption'
  | 'consensus'
  | 'distributive'
  | 'idempotent'
  | 'complement'
  | 'identity'
  | 'null'
  | 'involution'
  | 'associative'
  | 'commutative';

/**
 * Step recorded during interactive or automated algebraic expression reduction.
 */
export interface SimplificationStep {
  /** Name of the Boolean algebra axiom or theorem applied */
  readonly lawName: BooleanLaw;
  /** Sub-expression or tree before applying the law */
  readonly before: BoolNode;
  /** Sub-expression or tree resulting from the law application */
  readonly after: BoolNode;
  /** Student-friendly explanation of why and how this reduction took place */
  readonly explanation: string;
}

/**
 * Universal NAND-only implementation of an expression.
 */
export interface NandOnlyForm {
  /** AST composed exclusively of NAND nodes, NOT-as-NAND, and variables/constants */
  readonly root: BoolNode;
  /** Total count of NAND gates required */
  readonly gateCount: number;
  /** Readable text representation using NAND syntax */
  readonly expressionText: string;
}

/**
 * Universal NOR-only implementation of an expression.
 */
export interface NorOnlyForm {
  /** AST composed exclusively of NOR nodes, NOT-as-NOR, and variables/constants */
  readonly root: BoolNode;
  /** Total count of NOR gates required */
  readonly gateCount: number;
  /** Readable text representation using NOR syntax */
  readonly expressionText: string;
}
