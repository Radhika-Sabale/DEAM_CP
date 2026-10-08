/**
 * @file llmAdapter.ts
 *
 * CRITICAL PEDAGOGICAL INVARIANT:
 * The LLM may only rephrase an already computed Diagnosis in friendlier language.
 * It never decides correctness, never changes `ok`, and its output never overrides the engine.
 *
 * ETHICAL RESEARCH NOTICE:
 * Sending a student's work to a third party (such as the Anthropic API) must be clearly
 * disclosed in the informed consent text of the research study.
 */

import type { Diagnosis } from '../../types/feedback';
import { stringifyExpected, stringifyGot } from './diagnosis';

/**
 * Configuration options for the LLM rephrasing service.
 */
export interface LlmConfig {
  readonly enabled: boolean;
  readonly provider: 'anthropic';
  readonly apiKey?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
}

/**
 * Validated response returned by rephraseDiagnosis.
 */
export interface RephraseResult {
  readonly displayHint: string;
  readonly displayExplanation: string;
  readonly wasRephrased: boolean;
  readonly fallbackReason?:
    | 'disabled'
    | 'missing-api-key'
    | 'timeout'
    | 'network-error'
    | 'http-error'
    | 'parse-error'
    | 'validation-rejected';
}

/**
 * In-memory API key cache.
 */
let inMemoryApiKey: string | null = null;
const SESSION_STORAGE_KEY = 'delab:session:llm_key';

/**
 * Stores the API key in memory or sessionStorage (never localStorage).
 */
export function storeApiKey(key: string, rememberInSession = false): void {
  inMemoryApiKey = key;
  if (rememberInSession && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, key);
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Retrieves the API key from in-memory cache or sessionStorage.
 */
export function getStoredApiKey(): string | null {
  if (inMemoryApiKey) return inMemoryApiKey;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Clears the stored API key from both memory and sessionStorage.
 */
export function clearStoredApiKey(): void {
  inMemoryApiKey = null;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Constructs prompt text derived strictly from Diagnosis fields.
 */
export function buildRephraseRequest(
  diagnosis: Diagnosis,
  options?: { readonly wordLimit?: number }
): string {
  const limit = options?.wordLimit ?? 60;
  const expStr = stringifyExpected(diagnosis.expected);
  const gotStr = stringifyGot(diagnosis.got);

  return [
    'You are a supportive digital electronics tutor. Rephrase the following diagnostic feedback in friendlier, encouraging tone.',
    'RULES:',
    '1. You MUST keep every number, binary string, and Boolean expression exactly as given.',
    `2. If a correct expected value (${expStr}) is provided, you MUST include it verbatim.`,
    '3. Do NOT add new claims, rules, or mathematical steps.',
    '4. Do NOT contradict the verdict: this step was INCORRECT. Never say "correct", "well done", or "great job".',
    `5. Keep your response under ${limit} words in JSON format: {"displayHint": "...", "displayExplanation": "..."}.`,
    '',
    `DIAGNOSIS FOR STEP: ${diagnosis.step}`,
    `Error Type: ${diagnosis.errorType}`,
    `Misconception Tag: ${diagnosis.misconceptionTag ?? 'none'}`,
    `Expected Value: ${expStr}`,
    `Student Answer: ${gotStr}`,
    `Rule Hint: ${diagnosis.hint}`,
    `Explanation: ${diagnosis.fullExplanation}`,
  ].join('\n');
}

/**
 * Strictly validates that the LLM response preserves mathematical integrity.
 */
export function validateRephrase(
  original: Diagnosis,
  rephrased: { readonly displayHint?: string; readonly displayExplanation?: string }
): { readonly valid: boolean; readonly reason?: string } {
  const hint = (rephrased.displayHint ?? '').trim();
  const expl = (rephrased.displayExplanation ?? '').trim();

  // 1. Rejects if empty
  if (!hint || !expl) {
    return { valid: false, reason: 'Rephrase output has empty hint or explanation' };
  }

  // 2. Rejects if too long (> 150 words or > 600 characters)
  const combined = `${hint} ${expl}`;
  if (combined.length > 600 || combined.split(/\s+/).length > 150) {
    return { valid: false, reason: 'Rephrase exceeds maximum word or character limit' };
  }

  // 3. Rejects if it contradicts error verdict
  const forbidden =
    /\b(you are correct|your answer is correct|that is correct|that's correct|is correct|well done|good job|perfect|great job)\b/i;
  if (forbidden.test(combined)) {
    return {
      valid: false,
      reason: 'Rephrase contradicts verdict: falsely claims student step is correct',
    };
  }

  // 4. Rejects if it drops the expected value when original contains it
  const expStr = stringifyExpected(original.expected).trim();
  if (expStr && (original.hint.includes(expStr) || original.fullExplanation.includes(expStr))) {
    if (!combined.includes(expStr)) {
      return { valid: false, reason: `Rephrase dropped expected target value: "${expStr}"` };
    }
  }

  return { valid: true };
}

/**
 * Rephrases a Diagnosis using an external LLM provider if enabled.
 * Returns deterministic original text on any failure or when disabled.
 */
export async function rephraseDiagnosis(
  diagnosis: Diagnosis,
  config: LlmConfig,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<RephraseResult> {
  const fallback = {
    displayHint: diagnosis.hint,
    displayExplanation: diagnosis.fullExplanation,
    wasRephrased: false,
  };

  if (!config.enabled) {
    return { ...fallback, fallbackReason: 'disabled' };
  }

  const apiKey = config.apiKey || getStoredApiKey();
  if (!apiKey) {
    return { ...fallback, fallbackReason: 'missing-api-key' };
  }

  const prompt = buildRephraseRequest(diagnosis);
  const model = config.model || 'claude-3-5-sonnet-20241022';
  const timeoutMs = config.timeoutMs ?? 5000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      return { ...fallback, fallbackReason: 'http-error' };
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    const rawText = data.content?.[0]?.text ?? '';

    let parsed: { displayHint?: string; displayExplanation?: string };
    try {
      const jsonStart = rawText.indexOf('{');
      const jsonEnd = rawText.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) {
        return { ...fallback, fallbackReason: 'parse-error' };
      }
      parsed = JSON.parse(rawText.slice(jsonStart, jsonEnd + 1)) as { displayHint?: string; displayExplanation?: string };
    } catch {
      return { ...fallback, fallbackReason: 'parse-error' };
    }

    const validation = validateRephrase(diagnosis, parsed);
    if (!validation.valid) {
      return { ...fallback, fallbackReason: 'validation-rejected' };
    }

    return {
      displayHint: (parsed.displayHint ?? diagnosis.hint).trim(),
      displayExplanation: (parsed.displayExplanation ?? diagnosis.fullExplanation).trim(),
      wasRephrased: true,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'));
    return {
      ...fallback,
      fallbackReason: isTimeout ? 'timeout' : 'network-error',
    };
  }
}
