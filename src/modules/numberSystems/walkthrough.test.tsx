/**
 * @file walkthrough.test.tsx
 * Automated end-to-end verification of the Stage 5B walkthrough scenario:
 * 1. Convert 156 to binary with repeated division steps and reading direction.
 * 2. Convert 0.6875 to binary with repeated multiplication steps (0.1011).
 * 3. View -5 in 8-bit across representations (unsigned, sign-magnitude, 1's and 2's complement).
 * 4. Add 127 + 1 in 8-bit signed and verify overflow (V = 1, explanation, -128).
 * 5. BCD addition 9 + 8 showing +0110 correction step and result 17.
 * 6. Page reload and state restoration from localStorage without touching DesignProject.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { useUiStore } from '../../store/uiStore';
import { NumberSystemsPage } from './NumberSystemsPage';

describe('Stage 5B Walkthrough Verification', () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.getState().setModule('number-systems');
  });

  it('completes the entire Stage 5B verification walkthrough sequence', () => {
    // -------------------------------------------------------------
    // STEP 1: Convert 156 decimal to binary with steps
    // -------------------------------------------------------------
    const { unmount } = render(<NumberSystemsPage />);

    // Default input is '156', fromRadix=10, targetRadix=2
    expect(screen.getByDisplayValue('156')).toBeInTheDocument();

    // Verify live results in standard radices
    expect(screen.getByText('10011100')).toBeInTheDocument(); // Binary
    expect(screen.getByText('234')).toBeInTheDocument();      // Octal
    expect(screen.getByText('9C')).toBeInTheDocument();       // Hexadecimal

    // Verify repeated division steps table and reading direction notice
    expect(
      screen.getByText(/read remainders from bottom to top/i)
    ).toBeInTheDocument();

    const divTable = screen.getByRole('table', { name: /Repeated division steps/i });
    expect(divTable).toBeInTheDocument();

    // Verify division chain rows: 156, 78, 39, 19, 9, 4, 2, 1
    ['156', '78', '39', '19', '9', '4', '2', '1'].forEach((num) => {
      expect(screen.getAllByText(num).length).toBeGreaterThan(0);
    });

    // -------------------------------------------------------------
    // STEP 2: Convert 0.6875 to binary
    // -------------------------------------------------------------
    const numInput = screen.getByLabelText(/Input Number/i);
    fireEvent.change(numInput, { target: { value: '0.6875' } });

    // Result in binary should be 0.1011
    expect(screen.getByText('0.1011')).toBeInTheDocument();

    // Verify repeated multiplication steps table
    const multTable = screen.getByRole('table', { name: /Repeated multiplication steps/i });
    expect(multTable).toBeInTheDocument();

    // -------------------------------------------------------------
    // STEP 3: View -5 in 8-bit across representations
    // -------------------------------------------------------------
    const repTab = screen.getByRole('tab', { name: /^Representations$/i });
    fireEvent.click(repTab);
    expect(repTab).toHaveAttribute('aria-selected', 'true');

    // Set width=8, mode=decimal, input=-5
    const repValueInput = screen.getByLabelText(/Integer Value/i);
    fireEvent.change(repValueInput, { target: { value: '-5' } });

    // Unsigned does not fit
    expect(screen.getByText(/does not fit in 8-bit range/i)).toBeInTheDocument();

    // Sign-magnitude: -5 -> (MSB) 1000 0101 (LSB)
    expect(screen.getByText(/1000 0101/)).toBeInTheDocument();

    // One's complement: -5 -> (MSB) 1111 1010 (LSB)
    expect(screen.getByText(/1111 1010/)).toBeInTheDocument();

    // Two's complement: -5 -> (MSB) 1111 1011 (LSB)
    expect(screen.getAllByText(/1111 1011/).length).toBeGreaterThanOrEqual(1);

    // -------------------------------------------------------------
    // STEP 4: Add 127 + 1 in 8-bit signed and observe overflow
    // -------------------------------------------------------------
    const arithTab = screen.getByRole('tab', { name: /^Arithmetic$/i });
    fireEvent.click(arithTab);
    expect(arithTab).toHaveAttribute('aria-selected', 'true');

    // Set bit width to 8
    const widthSelect = screen.getByLabelText(/Bit Width/i);
    fireEvent.change(widthSelect, { target: { value: '8' } });

    // Set signed mode
    const signedRadio = screen.getByLabelText(/^Signed/i);
    fireEvent.click(signedRadio);

    // Set operands: 127 and 1
    const opAInput = screen.getByLabelText(/Operand A/i);
    const opBInput = screen.getByLabelText(/Operand B/i);
    fireEvent.change(opAInput, { target: { value: '127' } });
    fireEvent.change(opBInput, { target: { value: '1' } });

    // Verify V = 1 (overflow detected)
    expect(screen.getByText(/V \(overflow\): 1/i)).toBeInTheDocument();

    // Verify plain-language overflow explanation
    expect(
      screen.getByText(/Signed overflow: positive \+ positive produced a result with inverted sign/i)
    ).toBeInTheDocument();

    // Result bit pattern should be 1000 0000 with signed value -128
    expect(screen.getAllByText(/1000 0000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/-128/).length).toBeGreaterThanOrEqual(1);

    // -------------------------------------------------------------
    // STEP 5: BCD addition 9 + 8 with +0110 correction step
    // -------------------------------------------------------------
    const codesTab = screen.getByRole('tab', { name: /^Codes$/i });
    fireEvent.click(codesTab);
    expect(codesTab).toHaveAttribute('aria-selected', 'true');

    // Default addition is 9 + 8
    expect(screen.getByText(/\+0110 \(correction applied\)/i)).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.getByText(/0001 0111/)).toBeInTheDocument();

    // -------------------------------------------------------------
    // STEP 6: Reload and see page state restored from localStorage
    // -------------------------------------------------------------
    // Unmount simulating page leave
    unmount();

    // Render fresh page instance
    render(<NumberSystemsPage />);

    // Codes tab was last active tab, it should remain active!
    const restoredCodesTab = screen.getByRole('tab', { name: /^Codes$/i });
    expect(restoredCodesTab).toHaveAttribute('aria-selected', 'true');

    // Switch back to converter tab to see input '0.6875' persisted
    const restoredConverterTab = screen.getByRole('tab', { name: /^Converter$/i });
    fireEvent.click(restoredConverterTab);
    expect(screen.getByDisplayValue('0.6875')).toBeInTheDocument();

    // Verify plain text pointer with normal navigation link to Boolean Expression Tool (no handoff button)
    expect(screen.getByText(/No pipeline handoff/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send to/i })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Boolean Expression Tool/i })
    ).toBeInTheDocument();
  });
});
