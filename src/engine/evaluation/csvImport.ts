/**
 * @file csvImport.ts
 * Telemetry log event deserializer and merger (Stage 11B).
 * Validates parsed CSV rows against the LogEvent union, strips formula injection prefixes,
 * and merges multiple event logs deduplicating by ID.
 */

import { CSV_COLUMNS, type LogEvent } from '../../types/logging';
import { parseEventRow, unescapeInjection } from './csvImportEventParsers';
import { parseCsv, type ParseCsvResult } from './csvParser';

export { parseCsv, type ParseCsvResult };

/**
 * Validates parsed CSV rows against the LogEvent schema using strict hand-written guards.
 *
 * @param rows 2D array of CSV string cells
 */
export function csvToEvents(rows: readonly (readonly string[])[]): {
  readonly events: readonly LogEvent[];
  readonly rejectedRows: readonly { readonly rowNumber: number; readonly reason: string }[];
} {
  const events: LogEvent[] = [];
  const rejectedRows: { rowNumber: number; reason: string }[] = [];

  if (rows.length === 0) {
    return { events, rejectedRows };
  }

  const header = rows[0];
  if (!header) {
    return { events, rejectedRows };
  }

  const colIndex = new Map<string, number>();
  for (let i = 0; i < header.length; i++) {
    const h = header[i];
    if (h !== undefined) {
      colIndex.set(h.trim(), i);
    }
  }

  for (let c = 0; c < CSV_COLUMNS.length; c++) {
    const colName = CSV_COLUMNS[c];
    if (colName && !colIndex.has(colName)) {
      rejectedRows.push({
        rowNumber: 1,
        reason: `Header missing mandatory CSV column: "${colName}"`,
      });
      return { events, rejectedRows };
    }
  }

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || (row.length === 1 && (row[0] ?? '').trim() === '')) {
      continue; // Skip empty lines
    }

    const get = (col: string): string => {
      const idx = colIndex.get(col);
      return idx !== undefined && idx < row.length ? unescapeInjection(row[idx] ?? '') : '';
    };

    const id = get('id');
    const sessionId = get('sessionId');
    const participantId = get('participantId') || undefined;
    const moduleId = get('moduleId');
    const timestamp = get('timestamp');
    const eventType = get('eventType');

    if (!id || !sessionId || !moduleId || !timestamp || !eventType) {
      rejectedRows.push({
        rowNumber: r + 1,
        reason: 'Missing base log event fields (id, sessionId, moduleId, timestamp, eventType)',
      });
      continue;
    }

    try {
      const base = { id, sessionId, participantId, moduleId, timestamp };
      const ev = parseEventRow(eventType, base, get);
      events.push(ev);
    } catch (err) {
      rejectedRows.push({
        rowNumber: r + 1,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { events, rejectedRows };
}

/**
 * Merges multiple telemetry event streams, deduplicating records by unique event id
 * and sorting deterministically by timestamp ascending, then by id.
 *
 * @param logs Array of event arrays
 */
export function mergeEventLogs(logs: readonly (readonly LogEvent[])[]): readonly LogEvent[] {
  const map = new Map<string, LogEvent>();

  for (const list of logs) {
    for (const ev of list) {
      if (!map.has(ev.id)) {
        map.set(ev.id, ev);
      }
    }
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    const tCmp = a.timestamp.localeCompare(b.timestamp);
    if (tCmp !== 0) return tCmp;
    return a.id.localeCompare(b.id);
  });

  return merged;
}
