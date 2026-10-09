/**
 * @file DashboardImportSection.tsx
 * File upload (drag & drop, keyboard alternative, device log) and import audit report (Stage 11C).
 */

import React, { useRef, useState } from 'react';
import { csvToEvents, mergeEventLogs, parseCsv } from '../../engine/evaluation/csvImport';
import type { LogEvent } from '../../types/logging';
import { useLogStore } from '../../store/logStore';
import { readFileAsText } from '../../utils/download';
import { Button } from '../../components/ui/Button';

export interface ImportReport {
  readonly filesRead: number;
  readonly eventsAccepted: number;
  readonly duplicatesDropped: number;
  readonly rejectedRows: readonly { readonly rowNumber: number; readonly reason: string }[];
}

interface DashboardImportSectionProps {
  readonly onEventsLoaded: (events: readonly LogEvent[], report: ImportReport) => void;
  readonly currentEventCount: number;
}

export const DashboardImportSection: React.FC<DashboardImportSectionProps> = ({
  onEventsLoaded,
  currentEventCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastReport, setLastReport] = useState<ImportReport | null>(null);

  const processFiles = async (fileList: FileList | readonly File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    let filesRead = 0;
    const allParsedEventLists: LogEvent[][] = [];
    const allRejectedRows: { rowNumber: number; reason: string }[] = [];
    let rawEventCount = 0;

    for (const file of files) {
      const readResult = await readFileAsText(file);
      if (!readResult.ok) {
        allRejectedRows.push({ rowNumber: 0, reason: `${file.name}: ${readResult.error}` });
        continue;
      }
      filesRead++;
      const text = readResult.text.trim();

      if (file.name.endsWith('.json') || text.startsWith('[') || text.startsWith('{')) {
        try {
          const parsed = JSON.parse(text);
          const rawList: unknown[] = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.events)
              ? parsed.events
              : [];
          const validEvents: LogEvent[] = [];
          for (let i = 0; i < rawList.length; i++) {
            const item = rawList[i] as LogEvent;
            if (item && typeof item === 'object' && item.id && item.eventType && item.timestamp) {
              validEvents.push(item);
            } else {
              allRejectedRows.push({ rowNumber: i + 1, reason: `${file.name}: Invalid event object` });
            }
          }
          rawEventCount += validEvents.length;
          allParsedEventLists.push(validEvents);
        } catch {
          allRejectedRows.push({ rowNumber: 1, reason: `${file.name}: Malformed JSON syntax` });
        }
      } else {
        const parsed = parseCsv(text);
        if (!parsed.ok) {
          allRejectedRows.push({
            rowNumber: parsed.error.rowNumber,
            reason: `${file.name} line ${parsed.error.rowNumber}: ${parsed.error.reason}`,
          });
          continue;
        }
        const { events, rejectedRows } = csvToEvents(parsed.rows);
        rawEventCount += events.length;
        allParsedEventLists.push([...events]);
        for (const rej of rejectedRows) {
          allRejectedRows.push({
            rowNumber: rej.rowNumber,
            reason: `${file.name} line ${rej.rowNumber}: ${rej.reason}`,
          });
        }
      }
    }

    const merged = mergeEventLogs(allParsedEventLists);
    const duplicatesDropped = Math.max(0, rawEventCount - merged.length);

    const report: ImportReport = {
      filesRead,
      eventsAccepted: merged.length,
      duplicatesDropped,
      rejectedRows: allRejectedRows,
    };

    setLastReport(report);
    onEventsLoaded(merged, report);
  };

  const handleDeviceLog = () => {
    const deviceEvents = useLogStore.getState().events;
    const report: ImportReport = {
      filesRead: 1,
      eventsAccepted: deviceEvents.length,
      duplicatesDropped: 0,
      rejectedRows: [],
    };
    setLastReport(report);
    onEventsLoaded(deviceEvents, report);
  };

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Import Telemetry Logs
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Import CSV or JSON session logs from students, or analyze this local device.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDeviceLog}
            aria-label="Use this device's own telemetry log"
          >
            Use Device&apos;s Own Log
          </Button>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Select files to import"
          >
            Browse Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.json"
            className="sr-only"
            aria-label="Upload CSV or JSON telemetry log files"
            onChange={(e) => {
              if (e.target.files) void processFiles(e.target.files);
            }}
          />
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) void processFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
            : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
        }`}
        role="region"
        aria-label="Drag and drop file upload area"
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-sm font-medium text-gray-700 hover:text-blue-600 focus:outline-none focus-visible:underline dark:text-gray-300 dark:hover:text-blue-400"
        >
          Drag &amp; drop student log files here, or click to browse
        </button>
        <span className="mt-1 text-xs text-gray-400">
          Supports RFC 4180 CSV exports and JSON telemetry files. Multiple files supported.
        </span>
      </div>

      {lastReport && (
        <div
          className="rounded-lg border border-gray-200 bg-gray-50/80 p-4 text-xs dark:border-gray-800 dark:bg-gray-800/40"
          role="region"
          aria-label="Import summary report"
        >
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Import Report</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center mb-3">
            <div className="rounded bg-white dark:bg-gray-900 p-2 border border-gray-100 dark:border-gray-800">
              <span className="text-gray-500 block">Files Read</span>
              <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                {lastReport.filesRead}
              </span>
            </div>
            <div className="rounded bg-white dark:bg-gray-900 p-2 border border-gray-100 dark:border-gray-800">
              <span className="text-gray-500 block">Events Accepted</span>
              <span className="font-bold text-sm text-green-600 dark:text-green-400">
                {lastReport.eventsAccepted}
              </span>
            </div>
            <div className="rounded bg-white dark:bg-gray-900 p-2 border border-gray-100 dark:border-gray-800">
              <span className="text-gray-500 block">Duplicates Dropped</span>
              <span className="font-bold text-sm text-amber-600 dark:text-amber-400">
                {lastReport.duplicatesDropped}
              </span>
            </div>
            <div className="rounded bg-white dark:bg-gray-900 p-2 border border-gray-100 dark:border-gray-800">
              <span className="text-gray-500 block">Current Active Events</span>
              <span className="font-bold text-sm text-blue-600 dark:text-blue-400">
                {currentEventCount}
              </span>
            </div>
          </div>

          {lastReport.rejectedRows.length > 0 && (
            <div className="mt-2 space-y-1">
              <span className="font-semibold text-red-600 dark:text-red-400 block">
                Rejected Rows ({lastReport.rejectedRows.length}):
              </span>
              <div className="max-h-36 overflow-y-auto rounded border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-2">
                <table className="w-full text-left text-[11px]" aria-label="Rejected CSV Rows Report">
                  <caption className="sr-only">List of rejected CSV rows with row numbers and rejection reasons</caption>
                  <thead>
                    <tr className="border-b border-red-200 dark:border-red-900/40">
                      <th scope="col" className="p-1 font-semibold">Row #</th>
                      <th scope="col" className="p-1 font-semibold">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastReport.rejectedRows.map((rej, idx) => (
                      <tr key={idx} className="border-b border-red-100 dark:border-red-950/30">
                        <td className="p-1 font-mono text-red-800 dark:text-red-300">
                          {rej.rowNumber === 0 ? 'File Error' : `Row ${rej.rowNumber}`}
                        </td>
                        <td className="p-1 text-red-700 dark:text-red-400">{rej.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
