/**
 * @file quiz.test.ts
 * Comprehensive test suite for Stage 11A Quiz Engine:
 * - 10-question structural invariants (all distinct, correct option once, distinct distractors).
 * - Distractor misconception tag attribution rate (asserted >= 80%).
 * - Seed-deterministic shuffling.
 * - Scoring engine edge cases (all correct, all blank, mixed, numeric normalization).
 * - Adaptive difficulty suggestion on scripted student attempt histories.
 */

/* eslint-disable no-console */
import { describe, expect, it } from 'vitest';
import { AVAILABLE_TOPICS, buildQuiz, scoreQuiz } from './quiz';
import { matchesNormalized, normalizeAnswer } from './quizNormalize';
import { suggestNextDifficulty, type RecentResult } from './difficulty';

describe('Quiz Engine and Normalization (Stage 11A)', () => {
  // ── 1. Structural Invariants ─────────────────────────────────────────────
  describe('1. 10-Question Structure and Options Invariants', () => {
    it('generates exactly 10 distinct questions for every registered topic', () => {
      for (const topic of AVAILABLE_TOPICS) {
        for (let seed = 1; seed <= 5; seed++) {
          const quiz = buildQuiz(topic, seed);
          expect(quiz.questions.length).toBe(10);

          // All 10 distinct prompts
          const prompts = new Set(quiz.questions.map((q) => q.prompt));
          expect(prompts.size).toBe(10);

          for (const q of quiz.questions) {
            if (q.type === 'multiple-choice') {
              expect(q.options).toBeDefined();
              expect(q.options!.length).toBe(4);

              // Correct answer present exactly once
              const correctMatches = q.options!.filter((opt) => opt === q.correctAnswer);
              expect(correctMatches.length).toBe(1);

              // All 4 options distinct
              const optSet = new Set(q.options);
              expect(optSet.size).toBe(4);

              // Correct option index matches
              expect(q.options![q.correctOptionIndex!]).toBe(q.correctAnswer);
            }
          }
        }
      }
    });
  });

  // ── 2. Misconception Tag Rate ─────────────────────────────────────────────
  describe('2. Distractor Misconception Tagging Rate (>= 80% Invariant)', () => {
    it('ensures at least 80% of multiple-choice distractors carry a misconception tag', () => {
      let totalDistractors = 0;
      let taggedDistractors = 0;

      for (const topic of AVAILABLE_TOPICS) {
        for (let seed = 1; seed <= 10; seed++) {
          const quiz = buildQuiz(topic, seed);
          for (const q of quiz.questions) {
            if (q.type === 'multiple-choice' && q.options && q.optionMisconceptionTags) {
              for (let i = 0; i < q.options.length; i++) {
                if (i !== q.correctOptionIndex) {
                  totalDistractors++;
                  if (q.optionMisconceptionTags[i] !== undefined) {
                    taggedDistractors++;
                  }
                }
              }
            }
          }
        }
      }

      const percentage = (taggedDistractors / totalDistractors) * 100;
      console.log(`[Quiz Engine] Distractor tagging rate: ${percentage.toFixed(1)}% (${taggedDistractors}/${totalDistractors})`);
      expect(percentage).toBeGreaterThanOrEqual(80);
    });
  });

  // ── 3. Seed Determinism ───────────────────────────────────────────────────
  describe('3. Determinism and Shuffling', () => {
    it('produces identical quiz questions and option order for identical seeds', () => {
      for (const topic of AVAILABLE_TOPICS) {
        const q1 = buildQuiz(topic, 42);
        const q2 = buildQuiz(topic, 42);
        expect(q1).toEqual(q2);
      }
    });
  });

  // ── 4. Normalization and Scoring Edge Cases ──────────────────────────────
  describe('4. Answer Normalization and Scoring', () => {
    it('normalizes radix prefixes, casing, and bit string spacing', () => {
      expect(matchesNormalized(' 1101 0101 ', '11010101')).toBe(true);
      expect(matchesNormalized('0b1101', '1101')).toBe(true);
      expect(matchesNormalized('0x1F', '1f')).toBe(true);
      expect(matchesNormalized('0o77', '77')).toBe(true);
      expect(normalizeAnswer('[1, 2, 3]')).toBe('1,2,3');
    });

    it('scores a perfect quiz with 10/10', () => {
      const quiz = buildQuiz('kmap-solver', 101);
      const answers: Record<string, string> = {};
      for (const q of quiz.questions) {
        answers[q.id] = q.correctAnswer;
      }
      const result = scoreQuiz(quiz, answers);
      expect(result.score).toBe(10);
      expect(result.perQuestion.every((r) => r.correct)).toBe(true);
      expect(result.misconceptionTags.length).toBe(0);
    });

    it('scores an entirely blank quiz with 0/10 and unanswered: true', () => {
      const quiz = buildQuiz('number-systems', 202);
      const result = scoreQuiz(quiz, {});
      expect(result.score).toBe(0);
      expect(result.perQuestion.every((r) => r.unanswered)).toBe(true);
      expect(result.perQuestion.every((r) => !r.correct)).toBe(true);
    });

    it('captures misconception tags from wrong multiple-choice answers', () => {
      const quiz = buildQuiz('number-systems', 303);
      const answers: Record<string, string> = {};
      // Pick first wrong option for each question
      for (const q of quiz.questions) {
        if (q.options) {
          const wrongOpt = q.options.find((opt) => opt !== q.correctAnswer);
          if (wrongOpt) answers[q.id] = wrongOpt;
        }
      }
      const result = scoreQuiz(quiz, answers);
      expect(result.score).toBe(0);
      expect(result.misconceptionTags.length).toBeGreaterThan(0);
    });
  });

  // ── 5. Adaptive Difficulty Rule ──────────────────────────────────────────
  describe('5. Adaptive Difficulty Rule (suggestNextDifficulty)', () => {
    it('moves up after 2 consecutive unassisted correct answers', () => {
      const history: RecentResult[] = [
        { correct: true, unassisted: true, usedLevel3Hint: false },
        { correct: true, unassisted: true, usedLevel3Hint: false },
      ];
      expect(suggestNextDifficulty('easy', history)).toBe('medium');
      expect(suggestNextDifficulty('medium', history)).toBe('hard');
      expect(suggestNextDifficulty('hard', history)).toBe('hard'); // clamps at hard
    });

    it('moves down after 2 consecutive incorrect answers', () => {
      const history: RecentResult[] = [
        { correct: false, unassisted: true, usedLevel3Hint: false },
        { correct: false, unassisted: true, usedLevel3Hint: false },
      ];
      expect(suggestNextDifficulty('hard', history)).toBe('medium');
      expect(suggestNextDifficulty('medium', history)).toBe('easy');
      expect(suggestNextDifficulty('easy', history)).toBe('easy'); // clamps at easy
    });

    it('moves down when level-3 hint is used twice', () => {
      const history: RecentResult[] = [
        { correct: true, unassisted: false, usedLevel3Hint: true },
        { correct: true, unassisted: false, usedLevel3Hint: true },
      ];
      expect(suggestNextDifficulty('hard', history)).toBe('medium');
    });

    it('maintains current difficulty when performance is mixed', () => {
      const history: RecentResult[] = [
        { correct: true, unassisted: true, usedLevel3Hint: false },
        { correct: false, unassisted: true, usedLevel3Hint: false },
      ];
      expect(suggestNextDifficulty('medium', history)).toBe('medium');
    });
  });
});
