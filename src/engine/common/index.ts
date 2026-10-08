/**
 * @file index.ts
 * Public entrypoint for shared pure engine helpers.
 * Re-exports bit utilities, Gray code transformations, and brute-force minimizer oracle.
 */

export {
  MAX_GENERAL_WIDTH,
  MAX_MINTERM_VARIABLES,
  maxValueForWidth,
  fitsInWidth,
  minimumWidth,
  getBit,
  setBit,
  popCount,
  bitsToArray,
  arrayToBits,
  toBinaryString,
  fromBinaryString,
  mintermToAssignment,
  assignmentToMinterm,
  hammingDistance,
  differsByOneBit,
  lowBitMask,
  logicalShiftLeft,
  logicalShiftRight,
  arithmeticShiftRight,
  rotateLeft,
  rotateRight,
  rotate,
} from './bitUtils';

export {
  type KMapCellPosition,
  binaryToGray,
  grayToBinary,
  binaryStringToGrayString,
  grayStringToBinaryString,
  generateGraySequence,
  grayDistance,
  kmapAxisOrder,
  kmapAxisLabels,
  cyclicAdjacency,
  kmapCellToMinterm,
  mintermToKMapCell,
} from './grayCode';

export {
  type Cube,
  type MinimizerResult,
  cubeToLiterals,
  cubeToString,
  toSopString,
  cubeToPosString,
  toPosString,
  verifyCover,
  minimizeSOP,
  minimizePOS,
} from './bruteForceMinimizer';

export {
  createPrng,
  prngInt,
  prngChoice,
  prngShuffle,
} from './seededRandom';
