/**
 * @file FlipFlopTiming.test.tsx
 * Unit tests for FlipFlopTiming and WaveformStrip: SVG accessibility title/desc, hatched unknown X band,
 * event markers with text labels, and collapsible transitions audit log.
 */

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { FlipFlopTiming } from './FlipFlopTiming';
import { useFlipFlopSession } from './useFlipFlopSession';

describe('FlipFlopTiming', () => {
  it('renders SVG with title and desc for screen reader accessibility', () => {
    const { result } = renderHook(() => useFlipFlopSession('D'));
    render(<FlipFlopTiming session={result.current} />);

    expect(screen.getByText('Digital Flip-Flop Timing Waveforms')).toBeDefined();
    expect(
      screen.getByText(
        'Visual timing diagrams showing signal logic levels and clock transitions over discrete simulation time.'
      )
    ).toBeDefined();
  });

  it('renders hatched pattern and "X" text label for unknown signal regions', () => {
    const { result } = renderHook(() => useFlipFlopSession('D'));
    act(() => {
      result.current.setInitialQ('X');
    });
    const { container } = render(<FlipFlopTiming session={result.current} />);

    const pattern = container.querySelector('#ff-hatch-unknown');
    expect(pattern).not.toBeNull();

    // Check that 'X' label text is present in the SVG
    const xLabels = container.querySelectorAll('text');
    const foundX = Array.from(xLabels).some((el) => el.textContent === 'X');
    expect(foundX).toBe(true);
  });

  it('renders event markers with explicit text labels (never colour only)', () => {
    const { result } = renderHook(() => useFlipFlopSession('D'));
    act(() => {
      result.current.setInput('D', 1);
      result.current.pulseClock();
    });

    render(<FlipFlopTiming session={result.current} />);

    // Edge events are labelled in plain text.
    expect(screen.getByText(/Edge: Load 1/i)).toBeDefined();
  });

  it('collapsible audit table lists every signal transition', () => {
    const { result } = renderHook(() => useFlipFlopSession('D'));
    act(() => {
      result.current.setInput('D', 1);
      result.current.pulseClock();
    });

    render(<FlipFlopTiming session={result.current} />);

    const showButton = screen.getByRole('button', {
      name: /Show Complete Trace Event Log/i,
    });
    fireEvent.click(showButton);

    expect(screen.getByText('Signal / Node')).toBeDefined();
    expect(screen.getAllByText('CLK').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Q').length).toBeGreaterThanOrEqual(1);
  });
});
