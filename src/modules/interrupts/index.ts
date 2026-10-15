/**
 * @file index.ts
 * Public exports for the 8086 Interrupt Controller & Subsystem module (Stage 15B).
 */

export { InterruptPage } from './InterruptPage';
export {
  useInterruptSession,
  type InterruptSession,
  type InterruptLogEntry,
} from './useInterruptSession';
export { IvtViewer, type IvtViewerProps } from './IvtViewer';
export { ScenarioEditor, type ScenarioEditorProps } from './ScenarioEditor';
export { InterruptLines, type InterruptLinesProps } from './InterruptLines';
export { EntrySequenceView, type EntrySequenceViewProps } from './EntrySequenceView';
export { FrameStackView, type FrameStackViewProps } from './FrameStackView';
export { InterruptTimeline, type InterruptTimelineProps } from './InterruptTimeline';
export { InterruptPractice, type InterruptPracticeProps } from './InterruptPractice';
export {
  INTERRUPT_SAMPLE_PROGRAMS,
  type InterruptSampleProgram,
} from './samplePrograms';
