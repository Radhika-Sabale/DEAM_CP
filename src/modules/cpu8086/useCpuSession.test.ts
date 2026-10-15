/**
 * @file useCpuSession.test.ts
 * Unit tests for the useCpuSession hook managing the ephemeral 8086 machine state.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCpuSession } from './useCpuSession';
import { useProjectStore } from '../../store/projectStore';

describe('useCpuSession', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
    vi.useRealTimers();
  });

  it('assembles a valid program on mount or assembleAndReset', () => {
    useProjectStore.getState().applyPatch({
      cpu8086: {
        source: 'MOV AX, 42\nHLT',
        breakpoints: [],
      },
    });

    const { result } = renderHook(() => useCpuSession());

    act(() => {
      result.current.assembleAndReset();
    });

    expect(result.current.assemblerResult?.ok).toBe(true);
    expect(result.current.program).not.toBeNull();
    expect(result.current.cpuState).not.toBeNull();
    expect(result.current.status).toBe('assembled');
  });

  it('keeps old machine when assemble fails with syntax error', () => {
    useProjectStore.getState().applyPatch({
      cpu8086: {
        source: 'MOV AX, 12\nHLT',
        breakpoints: [],
      },
    });

    const { result } = renderHook(() => useCpuSession());

    act(() => {
      result.current.assembleAndReset();
    });

    const oldState = result.current.cpuState;
    expect(oldState).not.toBeNull();

    // Now introduce an assembler error
    act(() => {
      result.current.setSource('INVALID_SYNTAX_COMMAND %%%');
    });

    act(() => {
      result.current.assembleAndReset();
    });

    expect(result.current.assemblerResult?.ok).toBe(false);
    expect(result.current.status).toBe('error');
    // Old cpu state must be preserved
    expect(result.current.cpuState).toBe(oldState);
  });

  it('single-steps through instructions and records history', () => {
    useProjectStore.getState().applyPatch({
      cpu8086: {
        source: 'MOV AX, 1\nADD AX, 2\nHLT',
        breakpoints: [],
      },
    });

    const { result } = renderHook(() => useCpuSession());

    act(() => {
      result.current.assembleAndReset();
    });

    expect(result.current.cpuState?.registers.AX).toBe(0);

    // Step 1: MOV AX, 1
    act(() => {
      result.current.stepSingle();
    });

    expect(result.current.cpuState?.registers.AX).toBe(1);
    expect(result.current.historyLength).toBe(1);
    expect(result.current.canStepBack).toBe(true);

    // Step 2: ADD AX, 2
    act(() => {
      result.current.stepSingle();
    });

    expect(result.current.cpuState?.registers.AX).toBe(3);
    expect(result.current.historyLength).toBe(2);
  });

  it('supports history rewind (step back, step forward, goTo)', () => {
    useProjectStore.getState().applyPatch({
      cpu8086: {
        source: 'MOV AX, 10\nMOV BX, 20\nHLT',
        breakpoints: [],
      },
    });

    const { result } = renderHook(() => useCpuSession());

    act(() => {
      result.current.assembleAndReset();
      result.current.stepSingle(); // AX = 10
      result.current.stepSingle(); // BX = 20
    });

    expect(result.current.cpuState?.registers.AX).toBe(10);
    expect(result.current.cpuState?.registers.BX).toBe(20);

    // Step back
    act(() => {
      result.current.historyStepBack();
    });

    expect(result.current.cpuState?.registers.BX).toBe(0);
    expect(result.current.canStepForward).toBe(true);

    // Step forward
    act(() => {
      result.current.historyStepForward();
    });

    expect(result.current.cpuState?.registers.BX).toBe(20);

    // Go to step 0 (after first instruction MOV AX, 10)
    act(() => {
      result.current.historyGoTo(0);
    });

    expect(result.current.cpuState?.registers.AX).toBe(10);
    expect(result.current.cpuState?.registers.BX).toBe(0);

    // Go to baseline -1 (before any instruction executed)
    act(() => {
      result.current.historyGoTo(-1);
    });

    expect(result.current.cpuState?.registers.AX).toBe(0);
    expect(result.current.cpuState?.registers.BX).toBe(0);
  });

  it('runs to HLT with speed=max and sets halted status and message', async () => {
    useProjectStore.getState().applyPatch({
      cpu8086: {
        source: 'MOV CX, 5\nloop:\nDEC CX\nJNZ loop\nHLT',
        breakpoints: [],
      },
    });

    const { result } = renderHook(() => useCpuSession());

    act(() => {
      result.current.assembleAndReset();
      result.current.setSpeed('max');
    });

    act(() => {
      result.current.run();
    });

    // At speed max, it runs synchronously or via immediate chunking
    expect(result.current.cpuState?.registers.CX).toBe(0);
    expect(result.current.cpuState?.halted).toBe(true);
    expect(result.current.status).toBe('halted');
    expect(result.current.stopReasonMessage).toContain('HLT');
  });

  it('resets machine state back to initial configuration', () => {
    useProjectStore.getState().applyPatch({
      cpu8086: {
        source: 'MOV AX, 99\nHLT',
        breakpoints: [],
      },
    });

    const { result } = renderHook(() => useCpuSession());

    act(() => {
      result.current.assembleAndReset();
      result.current.stepSingle();
    });

    expect(result.current.cpuState?.registers.AX).toBe(99);

    act(() => {
      result.current.reset();
    });

    expect(result.current.cpuState?.registers.AX).toBe(0);
    expect(result.current.totalSteps).toBe(0);
    expect(result.current.status).toBe('assembled');
  });

  it('allows initial register edit and memory byte edit', () => {
    useProjectStore.getState().applyPatch({
      cpu8086: {
        source: 'HLT',
        breakpoints: [],
      },
    });

    const { result } = renderHook(() => useCpuSession());

    act(() => {
      result.current.assembleAndReset();
      result.current.setInitialRegister('BX', 0x5678);
      result.current.editMemoryByte(0x0200, 0xef);
    });

    expect(result.current.cpuState?.registers.BX).toBe(0x5678);
    expect(result.current.cpuState?.memory.pages[0x02] ? result.current.cpuState.memory.pages[0x02][0x00] : undefined).toBe(0xef);
  });
});
