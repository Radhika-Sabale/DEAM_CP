/**
 * @file studyStore.test.ts
 * Tests for study store consent gating, form assignment, delete-all, and privacy invariant (Stage 11C).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useLogStore } from './logStore';
import { CONSENT_TEXT_PLACEHOLDER, useStudyStore } from './studyStore';

describe('studyStore', () => {
  beforeEach(() => {
    useStudyStore.getState().deleteStudyData();
  });

  it('manages participant ID generation and deterministic form order', () => {
    const store = useStudyStore.getState();
    const generatedId = store.generateParticipantId();
    expect(generatedId).toMatch(/^P-[A-Z0-9]{4}$/);
    expect(useStudyStore.getState().participantId).toBe(generatedId);

    const formOrder = useStudyStore.getState().formOrder;
    expect(['A', 'B']).toContain(formOrder.pre);
    expect(['A', 'B']).toContain(formOrder.post);
    expect(formOrder.pre).not.toBe(formOrder.post);
  });

  it('toggles consent flag and exposes neutral placeholder constant', () => {
    expect(CONSENT_TEXT_PLACEHOLDER).toContain('pedagogy research');
    expect(useStudyStore.getState().hasConsented).toBe(false);

    useStudyStore.getState().setConsent(true);
    expect(useStudyStore.getState().hasConsented).toBe(true);
  });

  it('clears all study data, logs, and state upon deleteStudyData', () => {
    useStudyStore.getState().setParticipantId('STUDENT-99');
    useStudyStore.getState().setConsent(true);
    useLogStore.getState().logEvent({
      eventType: 'step-started',
      moduleId: 'boolean-tool',
      stepId: 's-1',
    });

    expect(useLogStore.getState().events.length).toBeGreaterThan(0);
    expect(useStudyStore.getState().participantId).toBe('STUDENT-99');

    useStudyStore.getState().deleteStudyData();

    expect(useStudyStore.getState().participantId).toBe('');
    expect(useStudyStore.getState().hasConsented).toBe(false);
    expect(useLogStore.getState().events.length).toBe(0);
  });

  it('PRIVACY INVARIANT: ensures study store state never contains API keys', () => {
    useStudyStore.getState().setParticipantId('P-TEST123');
    useStudyStore.getState().setConsent(true);

    const state = useStudyStore.getState();
    const serialized = JSON.stringify(state);

    expect(serialized).not.toContain('apiKey');
    expect(serialized).not.toContain('anthropic');
    expect(serialized).not.toContain('openai');
    expect(serialized).not.toContain('gemini');
    expect(serialized).not.toContain('secret');
  });
});
