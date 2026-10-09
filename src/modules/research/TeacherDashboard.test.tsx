/**
 * @file TeacherDashboard.test.tsx
 * Comprehensive unit and integration tests for TeacherDashboard (Stage 11C).
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toCsv } from '../../engine/evaluation/csvExport';
import type { LogEvent, StepSubmittedEvent } from '../../types/logging';
import * as downloadModule from '../../utils/download';
import { TeacherDashboard } from './TeacherDashboard';

describe('TeacherDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseHeader =
    'id,sessionId,participantId,moduleId,timestamp,eventType,stepId,isCorrect,misconceptionTag,hintLevel,score,details';

  it('imports two CSV files with overlapping events and reports the duplicate drop count', async () => {
    render(<TeacherDashboard />);

    const csv1 = [
      baseHeader,
      'ev-1,s1,p1,boolean,2026-10-09T10:00:00Z,step-started,step-1,,,,',
      'ev-2,s1,p1,boolean,2026-10-09T10:01:00Z,step-submitted,step-1,true,,,1,',
    ].join('\r\n');

    const csv2 = [
      baseHeader,
      'ev-2,s1,p1,boolean,2026-10-09T10:01:00Z,step-submitted,step-1,true,,,1,',
      'ev-3,s1,p1,boolean,2026-10-09T10:02:00Z,module-completed,,,,,10,{}',
    ].join('\r\n');

    const file1 = new File([csv1], 'student1.csv', { type: 'text/csv' });
    const file2 = new File([csv2], 'student2.csv', { type: 'text/csv' });

    const fileInput = screen.getByLabelText(/Upload CSV or JSON telemetry log files/i);
    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(screen.getByText(/Duplicates Dropped/i)).toBeInTheDocument();
    });

    // 3 unique events out of 4 raw => 1 duplicate dropped
    expect(screen.getByText(/Duplicates Dropped/i).closest('div')).toHaveTextContent('1');
    expect(screen.getByText(/Events Accepted/i).closest('div')).toHaveTextContent('3');
  });

  it('displays malformed rows in the rejection report with exact row numbers and reasons', async () => {
    render(<TeacherDashboard />);

    const malformedCsv = [
      baseHeader,
      'ev-1,s1,p1,boolean,2026-10-09T10:00:00Z,step-started,step-1,,,,',
      'bad-ev,,,,2026-10-09T10:01:00Z,invalid-type,,,,,', // Missing mandatory fields
    ].join('\r\n');

    const file = new File([malformedCsv], 'bad.csv', { type: 'text/csv' });
    const fileInput = screen.getByLabelText(/Upload CSV or JSON telemetry log files/i);
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Rejected Rows/i)).toBeInTheDocument();
    });

    // Row 3 should be reported
    expect(screen.getByText(/Row 3/i)).toBeInTheDocument();
  });

  it('renders misconception ranking table matching aggregator output and provides table alternative', async () => {
    render(<TeacherDashboard />);

    const csv = [
      baseHeader,
      'ev-1,s1,p1,kmap,2026-10-09T10:00:00Z,step-submitted,step-1,false,kmap-non-power-of-two,0,0,',
      'ev-2,s1,p2,kmap,2026-10-09T10:01:00Z,step-submitted,step-1,false,kmap-non-power-of-two,0,0,',
    ].join('\r\n');

    const file = new File([csv], 'kmap.csv', { type: 'text/csv' });
    const fileInput = screen.getByLabelText(/Upload CSV or JSON telemetry log files/i);
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Events Accepted/i)).toBeInTheDocument();
    });

    // Switch to Misconceptions tab
    const miscTab = screen.getByRole('button', { name: /^Misconceptions$/i });
    fireEvent.click(miscTab);

    // Verify misconception is rendered
    expect(screen.getAllByText(/kmap-non-power-of-two/i).length).toBeGreaterThanOrEqual(1);

    // Toggle "View as Pure Table"
    const toggleBtn = screen.getByRole('button', { name: /Switch to pure data table view/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByRole('button', { name: /Switch to bar visualization/i })).toBeInTheDocument();
  });

  it('exports merged events CSV matching the evaluation engine toCsv string', async () => {
    const downloadSpy = vi.spyOn(downloadModule, 'downloadText').mockImplementation(() => {});

    render(<TeacherDashboard />);

    const sampleEvent: StepSubmittedEvent = {
      id: 'ev-test-1',
      sessionId: 'sess-1',
      participantId: 'p-1',
      moduleId: 'boolean',
      timestamp: '2026-10-09T10:00:00.000Z',
      eventType: 'step-submitted',
      stepId: 'step-1',
      isCorrect: true,
      score: 1,
    };

    const file = new File([JSON.stringify([sampleEvent])], 'test.json', { type: 'application/json' });
    const fileInput = screen.getByLabelText(/Upload CSV or JSON telemetry log files/i);
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Merged Events \(CSV\)/i })).not.toBeDisabled();
    });

    const exportBtn = screen.getByRole('button', { name: /Merged Events \(CSV\)/i });
    fireEvent.click(exportBtn);

    expect(downloadSpy).toHaveBeenCalled();
    const exportedContent = downloadSpy.mock.calls[0]?.[1];
    const expectedCsv = toCsv([sampleEvent]);
    expect(exportedContent).toBe(expectedCsv);
  });

  it('keeps UI responsive and indicates progress when importing large datasets', async () => {
    render(<TeacherDashboard />);

    // Generate large batch of 20,000 synthetic events
    const largeEvents: LogEvent[] = [];
    for (let i = 0; i < 20000; i++) {
      largeEvents.push({
        id: `ev-large-${i}`,
        sessionId: 'sess-large',
        participantId: `p-${i % 50}`,
        moduleId: 'boolean',
        timestamp: new Date(1700000000000 + i * 1000).toISOString(),
        eventType: 'step-started',
        stepId: 'step-0',
      });
    }

    const file = new File([JSON.stringify(largeEvents)], 'large.json', { type: 'application/json' });
    const fileInput = screen.getByLabelText(/Upload CSV or JSON telemetry log files/i);
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Progress bar or aggregation status indicator should appear
    await waitFor(() => {
      expect(screen.getByRole('status', { name: /Calculating analytics from telemetry logs/i })).toBeInTheDocument();
    });

    // Wait for chunked completion
    await waitFor(
      () => {
        expect(screen.getByText('20,000')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  });
});
