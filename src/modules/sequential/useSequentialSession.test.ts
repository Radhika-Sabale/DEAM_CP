/**
 * @file useSequentialSession.test.ts
 * Tests for useSequentialSession hook: reference derivation, error exposure, and patch persistence.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from '../../store/projectStore';
import type { CounterSpec } from '../../types/sequential';
import { useSequentialSession } from './useSequentialSession';

describe('useSequentialSession hook', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('initializes with default project state and exposes unlocking helpers', () => {
    const { result } = renderHook(() => useSequentialSession());
    expect(result.current.state.currentStep).toBe('flipflop');
    expect(result.current.isUnlocked('flipflop')).toBe(true);
    expect(result.current.isUnlocked('define')).toBe(false);
    expect(result.current.referenceDesign).toBeNull();
  });

  it('derives reference design via designSequential when synchronous spec is supplied', () => {
    const { result } = renderHook(() => useSequentialSession());

    const spec: CounterSpec = {
      kind: 'counter',
      flipFlop: 'D',
      style: 'sync',
      direction: 'up',
      modulus: 4,
    };

    act(() => {
      result.current.setSpec(spec);
    });

    expect(result.current.referenceDesign).not.toBeNull();
    expect(result.current.referenceDesign?.table.validCodes).toEqual([0, 1, 2, 3]);
    expect(result.current.errors).toHaveLength(0);
  });

  it('derives async ripple design when asynchronous counter is specified', () => {
    const { result } = renderHook(() => useSequentialSession());

    const asyncSpec: CounterSpec = {
      kind: 'counter',
      flipFlop: 'JK',
      style: 'async',
      direction: 'up',
      modulus: 4,
    };

    act(() => {
      result.current.setSpec(asyncSpec);
    });

    expect(result.current.asyncDesign).not.toBeNull();
    expect(result.current.asyncDesign?.modulus).toBe(4);
    expect(result.current.errors).toHaveLength(0);
  });

  it('exposes plain-language errors on invalid specification', () => {
    const { result } = renderHook(() => useSequentialSession());

    const badSpec: CounterSpec = {
      kind: 'counter',
      flipFlop: 'D',
      style: 'sync',
      direction: 'up',
      modulus: 1, // Invalid: must be >= 2
    };

    act(() => {
      result.current.setSpec(badSpec);
    });

    expect(result.current.referenceDesign).toBeNull();
    expect(result.current.errors.length).toBeGreaterThan(0);
    expect(result.current.errors[0]).toContain('between 2 and 16');
  });

  it('guards against accidental draft loss with confirmation dialog when later drafts exist', () => {
    const { result } = renderHook(() => useSequentialSession());

    const spec1: CounterSpec = {
      kind: 'counter',
      flipFlop: 'D',
      style: 'sync',
      direction: 'up',
      modulus: 4,
    };

    act(() => {
      result.current.setSpec(spec1);
      result.current.updateDraft('table', { customCell: '1' });
    });

    const spec2: CounterSpec = {
      kind: 'counter',
      flipFlop: 'D',
      style: 'sync',
      direction: 'up',
      modulus: 6,
    };

    act(() => {
      result.current.setSpec(spec2);
    });

    // Should prompt confirmation because 'table' has draft work
    expect(result.current.specChangeConfirm.isOpen).toBe(true);
    expect(result.current.specChangeConfirm.pendingSpec).toEqual(spec2);
    // Old spec still active
    expect((result.current.state.spec as CounterSpec | null)?.modulus).toBe(4);

    // Cancel preserves old state
    act(() => {
      result.current.specChangeConfirm.cancel();
    });
    expect(result.current.specChangeConfirm.isOpen).toBe(false);
    expect((result.current.state.spec as CounterSpec | null)?.modulus).toBe(4);

    // Confirm replaces spec and clears dialog
    act(() => {
      result.current.setSpec(spec2);
    });
    act(() => {
      result.current.specChangeConfirm.confirm();
    });
    expect(result.current.specChangeConfirm.isOpen).toBe(false);
    expect((result.current.state.spec as CounterSpec | null)?.modulus).toBe(6);
  });
});
