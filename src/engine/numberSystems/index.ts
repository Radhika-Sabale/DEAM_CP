/**
 * @file index.ts
 * Public entrypoint for Stage 5A Number Systems engine.
 *
 * Provides pure functional radix conversion, structured step generation,
 * fixed-width complement representations (1 to 32 bits), BCD codes and addition,
 * and binary arithmetic with carry chains and condition flags.
 */

// Types
export type {
  ArithmeticFlags,
  BCDCode,
  BCDFormat,
  BcdAddResult,
  BcdConversionResult,
  BcdToDecimalResult,
  BinaryArithmeticResult,
  BitCarryStep,
  BitInterpretation,
  BorrowConvention,
  ConvertRadixOptions,
  FormatNumberOptions,
  NumberSystemError,
  NumberSystemResult,
  OnesComplementAddResult,
  Radix,
  RadixConversionResult,
  Representation,
  RepresentationRange,
  SignMagnitudeAddResult,
  StandardRadix,
  StepRecord,
} from './types';

// Radix Conversion & Parsing
export {
  charToDigitValue,
  convertRadix,
  digitValueToChar,
  formatNumber,
  getRadixName,
  parseNumber,
  tokenizeNumber,
} from './convert';

// Structured Step Generators
export {
  generateGroupingSteps,
  generatePositionalWeightSteps,
  generateRadixConversionSteps,
  generateRepeatedDivisionSteps,
  generateRepeatedMultiplicationSteps,
} from './steps';

// Complements & Fixed-Width Representations
export {
  decode,
  encode,
  fits,
  interpretBits,
  onesComplement,
  range,
  signExtend,
  truncate,
  twosComplement,
} from './complements';

// BCD & Gray Code
export {
  bcdAdd,
  bcdToDecimal,
  binaryToGrayWithSteps,
  decimalToBcd,
  grayToBinaryWithSteps,
} from './bcd';

// Binary Arithmetic
export {
  addBinary,
  explainOverflow,
  onesComplementAdd,
  signMagnitudeAdd,
  subtractBinary,
} from './arithmetic';
