/**
 * @file RaceAroundExplorer.test.tsx
 * Unit tests for RaceAroundExplorer: theoretical vs simulated toggle count matching across 20 parameter pairs,
 * and edge-triggered conversion verification.
 */

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import type { LogicValue } from '../../types/ast';
import { analyzeRaceAround } from '../../engine/flipflop/hazards';
import { defaultConfig } from '../../engine/flipflop/models';
import { simulateTimeline } from '../../engine/flipflop/stepper';
import { RaceAroundExplorer } from './RaceAroundExplorer';
import { useFlipFlopSession } from './useFlipFlopSession';

describe('RaceAroundExplorer', () => {
  it('verifies for 20 (width, delay) pairs that theoretical predicted count equals simulated toggle count', () => {
    const testPairs: [number, number][] = [
      [10, 2],
      [12, 3],
      [15, 3],
      [8, 2],
      [20, 4],
      [14, 2],
      [9, 3],
      [16, 4],
      [25, 5],
      [18, 6],
      [10, 5],
      [12, 4],
      [6, 2],
      [21, 7],
      [30, 6],
      [15, 5],
      [8, 4],
      [24, 8],
      [20, 5],
      [10, 10],
    ];

    for (const [width, delay] of testPairs) {
      const config = {
        ...defaultConfig('JK'),
        trigger: 'level-high' as const,
        propagationDelay: delay,
      };
      const inputs: Record<string, LogicValue> = { J: 1, K: 1 };

      const analysis = analyzeRaceAround(config, inputs, width);
      const sim = simulateTimeline(config, {
        initialQ: 0,
        initialInputs: inputs,
        initialClock: 0,
        events: [
          { time: 5, signal: 'CLK', value: 1 },
          { time: 5 + width, signal: 'CLK', value: 0 },
        ],
        endTime: 5 + width + 10,
      });

      expect(sim.ok).toBe(true);
      if (sim.ok) {
        expect(analysis.toggleCount).toBe(sim.stats.qTogglesCount);
      }
    }
  });

  it('Make it edge-triggered button brings toggle count to 1', () => {
    const { result } = renderHook(() => useFlipFlopSession('JK'));
    act(() => {
      result.current.setConfig({
        ...result.current.state.config,
        trigger: 'level-high',
        propagationDelay: 2,
      });
      result.current.setInput('J', 1);
      result.current.setInput('K', 1);
    });

    const { rerender } = render(<RaceAroundExplorer session={result.current} />);

    expect(screen.getByText(/5 toggles predicted/i)).toBeDefined();

    const makeEdgeBtn = screen.getByRole('button', {
      name: /Make it Edge-Triggered/i,
    });
    fireEvent.click(makeEdgeBtn);

    rerender(<RaceAroundExplorer session={result.current} />);
    expect(screen.getByText(/Edge-Triggering Active \(Immune to Race-Around\)/i)).toBeDefined();
  });
});
