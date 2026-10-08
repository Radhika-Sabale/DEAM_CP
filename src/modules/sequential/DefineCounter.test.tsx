/**
 * @file DefineCounter.test.tsx
 * Tests for DefineCounter: plain-language validation errors, live metrics, and Mod-10 architecture numbers.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { CounterSpec } from '../../types/sequential';
import { DefineCounter } from './DefineCounter';

describe('DefineCounter component', () => {
  it('displays accurate summary numbers for Mod-10 counter (4 flip-flops, 6 unused)', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      flipFlop: 'D',
      style: 'sync',
      direction: 'up',
      modulus: 10,
    };

    render(<DefineCounter flipFlop="D" value={spec} onChange={vi.fn()} />);

    // States Visited: 10
    expect(screen.getByText('10')).toBeInTheDocument();
    // Flip-Flops Needed: 4
    const ffLabels = screen.getAllByText('4');
    expect(ffLabels.length).toBeGreaterThan(0);
    // Unused states: 6 (10, 11, 12, 13, 14, 15)
    expect(screen.getByText(/6 \(10, 11, 12, 13, 14, 15\)/i)).toBeInTheDocument();
  });

  it('shows plain-language error for bad modulus (< 2)', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      flipFlop: 'JK',
      style: 'sync',
      direction: 'up',
      modulus: 1,
    };

    render(<DefineCounter flipFlop="JK" value={spec} onChange={vi.fn()} />);

    expect(
      screen.getByText(/Field 'modulus' must be an integer between 2 and 16/i)
    ).toBeInTheDocument();
  });

  it('shows plain-language error for bad custom sequence', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      flipFlop: 'T',
      style: 'sync',
      direction: 'custom',
      modulus: 3,
      sequence: [1, 2, 2], // Duplicate
    };

    render(<DefineCounter flipFlop="T" value={spec} onChange={vi.fn()} />);

    expect(
      screen.getByText(/Custom sequence states must be unique/i)
    ).toBeInTheDocument();
  });

  it('shows plain-language error when asynchronous ripple counter uses unsupported direction', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      flipFlop: 'JK',
      style: 'async',
      direction: 'up-down', // Async cannot do bidirectional up-down
      modulus: 4,
    };

    render(<DefineCounter flipFlop="JK" value={spec} onChange={vi.fn()} />);

    expect(
      screen.getByText(/Asynchronous ripple counters cannot support/i)
    ).toBeInTheDocument();
  });

  it('shows plain-language error for asynchronous down-counter with non-power-of-2 modulus', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      flipFlop: 'JK',
      style: 'async',
      direction: 'down',
      modulus: 6, // Not a power of 2
    };

    render(<DefineCounter flipFlop="JK" value={spec} onChange={vi.fn()} />);

    expect(
      screen.getByText(/Asynchronous ripple down-counters require a power-of-2 modulus/i)
    ).toBeInTheDocument();
  });

  it('shows DN input polarity explanation when up-down mode is selected', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      flipFlop: 'D',
      style: 'sync',
      direction: 'up-down',
      modulus: 4,
    };

    render(<DefineCounter flipFlop="D" value={spec} onChange={vi.fn()} />);

    expect(
      screen.getByText(/DN = 0 counts up, DN = 1 counts down/i)
    ).toBeInTheDocument();
  });
});
