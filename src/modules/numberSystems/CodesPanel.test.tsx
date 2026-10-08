/**
 * @file CodesPanel.test.tsx
 * Unit tests for CodesPanel component.
 * Verifies BCD addition with +0110 correction step (9 + 8 = 17),
 * Gray code XOR step tables, and accessibility standards.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { CodesPanel } from './CodesPanel';

describe('CodesPanel', () => {
  it('BCD add 9 + 8 shows the correction step (+0110)', () => {
    render(<CodesPanel />);

    // By default, addA is '9' and addB is '8'
    // Verify correction step is rendered
    expect(screen.getByText(/\+0110 \(correction applied\)/i)).toBeInTheDocument();

    // Verify decimal sum is 17
    expect(screen.getByText('17')).toBeInTheDocument();

    // Verify table has steps
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
  });

  it('switches to Reflected Gray Code tab and displays XOR steps', () => {
    render(<CodesPanel />);

    const grayTab = screen.getByRole('tab', { name: /Reflected Gray Code/i });
    fireEvent.click(grayTab);

    expect(screen.getByText(/Reflected Gray Code Converter/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Binary Input/i)).toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(screen.getByText(/XOR Derivation/i)).toBeInTheDocument();
  });

  it('meets accessibility standards with tabs, forms, and tables', () => {
    render(<CodesPanel />);

    const tablist = screen.getByRole('tablist', { name: /Codes Subsections/i });
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(2);

    expect(screen.getByLabelText(/Code Scheme/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Packaging Format/i)).toBeInTheDocument();
  });
});
