/**
 * @file logStore.ts
 * Telemetry log event store managing immutable student interaction logs,
 * session lifecycle, local storage persistence, buffer cap guards, and research CSV export.
 */

import { create } from 'zustand';
import type { FeedbackResult } from '../types/feedback';
import type { CsvColumn, LogEvent } from '../types/logging';
import { CSV_COLUMNS } from '../types/logging';
import { summarizeForLog } from '../engine/feedback/feedbackEngine';
import { loadEventLog, saveEventLog, clearEventLog } from './persistence';

/**
 * Distributive omitted payload type across the LogEvent discriminated union.
 */
type DistributeOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type LogEventPayload = DistributeOmit<
  LogEvent,
  'id' | 'timestamp' | 'sessionId' | 'participantId'
>;

/**
 * Configuration options for the log store buffer.
 */
export interface LogStoreConfig {
  /** Maximum number of events retained in memory and localStorage (default 50,000) */
  maxEvents: number;
}

export interface LogState {
  events: readonly LogEvent[];
  sessionId: string;
  participantId?: string;
  maxEvents: number;
  capExceededWarning: boolean;

  logEvent: (event: LogEventPayload) => void;
  logStepSubmitted: (
    stepId: string,
    moduleId: string,
    result: FeedbackResult,
    timing?: { readonly durationMs?: number; readonly score?: number }
  ) => void;
  startSession: (participantId?: string) => string;
  setParticipantId: (participantId: string | undefined) => void;
  setMaxEvents: (max: number) => void;
  clearLog: () => void;
  getEvents: (filter?: (e: LogEvent) => boolean) => readonly LogEvent[];
  exportCsv: () => string;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getInitialEvents(): readonly LogEvent[] {
  const result = loadEventLog();
  return result.ok ? result.value : [];
}

export const useLogStore = create<LogState>((set, get) => ({
  events: getInitialEvents(),
  sessionId: generateId(),
  participantId: undefined,
  maxEvents: 50000,
  capExceededWarning: false,

  startSession: (participantId) => {
    const newSessionId = generateId();
    set({
      sessionId: newSessionId,
      participantId: participantId ?? get().participantId,
    });
    return newSessionId;
  },

  setParticipantId: (participantId) => {
    set({ participantId });
  },

  setMaxEvents: (max) => {
    set({ maxEvents: max });
  },

  logEvent: (eventPayload) => {
    const { events, sessionId, participantId, maxEvents } = get();
    const id = generateId();
    const timestamp = new Date().toISOString();

    const fullEvent = {
      ...eventPayload,
      id,
      sessionId,
      participantId,
      timestamp,
    } as LogEvent;

    let updated = [...events, fullEvent];
    let capExceeded = false;

    if (updated.length > maxEvents) {
      capExceeded = true;
      // Drop oldest events to stay within cap
      updated = updated.slice(updated.length - maxEvents);
    }

    set({ events: updated, capExceededWarning: capExceeded });
    saveEventLog(updated);
  },

  logStepSubmitted: (stepId, moduleId, result, timing) => {
    const summary = summarizeForLog(result);
    get().logEvent({
      eventType: 'step-submitted',
      moduleId,
      stepId,
      isCorrect: summary.isCorrect,
      misconceptionTag: summary.misconceptionTag,
      score: timing?.score,
    });
  },

  clearLog: () => {
    clearEventLog();
    set({ events: [], capExceededWarning: false });
  },

  getEvents: (filter) => {
    const all = get().events;
    return filter ? all.filter(filter) : all;
  },

  exportCsv: () => {
    const events = get().events;
    return formatEventsToCsv(events);
  },
}));

/**
 * Pure function formatting telemetry events to standard RFC-4180 CSV rows.
 */
export function formatEventsToCsv(events: readonly LogEvent[]): string {
  const header = CSV_COLUMNS.join(',');
  const rows = events.map((event) => {
    const rowObj: Record<CsvColumn, string | number | boolean | null> = {
      id: event.id,
      sessionId: event.sessionId,
      participantId: event.participantId ?? null,
      moduleId: event.moduleId,
      timestamp: event.timestamp,
      eventType: event.eventType,
      stepId: 'stepId' in event ? (event.stepId as string) : null,
      isCorrect: 'isCorrect' in event ? (event.isCorrect as boolean) : null,
      misconceptionTag: 'misconceptionTag' in event ? (event.misconceptionTag as string) : null,
      hintLevel: 'level' in event ? (event.level as number) : null,
      score: 'score' in event ? (event.score as number) : null,
      details: null,
    };

    return CSV_COLUMNS.map((col) => {
      const val = rowObj[col];
      if (val === null || val === undefined) return '';
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return String(val);
    }).join(',');
  });

  return [header, ...rows].join('\n');
}

export const selectEvents = (state: LogState): readonly LogEvent[] => state.events;
export const selectSessionId = (state: LogState): string => state.sessionId;
export const selectParticipantId = (state: LogState): string | undefined => state.participantId;
export const selectCapWarning = (state: LogState): boolean => state.capExceededWarning;
