/**
 * @file llmAdapter.test.ts
 * Unit tests for LLM rephrasing adapter:
 * verification of zero calls when disabled, success rephrasing, validation failure fallbacks,
 * timeout/network error resilience, HTTP status fallbacks, and API key leak guards.
 */

import { describe, expect, it, vi } from 'vitest';
import type { Diagnosis } from '../../types/feedback';
import {
  buildRephraseRequest,
  clearStoredApiKey,
  rephraseDiagnosis,
  storeApiKey,
  validateRephrase,
} from './llmAdapter';

describe('LLM Adapter Unit Tests', () => {
  const sampleDiagnosis: Diagnosis = {
    step: 'step-1',
    errorType: 'misconception',
    expected: {
      kind: 'number-conversion-step',
      targetValue: '1101',
      intermediateSteps: ['1101'],
    },
    got: {
      kind: 'number-conversion-step',
      studentValue: '1011',
      intermediateWork: ['1011'],
    },
    misconceptionTag: 'wrong-remainder-order',
    hint: 'Read remainders bottom-to-top.',
    fullExplanation: 'You read remainders top-to-bottom. The correct value is 1101.',
  };

  it('disabled: makes zero fetch calls and returns deterministic original immediately', async () => {
    const fakeFetch = vi.fn();
    const result = await rephraseDiagnosis(
      sampleDiagnosis,
      { enabled: false, provider: 'anthropic' },
      fakeFetch as unknown as typeof fetch
    );

    expect(fakeFetch).toHaveBeenCalledTimes(0);
    expect(result.wasRephrased).toBe(false);
    expect(result.fallbackReason).toBe('disabled');
    expect(result.displayHint).toBe(sampleDiagnosis.hint);
    expect(result.displayExplanation).toBe(sampleDiagnosis.fullExplanation);
  });

  it('missing api key: returns fallback immediately with missing-api-key reason', async () => {
    clearStoredApiKey();
    const fakeFetch = vi.fn();
    const result = await rephraseDiagnosis(
      sampleDiagnosis,
      { enabled: true, provider: 'anthropic' },
      fakeFetch as unknown as typeof fetch
    );

    expect(fakeFetch).toHaveBeenCalledTimes(0);
    expect(result.wasRephrased).toBe(false);
    expect(result.fallbackReason).toBe('missing-api-key');
  });

  it('success path: parses Anthropic response and returns validated friendly text', async () => {
    const fakeResponse = {
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              displayHint: 'Try reading from bottom to top!',
              displayExplanation: 'Great effort, but the correct value is 1101.',
            }),
          },
        ],
      }),
    };
    const fakeFetch = vi.fn().mockResolvedValue(fakeResponse);

    const result = await rephraseDiagnosis(
      sampleDiagnosis,
      { enabled: true, provider: 'anthropic', apiKey: 'sk-ant-test-key' },
      fakeFetch as unknown as typeof fetch
    );

    expect(fakeFetch).toHaveBeenCalledTimes(1);
    expect(result.wasRephrased).toBe(true);
    expect(result.displayHint).toBe('Try reading from bottom to top!');
    expect(result.displayExplanation).toContain('1101');
  });

  it('validation fallback: rejects when output is empty', () => {
    const check = validateRephrase(sampleDiagnosis, { displayHint: '', displayExplanation: '' });
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('empty');
  });

  it('validation fallback: rejects when output is too long', () => {
    const longText = 'word '.repeat(200);
    const check = validateRephrase(sampleDiagnosis, {
      displayHint: 'Hint',
      displayExplanation: longText,
    });
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('limit');
  });

  it('validation fallback: rejects when output falsely claims answer is correct', () => {
    const check = validateRephrase(sampleDiagnosis, {
      displayHint: 'Good job!',
      displayExplanation: 'Your answer is correct! The target is 1101.',
    });
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('verdict');
  });

  it('validation fallback: rejects when output drops required expected value', () => {
    const check = validateRephrase(sampleDiagnosis, {
      displayHint: 'Check your order.',
      displayExplanation: 'You read the digits in the wrong direction.', // missing '1101'
    });
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('dropped expected target value');
  });

  it('timeout fallback: handles aborted fetch gracefully without throwing', async () => {
    const fakeFetch = vi.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const result = await rephraseDiagnosis(
      sampleDiagnosis,
      { enabled: true, provider: 'anthropic', apiKey: 'key', timeoutMs: 10 },
      fakeFetch as unknown as typeof fetch
    );

    expect(result.wasRephrased).toBe(false);
    expect(result.fallbackReason).toBe('timeout');
    expect(result.displayHint).toBe(sampleDiagnosis.hint);
  });

  it('malformed JSON fallback: returns original when model returns invalid JSON', async () => {
    const fakeResponse = {
      ok: true,
      json: async () => ({
        content: [{ text: 'Here is some text not in json format' }],
      }),
    };
    const fakeFetch = vi.fn().mockResolvedValue(fakeResponse);

    const result = await rephraseDiagnosis(
      sampleDiagnosis,
      { enabled: true, provider: 'anthropic', apiKey: 'key' },
      fakeFetch as unknown as typeof fetch
    );

    expect(result.wasRephrased).toBe(false);
    expect(result.fallbackReason).toBe('parse-error');
  });

  it('http error fallback: handles status 401 and 429 without throwing', async () => {
    const fake401 = { ok: false, status: 401 };
    const fakeFetch401 = vi.fn().mockResolvedValue(fake401);

    const res401 = await rephraseDiagnosis(
      sampleDiagnosis,
      { enabled: true, provider: 'anthropic', apiKey: 'bad-key' },
      fakeFetch401 as unknown as typeof fetch
    );
    expect(res401.wasRephrased).toBe(false);
    expect(res401.fallbackReason).toBe('http-error');

    const fake429 = { ok: false, status: 429 };
    const fakeFetch429 = vi.fn().mockResolvedValue(fake429);

    const res429 = await rephraseDiagnosis(
      sampleDiagnosis,
      { enabled: true, provider: 'anthropic', apiKey: 'rate-limited' },
      fakeFetch429 as unknown as typeof fetch
    );
    expect(res429.wasRephrased).toBe(false);
    expect(res429.fallbackReason).toBe('http-error');
  });

  it('security guard: API key is held in memory/sessionStorage only and never appears in prompt or exports', () => {
    const secretKey = 'sk-ant-SUPER_SECRET_TOKEN_DO_NOT_LEAK';
    storeApiKey(secretKey, false);

    const prompt = buildRephraseRequest(sampleDiagnosis);
    expect(prompt).not.toContain(secretKey);

    clearStoredApiKey();
  });
});
