/**
 * @file FlagsPanel8086.test.tsx
 * Unit tests for FlagsPanel8086: displays flags, "undefined" shown literally,
 * subtraction borrow convention line, and fault message.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { FlagsPanel8086 } from './FlagsPanel8086';
import type { CpuFlags, FlagChange } from '../../engine/cpu8086/cpuTypes';

describe('FlagsPanel8086', () => {
  it('renders status flags and convention line', () => {
    const flags: CpuFlags = {
      Z: 1,
      C: 0,
      S: 0,
      O: 0,
      I: 0,
      T: 0,
    };

    render(<FlagsPanel8086 flags={flags} />);

    expect(screen.getByText(/Status Flags/i)).toBeInTheDocument();
    expect(screen.getByText(/CF = borrow on subtraction \(8086\)/i)).toBeInTheDocument();
    expect(screen.getByText('ZF')).toBeInTheDocument();
    expect(screen.getByText('Zero Flag')).toBeInTheDocument();
  });

  it('displays "undefined" as the word when OF is undefined after multi-bit shift', () => {
    const flags: CpuFlags = {
      Z: 0,
      C: 1,
      S: 0,
      O: 'undefined',
      I: 0,
      T: 0,
    };

    render(<FlagsPanel8086 flags={flags} />);

    // Literal word "undefined" displayed for OF
    expect(screen.getAllByText('undefined').length).toBeGreaterThan(0);
  });

  it('renders fault message and changed flags', () => {
    const flags: CpuFlags = {
      Z: 0,
      C: 0,
      S: 0,
      O: 0,
      I: 0,
      T: 0,
    };

    const lastChanges: readonly FlagChange[] = [
      { name: 'Z', old: 0, new: 1 },
    ];

    render(
      <FlagsPanel8086
        flags={flags}
        lastChanges={lastChanges}
        faultMessage="Branch on undefined OF attempted at line 4"
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/Branch on undefined OF attempted/i);
    expect(screen.getByText('changed')).toBeInTheDocument();
  });
});
