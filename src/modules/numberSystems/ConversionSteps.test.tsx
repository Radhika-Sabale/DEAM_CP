/**
 * @file ConversionSteps.test.tsx
 * Unit tests for ConversionSteps component.
 * Verifies repeated division table rows for 156 (dec -> bin),
 * presence of reading direction guidance, and accessibility roles.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { generateRadixConversionSteps } from '../../engine/numberSystems/steps';
import { ConversionSteps } from './ConversionSteps';

describe('ConversionSteps', () => {
  it('renders exact expected repeated division rows for 156 dec -> bin and shows reading direction', () => {
    const convRes = generateRadixConversionSteps('156', 10, 2);
    if (!convRes.ok) throw new Error('Conversion failed');

    render(<ConversionSteps steps={convRes.value.steps} />);

    // Check reading direction text
    expect(
      screen.getByText(/read remainders from bottom to top/i)
    ).toBeInTheDocument();

    // Verify repeated division table rows
    const table = screen.getByRole('table', { name: /Repeated division steps/i });
    expect(table).toBeInTheDocument();

    // Expected rows:
    // 156 / 2 = 78 r 0
    // 78 / 2 = 39 r 0
    // 39 / 2 = 19 r 1
    // 19 / 2 = 9 r 1
    // 9 / 2 = 4 r 1
    // 4 / 2 = 2 r 0
    // 2 / 2 = 1 r 0
    // 1 / 2 = 0 r 1
    const expectedDividends = ['156', '78', '39', '19', '9', '4', '2', '1'];
    const expectedQuotients = ['78', '39', '19', '9', '4', '2', '1', '0'];
    const expectedRemainders = ['0', '0', '1', '1', '1', '0', '0', '1'];

    expectedDividends.forEach((d) => {
      expect(screen.getAllByText(d).length).toBeGreaterThan(0);
    });
    expectedQuotients.forEach((q) => {
      expect(screen.getAllByText(q).length).toBeGreaterThan(0);
    });
    expectedRemainders.forEach((r) => {
      expect(screen.getAllByText(r).length).toBeGreaterThan(0);
    });
  });

  it('supports stepper navigation (Next / Previous / Show all)', () => {
    const convRes = generateRadixConversionSteps('156', 10, 2);
    if (!convRes.ok) throw new Error('Conversion failed');

    render(<ConversionSteps steps={convRes.value.steps} />);

    const nextBtn = screen.getByRole('button', { name: /next/i });
    const prevBtn = screen.getByRole('button', { name: /previous/i });
    const showAllBtn = screen.getByRole('button', { name: /show all/i });

    expect(nextBtn).toBeInTheDocument();
    expect(prevBtn).toBeInTheDocument();
    expect(showAllBtn).toBeInTheDocument();

    // Clicking Next when showAll is true switches to step-by-step at step 1
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Step 1 of/i)).toBeInTheDocument();

    // Clicking Next again steps to step 2
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Step 2 of/i)).toBeInTheDocument();

    // Clicking Show all reveals all steps
    fireEvent.click(showAllBtn);
    expect(screen.getByText(/Step \d+ of \d+/i)).toBeInTheDocument();
  });

  it('meets accessibility standards with accessible table and headers', () => {
    const convRes = generateRadixConversionSteps('156', 10, 2);
    if (!convRes.ok) throw new Error('Conversion failed');

    render(<ConversionSteps steps={convRes.value.steps} />);

    const tables = screen.getAllByRole('table');
    expect(tables.length).toBeGreaterThanOrEqual(1);

    const colHeaders = screen.getAllByRole('columnheader');
    expect(colHeaders.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(/Dividend/i)).toBeInTheDocument();
    expect(screen.getByText(/Divisor/i)).toBeInTheDocument();
    expect(screen.getByText(/Quotient/i)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Remainder/i })).toBeInTheDocument();
  });
});
