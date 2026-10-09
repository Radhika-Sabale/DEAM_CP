/**
 * @file download.test.ts
 * Tests for file download, filename formatting, and FileReader utilities (Stage 11C).
 */

import { describe, expect, it, vi } from 'vitest';
import { downloadText, formatDatedFilename, readFileAsText } from './download';

describe('download utilities', () => {
  it('formats reproducible dated filenames', () => {
    const fixedDate = new Date('2026-10-09T08:00:00.000Z');
    const name1 = formatDatedFilename('delab-log', 'student-42', fixedDate, 'csv');
    expect(name1).toBe('delab-log-student-42-2026-10-09.csv');

    const name2 = formatDatedFilename('delab-summary', 'p/weird:id', fixedDate, '.json');
    expect(name2).toBe('delab-summary-p_weird_id-2026-10-09.json');

    const name3 = formatDatedFilename('delab-log', '', fixedDate);
    expect(name3).toBe('delab-log-anonymous-2026-10-09.csv');
  });

  it('triggers browser file download with Blob and cleans up object URL', () => {
    const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/dummy-blob-id');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');

    downloadText('test.csv', 'id,score\n1,100', 'text/csv');

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(removeChildSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:http://localhost/dummy-blob-id');

    clickSpy.mockRestore();
  });

  it('reads File object as text successfully', async () => {
    const sampleText = 'id,timestamp,eventType\ne-1,2026-10-09,step-started';
    const file = new File([sampleText], 'sample.csv', { type: 'text/csv' });

    const result = await readFileAsText(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe(sampleText);
      expect(result.filename).toBe('sample.csv');
    }
  });

  it('handles FileReader error path gracefully without throwing', async () => {
    const mockFile = {} as unknown as File;
    const result = await readFileAsText(mockFile);
    expect(result.ok).toBe(false);
  });
});
