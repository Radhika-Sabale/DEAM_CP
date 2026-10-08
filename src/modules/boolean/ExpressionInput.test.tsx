/**
 * @file ExpressionInput.test.tsx
 * Tests for ExpressionInput: live debounced parsing, error caret visualization,
 * symbol palette insertion at cursor, and ARIA accessibility.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { ExpressionInput } from './ExpressionInput';

describe('ExpressionInput', () => {
  it('valid input debounces and invokes onParsed with valid AST', async () => {
    const handleParsed = vi.fn();
    const handleChange = vi.fn();

    render(
      <ExpressionInput
        value="A + B"
        onChange={handleChange}
        onParsed={handleParsed}
      />
    );

    await waitFor(
      () => {
        expect(handleParsed).toHaveBeenCalledWith(
          expect.objectContaining({
            ok: true,
            variables: ['A', 'B'],
          })
        );
      },
      { timeout: 500 }
    );

    expect(screen.getByText(/\[Valid Syntax\]/i)).toBeInTheDocument();
  });

  it('invalid input displays error message, position, and caret line', async () => {
    const handleParsed = vi.fn();

    render(
      <ExpressionInput
        value="A + +"
        onChange={() => {}}
        onParsed={handleParsed}
      />
    );

    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      },
      { timeout: 500 }
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Syntax Error/i);
    expect(alert).toHaveTextContent(/Position/i);
    expect(alert).toHaveTextContent(/\^/);
  });

  it('inserts symbol from palette at the current cursor position', () => {
    const handleChange = vi.fn();

    const { rerender } = render(
      <ExpressionInput
        value="AB"
        onChange={handleChange}
      />
    );

    const input = screen.getByRole('textbox', { name: /boolean expression/i });

    // Set cursor between A and B
    fireEvent.focus(input);
    (input as HTMLInputElement).setSelectionRange(1, 1);

    // Click the '+' operator button
    const orButton = screen.getByRole('button', { name: /insert or \(\+\)/i });
    fireEvent.click(orButton);

    expect(handleChange).toHaveBeenCalledWith('A+B');

    // Re-render with new value to simulate controlled component
    rerender(<ExpressionInput value="A+B" onChange={handleChange} />);
    expect(input).toHaveValue('A+B');
  });

  it('meets accessibility standards with proper roles, labels, and aria-invalid', async () => {
    const { rerender } = render(
      <ExpressionInput
        value="A"
        onChange={() => {}}
      />
    );

    const input = screen.getByRole('textbox', { name: /boolean expression/i });
    expect(input).toHaveAttribute('aria-invalid', 'false');

    // Render with syntax error
    rerender(
      <ExpressionInput
        value="A +"
        onChange={() => {}}
      />
    );

    await waitFor(
      () => {
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
      },
      { timeout: 500 }
    );
  });
});
