/**
 * @file index.ts
 * Public entrypoint for the Sequential State Machine and Counter Engine (Stages 10A and 10B).
 * Re-exports encoding, specs, state tables & diagrams, machine builders, excitation matrices,
 * K-map next-state Boolean equation synthesis, design orchestrators, lockout analysis & repair,
 * combinational circuit schematic building, behavioural simulation, and asynchronous ripple counters.
 */

export * from './encoding';
export * from './specs';
export * from './stateTable';
export * from './stateDiagram';
export * from './stateDiagramLayout';
export * from './counterMachines';
export * from './detectorMachines';
export * from './excitation';
export * from './nextStateEquations';
export * from './counterDesigner';
export * from './lockout';
export * from './lockoutFix';
export * from './circuitBuild';
export * from './simulate';
export * from './asyncRipple';
