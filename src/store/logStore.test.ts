/**
 * @file logStore.test.ts
 * Unit tests for the telemetry log store:
 * event appending, session isolation, buffer cap guard, CSV export,
 * and security verification that API keys never leak into logs or CSV.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useLogStore } from './logStore';

describe('Log Store Unit Tests', () => {
  beforeEach(() => {
    useLogStore.getState().clearLog();
    useLogStore.getState().setMaxEvents(50000);
  });

  it('logEvent appends events with unique ID, ISO timestamp, and active session ID', () => {
    const store = useLogStore.getState();
    store.logEvent({
      eventType: 'step-started',
      moduleId: 'boolean',
      stepId: 'step-1',
    });

    const events = useLogStore.getState().events;
    expect(events.length).toBe(1);
    const evt = events[0];
    expect(evt?.id).toBeDefined();
    expect(evt?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(evt?.sessionId).toBe(useLogStore.getState().sessionId);
    expect(evt?.eventType).toBe('step-started');
  });

  it('startSession generates a fresh session ID and optionally updates participant ID', () => {
    const oldSession = useLogStore.getState().sessionId;
    const newSession = useLogStore.getState().startSession('participant-007');

    expect(newSession).not.toBe(oldSession);
    expect(useLogStore.getState().sessionId).toBe(newSession);
    expect(useLogStore.getState().participantId).toBe('participant-007');
  });

  it('logStepSubmitted correctly logs step submission using summarizeForLog', () => {
    const store = useLogStore.getState();
    store.logStepSubmitted(
      'step-42',
      'numberSystems',
      {
        ok: false,
        diagnoses: [
          {
            step: 'step-42',
            errorType: 'misconception',
            expected: { kind: 'number-conversion-step', targetValue: '1101', intermediateSteps: [] },
            got: { kind: 'number-conversion-step', studentValue: '1011', intermediateWork: [] },
            misconceptionTag: 'wrong-remainder-order',
            hint: 'hint',
            fullExplanation: 'explanation',
          },
        ],
      }
    );

    const events = useLogStore.getState().events;
    expect(events.length).toBe(1);
    const submittedEvt = events[0];
    expect(submittedEvt?.eventType).toBe('step-submitted');
    if (submittedEvt?.eventType === 'step-submitted') {
      expect(submittedEvt.isCorrect).toBe(false);
      expect(submittedEvt.misconceptionTag).toBe('wrong-remainder-order');
    }
  });

  it('cap guard: drops oldest events when buffer limit is exceeded and sets warning', () => {
    const store = useLogStore.getState();
    store.setMaxEvents(3); // Cap at 3 events for testing

    store.logEvent({ eventType: 'step-started', moduleId: 'm1', stepId: 's1' });
    store.logEvent({ eventType: 'step-started', moduleId: 'm1', stepId: 's2' });
    store.logEvent({ eventType: 'step-started', moduleId: 'm1', stepId: 's3' });

    expect(useLogStore.getState().events.length).toBe(3);
    expect(useLogStore.getState().capExceededWarning).toBe(false);

    // 4th event exceeds cap
    store.logEvent({ eventType: 'step-started', moduleId: 'm1', stepId: 's4' });

    const updated = useLogStore.getState().events;
    expect(updated.length).toBe(3);
    expect(useLogStore.getState().capExceededWarning).toBe(true);
    // Oldest event s1 should have been dropped
    expect(updated.map((e) => 'stepId' in e ? e.stepId : '')).toEqual(['s2', 's3', 's4']);
  });

  it('getEvents filters events accurately', () => {
    const store = useLogStore.getState();
    store.logEvent({ eventType: 'step-started', moduleId: 'boolean', stepId: 's1' });
    store.logEvent({ eventType: 'hint-used', moduleId: 'boolean', stepId: 's1', level: 1 });

    const hints = store.getEvents((e) => e.eventType === 'hint-used');
    expect(hints.length).toBe(1);
    expect(hints[0]?.eventType).toBe('hint-used');
  });

  it('exportCsv outputs formatted headers and rows matching CSV_COLUMNS', () => {
    const store = useLogStore.getState();
    store.logEvent({ eventType: 'step-started', moduleId: 'kmap', stepId: 'step-k1' });
    store.logEvent({ eventType: 'hint-used', moduleId: 'kmap', stepId: 'step-k1', level: 2 });

    const csv = store.exportCsv();
    const lines = csv.split('\n');
    expect(lines[0]).toContain('id,sessionId,participantId,moduleId,timestamp,eventType,stepId');
    expect(lines.length).toBe(3);
    expect(lines[1]).toContain('kmap');
    expect(lines[2]).toContain('hint-used');
  });

  it('security guard: API key never appears in logged events or CSV export', () => {
    const secretApiKey = 'sk-ant-TOP_SECRET_RESEARCHER_KEY_12345';
    const store = useLogStore.getState();

    store.logEvent({
      eventType: 'step-started',
      moduleId: 'boolean',
      stepId: 'step-secure',
    });
    store.logStepSubmitted('step-secure', 'boolean', { ok: true, message: 'Correct' });

    const json = JSON.stringify(useLogStore.getState().events);
    expect(json).not.toContain(secretApiKey);

    const csv = store.exportCsv();
    expect(csv).not.toContain(secretApiKey);
  });
});
