/**
 * @file EquivalencePanel.test.tsx
 * Tests for EquivalencePanel: equivalence validation, mismatch counterexample reporting,
 * discrepancy table rendering, and accessibility.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { EquivalencePanel } from './EquivalencePanel';

describe('EquivalencePanel', () => {
  it('confirms two equivalent expressions using De Morgan duals', async () => {
    render(<EquivalencePanel initialExpression="A + B" />);

    // Enter De Morgan equivalent into expression 2: (A'B')'
    const inputs = screen.getAllByRole('textbox');
    const input2 = inputs[1];
    if (!input2) throw new Error('Input 2 missing');
    fireEvent.change(input2, { target: { value: "(A'B')'" } });

    await waitFor(
      () => {
        expect(screen.getByText(/\[Equivalent\]/i)).toBeInTheDocument();
      },
      { timeout: 600 }
    );
  });

  it('detects inequivalence and displays counterexample and discrepancy table', async () => {
    render(<EquivalencePanel initialExpression="A + B" />);

    const inputs = screen.getAllByRole('textbox');
    const input2 = inputs[1];
    if (!input2) throw new Error('Input 2 missing');
    fireEvent.change(input2, { target: { value: 'AB' } });

    await waitFor(
      () => {
        expect(screen.getByText(/\[Not Equivalent\]/i)).toBeInTheDocument();
        expect(screen.getByText(/Counterexample/i)).toBeInTheDocument();
        expect(screen.getByRole('table')).toBeInTheDocument();
      },
      { timeout: 600 }
    );
  });
});
