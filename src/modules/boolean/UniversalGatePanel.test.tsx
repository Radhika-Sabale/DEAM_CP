/**
 * @file UniversalGatePanel.test.tsx
 * Tests for UniversalGatePanel: NAND-only and NOR-only conversion,
 * gate and level metrics, verified equivalence indicator, and accessibility.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { parse } from '../../engine/boolean';
import { UniversalGatePanel } from './UniversalGatePanel';

describe('UniversalGatePanel', () => {
  it('converts to NAND-only form and displays verified equivalence indicator', () => {
    const parsed = parse('A + B');
    if (!parsed.ok) throw new Error('Parse failed');

    render(<UniversalGatePanel ast={parsed.ast} />);

    expect(screen.getByText(/Verified Equivalent/i)).toBeInTheDocument();
    expect(screen.getByText(/Total NAND Gate Count/i)).toBeInTheDocument();
    expect(screen.getByText(/Logic Circuit Level Depth/i)).toBeInTheDocument();
  });

  it('switches between NAND-only and NOR-only forms', () => {
    const parsed = parse('AB');
    if (!parsed.ok) throw new Error('Parse failed');

    render(<UniversalGatePanel ast={parsed.ast} />);

    const norRadio = screen.getByRole('radio', { name: /nor-only/i });
    fireEvent.click(norRadio);

    expect(screen.getByText(/Total NOR Gate Count/i)).toBeInTheDocument();
    expect(screen.getByText(/Synthesized NOR Expression/i)).toBeInTheDocument();
  });
});
