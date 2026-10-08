/**
 * @file CharacteristicTables.test.tsx
 * Unit tests for CharacteristicTables: headers, current-row tracking, invalid state markers, and equation tab.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { CharacteristicTables } from './CharacteristicTables';

describe('CharacteristicTables', () => {
  it('renders table headers with scope="col"', () => {
    render(<CharacteristicTables type="JK" currentRowIndex={2} />);

    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBeGreaterThanOrEqual(4);
    headers.forEach((th) => {
      expect(th.getAttribute('scope')).toBe('col');
    });

    expect(screen.getByText('Q (present state)')).toBeDefined();
    expect(screen.getByText('Q+ (next state)')).toBeDefined();
  });

  it('marks current row with "Current" text and badge', () => {
    render(<CharacteristicTables type="D" currentRowIndex={2} />);

    // Row 2 is D=1, Q=0 -> "Current" text should be present in that row
    const currentBadge = screen.getByText(/Current/i);
    expect(currentBadge).toBeDefined();
  });

  it('marks invalid SR (1, 1) rows with "Invalid" badge', () => {
    render(<CharacteristicTables type="SR" />);

    const invalidBadges = screen.getAllByText(/Invalid/i);
    expect(invalidBadges.length).toBeGreaterThanOrEqual(2);
  });

  it('displays don`t-care footnote on excitation table tab', () => {
    render(<CharacteristicTables type="JK" />);

    const excTab = screen.getByRole('tab', { name: /Excitation table/i });
    fireEvent.click(excTab);

    expect(
      screen.getByText(/X = don't care: either 0 or 1 works/i)
    ).toBeDefined();
  });

  it('renders equation tab with equation text, constraint, and notes', () => {
    // 1. SR equation with constraint
    const { rerender } = render(<CharacteristicTables type="SR" />);
    const eqTab = screen.getByRole('tab', { name: /Characteristic equation/i });
    fireEvent.click(eqTab);

    expect(screen.getByText(/Q\+ = S \+ R'Q/i)).toBeDefined();
    expect(screen.getByText(/S\.R = 0/i)).toBeDefined();

    // 2. T equation with alternate XOR form
    rerender(<CharacteristicTables type="T" />);
    expect(screen.getByText(/Q\+ = TQ' \+ T'Q/i)).toBeDefined();
    expect(screen.getByText(/Q\+ = T \^ Q/i)).toBeDefined();
  });

  it('supports roving tabindex keyboard navigation across tabs', () => {
    render(<CharacteristicTables type="JK" />);

    const charTab = screen.getByRole('tab', { name: /Characteristic table/i });
    const opTab = screen.getByRole('tab', { name: /Operation table/i });

    charTab.focus();
    fireEvent.keyDown(charTab, { key: 'ArrowRight' });

    expect(opTab.getAttribute('aria-selected')).toBe('true');
  });
});
