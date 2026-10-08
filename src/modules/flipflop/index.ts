/**
 * @file index.ts
 * Public entrypoint for the Flip-Flop & Latch Workbench laboratory module (Stage 9B).
 */

export { FlipFlopPage, default } from './FlipFlopPage';
export { ConfigPanel } from './ConfigPanel';
export { CharacteristicTables } from './CharacteristicTables';
export { ClockStepper } from './ClockStepper';
export { WaveformStrip } from './WaveformStrip';
export { FlipFlopTiming } from './FlipFlopTiming';
export { EventLog } from './EventLog';
export { RaceAroundExplorer } from './RaceAroundExplorer';
export { PracticePanel } from './PracticePanel';
export {
  flipFlopModuleDefinition,
  flipFlopModuleContract,
  extractFlipFlopInputs,
  createFlipFlopPatch,
  createFlipFlopStorePatch,
  validateFlipFlopPrerequisites,
  getCounterDesignAdvisory,
  type FlipFlopModuleInputs,
  type FlipFlopModuleOutputs,
} from './flipFlopModuleLogic';
export {
  flipFlopSessionReducer,
  createInitialSessionState,
  createDefaultInputs,
  getSignalValueAtTime,
  type FlipFlopSessionState,
  type FlipFlopSessionAction,
} from './flipFlopSession';
export {
  useFlipFlopSession,
  type UseFlipFlopSessionResult,
  type CursorValuation,
} from './useFlipFlopSession';
