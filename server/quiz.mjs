export const QUIZ_TOPICS = Object.freeze({
  'number-systems': { name: 'Number Systems', subtopics: 'radix conversion, binary arithmetic, signed representation, two’s complement, BCD, and code conversion' },
  'boolean-tool': { name: 'Boolean Expression Analysis', subtopics: 'Boolean laws, De Morgan’s theorems, expression simplification, truth tables, and universal gates' },
  'kmap-solver': { name: 'Karnaugh Map Minimization', subtopics: 'Gray-code ordering, valid groups, prime implicants, essential prime implicants, don’t-care cells, SOP, and POS' },
  'circuit-simulator': { name: 'Digital Circuit Schematic Simulation', subtopics: 'logic gates, wiring, propagation, circuit outputs, timing, and truth tables' },
  'flipflop-simulator': { name: 'Flip-Flops and Latches', subtopics: 'SR, JK, D, and T flip-flops, characteristic tables, excitation tables, clock edges, and latches' },
  'sequential-designer': { name: 'Synchronous Sequential Circuit Design', subtopics: 'state diagrams, state tables, excitation tables, state assignment, sequence detection, and lockout' },
});

export const QUIZ_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correctIndex: { type: 'integer' },
          explanation: { type: 'string' },
        },
        required: ['question', 'options', 'correctIndex', 'explanation'],
      },
    },
  },
  required: ['questions'],
};

export function clampQuestionCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(3, Math.min(10, parsed)) : 10;
}

export function validateQuiz(value, expectedCount) {
  if (!value || !Array.isArray(value.questions) || value.questions.length !== expectedCount) return false;
  const seen = new Set();
  return value.questions.every((item) => {
    if (!item || typeof item.question !== 'string' || !item.question.trim() ||
      typeof item.explanation !== 'string' || !item.explanation.trim() ||
      !Array.isArray(item.options) || item.options.length !== 4 ||
      !item.options.every((option) => typeof option === 'string' && option.trim()) ||
      !Number.isInteger(item.correctIndex) || item.correctIndex < 0 || item.correctIndex > 3) return false;
    const normalized = item.question.trim().toLocaleLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function createQuizCache(ttlMs = 60 * 60 * 1000, now = () => Date.now()) {
  const values = new Map();
  return {
    get(key) {
      const hit = values.get(key);
      if (!hit) return null;
      if (hit.expiresAt <= now()) { values.delete(key); return null; }
      return hit.value;
    },
    set(key, value) {
      if (values.size >= 200) values.delete(values.keys().next().value);
      values.set(key, { value, expiresAt: now() + ttlMs });
    },
    clear() { values.clear(); },
  };
}

export function createQuizPrompt(topic, difficulty, count) {
  return `Create exactly ${count} distinct four-option multiple-choice questions for a digital electronics and microprocessor laboratory course. Topic: ${topic.name}. Keep every question strictly within this topic and its subtopics: ${topic.subtopics}. Difficulty: ${difficulty}. Each question must have exactly one correct answer, four concise non-empty options, a short explanation, and a correctIndex from 0 through 3. Avoid duplicate questions. Return only the requested JSON structure.`;
}

export async function requestGeminiQuiz({ topic, difficulty, count, apiKey, model, fetchImpl = fetch }) {
  const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      contents: [{ parts: [{ text: createQuizPrompt(topic, difficulty, count) }] }],
      generationConfig: { responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: QUIZ_SCHEMA } } },
    }),
  });
  if (response.status === 429) throw Object.assign(new Error('Gemini quota is busy. Try again later.'), { status: 429 });
  if (!response.ok) throw new Error('The quiz service could not generate questions right now.');
  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export function createQuizGenerator({ env = process.env, fetchImpl = fetch, cache = createQuizCache() } = {}) {
  return async ({ topicId, difficulty, questionCount }) => {
    if (!Object.hasOwn(QUIZ_TOPICS, topicId)) return { status: 400, body: { error: 'Unknown quiz topic.' } };
    if (!['easy', 'medium', 'hard'].includes(difficulty)) return { status: 400, body: { error: 'Choose easy, medium, or hard difficulty.' } };
    const count = clampQuestionCount(questionCount);
    const key = `${topicId}:${difficulty}:${count}`;
    const cached = cache.get(key);
    if (cached) return { status: 200, body: cached, cached: true };
    if (String(env.AI_PROVIDER || 'gemini').trim() !== 'gemini') return { status: 503, body: { error: 'The configured AI provider is not supported.' } };
    if (!env.GEMINI_API_KEY) return { status: 503, body: { code: 'AI_NOT_CONFIGURED', error: 'AI quiz generation not configured. Showing the static quiz instead.' } };

    const model = env.AI_MODEL || 'gemini-3.5-flash-lite';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await requestGeminiQuiz({ topic: QUIZ_TOPICS[topicId], difficulty, count, apiKey: env.GEMINI_API_KEY, model, fetchImpl });
        if (validateQuiz(result, count)) {
          cache.set(key, result);
          return { status: 200, body: result, cached: false };
        }
      } catch (error) {
        if (error?.status === 429) return { status: 429, body: { error: error.message } };
        if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return { status: 504, body: { error: 'Question generation timed out. Please try again.' } };
        if (attempt === 1) return { status: 502, body: { error: 'Could not generate a valid quiz. Showing the static quiz instead.' } };
      }
    }
    return { status: 502, body: { error: 'Could not generate a valid quiz. Showing the static quiz instead.' } };
  };
}
