/**
 * @file KeyboardHelpModal.tsx
 * Accessible dialog documenting full keyboard navigation and shortcut controls for the circuit simulator.
 */

import type { FC } from 'react';
import { Modal } from '../../components/ui/Modal';

export interface KeyboardHelpModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export const KeyboardHelpModal: FC<KeyboardHelpModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Navigation & Shortcuts">
      <div className="space-y-4 text-xs text-gray-700 dark:text-gray-300">
        <p>
          The circuit canvas and editor are fully operable with the keyboard without requiring a mouse:
        </p>

        <div className="space-y-2 border-t border-gray-200 pt-3 dark:border-gray-800">
          <div className="flex justify-between font-mono">
            <span className="font-bold text-gray-900 dark:text-gray-100">Tab</span>
            <span>Enters the canvas as a single tab stop</span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="font-bold text-gray-900 dark:text-gray-100">Left / Right Arrows</span>
            <span>Navigates through nodes in topological order</span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="font-bold text-gray-900 dark:text-gray-100">Alt + Arrow Keys</span>
            <span>Nudges selected node position by 1 grid step (20px)</span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="font-bold text-gray-900 dark:text-gray-100">Enter (on Node)</span>
            <span>Starts wiring mode from the focused node output</span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="font-bold text-gray-900 dark:text-gray-100">Left / Right (Wiring)</span>
            <span>Cycles through candidate input destination pins</span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="font-bold text-gray-900 dark:text-gray-100">Enter (Target Pin)</span>
            <span>Confirms and places the wire connection</span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="font-bold text-gray-900 dark:text-gray-100">Escape</span>
            <span>Cancels wiring mode or clears active selection</span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="font-bold text-gray-900 dark:text-gray-100">Space / Enter</span>
            <span>Toggles focused input switch (0 → 1 → X)</span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="font-bold text-gray-900 dark:text-gray-100">Delete / Backspace</span>
            <span>Removes the selected node or wire from schematic</span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="font-bold text-gray-900 dark:text-gray-100">Ctrl+Z / Cmd+Z</span>
            <span>Undo last graph modification</span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="font-bold text-gray-900 dark:text-gray-100">Ctrl+Y / Shift+Cmd+Z</span>
            <span>Redo last graph modification</span>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-3 text-[11px] text-gray-500 dark:border-gray-800">
          Tip: You can also switch to the <strong>List & Table Editor</strong> tab for a structured tabular editor with native select menus.
        </div>
      </div>
    </Modal>
  );
};
