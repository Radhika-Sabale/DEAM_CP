import { afterEach, describe, expect, it, vi } from 'vitest';
import { clampQuestionCount, createQuizCache, createQuizGenerator, QUIZ_TOPICS, validateQuiz } from './quiz.mjs';

const questions = (count: number) => ({ questions: Array.from({ length: count }, (_, i) => ({ question: `Question ${i}`, options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'Because.' })) });

describe('AI quiz endpoint helpers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('allow-lists the six topics supported by the existing quiz engine', async () => {
    const generate = createQuizGenerator({ env: { GEMINI_API_KEY: 'test' }, fetchImpl: vi.fn() });
    expect(Object.keys(QUIZ_TOPICS)).toHaveLength(6);
    expect((await generate({ topicId: 'not-a-topic', difficulty: 'easy', questionCount: 3 })).status).toBe(400);
  });

  it('clamps question counts and validates the exact output schema', () => {
    expect(clampQuestionCount(1)).toBe(3);
    expect(clampQuestionCount(30)).toBe(10);
    expect(validateQuiz(questions(3), 3)).toBe(true);
    expect(validateQuiz({ questions: [{ ...questions(1).questions[0], options: ['A'] }] }, 1)).toBe(false);
  });

  it('caches by topic, difficulty, and count', async () => {
    const cache = createQuizCache();
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(questions(3)) }] } }] }) });
    const generate = createQuizGenerator({ env: { GEMINI_API_KEY: 'test', AI_MODEL: 'gemini-3.5-flash-lite' }, fetchImpl, cache });
    const input = { topicId: 'number-systems', difficulty: 'easy', questionCount: 3 };
    await generate(input);
    expect((await generate(input)).cached).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('expires cached quizzes after the configured lifetime', () => {
    let now = 10;
    const cache = createQuizCache(20, () => now);
    cache.set('topic:easy:3', questions(3));
    expect(cache.get('topic:easy:3')).not.toBeNull();
    now = 31;
    expect(cache.get('topic:easy:3')).toBeNull();
  });

  it('returns the missing-key fallback without calling Gemini', async () => {
    const fetchImpl = vi.fn();
    const generate = createQuizGenerator({ env: {}, fetchImpl });
    const result = await generate({ topicId: 'number-systems', difficulty: 'medium', questionCount: 10 });
    expect(result.status).toBe(503);
    expect(result.body.code).toBe('AI_NOT_CONFIGURED');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('retries a malformed model response once and then succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(questions(3)) }] } }] }) });
    const generate = createQuizGenerator({ env: { GEMINI_API_KEY: 'test' }, fetchImpl });
    expect((await generate({ topicId: 'boolean-tool', difficulty: 'hard', questionCount: 3 })).status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
