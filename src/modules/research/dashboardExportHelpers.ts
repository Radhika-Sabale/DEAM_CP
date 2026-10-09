/**
 * @file dashboardExportHelpers.ts
 * Export serializers for TeacherDashboard (Stage 11C).
 */

import { formatCsvField } from '../../engine/evaluation/csvExport';
import type { MisconceptionRankingRow } from '../../engine/evaluation/types';

/**
 * Serializes misconception ranking rows into an RFC 4180 CSV string with UTF-8 BOM.
 */
export function toMisconceptionRankingCsv(
  rankings: readonly MisconceptionRankingRow[]
): string {
  const header = ['Tag', 'Title', 'Count', 'Distinct Participants', 'Error Share (%)', 'Affected Modules'];
  const lines: string[] = [header.join(',')];

  for (const r of rankings) {
    const row = [
      formatCsvField(r.tag),
      formatCsvField(r.title),
      formatCsvField(r.count),
      formatCsvField(r.distinctParticipants),
      formatCsvField((r.errorShare * 100).toFixed(1)),
      formatCsvField(r.affectedModules.join('; ')),
    ];
    lines.push(row.join(','));
  }

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
