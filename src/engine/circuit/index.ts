/**
 * @file index.ts
 * Public entry point for the Circuit Graph & Discrete-Event Simulation Engine (Stage 8A).
 */

export { evaluateGate, invert } from './gateLogic';
export {
  addNode,
  addWire,
  createEmptyCircuit,
  moveNodes,
  nextNodeId,
  nextWireId,
  removeNode,
  removeWire,
  setGateInputCount,
  updateNode,
  type AddWireResult,
  type NodeUpdatePatch,
  type SetGateInputCountResult,
} from './graph';
export {
  buildIndex,
  faninCone,
  fanoutCone,
  stronglyConnectedComponents,
  structuralSignature,
  topologicalLevels,
  type CircuitIndex,
  type TopologicalLevelsResult,
} from './graphAnalysis';
export { validateCircuit, type ValidateCircuitOptions, type ValidationResult } from './validate';
export { EventQueue } from './eventQueue';
export type {
  CreateSimulatorResult,
  DelayMode,
  SimulationStatus,
  SimulationTrace,
  SimulatorOptions,
  SimulatorStats,
  StepResult,
  ValueChange,
} from './simulatorTypes';
export { CircuitSimulator, createSimulator } from './simulator';
export {
  fullAdder,
  gatedDLatchNand,
  halfAdder,
  masterSlaveDFlipFlop,
  rippleCarryAdder,
  srLatchNor,
  xorFromNands,
} from './examples';
