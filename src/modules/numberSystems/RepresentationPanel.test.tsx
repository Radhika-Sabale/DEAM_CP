/**
 * @file RepresentationPanel.test.tsx
 * Unit tests for RepresentationPanel component.
 * Verifies representation limits (-128 in 8-bit two's complement vs sign-magnitude/one's complement),
 * overflow warnings for most negative value negation, and accessibility.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { RepresentationPanel } from './RepresentationPanel';

describe('RepresentationPanel', () => {
  it('value -128 in 8-bit shows the right pattern in two\'s complement and "does not fit" in sign-magnitude and one\'s complement', () => {
    render(
      <RepresentationPanel
        initialWidth={8}
        initialValue="-128"
        initialMode="decimal"
      />
    );

    // Two's complement section should show decoded value -128 and bit pattern 1000 0000
    expect(screen.getByText('-128')).toBeInTheDocument();
    expect(screen.getAllByText(/1000 0000/).length).toBeGreaterThanOrEqual(1);

    // Sign-magnitude and One's complement cannot fit -128 (max negative is -127)
    const notFitElements = screen.getAllByText(/does not fit in 8-bit range/i);
    expect(notFitElements.length).toBeGreaterThanOrEqual(2);

    // Most negative negation overflow warning
    expect(
      screen.getByText(/Negating the most negative value \(-128 in 8-bit\) overflows/i)
    ).toBeInTheDocument();
  });

  it('meets accessibility standards with accessible form controls and tables', () => {
    render(<RepresentationPanel />);

    expect(screen.getByLabelText(/Bit Width/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Input Mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Integer Value/i)).toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
  });
});
