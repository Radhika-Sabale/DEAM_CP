/**
 * @file ReplaceCircuitModal.tsx
 * Confirmation modal protecting existing student circuits before synthesizing an adder schematic.
 */

import { type FC, useEffect, useRef } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

export interface ReplaceCircuitModalProps {
  readonly isOpen: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export const ReplaceCircuitModal: FC<ReplaceCircuitModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Ensure Cancel button receives default focus
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 20);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Replace Existing Circuit?"
      ariaDescribedBy="replace-circuit-description"
    >
      <div className="space-y-4">
        <p
          id="replace-circuit-description"
          className="text-sm text-gray-700 dark:text-gray-300"
        >
          This replaces your current circuit. Continue?
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            ref={cancelBtnRef}
            variant="secondary"
            size="sm"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onConfirm}
          >
            Continue
          </Button>
        </div>
      </div>
    </Modal>
  );
};
