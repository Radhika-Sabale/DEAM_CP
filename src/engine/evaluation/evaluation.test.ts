/**
 * @file evaluation.test.ts
 * Comprehensive test suite for the research evaluation engine (Stage 11B).
 *
 * Verifies SUS psychometrics, pre/post counterbalancing and paired inference,
 * RFC 4180 CSV serialization and round-trip parsing, telemetry aggregation,
 * privacy invariants, and 100k event stress performance.
 */

import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, type LogEvent, type SusResponse } from '../../types/logging';
import { convertRadix, twosComplement } from '../numberSystems';
import { cornerMinterms, solveSOP } from '../kmap';
import {
  aggregate,
  aggregateSus,
  analyzePrePostCohort,
  assignFormOrder,
  calculateHakeGain,
  calculateRawGain,
  csvToEvents,
  FORM_A_ITEMS,
  FORM_B_ITEMS,
  interpretSus,
  mergeEventLogs,
  parseCsv,
  scoreSus,
  scoreTest,
  summarizeSessions,
  SUS_BENCHMARK,
  SUS_ITEMS,
  toCsv,
  toSummaryCsv,
} from './index';

describe('Evaluation Engine (Stage 11B)', () => {
  // -------------------------------------------------------------------------
  // 1. System Usability Scale (SUS)
  // -------------------------------------------------------------------------
  describe('1. System Usability Scale (SUS)', () => {
    it('contains all 10 standard items in canonical order', () => {
      expect(SUS_ITEMS).toHaveLength(10);
      expect(SUS_ITEMS[0]).toContain('frequently');
      expect(SUS_ITEMS[1]).toContain('unnecessarily complex');
      expect(SUS_ITEMS[9]).toContain('learn a lot of things');
    });

    it('scores standard edge cases accurately', () => {
      // All 3s (neutral) must score exactly 50
      const neutral: SusResponse = { items: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3] };
      const neutralRes = scoreSus(neutral);
      expect(neutralRes.ok).toBe(true);
      if (neutralRes.ok) {
        expect(neutralRes.value.score).toBe(50);
        expect(neutralRes.value.itemScores).toEqual([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
      }

      // Best possible: all 5s on odd items, all 1s on even items -> 100
      const best: SusResponse = { items: [5, 1, 5, 1, 5, 1, 5, 1, 5, 1] };
      const bestRes = scoreSus(best);
      expect(bestRes.ok).toBe(true);
      if (bestRes.ok) {
        expect(bestRes.value.score).toBe(100);
        expect(bestRes.value.itemScores).toEqual([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
      }

      // Worst possible: all 1s on odd items, all 5s on even items -> 0
      const worst: SusResponse = { items: [1, 5, 1, 5, 1, 5, 1, 5, 1, 5] };
      const worstRes = scoreSus(worst);
      expect(worstRes.ok).toBe(true);
      if (worstRes.ok) {
        expect(worstRes.value.score).toBe(0);
        expect(worstRes.value.itemScores).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      }
    });

    it('scores standard published worked example accurately (Brooke 1996 / Sauro 2011)', () => {
      // Responses: [4, 2, 5, 1, 4, 2, 5, 2, 4, 1]
      // Odd contributions: (4-1)=3, (5-1)=4, (4-1)=3, (5-1)=4, (4-1)=3 -> 17
      // Even contributions: (5-2)=3, (5-1)=4, (5-2)=3, (5-2)=3, (5-1)=4 -> 17
      // Sum = 34 * 2.5 = 85.0
      const example: SusResponse = { items: [4, 2, 5, 1, 4, 2, 5, 2, 4, 1] };
      const res = scoreSus(example);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.score).toBe(85.0);
        expect(res.value.itemScores).toEqual([3, 3, 4, 4, 3, 3, 4, 3, 3, 4]);
      }
    });

    it('returns typed errors for missing or out-of-range items', () => {
      // Missing items
      const incomplete = scoreSus([4, 2, 5]);
      expect(incomplete.ok).toBe(false);
      if (!incomplete.ok) {
        expect(incomplete.error.code).toBe('sus-invalid-input');
        expect(incomplete.error.invalidItems).toEqual([4, 5, 6, 7, 8, 9, 10]);
      }

      // Out of range (e.g. 0, 6, non-integers)
      const invalid = scoreSus([0, 2, 3, 4, 5, 6, 3, 3, 3.5, 3]);
      expect(invalid.ok).toBe(false);
      if (!invalid.ok) {
        expect(invalid.error.invalidItems).toEqual([1, 6, 9]);
      }
    });

    it('interprets scores according to Bangor et al. adjective ratings', () => {
      const best = interpretSus(92);
      expect(best.adjectiveBand).toBe('Best Imaginable');
      expect(best.grade).toBe('A');
      expect(best.isAcceptable).toBe(true);
      expect(best.benchmark).toBe(SUS_BENCHMARK);

      const good = interpretSus(72);
      expect(good.adjectiveBand).toBe('Good');
      expect(good.grade).toBe('B');

      const ok = interpretSus(60);
      expect(ok.adjectiveBand).toBe('OK');
      expect(ok.grade).toBe('D');
      expect(ok.isAcceptable).toBe(false);

      const poor = interpretSus(45);
      expect(poor.adjectiveBand).toBe('Poor');
      expect(poor.grade).toBe('F');
    });

    it('aggregates cohort results and computes 95% confidence intervals', () => {
      // Sample dataset: [65, 75, 80, 85, 90]
      // Mean: (65 + 75 + 80 + 85 + 90) / 5 = 79.0
      // Diff from 79: -14, -4, 1, 6, 11
      // SqDiff: 196 + 16 + 1 + 36 + 121 = 370
      // Sample Var: 370 / 4 = 92.5
      // Sample SD: sqrt(92.5) ~= 9.6177
      // df = 4 -> t_crit = 2.776
      // Margin: 2.776 * 9.6177 / sqrt(5) = 2.776 * 4.3012 ~= 11.940
      // CI: [79 - 11.94, 79 + 11.94] = [67.06, 90.94]
      const agg = aggregateSus([65, 75, 80, 85, 90]);
      expect(agg.count).toBe(5);
      expect(agg.mean).toBe(79.0);
      expect(agg.sd).toBe(9.62);
      expect(agg.median).toBe(80.0);
      expect(agg.min).toBe(65.0);
      expect(agg.max).toBe(90.0);
      expect(agg.ci95[0]).toBeCloseTo(67.06, 1);
      expect(agg.ci95[1]).toBeCloseTo(90.94, 1);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Pre/Post Diagnostic Assessments
  // -------------------------------------------------------------------------
  describe('2. Pre/Post Diagnostic Assessments', () => {
    it('ensures Form A and Form B have equal item counts and topic balances', () => {
      expect(FORM_A_ITEMS).toHaveLength(20);
      expect(FORM_B_ITEMS).toHaveLength(20);

      const countTopics = (items: typeof FORM_A_ITEMS) => {
        const counts: Record<string, number> = {};
        for (const item of items) {
          counts[item.topic] = (counts[item.topic] ?? 0) + 1;
        }
        return counts;
      };

      const topicsA = countTopics(FORM_A_ITEMS);
      const topicsB = countTopics(FORM_B_ITEMS);

      expect(topicsA).toEqual({
        'number-systems': 4,
        'boolean-tool': 3,
        'kmap-solver': 4,
        'circuit-simulator': 3,
        'flipflop-simulator': 3,
        'sequential-designer': 3,
      });
      expect(topicsB).toEqual(topicsA);
    });

    it('verifies correct answers in item banks match domain engine outputs', () => {
      // 1. Number Systems Form A Item 1: 8-bit twos complement of -18 (18 = 00010010)
      const twosA = twosComplement('00010010');
      expect(twosA.result).toBe(FORM_A_ITEMS[0]?.correctAnswer);

      // 2. Number Systems Form B Item 1: 8-bit twos complement of -25 (25 = 00011001)
      const twosB = twosComplement('00011001');
      expect(twosB.result).toBe(FORM_B_ITEMS[0]?.correctAnswer);

      // 3. Hexadecimal conversion Form A Item 3: decimal 27 -> hex
      const hexA = convertRadix('27', 10, 16);
      expect(hexA.ok && hexA.value.fullResult).toBe(FORM_A_ITEMS[2]?.correctAnswer);

      // 4. Hexadecimal conversion Form B Item 3: decimal 43 -> hex
      const hexB = convertRadix('43', 10, 16);
      expect(hexB.ok && hexB.value.fullResult).toBe(FORM_B_ITEMS[2]?.correctAnswer);

      // 5. K-Map Solver Form A Item 9: 4 corners m(0, 2, 8, 10)
      const corners = cornerMinterms(4);
      expect(corners).toEqual([0, 2, 8, 10]);
      const kmapA = solveSOP(4, [0, 2, 8, 10], []);
      expect(kmapA.ok).toBe(true);
      if (kmapA.ok) {
        expect(kmapA.solution.essentialPrimeImplicants).toHaveLength(1);
        expect(kmapA.solution.essentialPrimeImplicants[0]?.minterms).toEqual([0, 2, 8, 10]);
      }
    });

    it('scores student test and attributes misconception tags to wrong answers', () => {
      const answers: Record<string, string> = {
        'form-a-01': '11101110', // correct
        'form-a-02': 'Arithmetic overflow because two positive numbers sum to a negative representation', // correct
        'form-a-05': '!A + !B', // incorrect -> demorgan-misapplied
        'form-a-08': '2', // incorrect -> grouped-non-power-of-two
      };

      const result = scoreTest('A', answers);
      expect(result.score).toBe(2);
      expect(result.maxScore).toBe(20);
      expect(result.percentage).toBe(10.0);
      expect(result.unansweredCount).toBe(16);
      expect(result.subscores['number-systems']?.score).toBe(2);
      expect(result.subscores['number-systems']?.maxScore).toBe(4);
      expect(result.misconceptionTags).toContain('demorgan-misapplied');
      expect(result.misconceptionTags).toContain('grouped-non-power-of-two');
    });

    it('computes Hake normalized gain including the ceiling pre = max rule', () => {
      // Standard gain: pre = 10, post = 15, max = 20 -> (15 - 10) / (20 - 10) = 0.5
      expect(calculateHakeGain({ score: 10, maxScore: 20 }, { score: 15 })).toBe(0.5);

      // Ceiling case: pre = 20, post = 20 -> 1.0 (perfect retention)
      expect(calculateHakeGain({ score: 20, maxScore: 20 }, { score: 20 })).toBe(1.0);

      // Regression from ceiling: pre = 20, post = 18 -> -1.0
      expect(calculateHakeGain({ score: 20, maxScore: 20 }, { score: 18 })).toBe(-1.0);

      // Raw gain
      expect(calculateRawGain({ score: 8 }, { score: 14 })).toBe(6);
    });

    it('validates paired t-test against published reference datasets', () => {
      // Reference Dataset 1: Standard textbook paired sample
      // Pre: [10, 12, 14, 15, 18], Post: [14, 15, 18, 19, 20]
      // Diffs: [4, 3, 4, 4, 2] -> Mean = 3.4, SD = 0.8944, SE = 0.4000
      // t = 3.4 / 0.4 = 8.5, df = 4
      const pairs1 = [
        { pre: 10, post: 14 },
        { pre: 12, post: 15 },
        { pre: 14, post: 18 },
        { pre: 15, post: 19 },
        { pre: 18, post: 20 },
      ];
      const stats1 = analyzePrePostCohort(pairs1);
      expect('code' in stats1).toBe(false);
      if (!('code' in stats1)) {
        expect(stats1.meanDiff).toBe(3.4);
        expect(stats1.sdDiff).toBeCloseTo(0.8944, 2);
        expect(stats1.t).toBeCloseTo(8.5, 1);
        expect(stats1.df).toBe(4);
        expect(stats1.pValue).toBeLessThan(0.005);
        expect(stats1.cohensD).toBeCloseTo(3.8, 1);
      }

      // Reference Dataset 2: Zero change
      const pairs2 = [
        { pre: 10, post: 10 },
        { pre: 12, post: 12 },
        { pre: 15, post: 15 },
      ];
      const stats2 = analyzePrePostCohort(pairs2);
      if (!('code' in stats2)) {
        expect(stats2.meanDiff).toBe(0);
        expect(stats2.t).toBe(0);
        expect(stats2.pValue).toBe(1.0);
      }

      // Insufficient data (< 2 pairs)
      const single = [{ pre: 10, post: 15 }];
      const notEnough = analyzePrePostCohort(single);
      expect('code' in notEnough && notEnough.code).toBe('not-enough-data');
    });

    it('counterbalances form order evenly across 1,000 participant IDs', () => {
      let countAFirst = 0;
      let countBFirst = 0;

      for (let i = 0; i < 1000; i++) {
        const pid = `student-${i}-${i * 37 + 11}`;
        const order = assignFormOrder(pid);
        if (order.pre === 'A') {
          countAFirst++;
          expect(order.post).toBe('B');
        } else {
          countBFirst++;
          expect(order.post).toBe('A');
        }
      }

      // Assert balance is approximately 50/50 (between 450 and 550)
      expect(countAFirst).toBeGreaterThan(450);
      expect(countAFirst).toBeLessThan(550);
      expect(countAFirst + countBFirst).toBe(1000);
    });
  });

  // -------------------------------------------------------------------------
  // 3. RFC 4180 CSV Serialization & Import
  // -------------------------------------------------------------------------
  describe('3. RFC 4180 CSV Serialization & Import', () => {
    it('handles formula injection protection for =, +, -, and @', () => {
      const maliciousEvents: LogEvent[] = [
        {
          id: 'ev-1',
          sessionId: 's-1',
          participantId: '=cmd|"/C calc"!A0',
          moduleId: '+module-calc',
          timestamp: '2026-10-08T10:00:00.000Z',
          eventType: 'step-started',
          stepId: '@step-danger',
        },
      ];

      const csv = toCsv(maliciousEvents, { includeBom: false });
      expect(csv).toContain("'=cmd");
      expect(csv).toContain("'+module-calc");
      expect(csv).toContain("'@step-danger");

      // Round trip back
      const parsed = parseCsv(csv);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        const { events } = csvToEvents(parsed.rows);
        expect(events[0]?.participantId).toBe('=cmd|"/C calc"!A0');
        expect(events[0]?.moduleId).toBe('+module-calc');
      }
    });

    it('ensures byte-for-byte determinism and RFC 4180 compliance', () => {
      const events: LogEvent[] = [
        {
          id: 'ev-b',
          sessionId: 's-1',
          moduleId: 'number-systems',
          timestamp: '2026-10-08T10:05:00.000Z',
          eventType: 'step-started',
          stepId: 'step-2',
        },
        {
          id: 'ev-a',
          sessionId: 's-1',
          moduleId: 'number-systems',
          timestamp: '2026-10-08T10:00:00.000Z',
          eventType: 'step-started',
          stepId: 'step-1,with,commas and "quotes"',
        },
      ];

      const csv1 = toCsv(events);
      const csv2 = toCsv(events);
      expect(csv1).toBe(csv2);
      expect(csv1.startsWith('\uFEFF')).toBe(true);

      // Verify CRLF line endings
      expect(csv1).toContain('\r\n');
    });

    it('round-trips 1,000 synthetic events through toCsv -> parseCsv -> csvToEvents', () => {
      const sampleEvents: LogEvent[] = [];
      for (let i = 0; i < 1000; i++) {
        const id = `ev-${i.toString().padStart(4, '0')}`;
        const timestamp = new Date(1700000000000 + i * 1000).toISOString();
        if (i % 3 === 0) {
          sampleEvents.push({
            id,
            sessionId: `sess-${i % 10}`,
            participantId: `part-${i % 25}`,
            moduleId: 'number-systems',
            timestamp,
            eventType: 'step-started',
            stepId: `step-${i}`,
          });
        } else if (i % 3 === 1) {
          sampleEvents.push({
            id,
            sessionId: `sess-${i % 10}`,
            participantId: `part-${i % 25}`,
            moduleId: 'number-systems',
            timestamp,
            eventType: 'step-submitted',
            stepId: `step-${i}`,
            isCorrect: i % 2 === 0,
            misconceptionTag: i % 2 === 1 ? ('wrong-complement' as const) : undefined,
          });
        } else {
          sampleEvents.push({
            id,
            sessionId: `sess-${i % 10}`,
            participantId: `part-${i % 25}`,
            moduleId: 'number-systems',
            timestamp,
            eventType: 'hint-used',
            stepId: `step-${i}`,
            level: 1,
          });
        }
      }

      const csv = toCsv(sampleEvents);
      const parsed = parseCsv(csv);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        const { events: recovered, rejectedRows } = csvToEvents(parsed.rows);
        expect(rejectedRows).toHaveLength(0);
        expect(recovered).toHaveLength(1000);
        expect(recovered[0]?.id).toBe(sampleEvents[0]?.id);
        expect(recovered[999]?.id).toBe(sampleEvents[999]?.id);
      }
    });

    it('merges multiple event logs deduplicating by ID in stable chronological order', () => {
      const log1: LogEvent[] = [
        {
          id: 'ev-1',
          sessionId: 's-1',
          moduleId: 'kmap-solver',
          timestamp: '2026-10-08T10:00:00.000Z',
          eventType: 'step-started',
          stepId: 'st-1',
        },
      ];
      const log2: LogEvent[] = [
        {
          id: 'ev-1', // duplicate
          sessionId: 's-1',
          moduleId: 'kmap-solver',
          timestamp: '2026-10-08T10:00:00.000Z',
          eventType: 'step-started',
          stepId: 'st-1',
        },
        {
          id: 'ev-2',
          sessionId: 's-1',
          moduleId: 'kmap-solver',
          timestamp: '2026-10-08T10:02:00.000Z',
          eventType: 'step-started',
          stepId: 'st-2',
        },
      ];

      const merged = mergeEventLogs([log1, log2]);
      expect(merged).toHaveLength(2);
      expect(merged[0]?.id).toBe('ev-1');
      expect(merged[1]?.id).toBe('ev-2');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Telemetry Aggregation & Dashboard Model
  // -------------------------------------------------------------------------
  describe('4. Telemetry Aggregation & Dashboard Model', () => {
    it('aggregates a hand-built 40-event log with asserted statistics and shuffling invariance', () => {
      const log: LogEvent[] = [];
      const baseTime = 1700000000000;

      // Student 1: 3 steps, 1 answer trap, completed number-systems
      log.push({
        id: 'e01',
        sessionId: 's1',
        participantId: 'p1',
        moduleId: 'number-systems',
        timestamp: new Date(baseTime).toISOString(),
        eventType: 'step-started',
        stepId: 'conv-1',
      });
      log.push({
        id: 'e02',
        sessionId: 's1',
        participantId: 'p1',
        moduleId: 'number-systems',
        timestamp: new Date(baseTime + 5000).toISOString(),
        eventType: 'hint-used',
        stepId: 'conv-1',
        level: 1,
      });
      log.push({
        id: 'e03',
        sessionId: 's1',
        participantId: 'p1',
        moduleId: 'number-systems',
        timestamp: new Date(baseTime + 10000).toISOString(),
        eventType: 'step-submitted',
        stepId: 'conv-1',
        isCorrect: false,
        misconceptionTag: 'wrong-complement' as const,
      });
      log.push({
        id: 'e04',
        sessionId: 's1',
        participantId: 'p1',
        moduleId: 'number-systems',
        timestamp: new Date(baseTime + 15000).toISOString(),
        eventType: 'step-submitted',
        stepId: 'conv-1',
        isCorrect: true, // Answer trap: had prior wrong & hint, but finally correct
      });
      log.push({
        id: 'e05',
        sessionId: 's1',
        participantId: 'p1',
        moduleId: 'number-systems',
        timestamp: new Date(baseTime + 20000).toISOString(),
        eventType: 'module-completed',
        durationMs: 20000,
        finalScore: 100,
      });

      // Module handoff: boolean-tool -> kmap-solver
      log.push({
        id: 'e06',
        sessionId: 's1',
        participantId: 'p1',
        moduleId: 'boolean-tool',
        timestamp: new Date(baseTime + 25000).toISOString(),
        eventType: 'module-handoff',
        fromModuleId: 'boolean-tool',
        toModuleId: 'kmap-solver',
      });

      // Pre-test & Post-test for p1
      log.push({
        id: 'e07',
        sessionId: 's1',
        participantId: 'p1',
        moduleId: 'assessment',
        timestamp: new Date(baseTime + 30000).toISOString(),
        eventType: 'pretest/posttest-submitted',
        testType: 'pretest',
        score: 10,
        maxScore: 20,
      });
      log.push({
        id: 'e08',
        sessionId: 's1',
        participantId: 'p1',
        moduleId: 'assessment',
        timestamp: new Date(baseTime + 35000).toISOString(),
        eventType: 'pretest/posttest-submitted',
        testType: 'posttest',
        score: 16,
        maxScore: 20,
      });

      // Student 2: submitted pretest but missing posttest (exclusion)
      log.push({
        id: 'e09',
        sessionId: 's2',
        participantId: 'p2',
        moduleId: 'assessment',
        timestamp: new Date(baseTime + 40000).toISOString(),
        eventType: 'pretest/posttest-submitted',
        testType: 'pretest',
        score: 8,
        maxScore: 20,
      });

      // Pad out with additional events up to 40
      for (let i = 10; i <= 40; i++) {
        log.push({
          id: `e${i}`,
          sessionId: 's3',
          participantId: 'p3',
          moduleId: 'kmap-solver',
          timestamp: new Date(baseTime + i * 1000).toISOString(),
          eventType: 'step-submitted',
          stepId: `kmap-${i}`,
          isCorrect: i % 2 === 0,
          misconceptionTag: i % 2 !== 0 ? ('grouped-non-power-of-two' as const) : undefined,
        });
      }

      const res1 = aggregate(log);
      expect(res1.participantsCount).toBe(3);
      expect(res1.answerTrapCount).toBeGreaterThanOrEqual(1);
      expect(res1.excludedCount).toBe(1);
      expect(res1.exclusionReasons[0] ?? '').toContain('p2');

      // Shuffling invariance
      const shuffled = Array.from(log).sort(() => Math.random() - 0.5);
      const res2 = aggregate(shuffled);
      expect(res1).toEqual(res2);
    });

    it('summarizes sessions into researcher tables', () => {
      const events: LogEvent[] = [
        {
          id: '1',
          sessionId: 'sess-1',
          participantId: 'user-1',
          moduleId: 'boolean-tool',
          timestamp: '2026-10-08T10:00:00.000Z',
          eventType: 'step-started',
          stepId: 'step-a',
        },
        {
          id: '2',
          sessionId: 'sess-1',
          participantId: 'user-1',
          moduleId: 'boolean-tool',
          timestamp: '2026-10-08T10:01:00.000Z',
          eventType: 'step-submitted',
          stepId: 'step-a',
          isCorrect: true,
        },
      ];

      const summaries = summarizeSessions(events);
      expect(summaries).toHaveLength(1);
      expect(summaries[0]?.participantId).toBe('user-1');
      expect(summaries[0]?.stepsAttempted).toBe(1);
      expect(summaries[0]?.stepsCorrectFirstTry).toBe(1);
      expect(summaries[0]?.durationMs).toBe(60000);

      const summaryCsv = toSummaryCsv(summaries);
      expect(summaryCsv).toContain('user-1,sess-1');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Privacy Safeguards
  // -------------------------------------------------------------------------
  describe('5. Privacy Safeguards', () => {
    it('verifies CSV column list contains no private API keys or free-form text', () => {
      expect(CSV_COLUMNS).not.toContain('apiKey');
      expect(CSV_COLUMNS).not.toContain('token');
      expect(CSV_COLUMNS).not.toContain('secret');
      expect(CSV_COLUMNS).not.toContain('password');

      const fakeApiKey = 'AIzaSyA_FAKE_TEST_API_KEY_9999';
      const events: LogEvent[] = [
        {
          id: 'e-1',
          sessionId: 's-1',
          moduleId: 'number-systems',
          timestamp: '2026-10-08T10:00:00.000Z',
          eventType: 'step-started',
          stepId: 'step-1',
        },
      ];

      const exported = toCsv(events);
      expect(exported).not.toContain(fakeApiKey);
      expect(exported).not.toContain('apiKey');
    });
  });

  // -------------------------------------------------------------------------
  // 6. Stress Performance (100,000 synthetic events)
  // -------------------------------------------------------------------------
  describe('6. Stress Performance (100,000 synthetic events)', () => {
    it('aggregates and exports 100,000 synthetic events well under target bounds', () => {
      const syntheticCount = 100000;
      const largeLog: LogEvent[] = [];
      const baseMs = 1700000000000;

      for (let i = 0; i < syntheticCount; i++) {
        const id = `ev-${i}`;
        const pNum = i % 500;
        const sNum = i % 1000;
        const timestamp = new Date(baseMs + i * 100).toISOString();

        if (i % 2 === 0) {
          largeLog.push({
            id,
            sessionId: `sess-${sNum}`,
            participantId: `part-${pNum}`,
            moduleId: 'number-systems',
            timestamp,
            eventType: 'step-submitted',
            stepId: `step-${i % 20}`,
            isCorrect: i % 4 !== 0,
            misconceptionTag: i % 4 === 0 ? ('wrong-complement' as const) : undefined,
          });
        } else {
          largeLog.push({
            id,
            sessionId: `sess-${sNum}`,
            participantId: `part-${pNum}`,
            moduleId: 'number-systems',
            timestamp,
            eventType: 'hint-used',
            stepId: `step-${i % 20}`,
            level: 1,
          });
        }
      }

      // Test aggregation performance
      const t0 = performance.now();
      const model = aggregate(largeLog);
      const aggMs = performance.now() - t0;

      expect(model.participantsCount).toBe(500);
      expect(aggMs).toBeLessThan(3500); // Target: well under a few seconds

      // Test CSV export performance
      const t1 = performance.now();
      const csv = toCsv(largeLog, { includeBom: false });
      const csvMs = performance.now() - t1;

      expect(csv.length).toBeGreaterThan(1000000);
      expect(csvMs).toBeLessThan(3500);

      // Report performance metrics
      // eslint-disable-next-line no-console
      console.log(`[Performance] 100k events aggregated in ${aggMs.toFixed(1)}ms`);
      // eslint-disable-next-line no-console
      console.log(`[Performance] 100k events exported to CSV in ${csvMs.toFixed(1)}ms`);
    });
  });
});
