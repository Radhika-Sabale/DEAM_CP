/**
 * @file csvParser.ts
 * RFC 4180 compliant streaming CSV parser (Stage 11B).
 * Supports quoted fields, embedded newlines, escaped quotes, and UTF-8 BOM stripping.
 */

export type ParseCsvResult =
  | { readonly ok: true; readonly rows: readonly (readonly string[])[] }
  | { readonly ok: false; readonly error: { readonly rowNumber: number; readonly reason: string } };

/**
 * Parses an RFC 4180 CSV string into a 2D array of string cells.
 * Correctly handles quoted fields with embedded commas, quotes, and newlines.
 *
 * @param text CSV string, optionally with UTF-8 BOM
 */
export function parseCsv(text: string): ParseCsvResult {
  let content = text;
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let rowNumber = 1;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < content.length && content[i + 1] === '"') {
          currentField += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        if (i + 1 < content.length && content[i + 1] === '\n') {
          i++; // skip \n
        }
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        rowNumber++;
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        rowNumber++;
      } else {
        currentField += char;
      }
    }
  }

  if (inQuotes) {
    return {
      ok: false,
      error: { rowNumber, reason: 'Unclosed quote detected at end of file' },
    };
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return { ok: true, rows };
}
