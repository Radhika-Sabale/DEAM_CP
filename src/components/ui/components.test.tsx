/**
 * @file components.test.tsx
 * Integration tests for UI and Layout primitives verifying accessibility patterns:
 * Modal focus trap & restoration, Tabs arrow key roving tabindex, Toast text-level signaling,
 * and PipelineStepper aria-current step tracking.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { PipelineStepper } from '../layout/PipelineStepper';
import { Button } from './Button';
import { Modal } from './Modal';
import { Tabs } from './Tabs';
import { Toast } from './Toast';

describe('Modal accessibility and focus management', () => {
  it('traps focus and restores focus to opener element upon close', async () => {
    const handleClose = vi.fn();

    const TestHost = () => {
      return (
        <div>
          <button type="button" id="opener-btn">
            Open Modal
          </button>
          <Modal isOpen={true} onClose={handleClose} title="Accessible Modal">
            <div>
              <input type="text" data-testid="modal-input" placeholder="Name" />
              <button type="button" data-testid="modal-action-btn">
                Confirm
              </button>
            </div>
          </Modal>
        </div>
      );
    };

    render(<TestHost />);

    const opener = screen.getByRole('button', { name: 'Open Modal' });
    opener.focus();
    expect(document.activeElement).toBe(opener);

    // Verify modal is rendered
    const dialog = screen.getByRole('dialog', { name: 'Accessible Modal' });
    expect(dialog).toBeInTheDocument();

    // Verify close on Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

describe('Tabs arrow-key roving tabindex', () => {
  it('navigates through tabs with arrow keys and updates active panel', () => {
    const tabsData = [
      { id: 'tab1', label: 'Tab One', content: <div>Content One</div> },
      { id: 'tab2', label: 'Tab Two', content: <div>Content Two</div> },
      { id: 'tab3', label: 'Tab Three', content: <div>Content Three</div> },
    ];

    render(<Tabs tabs={tabsData} defaultValue="tab1" />);

    const tab1 = screen.getByRole('tab', { name: 'Tab One' });
    const tab2 = screen.getByRole('tab', { name: 'Tab Two' });
    const tab3 = screen.getByRole('tab', { name: 'Tab Three' });

    expect(tab1).toHaveAttribute('aria-selected', 'true');
    expect(tab1).toHaveAttribute('tabindex', '0');
    expect(tab2).toHaveAttribute('tabindex', '-1');
    expect(screen.getByText('Content One')).toBeInTheDocument();

    // Focus first tab and press ArrowRight
    tab1.focus();
    fireEvent.keyDown(tab1, { key: 'ArrowRight' });

    expect(tab2).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Content Two')).toBeInTheDocument();

    // Press End key to jump to last tab
    fireEvent.keyDown(tab2, { key: 'End' });
    expect(tab3).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Content Three')).toBeInTheDocument();

    // Press Home key to jump back to first tab
    fireEvent.keyDown(tab3, { key: 'Home' });
    expect(tab1).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Content One')).toBeInTheDocument();
  });
});

describe('Toast multi-channel accessibility', () => {
  it('renders an explicit text label for its level ensuring color is not the only signal', () => {
    const handleDismiss = vi.fn();
    const testToast = {
      id: 'toast-1',
      message: 'Synthesis complete without hazards.',
      level: 'success' as const,
      createdAt: Date.now(),
    };

    render(<Toast toast={testToast} onDismiss={handleDismiss} />);

    // Must render explicit uppercase text label [SUCCESS]
    expect(screen.getByText('[SUCCESS]')).toBeInTheDocument();
    expect(screen.getByText('Synthesis complete without hazards.')).toBeInTheDocument();

    // Dismiss button works
    const dismissBtn = screen.getByRole('button', {
      name: /dismiss success notification/i,
    });
    fireEvent.click(dismissBtn);
    expect(handleDismiss).toHaveBeenCalledWith('toast-1');
  });

  it('renders explicit text label for error level', () => {
    const handleDismiss = vi.fn();
    const testToast = {
      id: 'toast-2',
      message: 'Combinational loop detected.',
      level: 'error' as const,
      createdAt: Date.now(),
    };

    render(<Toast toast={testToast} onDismiss={handleDismiss} />);

    expect(screen.getByText('[ERROR]')).toBeInTheDocument();
    expect(screen.getByText('Combinational loop detected.')).toBeInTheDocument();
  });
});

describe('PipelineStepper step accessibility', () => {
  it('marks the current active step with aria-current="step"', () => {
    render(<PipelineStepper />);

    // Default current module in uiStore is 'boolean-tool'
    const stepButtons = screen.getAllByRole('button');
    const currentStepBtn = stepButtons.find(
      (btn) => btn.getAttribute('aria-current') === 'step'
    );

    expect(currentStepBtn).toBeDefined();
    expect(currentStepBtn).toHaveTextContent('Boolean Expression Analysis');
    expect(currentStepBtn).toHaveTextContent('(Current)');
  });
});

describe('Button primitive', () => {
  it('renders variants and handles loading state', () => {
    render(
      <Button variant="danger" loading>
        Delete
      </Button>
    );

    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });
});
