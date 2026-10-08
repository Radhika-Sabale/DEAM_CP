/**
 * @file SelectFlipFlop.test.tsx
 * Tests for SelectFlipFlop component: 4-type tables, store updates, and unset advisory.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { useProjectStore } from '../../store/projectStore';
import type { FlipFlopType } from '../../types/sequential';
import { SelectFlipFlop } from './SelectFlipFlop';

describe('SelectFlipFlop component', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('renders unset advisory note when no flip-flop is selected', () => {
    render(<SelectFlipFlop selectedType={null} onSelectType={vi.fn()} />);

    expect(
      screen.getByText(/No flip-flop selected yet\. Choose a flip-flop type to begin\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Explore in Flip-Flop Module/i })
    ).toBeInTheDocument();
  });

  it('writes selected type to the real project store and triggers callback', () => {
    const handleSelect = vi.fn();
    render(<SelectFlipFlop selectedType={null} onSelectType={handleSelect} />);

    const jkRadio = screen.getByLabelText(/JK Flip-Flop/i);
    fireEvent.click(jkRadio);

    expect(handleSelect).toHaveBeenCalledWith('JK');
    expect(useProjectStore.getState().project.flipFlopType).toBe('JK');
  });

  it.each<FlipFlopType>(['SR', 'JK', 'D', 'T'])(
    'renders both operation and excitation tables accurately for %s flip-flop',
    (ffType) => {
      render(<SelectFlipFlop selectedType={ffType} onSelectType={vi.fn()} />);

      const opTable = screen.getByRole('table', {
        name: `${ffType} Operation Table`,
      });
      expect(opTable).toBeInTheDocument();

      const excTable = screen.getByRole('table', {
        name: `${ffType} Excitation Table`,
      });
      expect(excTable).toBeInTheDocument();

      // Check header scopes for accessibility
      const headers = screen.getAllByRole('columnheader');
      expect(headers.length).toBeGreaterThan(0);
      for (const th of headers) {
        expect(th).toHaveAttribute('scope', 'col');
      }
    }
  );
});
