/**
 * @file history.test.ts
 * Unit tests for delta-compressed execution history: reversible transitions,
 * state reconstruction equivalence against fresh re-runs, truncation bounding, and trace table.
 */

import { describe, expect, it } from 'vitest';
import { assemble } from './assembler';
import { createCpuState, step } from './cpu';
import type { CpuState } from './cpuTypes';
import {
  applyForwardDelta,
  applyReverseDelta,
  createHistory,
  goTo,
  lastN,
  pushRecord,
  reconstructState,
  stepBack,
  stepForward,
} from './history';

describe('history: execution history and deltas', () => {
  it('applies forward and reverse deltas as exact inverses', () => {
    const prog = assemble('MOV AX, 0x1234\nADD AX, 0x0001\nHLT');
    expect(prog.ok).toBe(true);
    if (!prog.ok) return;

    const s0 = createCpuState(prog.program);
    const r1 = step(s0, prog.program);

    const sForward = applyForwardDelta(s0, r1.record);
    expect(sForward.registers.AX).toBe(0x1234);
    expect(sForward.registers.IP).toBe(1);

    const sReverse = applyReverseDelta(sForward, r1.record);
    expect(sReverse.registers.AX).toBe(s0.registers.AX);
    expect(sReverse.registers.IP).toBe(s0.registers.IP);
  });

  it('stepBack then stepForward is the identity on state', () => {
    const prog = assemble([
      'MOV AX, 10',
      'MOV BX, 20',
      'ADD AX, BX',
      'HLT',
    ].join('\n'));
    expect(prog.ok).toBe(true);
    if (!prog.ok) return;

    let state = createCpuState(prog.program);
    let hist = createHistory(state);

    // Execute 3 steps
    for (let i = 0; i < 3; i++) {
      const res = step(state, prog.program);
      state = res.state;
      hist = pushRecord(hist, res.record);
    }

    const stateAtStep3 = state;

    // Step back
    const back1 = stepBack(hist, state);
    expect(back1).not.toBeNull();
    if (!back1) return;

    // Step forward again
    const fwd1 = stepForward(back1.history, back1.state);
    expect(fwd1).not.toBeNull();
    if (!fwd1) return;

    expect(fwd1.state.registers.AX).toBe(stateAtStep3.registers.AX);
    expect(fwd1.state.registers.BX).toBe(stateAtStep3.registers.BX);
    expect(fwd1.state.registers.IP).toBe(stateAtStep3.registers.IP);
    expect(fwd1.state.flags).toEqual(stateAtStep3.flags);
  });

  it('sets truncation flag and drops oldest record when capacity is exceeded', () => {
    const prog = assemble([
      'loop:',
      'INC AX',
      'JMP loop',
    ].join('\n'));
    expect(prog.ok).toBe(true);
    if (!prog.ok) return;

    let state = createCpuState(prog.program);
    // Create history with small capacity of 5 steps
    let hist = createHistory(state, 5);
    expect(hist.truncated).toBe(false);

    for (let i = 0; i < 8; i++) {
      const res = step(state, prog.program);
      state = res.state;
      hist = pushRecord(hist, res.record);
    }

    expect(hist.truncated).toBe(true);
    expect(hist.records.length).toBe(5);
    expect(hist.totalSteps).toBe(8);
  });

  it('goTo navigates directly to any retained step index', () => {
    const prog = assemble([
      'MOV AX, 1',
      'MOV BX, 2',
      'MOV CX, 3',
      'HLT',
    ].join('\n'));
    expect(prog.ok).toBe(true);
    if (!prog.ok) return;

    let state = createCpuState(prog.program);
    let hist = createHistory(state);

    for (let i = 0; i < 3; i++) {
      const res = step(state, prog.program);
      state = res.state;
      hist = pushRecord(hist, res.record);
    }

    // Go to step index 0 (after MOV AX, 1)
    const at0 = goTo(hist, 0);
    expect(at0.state.registers.AX).toBe(1);
    expect(at0.state.registers.BX).toBe(0);

    // Go to step index 1 (after MOV BX, 2)
    const at1 = goTo(hist, 1);
    expect(at1.state.registers.AX).toBe(1);
    expect(at1.state.registers.BX).toBe(2);
    expect(at1.state.registers.CX).toBe(0);
  });

  it('formats lastN rows with instruction and register details', () => {
    const prog = assemble('MOV AX, 0x55\nADD AX, 0x11\nHLT');
    expect(prog.ok).toBe(true);
    if (!prog.ok) return;

    let state = createCpuState(prog.program);
    let hist = createHistory(state);

    for (let i = 0; i < 3; i++) {
      const res = step(state, prog.program);
      state = res.state;
      hist = pushRecord(hist, res.record);
    }

    const rows = lastN(hist, 2);
    expect(rows.length).toBe(2);
    expect(rows[0]?.stepNumber).toBe(2);
    expect(rows[0]?.instructionText).toContain('ADD');
    expect(rows[0]?.registersChanged).toContain('AX');
    expect(rows[1]?.stepNumber).toBe(3);
    expect(rows[1]?.instructionText).toContain('HLT');
  });

  it('proves state reconstruction equals fresh re-running from start for 100 random (program, step) pairs', () => {
    const sampleSnippets = [
      'MOV AX, 10\nMOV BX, 20\nADD AX, BX\nSUB AX, 5\nHLT',
      'MOV CX, 5\nMOV AX, 0\nloop:\nINC AX\nDEC CX\nJNZ loop\nHLT',
      'MOV AX, 0x1234\nMOV [0x0100], AX\nMOV BX, [0x0100]\nHLT',
      'MOV AX, 1\nPUSH AX\nMOV AX, 2\nPUSH AX\nPOP BX\nPOP CX\nHLT',
      'MOV AX, 0\nCALL myFn\nHLT\nmyFn:\nADD AX, 7\nRET',
    ];

    let seed = 123456789;
    function lcg(): number {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    let checksCount = 0;

    for (let i = 0; i < 100; i++) {
      const snippetIndex = Math.floor(lcg() * sampleSnippets.length);
      const snippet = sampleSnippets[snippetIndex] ?? 'MOV AX, 1\nHLT';
      const prog = assemble(snippet);
      expect(prog.ok).toBe(true);
      if (!prog.ok) continue;

      // Run up to 25 steps collecting records
      const s0 = createCpuState(prog.program);
      let s = s0;
      let hist = createHistory(s0);
      const stepsLimit = 25;

      for (let st = 0; st < stepsLimit && !s.halted && !s.fault; st++) {
        const res = step(s, prog.program);
        s = res.state;
        hist = pushRecord(hist, res.record);
      }

      if (hist.records.length === 0) continue;

      // Pick random step index to test reconstruction
      const targetStep = Math.floor(lcg() * hist.records.length);

      // 1. State reconstructed from history
      const reconstructed: CpuState = reconstructState(hist, targetStep);

      // 2. State obtained by fresh re-run from start
      let fresh = createCpuState(prog.program);
      for (let k = 0; k <= targetStep; k++) {
        fresh = step(fresh, prog.program).state;
      }

      // Assert complete equivalence: registers, flags, halted, memory written
      expect(reconstructed.registers.AX).toBe(fresh.registers.AX);
      expect(reconstructed.registers.BX).toBe(fresh.registers.BX);
      expect(reconstructed.registers.CX).toBe(fresh.registers.CX);
      expect(reconstructed.registers.DX).toBe(fresh.registers.DX);
      expect(reconstructed.registers.SP).toBe(fresh.registers.SP);
      expect(reconstructed.registers.IP).toBe(fresh.registers.IP);
      expect(reconstructed.flags).toEqual(fresh.flags);
      expect(reconstructed.halted).toBe(fresh.halted);

      // Check memory equivalence at key test addresses
      expect(reconstructed.memory.pages[1]?.[0]).toBe(fresh.memory.pages[1]?.[0]);
      checksCount++;
    }

    expect(checksCount).toBe(100);
  });
});
