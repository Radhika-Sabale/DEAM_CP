/**
 * @file NumberSystemsPage.test.tsx
 * Unit tests for NumberSystemsPage component.
 * Verifies invalid digit error display with caret/position,
 * keyboard tab navigation, absence of pipeline handoff button,
 * and accessibility.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { NumberSystemsPage } from './NumberSystemsPage';

describe('NumberSystemsPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows parse error with digit position when input contains invalid digit for radix', () => {
    render(<NumberSystemsPage />);

    // Select Base 2 (Binary) as fromRadix
    const fromSelect = screen.getByLabelText(/From Radix/i);
    fireEvent.change(fromSelect, { target: { value: '2' } });

    // Enter '156' which contains invalid digits '5' and '6' for base 2
    const input = screen.getByLabelText(/Input Number/i);
    fireEvent.change(input, { target: { value: '156' } });

    // Verify error is announced via role="alert"
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('aria-live', 'polite');

    // Verify error message indicates position
    expect(screen.getByText(/Invalid digit at position 1/i)).toBeInTheDocument();
  });

  it('supports tab navigation across Converter, Representations, Codes, and Arithmetic', () => {
    render(<NumberSystemsPage />);

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(5);

    // Initial tab is Converter
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    // Click 'Arithmetic' tab
    const arithmeticTab = screen.getByRole('tab', { name: /Arithmetic/i });
    fireEvent.click(arithmeticTab);

    expect(arithmeticTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Condition Flags/i)).toBeInTheDocument();

    // Arrow navigation on tablist
    fireEvent.keyDown(arithmeticTab, { key: 'ArrowLeft' });
    const codesTab = screen.getByRole('tab', { name: /^Codes$/i });
    expect(codesTab).toHaveAttribute('aria-selected', 'true');
  });

  it('does NOT render pipeline handoff button; shows plain text pointer to Boolean Expression Tool', () => {
    render(<NumberSystemsPage />);

    // Ensure no pipeline handoff button
    expect(screen.queryByRole('button', { name: /send to/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /handoff/i })).not.toBeInTheDocument();

    // Plain text pointer with navigation link
    expect(
      screen.getByText(/No pipeline handoff/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Boolean Expression Tool/i })
    ).toBeInTheDocument();
  });

  it('meets accessibility standards with proper ARIA landmarks and tabpanel', () => {
    render(<NumberSystemsPage />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    expect(screen.getByLabelText(/Input Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/From Radix/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Target Radix for Steps/i)).toBeInTheDocument();
  });

  it('integration: 156 division correctly entered then wrong bit string shows wrong-remainder-order', () => {
    render(<NumberSystemsPage />);

    // Open Practice tab
    const practiceTab = screen.getByRole('tab', { name: /Practice/i });
    fireEvent.click(practiceTab);

    // Step 1: correct quotient
    const quotientInput = screen.getByLabelText(/Quotient of 156 \/ 2/i);
    fireEvent.change(quotientInput, { target: { value: '78' } });
    const checkStep1Btn = screen.getAllByRole('button', { name: /Check My Step/i })[0];
    if (checkStep1Btn) fireEvent.click(checkStep1Btn);

    expect(screen.getByText(/Correct! Step verified/i)).toBeInTheDocument();

    // Step 2: reversed bit string (00111001)
    const bitStringInput = screen.getByLabelText(/Final Binary Bit String/i);
    fireEvent.change(bitStringInput, { target: { value: '00111001' } });
    const checkStep2Btn = screen.getByRole('button', { name: /Check My Step/i });
    fireEvent.click(checkStep2Btn);

    // Verifies wrong-remainder-order misconception
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText(/Cognitive Diagnosis: Reversed Division Remainder Order/i)
    ).toBeInTheDocument();
  });

  it('integration: wrong middle step but right final answer triggers answer-trap banner', () => {
    render(<NumberSystemsPage />);

    // Open Practice tab
    const practiceTab = screen.getByRole('tab', { name: /Practice/i });
    fireEvent.click(practiceTab);

    // Step 1: wrong quotient
    const quotientInput = screen.getByLabelText(/Quotient of 156 \/ 2/i);
    fireEvent.change(quotientInput, { target: { value: '75' } });
    const checkStep1Btn = screen.getAllByRole('button', { name: /Check My Step/i })[0];
    if (checkStep1Btn) fireEvent.click(checkStep1Btn);

    // Step 1 fails
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Step 2: correct final bit string
    const bitStringInput = screen.getByLabelText(/Final Binary Bit String/i);
    fireEvent.change(bitStringInput, { target: { value: '10011100' } });
    const checkButtons = screen.getAllByRole('button', { name: /Check My Step/i });
    const checkStep2Btn = checkButtons[checkButtons.length - 1];
    if (checkStep2Btn) fireEvent.click(checkStep2Btn);

    // Click Final Attempt Check
    const finalCheckBtn = screen.getByRole('button', {
      name: /Check Complete Attempt & Trap Detection/i,
    });
    fireEvent.click(finalCheckBtn);

    // Verifies AnswerTrapBanner appears
    expect(screen.getByText(/Answer Trap Detected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Jump to step-1/i })).toBeInTheDocument();
  });
});
