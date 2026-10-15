/**
 * @file index.ts
 * Public entry point for the Arithmetic Logic Unit (ALU) Engine (Stage 13A).
 */

export * from './types';
export {
  computeZeroFlag,
  computeSignFlag,
  computeAddCarryFlag,
  computeAddOverflowFlag,
  computeSubBorrowFlag,
  computeSubOverflowFlag,
  computeLogicCarryFlag,
  computeLogicOverflowFlag,
  computeIncOverflowFlag,
  computeDecOverflowFlag,
  computeShiftCarryFlag,
  computeShiftOverflowFlag,
  explainFlag,
} from './flags';
export { buildCarryChain, verifyChain } from './carryChain';
export { execute, compareUnsigned, compareSigned } from './alu';
export {
  buildAdderSubtractorCircuit,
  getGateCorrespondence,
  getCircuitNodeForGateId,
  type GateCorrespondence,
} from './adderCircuit';
