/**
 * @file download.ts
 * Browser file download and file reading utilities for CSV, JSON, and research exports (Stage 11C).
 * Pure and deterministic filename builders; DOM interactions mockable in jsdom.
 */

/**
 * Result of reading a local file as text.
 */
export type ReadFileResult =
  | { readonly ok: true; readonly text: string; readonly filename: string }
  | { readonly ok: false; readonly error: string; readonly filename: string };

/**
 * Triggers a client-side file download via an invisible anchor and object URL.
 * Automatically revokes the object URL after triggering.
 *
 * @param filename Desired filename for the downloaded file
 * @param text Content to write into the file
 * @param mimeType MIME type (e.g. 'text/csv;charset=utf-8', 'application/json')
 */
export function downloadText(filename: string, text: string, mimeType: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Constructs a standardized, reproducible research export filename.
 * Pure function: accepts explicit date parameter to guarantee deterministic test output.
 *
 * @param prefix Category identifier (e.g. 'delab-log', 'delab-summary', 'delab-misconceptions')
 * @param participantId Participant pseudonym or identifier (sanitized for filesystem)
 * @param date ISO date string or Date object
 * @param extension File extension without leading dot (default: 'csv')
 */
export function formatDatedFilename(
  prefix: string,
  participantId: string,
  date: Date | string,
  extension: string = 'csv'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const cleanId = (participantId || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanExt = extension.replace(/^\./, '');

  return `${cleanPrefix}-${cleanId}-${yyyy}-${mm}-${dd}.${cleanExt}`;
}

/**
 * Reads a user-selected File object as UTF-8 text using the FileReader API.
 * Never throws; returns a typed ReadFileResult.
 *
 * @param file File selected from file input or drag-and-drop
 */
export function readFileAsText(file: File): Promise<ReadFileResult> {
  return new Promise((resolve) => {
    if (!file) {
      resolve({ ok: false, error: 'No file provided', filename: '' });
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve({ ok: true, text: reader.result, filename: file.name });
      } else {
        resolve({ ok: false, error: 'File content was not readable as text', filename: file.name });
      }
    };

    reader.onerror = () => {
      resolve({
        ok: false,
        error: reader.error?.message ?? 'Failed to read file',
        filename: file.name,
      });
    };

    try {
      reader.readAsText(file);
    } catch (err) {
      resolve({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        filename: file?.name ?? '',
      });
    }
  });
}
