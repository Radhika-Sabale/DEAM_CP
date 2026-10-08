/**
 * @file index.ts
 * Public entrypoint for the Boolean logic engine (Stage 4A + 4B).
 * Re-exports tokenization, parsing, formatting, three-valued evaluation,
 * truth table generation, canonical SOP/POS transformations, algebraic
 * simplification with step tracking, equivalence checking, and universal-gate
 * (NAND-only / NOR-only) conversion.
 */

// ── Stage 4A ────────────────────────────────────────────────────────────────

export {
  tokenize,
  type Token,
  type TokenType,
  type TokenizerResult,
} from './tokenizer';

export {
  parse,
  type ParseOptions,
  type ParseResult,
} from './parser';

export {
  toString,
  type PrintStyle,
} from './printer';

export {
  evaluate,
  evaluateBinary,
  type LogicAssignment,
  type BinaryLogicAssignment,
} from './evaluator';

export {
  buildTruthTable,
  tableFromMinterms,
  type TruthTableResult,
  getMinterms,
  getMaxterms,
  getDontCares,
  isTautology,
  isContradiction,
} from './truthTable';

export {
  canonicalSOP,
  canonicalPOS,
  canonicalForms,
  sopToAst,
  posToAst,
  mintermListToMaxtermList,
  maxtermListToMintermList,
  indicesToBinaryStrings,
  type CanonicalSopResult,
  type CanonicalPosResult,
  type CanonicalFormsResult,
} from './canonical';

// ── Stage 4B ────────────────────────────────────────────────────────────────

export { areEquivalent } from './equivalence';

export { tryApplyRules, applyRulesBottomUp, type RuleMatch } from './laws';

export { simplify, simplifiedAst, type SimplifyResult } from './simplify';

export { toNandOnlyForm, toNorOnlyForm } from './universalGates';
