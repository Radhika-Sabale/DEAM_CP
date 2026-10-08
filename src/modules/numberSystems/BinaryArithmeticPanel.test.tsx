/**
 * @file BinaryArithmeticPanel.test.tsx
 * Unit tests for BinaryArithmeticPanel component.
 * Verifies signed overflow detection (7 + 5 in 4-bit), unsigned subtraction borrow flag,
 * carry chain table rendering, and accessibility.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { BinaryArithmeticPanel } from './BinaryArithmeticPanel';

describe('BinaryArithmeticPanel', () => {
  it('7 + 5 in 4-bit signed shows V = 1 with the plain-language explanation', () => {
    render(
      <BinaryArithmeticPanel
        initialWidth={4}
        initialMode="signed"
        initialOp="add"
        initialA="7"
        initialB="5"
      />
    );

    // Overflow flag V must show value 1
    expect(screen.getByText(/V \(overflow\): 1/i)).toBeInTheDocument();

    // Plain-language overflow explanation
    expect(
      screen.getByText(/Signed overflow: positive \+ positive/i)
    ).toBeInTheDocument();

    // Result bit string displayed
    expect(screen.getByRole('heading', { name: /^Result$/i })).toBeInTheDocument();
    expect(screen.getByText(/1100/i)).toBeInTheDocument();
  });

  it('0 - 1 unsigned shows borrow indicator with convention text', () => {
    render(
      <BinaryArithmeticPanel
        initialWidth={4}
        initialMode="unsigned"
        initialOp="subtract"
        initialA="0"
        initialB="1"
      />
    );

    // Borrow indicator should be 1
    expect(screen.getByText(/Borrow: 1/i)).toBeInTheDocument();

    // Subtraction hardware convention text
    expect(
      screen.getByText(/8086 convention/i)
    ).toBeInTheDocument();
  });

  it('renders carry chain table with proper column headers and MSB on left', () => {
    render(
      <BinaryArithmeticPanel
        initialWidth={4}
        initialMode="signed"
        initialOp="add"
        initialA="7"
        initialB="5"
      />
    );

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    // Headers should have Bit 3 (MSB) and Bit 0 (LSB)
    expect(screen.getByText(/Bit 3 \(MSB\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Bit 0 \(LSB\)/i)).toBeInTheDocument();

    // Row headers
    expect(screen.getByText(/Carry In/i)).toBeInTheDocument();
    expect(screen.getByText(/Sum \(S\)/i)).toBeInTheDocument();
  });

  it('meets accessibility standards with accessible form controls and flags', () => {
    render(<BinaryArithmeticPanel />);

    expect(screen.getByLabelText(/Bit Width/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Signed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Operation/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Operand A/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Operand B/i)).toBeInTheDocument();
  });
});
