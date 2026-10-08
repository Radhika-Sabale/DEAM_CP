/**
 * @file EventLog.test.tsx
 * Unit tests for EventLog component: SR 11 invalid input error, async conflict, timing violation,
 * and level-high race-around warning explanations.
 */

import { act, render, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { PRESET_SCENARIOS } from '../../engine/flipflop/presets';
import { EventLog } from './EventLog';
import { useFlipFlopSession } from './useFlipFlopSession';

describe('EventLog', () => {
  it('renders SR S=1 R=1 invalid input with error severity badge and explanation', () => {
    const { result } = renderHook(() => useFlipFlopSession('SR'));
    act(() => {
      const preset = PRESET_SCENARIOS.find((p) => p.id === 'sr-invalid-state')!;
      result.current.loadPreset(preset);
    });

    render(<EventLog session={result.current} />);

    expect(screen.getAllByText(/Error/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/invalid input combination was present/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/What does forbidden state mean/i)).toBeDefined();
  });

  it('renders async PRESET and CLEAR conflict with error message', () => {
    const { result } = renderHook(() => useFlipFlopSession('SR'));
    act(() => {
      const preset = PRESET_SCENARIOS.find((p) => p.id === 'async-conflict')!;
      result.current.loadPreset(preset);
    });

    render(<EventLog session={result.current} />);

    expect(
      screen.getAllByText(/both PRESET and CLEAR pins were asserted simultaneously/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('renders data setup time violation when signal changes too close to clock edge', () => {
    const { result } = renderHook(() => useFlipFlopSession('D'));
    act(() => {
      const preset = PRESET_SCENARIOS.find((p) => p.id === 'setup-violation')!;
      result.current.loadPreset(preset);
    });

    render(<EventLog session={result.current} />);

    expect(screen.getAllByText(/Setup time violation occurred on data input "D"/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders race-around warning for level-high JK latch preset', () => {
    const { result } = renderHook(() => useFlipFlopSession('JK'));
    act(() => {
      const preset = PRESET_SCENARIOS.find((p) => p.id === 'level-jk-race-around')!;
      result.current.loadPreset(preset);
    });

    render(<EventLog session={result.current} />);

    expect(screen.getAllByText(/Warning/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/race-around oscillation occurred/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/What is a Race-Around Hazard/i)).toBeDefined();
  });
});
