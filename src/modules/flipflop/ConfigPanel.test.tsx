/**
 * @file ConfigPanel.test.tsx
 * Unit tests for the flip-flop component configuration panel.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { defaultConfig } from '../../engine/flipflop/models';
import { ConfigPanel } from './ConfigPanel';

describe('ConfigPanel', () => {
  it('renders all four flip-flop type radio options', () => {
    const onTypeChange = vi.fn();
    const onConfigChange = vi.fn();
    const onInitialQChange = vi.fn();

    render(
      <ConfigPanel
        config={defaultConfig('D')}
        initialQ={0}
        onTypeChange={onTypeChange}
        onConfigChange={onConfigChange}
        onInitialQChange={onInitialQChange}
      />
    );

    expect(screen.getByText('D (Data) Flip-Flop')).toBeDefined();
    expect(screen.getByText('JK Flip-Flop')).toBeDefined();
    expect(screen.getByText('SR Latch / Flip-Flop')).toBeDefined();
    expect(screen.getByText('T (Toggle) Flip-Flop')).toBeDefined();

    // Change type to JK
    const jkRadio = screen.getByDisplayValue('JK');
    fireEvent.click(jkRadio);
    expect(onTypeChange).toHaveBeenCalledWith('JK');
  });

  it('changes trigger mode and displays trigger explanation', () => {
    const onConfigChange = vi.fn();

    const { rerender } = render(
      <ConfigPanel
        config={defaultConfig('D')}
        initialQ={0}
        onTypeChange={vi.fn()}
        onConfigChange={onConfigChange}
        onInitialQChange={vi.fn()}
      />
    );

    const select = screen.getByLabelText(/Clock Triggering Mechanism/i);
    fireEvent.change(select, { target: { value: 'level-high' } });
    expect(onConfigChange).toHaveBeenCalled();

    rerender(
      <ConfigPanel
        config={{ ...defaultConfig('D'), trigger: 'level-high' }}
        initialQ={0}
        onTypeChange={vi.fn()}
        onConfigChange={onConfigChange}
        onInitialQChange={vi.fn()}
      />
    );

    expect(screen.getByText(/Setup and hold times apply only to edge-triggered flip-flops/i)).toBeDefined();
  });

  it('toggles asynchronous controls checkbox and changes polarity', () => {
    const onConfigChange = vi.fn();

    const { rerender } = render(
      <ConfigPanel
        config={defaultConfig('D')}
        initialQ={0}
        onTypeChange={vi.fn()}
        onConfigChange={onConfigChange}
        onInitialQChange={vi.fn()}
      />
    );

    const asyncCheckbox = screen.getByLabelText(/Asynchronous PRESET & CLEAR Controls/i);
    expect(asyncCheckbox).not.toBeChecked();
    fireEvent.click(asyncCheckbox);
    expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({ asyncControls: true }));

    rerender(
      <ConfigPanel
        config={{ ...defaultConfig('D'), asyncControls: true }}
        initialQ={0}
        onTypeChange={vi.fn()}
        onConfigChange={onConfigChange}
        onInitialQChange={vi.fn()}
      />
    );

    const polaritySelect = screen.getByLabelText(/Control Assertion Active Level/i);
    fireEvent.change(polaritySelect, { target: { value: 'active-high' } });
    expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({ asyncActiveLow: false }));
  });
});
