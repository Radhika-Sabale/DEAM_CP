/**
 * @file quiz.ts
 * Deterministic 10-question quiz generator and time-agnostic scoring engine (Stage 11A).
 *
 * Each quiz contains exactly 10 distinct questions covering sub-skills within the topic.
 * Default difficulty mix: 4 easy, 4 medium, 2 hard.
 */

import type { MisconceptionTag } from '../../types/feedback';
import type {
  Difficulty,
  DifficultyMix,
  QuestionResult,
  Quiz,
  QuizQuestion,
  QuizResult,
} from './types';
import { DEFAULT_DIFFICULTY_MIX } from './types';
import { createPrng } from './random';
import { matchesNormalized } from './quizNormalize';
import {
  genBooleanQuestion,
  genCircuitQuestion,
  genFlipFlopQuestion,
  genKMapQuestion,
  genNumberSystemsQuestion,
  genSequentialQuestion,
} from './quizBank';

/** List of available quiz topics matching registered generator module IDs. */
export const AVAILABLE_TOPICS: readonly string[] = [
  'number-systems',
  'boolean-tool',
  'kmap-solver',
  'circuit-simulator',
  'flipflop-simulator',
  'sequential-designer',
];

/**
 * Dispatches question generation to the corresponding topic generator.
 */
function generateQuestionForTopic(
  topic: string,
  prng: () => number,
  difficulty: Difficulty,
  index: number
): QuizQuestion {
  switch (topic) {
    case 'number-systems':
      return genNumberSystemsQuestion(prng, difficulty, index);
    case 'boolean-tool':
      return genBooleanQuestion(prng, difficulty, index);
    case 'kmap-solver':
      return genKMapQuestion(prng, difficulty, index);
    case 'circuit-simulator':
      return genCircuitQuestion(prng, difficulty, index);
    case 'flipflop-simulator':
      return genFlipFlopQuestion(prng, difficulty, index);
    case 'sequential-designer':
      return genSequentialQuestion(prng, difficulty, index);
    default:
      throw new Error(`Unknown quiz topic: "${topic}". Available topics: ${AVAILABLE_TOPICS.join(', ')}`);
  }
}

/**
 * Builds a deterministic 10-question quiz for a topic.
 *
 * @param topic Module identifier
 * @param seed Random seed
 * @param difficultyMix Optional custom difficulty distribution (defaults to 4 easy, 4 medium, 2 hard)
 * @returns Complete Quiz object with exactly 10 distinct questions
 */
export function buildQuiz(
  topic: string,
  seed: number,
  difficultyMix: DifficultyMix = DEFAULT_DIFFICULTY_MIX
): Quiz {
  if (!AVAILABLE_TOPICS.includes(topic)) {
    throw new Error(`Invalid quiz topic: "${topic}". Available topics: ${AVAILABLE_TOPICS.join(', ')}`);
  }

  const prng = createPrng(seed);
  const questions: QuizQuestion[] = [];
  const seenPrompts = new Set<string>();

  // Determine difficulty sequence
  const tiers: Difficulty[] = [
    ...Array(difficultyMix.easy).fill('easy' as const),
    ...Array(difficultyMix.medium).fill('medium' as const),
    ...Array(difficultyMix.hard).fill('hard' as const),
  ];

  let qIndex = 0;
  let attempts = 0;
  while (questions.length < 10 && attempts < 100) {
    const diff = tiers[questions.length] ?? 'medium';
    const q = generateQuestionForTopic(topic, prng, diff, qIndex++);
    attempts++;

    // Ensure distinct questions
    if (!seenPrompts.has(q.prompt)) {
      seenPrompts.add(q.prompt);
      questions.push(q);
    }
  }

  if (questions.length < 10) {
    throw new Error(`Could not generate 10 distinct questions for topic "${topic}".`);
  }

  return {
    topic,
    seed,
    difficultyMix,
    questions,
  };
}

/**
 * Scores a completed student quiz attempt deterministically.
 *
 * @param quiz The quiz specification
 * @param answers Map of questionId -> student answer (selected option text or short-answer string)
 * @returns Scored QuizResult
 */
export function scoreQuiz(
  quiz: Quiz,
  answers: Record<string, string | number>
): QuizResult {
  const perQuestion: QuestionResult[] = [];
  const collectedTags: MisconceptionTag[] = [];
  let score = 0;

  for (const q of quiz.questions) {
    const rawAnswer = answers[q.id];
    const unanswered = rawAnswer === undefined || rawAnswer === null || String(rawAnswer).trim() === '';

    if (unanswered) {
      perQuestion.push({
        questionId: q.id,
        correct: false,
        unanswered: true,
      });
      continue;
    }

    const studentStr = String(rawAnswer).trim();

    if (q.type === 'multiple-choice') {
      const options = q.options ?? [];
      const isCorrect = studentStr === q.correctAnswer;

      let misconceptionTag: MisconceptionTag | undefined;
      if (!isCorrect) {
        const optionIndex = options.indexOf(studentStr);
        if (optionIndex !== -1 && q.optionMisconceptionTags) {
          misconceptionTag = q.optionMisconceptionTags[optionIndex];
          if (misconceptionTag) collectedTags.push(misconceptionTag);
        }
      } else {
        score++;
      }

      perQuestion.push({
        questionId: q.id,
        correct: isCorrect,
        unanswered: false,
        misconceptionTag,
      });
    } else {
      // Short answer or numeric comparison with normalization
      const isCorrect = matchesNormalized(studentStr, q.correctAnswer);
      if (isCorrect) score++;

      perQuestion.push({
        questionId: q.id,
        correct: isCorrect,
        unanswered: false,
      });
    }
  }

  return {
    topic: quiz.topic,
    score,
    totalQuestions: quiz.questions.length,
    perQuestion,
    misconceptionTags: Array.from(new Set(collectedTags)),
  };
}
