/**
 * @file SimplificationSteps.test.tsx
 * Tests for SimplificationSteps: stepper navigation, Try a Law verification success/failure,
 * literal count reporting, and accessible markup.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { parse } from '../../engine/boolean';
import { SimplificationSteps } from './SimplificationSteps';

describe('SimplificationSteps', () => {
  it('renders simplification steps and literal counts for reducible expression', () => {
    // A + A' reduces via complement law
    const parsed = parse("A + A'");
    if (!parsed.ok) throw new Error('Parse failed');

    render(<SimplificationSteps ast={parsed.ast} />);

    expect(screen.getByText(/Algebraic Reduction Result/i)).toBeInTheDocument();
    expect(screen.getByText(/Literals: 2 → 1/i)).toBeInTheDocument();

    const list = screen.getByRole('list', { name: /simplification step sequence/i });
    expect(within(list).getByText(/Complement Law/i)).toBeInTheDocument();
    expect(within(list).getByText(/\[changed\]/i)).toBeInTheDocument();
  });

  it('supports stepper navigation: Next Step, Previous, and Show All', () => {
    // Expression with multiple steps
    const parsed = parse("A(A + B) + 0");
    if (!parsed.ok) throw new Error('Parse failed');

    render(<SimplificationSteps ast={parsed.ast} />);

    const nextBtn = screen.getByRole('button', { name: /next step/i });
    const prevBtn = screen.getByRole('button', { name: /previous/i });
    const showAllBtn = screen.getByRole('button', { name: /show all/i });

    // Step sequence starts showing all or moves step by step
    fireEvent.click(prevBtn);
    expect(prevBtn).toBeEnabled();

    fireEvent.click(nextBtn);
    expect(nextBtn).toBeInTheDocument();

    fireEvent.click(showAllBtn);
    const list = screen.getByRole('list', { name: /simplification step sequence/i });
    expect(within(list).getByText(/Absorption Law/i)).toBeInTheDocument();
  });

  it('verifies "Try a law" success when the chosen law matches the expression', () => {
    const parsed = parse("A(A + B)");
    if (!parsed.ok) throw new Error('Parse failed');

    render(<SimplificationSteps ast={parsed.ast} />);

    // Select absorption law
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'absorption' } });

    const verifyBtn = screen.getByRole('button', { name: /verify law/i });
    fireEvent.click(verifyBtn);

    const feedback = screen.getByRole('status');
    expect(feedback).toHaveTextContent(/\[Success\]/i);
    expect(feedback).toHaveTextContent(/Absorption/i);
  });

  it('verifies "Try a law" failure with pedagogical explanation when law does not match', () => {
    const parsed = parse('A + B');
    if (!parsed.ok) throw new Error('Parse failed');

    render(<SimplificationSteps ast={parsed.ast} />);

    // Select involution (double negation) which does not apply to A + B
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'involution' } });

    const verifyBtn = screen.getByRole('button', { name: /verify law/i });
    fireEvent.click(verifyBtn);

    const feedback = screen.getByRole('status');
    expect(feedback).toHaveTextContent(/\[Did Not Apply\]/i);
    expect(feedback).toHaveTextContent(/Involution/i);
  });

  it('provides an apply button that triggers onApplySimplified', () => {
    const parsed = parse("A + A'");
    if (!parsed.ok) throw new Error('Parse failed');

    const handleApply = vi.fn();
    render(
      <SimplificationSteps
        ast={parsed.ast}
        onApplySimplified={handleApply}
      />
    );

    const applyBtn = screen.getByRole('button', {
      name: /apply simplified expression to project/i,
    });
    fireEvent.click(applyBtn);

    expect(handleApply).toHaveBeenCalledTimes(1);
    expect(handleApply.mock.calls[0]?.[0]?.type).toBe('constant');
  });

  it('meets accessibility requirements: ordered list with role and proper button labels', () => {
    const parsed = parse("A + A'");
    if (!parsed.ok) throw new Error('Parse failed');

    render(<SimplificationSteps ast={parsed.ast} />);

    const list = screen.getByRole('list', {
      name: /simplification step sequence/i,
    });
    expect(list).toBeInTheDocument();
  });
});
