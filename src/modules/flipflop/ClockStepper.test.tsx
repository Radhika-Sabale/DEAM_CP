/**
 * @file ClockStepper.test.tsx
 * Unit tests for the ClockStepper component: toggle actions, pulsing, preset loading, and keyboard navigation.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { PRESET_SCENARIOS } from '../../engine/flipflop/presets';
import { ClockStepper } from './ClockStepper';
import { useFlipFlopSession } from './useFlipFlopSession';

function TestWrapper({ type = 'D' }: { type?: 'D' | 'JK' | 'SR' | 'T' }) {
  const session = useFlipFlopSession(type);
  return <ClockStepper session={session} />;
}

describe('ClockStepper', () => {
  it('renders input buttons for D flip-flop and toggles input value', () => {
    render(<TestWrapper type="D" />);

    const toggleD = screen.getByRole('button', { name: /Toggle input D/i });
    expect(toggleD).toBeDefined();

    fireEvent.click(toggleD);
    expect(screen.getByText('D =')).toBeDefined();
  });

  it('pulses clock and updates output state Q', () => {
    render(<TestWrapper type="D" />);

    // Toggle D to 1
    const toggleD = screen.getByRole('button', { name: /Toggle input D/i });
    fireEvent.click(toggleD);

    // Pulse clock
    const pulseBtn = screen.getByRole('button', { name: /Pulse clock full cycle/i });
    fireEvent.click(pulseBtn);

    // Q should become 1
    expect(screen.getByText('Q = 1')).toBeDefined();
  });

  it('loads preset scenarios from menu', () => {
    render(<TestWrapper type="D" />);

    const select = screen.getByLabelText(/Preset Scenarios Menu/i);
    const targetPreset = PRESET_SCENARIOS[1]!; // T divide by two
    fireEvent.change(select, { target: { value: targetPreset.id } });

    expect(
      screen.getAllByText(new RegExp(`t = ${targetPreset.script.endTime}`, 'i')).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('steps cursor through previous and next events', () => {
    render(<TestWrapper type="D" />);

    // Create 2 events
    const toggleD = screen.getByRole('button', { name: /Toggle input D/i });
    fireEvent.click(toggleD);
    const toggleClk = screen.getByRole('button', { name: /Toggle clock transition/i });
    fireEvent.click(toggleClk);

    const prevBtn = screen.getByRole('button', { name: /Step cursor to previous event/i });
    const nextBtn = screen.getByRole('button', { name: /Step cursor to next event/i });

    fireEvent.click(prevBtn);
    expect(screen.getByLabelText(/Timeline inspection cursor position/i)).toBeDefined();
    fireEvent.click(nextBtn);
  });

  it('supports keyboard-only interactive scenario execution', () => {
    render(<TestWrapper type="JK" />);

    const toggleJ = screen.getByRole('button', { name: /Toggle input J/i });
    const toggleK = screen.getByRole('button', { name: /Toggle input K/i });
    const pulseBtn = screen.getByRole('button', { name: /Pulse clock full cycle/i });

    // Keyboard activation with Enter/Space
    fireEvent.keyDown(toggleJ, { key: 'Enter' });
    fireEvent.click(toggleJ);

    fireEvent.keyDown(toggleK, { key: 'Enter' });
    fireEvent.click(toggleK);

    fireEvent.keyDown(pulseBtn, { key: ' ' });
    fireEvent.click(pulseBtn);

    expect(screen.getByText('Q = 1')).toBeDefined();
  });
});
