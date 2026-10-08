/**
 * @file DefineDetector.test.tsx
 * Tests for DefineDetector: plain-language validation errors and Mealy vs Moore state projections.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { DetectorSpec } from '../../types/sequential';
import { DefineDetector } from './DefineDetector';

describe('DefineDetector component', () => {
  it('displays accurate state projections for pattern "1011" (Mealy 4 states, Moore 5)', () => {
    const spec: DetectorSpec = {
      kind: 'detector',
      flipFlop: 'D',
      pattern: '1011',
      machine: 'mealy',
      overlapping: true,
    };

    render(<DefineDetector flipFlop="D" value={spec} onChange={vi.fn()} />);

    expect(screen.getByText(/Mealy: 4 \| Moore: 5/i)).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument(); // Active Mealy states
  });

  it('shows plain-language error for invalid pattern (too short or containing non-binary characters)', () => {
    const badSpec: DetectorSpec = {
      kind: 'detector',
      flipFlop: 'D',
      pattern: '10A', // Contains 'A'
      machine: 'mealy',
      overlapping: true,
    };

    render(<DefineDetector flipFlop="D" value={badSpec} onChange={vi.fn()} />);

    expect(
      screen.getByText(/must be a binary string of 2 to 8 bits/i)
    ).toBeInTheDocument();
  });

  it('shows plain-language error for single-bit pattern (< 2 bits)', () => {
    const badSpec: DetectorSpec = {
      kind: 'detector',
      flipFlop: 'D',
      pattern: '1',
      machine: 'mealy',
      overlapping: true,
    };

    render(<DefineDetector flipFlop="D" value={badSpec} onChange={vi.fn()} />);

    expect(
      screen.getByText(/must be a binary string of 2 to 8 bits/i)
    ).toBeInTheDocument();
  });
});
