/**
 * @file ParticipantSetup.tsx
 * Participant pseudonym registration, consent confirmation, study mode toggling,
 * counterbalanced form display, and full data deletion controls (Stage 11C).
 */

import { type FC, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { CONSENT_TEXT_PLACEHOLDER, useStudyStore } from '../../store/studyStore';
import { useUiStore } from '../../store/uiStore';

export const ParticipantSetup: FC = () => {
  const participantId = useStudyStore((state) => state.participantId);
  const hasConsented = useStudyStore((state) => state.hasConsented);
  const studyModeActive = useStudyStore((state) => state.studyModeActive);
  const formOrder = useStudyStore((state) => state.formOrder);

  const setParticipantId = useStudyStore((state) => state.setParticipantId);
  const generateParticipantId = useStudyStore((state) => state.generateParticipantId);
  const setConsent = useStudyStore((state) => state.setConsent);
  const setStudyModeActive = useStudyStore((state) => state.setStudyModeActive);
  const deleteStudyData = useStudyStore((state) => state.deleteStudyData);
  const pushToast = useUiStore((state) => state.pushToast);

  const [inputVal, setInputVal] = useState(participantId);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const handleSaveId = () => {
    setParticipantId(inputVal);
    pushToast({
      level: 'success',
      title: 'Participant ID Updated',
      message: inputVal.trim() ? `Registered as "${inputVal.trim()}"` : 'Anonymous session set.',
    });
  };

  const handleGenerate = () => {
    const code = generateParticipantId();
    setInputVal(code);
    pushToast({
      level: 'info',
      title: 'Generated Short Code',
      message: `Assigned ID "${code}"`,
    });
  };

  const handleConfirmDelete = () => {
    deleteStudyData();
    setInputVal('');
    setDeleteModalOpen(false);
    pushToast({
      level: 'warning',
      title: 'Data Deleted',
      message: 'All local study logs, responses, and participant data were cleared.',
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-6">
      <div className="border-b border-gray-100 pb-4 dark:border-gray-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Research Study Configuration
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Participate in empirical digital electronics learning diagnostics.
        </p>
      </div>

      {/* Study Mode Toggle */}
      <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4 dark:bg-gray-950/60">
        <div>
          <label htmlFor="study-mode-toggle" className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Study Mode
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            When enabled, pre/post diagnostics, consent, and counterbalancing are tracked.
          </p>
        </div>
        <input
          id="study-mode-toggle"
          type="checkbox"
          checked={studyModeActive}
          onChange={(e) => setStudyModeActive(e.target.checked)}
          className="tog focus:ring-blue-500"
        />
      </div>

      {/* Participant ID Entry */}
      <div className="space-y-3">
        <label htmlFor="participant-id-input" className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Participant ID (Pseudonym)
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="participant-id-input"
            type="text"
            value={inputVal}
            placeholder="e.g. P-X7K2 or leave blank for anon"
            onChange={(e) => setInputVal(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <Button variant="secondary" size="md" onClick={handleSaveId}>
            Save ID
          </Button>
          <Button variant="ghost" size="md" onClick={handleGenerate}>
            Generate Code
          </Button>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          No names, student roll numbers, or email addresses are requested or stored.
        </p>
      </div>

      {/* Assigned Form Order Display */}
      <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4 text-xs dark:border-blue-900/60 dark:bg-blue-950/30">
        <span className="font-bold text-blue-900 dark:text-blue-300">
          Counterbalanced Assessment Allocation:
        </span>
        <div className="mt-2 flex gap-6 text-gray-700 dark:text-gray-300">
          <div>
            Pre-Test Form: <span className="font-bold text-blue-700 dark:text-blue-400">Form {formOrder.pre}</span>
          </div>
          <div>
            Post-Test Form: <span className="font-bold text-blue-700 dark:text-blue-400">Form {formOrder.post}</span>
          </div>
        </div>
      </div>

      {/* Consent Checkbox */}
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={hasConsented}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
            {CONSENT_TEXT_PLACEHOLDER}
          </span>
        </label>
      </div>

      {/* Danger Zone: Clear Data */}
      <div className="flex justify-between items-center border-t border-gray-100 pt-4 dark:border-gray-800">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Privacy control: clear logs and study state stored on this device.
        </span>
        <Button variant="danger" size="sm" onClick={() => setDeleteModalOpen(true)}>
          Delete all my local study data
        </Button>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Data Deletion"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Are you sure you want to delete all local study records? This will clear your participant ID,
            consent record, assessment scores, and all saved interaction telemetry logs.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete}>
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
