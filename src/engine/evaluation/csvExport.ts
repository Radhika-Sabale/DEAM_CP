/**
 * @file csvExport.ts
 * Deterministic RFC 4180 CSV export for student interaction logs and researcher session summaries.
 * Includes spreadsheet formula injection protection and UTF-8 BOM support.
 */

import { CSV_COLUMNS, type LogEvent, type StepSubmittedEvent, type HintUsedEvent } from '../../types/logging';
import { SUMMARY_CSV_COLUMNS, summarizeSessions } from './sessionSummary';
import type { SessionSummaryRow } from './types';

export { SUMMARY_CSV_COLUMNS, summarizeSessions };

/**
 * Sanitizes and escapes a single field value according to RFC 4180 and formula injection rules.
 *
 * @param value Raw field value
 */
export function formatCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  let str = String(value);

  // Injection defense: prefix text starting with =, +, -, @ with a single quote
  if (typeof value === 'string') {
    const trimmed = str.trimStart();
    if (
      trimmed.startsWith('=') ||
      trimmed.startsWith('+') ||
      trimmed.startsWith('-') ||
      trimmed.startsWith('@')
    ) {
      str = `'${str}`;
    }
  }

  // Quote field if it contains commas, double-quotes, or newlines
  if (str.includes(',') || str.includes('"') || str.includes('\r') || str.includes('\n')) {
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return str;
}

/**
 * Converts an array of telemetry log events into an RFC 4180 CSV string.
 *
 * @param events Chronological telemetry log events
 * @param options Export options (includeBom defaults to true)
 */
export function toCsv(
  events: readonly LogEvent[],
  options: { readonly includeBom?: boolean } = {}
): string {
  const includeBom = options.includeBom !== false;
  // Stable sort: by timestamp ascending, then by id
  const sorted = Array.from(events).sort((a, b) => {
    const tCmp = a.timestamp.localeCompare(b.timestamp);
    if (tCmp !== 0) return tCmp;
    return a.id.localeCompare(b.id);
  });

  const lines: string[] = [];
  lines.push(CSV_COLUMNS.join(','));

  for (const ev of sorted) {
    const rowObj: Record<string, unknown> = {
      id: ev.id,
      sessionId: ev.sessionId,
      participantId: ev.participantId ?? '',
      moduleId: ev.moduleId,
      timestamp: ev.timestamp,
      eventType: ev.eventType,
      stepId: '',
      isCorrect: '',
      misconceptionTag: '',
      hintLevel: '',
      score: '',
      details: '',
    };

    switch (ev.eventType) {
      case 'step-started':
        rowObj.stepId = ev.stepId;
        break;
      case 'step-submitted': {
        const sub = ev as StepSubmittedEvent;
        rowObj.stepId = sub.stepId;
        rowObj.isCorrect = sub.isCorrect;
        rowObj.misconceptionTag = sub.misconceptionTag ?? '';
        rowObj.score = sub.score !== undefined ? sub.score : '';
        break;
      }
      case 'hint-used': {
        const h = ev as HintUsedEvent;
        rowObj.stepId = h.stepId;
        rowObj.hintLevel = h.level;
        break;
      }
      case 'module-completed':
        rowObj.score = ev.finalScore !== undefined ? ev.finalScore : '';
        rowObj.details = JSON.stringify({ durationMs: ev.durationMs });
        break;
      case 'module-handoff':
        rowObj.details = JSON.stringify({
          from: ev.fromModuleId,
          to: ev.toModuleId,
          payload: ev.payloadSummary ?? '',
        });
        break;
      case 'practice-started':
        rowObj.details = JSON.stringify({
          exerciseId: ev.exerciseId,
          category: ev.category ?? '',
        });
        break;
      case 'quiz-answered':
        rowObj.stepId = ev.questionId;
        rowObj.isCorrect = ev.isCorrect;
        rowObj.details = JSON.stringify({ selectedOption: ev.selectedOption });
        break;
      case 'pretest/posttest-submitted':
        rowObj.score = ev.score;
        rowObj.details = JSON.stringify({ testType: ev.testType, maxScore: ev.maxScore });
        break;
      case 'sus-submitted':
        rowObj.score = ev.score;
        rowObj.details = JSON.stringify(ev.responses);
        break;
    }

    const rowStr = CSV_COLUMNS.map((col) => formatCsvField(rowObj[col])).join(',');
    lines.push(rowStr);
  }

  const csvBody = lines.join('\r\n') + '\r\n';
  return includeBom ? `\uFEFF${csvBody}` : csvBody;
}

/**
 * Converts session summary rows into an RFC 4180 CSV string.
 *
 * @param summaries Session summary rows
 * @param options Export options (includeBom defaults to true)
 */
export function toSummaryCsv(
  summaries: readonly SessionSummaryRow[],
  options: { readonly includeBom?: boolean } = {}
): string {
  const includeBom = options.includeBom !== false;
  const lines: string[] = [];
  lines.push(SUMMARY_CSV_COLUMNS.join(','));

  for (const s of summaries) {
    const rowStr = SUMMARY_CSV_COLUMNS.map((col) => formatCsvField(s[col])).join(',');
    lines.push(rowStr);
  }

  const csvBody = lines.join('\r\n') + '\r\n';
  return includeBom ? `\uFEFF${csvBody}` : csvBody;
}
