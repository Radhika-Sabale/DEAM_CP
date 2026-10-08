/**
 * @file graph.ts
 * Pure immutable graph model operations for gate-level schematics.
 *
 * Implements structural sharing for unchanged nodes and wires so that
 * downstream React components and memoized selectors can preserve identity.
 */

export {
  addNode,
  createEmptyCircuit,
  moveNodes,
  nextNodeId,
  nextWireId,
  removeNode,
} from './graphNodes';

export {
  setGateInputCount,
  updateNode,
  type NodeUpdatePatch,
  type SetGateInputCountResult,
} from './graphUpdate';

export {
  addWire,
  removeWire,
  type AddWireResult,
} from './graphWires';
