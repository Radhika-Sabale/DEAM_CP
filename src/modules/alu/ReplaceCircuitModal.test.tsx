/**
 * @file ReplaceCircuitModal.test.tsx
 * Unit tests for circuit replacement confirmation modal.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { ReplaceCircuitModal } from './ReplaceCircuitModal';

describe('ReplaceCircuitModal', () => {
  it('renders modal with warning message and Cancel button focused by default', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ReplaceCircuitModal
        isOpen={true}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(
      screen.getByText('This replaces your current circuit. Continue?')
    ).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    const continueBtn = screen.getByRole('button', { name: 'Continue' });

    expect(cancelBtn).toBeInTheDocument();
    expect(continueBtn).toBeInTheDocument();

    await waitFor(() => {
      expect(cancelBtn).toHaveFocus();
    });
  });

  it('triggers onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ReplaceCircuitModal
        isOpen={true}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('triggers onConfirm when Continue button is clicked', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ReplaceCircuitModal
        isOpen={true}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    const continueBtn = screen.getByRole('button', { name: 'Continue' });
    fireEvent.click(continueBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
