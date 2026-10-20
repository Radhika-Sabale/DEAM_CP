/**
 * @file CodeEditor.test.tsx
 * Unit tests for CodeEditor component: gutter markers, error table,
 * breakpoint toggles, and sample confirmation modal.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { CodeEditor } from './CodeEditor';
import type { AssemblerError } from '../../engine/cpu8086/types';

describe('CodeEditor', () => {
  const sampleErrors: readonly AssemblerError[] = [
    {
      line: 2,
      column: 5,
      length: 3,
      code: 'E_SYNTAX',
      message: 'Unknown mnemonic FOO',
    },
  ];

  it('renders line gutter and editor textarea', () => {
    const onSourceChange = vi.fn();
    const onToggleBreakpoint = vi.fn();

    render(
      <CodeEditor
        source={"MOV AX, 1\nMOV BX, 2\nHLT"}
        onSourceChange={onSourceChange}
        currentLine={1}
        breakpoints={new Set([2])}
        onToggleBreakpoint={onToggleBreakpoint}
        errors={[]}
      />
    );

    expect(screen.getByLabelText(/8086 Assembly source code editor/i)).toBeInTheDocument();
    // Line 1 is the current instruction.
    expect(screen.getByText('Current')).toBeInTheDocument();
    // Line 2 has breakpoint -> has text "breakpoint"
    expect(screen.getByText('breakpoint')).toBeInTheDocument();
  });

  it('toggles breakpoint when clicking gutter button', () => {
    const onToggleBreakpoint = vi.fn();

    render(
      <CodeEditor
        source={"MOV AX, 1\nMOV BX, 2"}
        onSourceChange={vi.fn()}
        currentLine={1}
        breakpoints={new Set()}
        onToggleBreakpoint={onToggleBreakpoint}
        errors={[]}
      />
    );

    const line2Button = screen.getByRole('button', { name: /Line 2/i });
    fireEvent.click(line2Button);
    expect(onToggleBreakpoint).toHaveBeenCalledWith(2);
  });

  it('renders assembler error table with clickable rows', () => {
    render(
      <CodeEditor
        source={"MOV AX, 1\nFOO\nHLT"}
        onSourceChange={vi.fn()}
        currentLine={1}
        breakpoints={new Set()}
        onToggleBreakpoint={vi.fn()}
        errors={sampleErrors}
      />
    );

    // Error badge in gutter
    expect(screen.getAllByText('Error').length).toBeGreaterThan(0);
    // Error table message
    expect(screen.getByText('Unknown mnemonic FOO')).toBeInTheDocument();

    // Clicking error row jumps to line
    const errorRow = screen.getByText('Unknown mnemonic FOO').closest('tr');
    expect(errorRow).not.toBeNull();
    fireEvent.click(errorRow!);

    const textarea = screen.getByLabelText(/8086 Assembly source code editor/i) as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
  });

  it('shows confirmation modal when selecting a sample program', () => {
    const onSourceChange = vi.fn();

    render(
      <CodeEditor
        source={"MOV AX, 999"}
        onSourceChange={onSourceChange}
        currentLine={1}
        breakpoints={new Set()}
        onToggleBreakpoint={vi.fn()}
        errors={[]}
      />
    );

    // Select "Sum Loop"
    const sampleSelect = screen.getByLabelText(/Load sample program/i);
    fireEvent.change(sampleSelect, { target: { value: 'sum-loop' } });

    // Modal appears
    expect(screen.getByText(/Replace Current Program\?/i)).toBeInTheDocument();
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    expect(cancelButton).toBeInTheDocument();

    // Confirm replaces
    const confirmButton = screen.getByRole('button', { name: /^Replace$/i });
    fireEvent.click(confirmButton);
    expect(onSourceChange).toHaveBeenCalledWith(expect.stringContaining('Sum of 1 to 10'));
  });
});
