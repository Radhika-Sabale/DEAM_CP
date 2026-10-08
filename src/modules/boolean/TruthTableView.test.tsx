/**
 * @file TruthTableView.test.tsx
 * Tests for TruthTableView: rendering for 3 and 6 variables (64 rows),
 * interactive 0 -> 1 -> X cycling, don't-care filter toggle, and accessible table markup.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { buildTruthTable, parse } from '../../engine/boolean';
import { TruthTableView } from './TruthTableView';

describe('TruthTableView', () => {
  it('renders correctly for 3 variables (8 rows) and displays canonical forms', () => {
    const parseRes = parse('A + B');
    if (!parseRes.ok) throw new Error('Parse failed');
    const ttRes = buildTruthTable(parseRes.ast, ['A', 'B', 'C']);
    if (!ttRes.ok) throw new Error('Truth table failed');

    render(<TruthTableView table={ttRes.table} />);

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    // Verify all 3 variable header columns
    expect(screen.getByRole('columnheader', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'B' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'C' })).toBeInTheDocument();

    // Verify 8 rows rendered
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(9); // 1 header row + 8 data rows

    // Verify canonical forms
    expect(screen.getByText(/Canonical SOP/i)).toBeInTheDocument();
    expect(screen.getByText(/Canonical POS/i)).toBeInTheDocument();
  });

  it('renders large 6-variable tables (64 rows) with proper keyboard scroll container', () => {
    const parseRes = parse('A');
    if (!parseRes.ok) throw new Error('Parse failed');
    const ttRes = buildTruthTable(parseRes.ast, ['A', 'B', 'C', 'D', 'E', 'F']);
    if (!ttRes.ok) throw new Error('Truth table failed');

    render(<TruthTableView table={ttRes.table} />);

    const scrollContainer = screen.getByLabelText(/truth table with keyboard navigation/i);
    expect(scrollContainer).toBeInTheDocument();

    const dataRows = screen.getAllByRole('row');
    expect(dataRows.length).toBe(65); // 1 header + 64 data rows
  });

  it('cycling an output cell updates minterm/maxterm state via onTableChange', () => {
    const parseRes = parse('A');
    if (!parseRes.ok) throw new Error('Parse failed');
    const ttRes = buildTruthTable(parseRes.ast, ['A', 'B']);
    if (!ttRes.ok) throw new Error('Truth table failed');

    const handleTableChange = vi.fn();

    render(
      <TruthTableView
        table={ttRes.table}
        onTableChange={handleTableChange}
        editable={true}
      />
    );

    // Row 0 has output 0 initially. Clicking cycles to 1.
    const row0Btn = screen.getByRole('button', {
      name: /row 0, output 0/i,
    });
    fireEvent.click(row0Btn);

    expect(handleTableChange).toHaveBeenCalledTimes(1);
    const updatedTable = handleTableChange.mock.calls[0]?.[0];
    expect(updatedTable?.rows[0]?.output).toBe(1);
  });

  it('toggling don`t-cares hides or shows rows with value X', () => {
    const parseRes = parse('A');
    if (!parseRes.ok) throw new Error('Parse failed');
    const ttRes = buildTruthTable(parseRes.ast, ['A', 'B'], [1]); // row 1 is 'X'
    if (!ttRes.ok) throw new Error('Truth table failed');

    render(<TruthTableView table={ttRes.table} />);

    // Initially don't cares are shown (4 rows + 1 header = 5)
    expect(screen.getAllByRole('row').length).toBe(5);

    // Uncheck toggle
    const toggle = screen.getByRole('checkbox', {
      name: /show and allow don't-cares/i,
    });
    fireEvent.click(toggle);

    // Now row 1 ('X') is hidden (3 rows + 1 header = 4)
    expect(screen.getAllByRole('row').length).toBe(4);
  });

  it('meets accessibility requirements: aria-labels on output buttons and multi-channel text', () => {
    const parseRes = parse('A');
    if (!parseRes.ok) throw new Error('Parse failed');
    const ttRes = buildTruthTable(parseRes.ast, ['A']);
    if (!ttRes.ok) throw new Error('Truth table failed');

    render(<TruthTableView table={ttRes.table} editable={true} />);

    // Buttons must have accessible name with row index and output
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAttribute('aria-label');
    expect(buttons[0]?.textContent).toContain('[Low]');
  });
});
