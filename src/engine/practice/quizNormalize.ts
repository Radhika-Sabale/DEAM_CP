/**
 * @file quizNormalize.ts
 * Exact-match answer normalization for short-answer and numeric quiz questions (Stage 11A).
 *
 * Normalization pipeline:
 * 1. Trim leading and trailing whitespace.
 * 2. Convert to lowercase.
 * 3. Strip radix prefixes (e.g. "0b" for binary, "0x" for hex, "0o" for octal, or leading "$", "#").
 * 4. Remove internal whitespace in bit strings and numeric sequences (e.g. "1101 0101" → "11010101").
 * 5. Normalize comma-separated lists (e.g. "[1, 2]" → "1,2").
 */

/**
 * Normalizes a student answer string for exact-match comparison.
 *
 * @param input Raw student answer string
 * @returns Normalized canonical string
 */
export function normalizeAnswer(input: string): string {
  if (!input) return '';

  let s = input.trim().toLowerCase();

  // Strip brackets if formatting is a set or array e.g. "[1, 2]" -> "1, 2"
  if (s.startsWith('[') && s.endsWith(']')) {
    s = s.slice(1, -1).trim();
  }

  // Strip radix prefixes if present
  if (s.startsWith('0b')) s = s.slice(2);
  else if (s.startsWith('0x')) s = s.slice(2);
  else if (s.startsWith('0o')) s = s.slice(2);
  else if (s.startsWith('#') || s.startsWith('$')) s = s.slice(1);

  // Remove internal spaces if it looks like a bit string, hex, or number
  if (/^[0-9a-f\s,]+$/i.test(s)) {
    // If it has commas, collapse space around commas
    if (s.includes(',')) {
      s = s
        .split(',')
        .map((part) => part.trim().replace(/\s+/g, ''))
        .join(',');
    } else {
      // Pure number or bit string with spaces: strip all whitespace
      s = s.replace(/\s+/g, '');
    }
  }

  return s;
}

/**
 * Compares a student answer against an expected answer under normalization.
 *
 * @param student Raw student string
 * @param expected Reference expected answer string
 * @returns true if normalized answers match exactly
 */
export function matchesNormalized(student: string, expected: string): boolean {
  return normalizeAnswer(student) === normalizeAnswer(expected);
}
