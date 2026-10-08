/**
 * @file useUndoRedo.test.ts
 * Unit tests for undo/redo reducer, history cap, transaction coalescing, and hook shortcuts.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { CircuitGraph } from '../../types/circuit';
import { createEmptyCircuit } from '../../engine/circuit';
import {
  initUndoRedoState,
  MAX_HISTORY_CAP,
  undoRedoReducer,
  useUndoRedo,
} from './useUndoRedo';

function makeDummyGraph(label: string): CircuitGraph {
  return {
    nodes: [{ id: `in_${label}`, kind: 'input', label, value: 0, x: 0, y: 0 }],
    wires: [],
  };
}

describe('undoRedoReducer', () => {
  it('handles push, undo, and redo correctly', () => {
    const g0 = makeDummyGraph('0');
    const g1 = makeDummyGraph('1');
    const g2 = makeDummyGraph('2');

    let state = initUndoRedoState(g0);
    expect(state.present).toBe(g0);
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);

    state = undoRedoReducer(state, { type: 'PUSH', graph: g1 });
    expect(state.present).toBe(g1);
    expect(state.past).toEqual([g0]);

    state = undoRedoReducer(state, { type: 'PUSH', graph: g2 });
    expect(state.present).toBe(g2);
    expect(state.past).toEqual([g0, g1]);

    // Undo to g1
    state = undoRedoReducer(state, { type: 'UNDO' });
    expect(state.present).toBe(g1);
    expect(state.past).toEqual([g0]);
    expect(state.future).toEqual([g2]);

    // Undo to g0
    state = undoRedoReducer(state, { type: 'UNDO' });
    expect(state.present).toBe(g0);
    expect(state.past).toHaveLength(0);
    expect(state.future).toEqual([g1, g2]);

    // Undo at boundary is no-op
    state = undoRedoReducer(state, { type: 'UNDO' });
    expect(state.present).toBe(g0);

    // Redo to g1
    state = undoRedoReducer(state, { type: 'REDO' });
    expect(state.present).toBe(g1);
    expect(state.past).toEqual([g0]);
    expect(state.future).toEqual([g2]);

    // Pushing a new graph clears future
    const g3 = makeDummyGraph('3');
    state = undoRedoReducer(state, { type: 'PUSH', graph: g3 });
    expect(state.present).toBe(g3);
    expect(state.past).toEqual([g0, g1]);
    expect(state.future).toHaveLength(0);
  });

  it('caps history at MAX_HISTORY_CAP (100) entries', () => {
    let state = initUndoRedoState(makeDummyGraph('init'));
    for (let i = 1; i <= 150; i++) {
      state = undoRedoReducer(state, { type: 'PUSH', graph: makeDummyGraph(`g_${i}`) });
    }

    expect(state.past.length).toBe(MAX_HISTORY_CAP);
    expect(state.present.nodes[0]?.label).toBe('g_150');
  });

  it('coalesces transactions so entire drag sequence creates exactly 1 undo entry', () => {
    const g0 = makeDummyGraph('start');
    let state = initUndoRedoState(g0);

    state = undoRedoReducer(state, { type: 'BEGIN_TRANSACTION' });
    expect(state.isTransaction).toBe(true);
    expect(state.transactionStart).toBe(g0);

    // Intermediate drag points
    const d1 = makeDummyGraph('drag1');
    const d2 = makeDummyGraph('drag2');
    const d3 = makeDummyGraph('drag3');

    state = undoRedoReducer(state, { type: 'UPDATE_TRANSACTION', graph: d1 });
    state = undoRedoReducer(state, { type: 'UPDATE_TRANSACTION', graph: d2 });
    state = undoRedoReducer(state, { type: 'UPDATE_TRANSACTION', graph: d3 });

    expect(state.present).toBe(d3);
    expect(state.past).toHaveLength(0); // Nothing committed yet

    // Commit transaction on pointer up
    state = undoRedoReducer(state, { type: 'COMMIT_TRANSACTION' });
    expect(state.isTransaction).toBe(false);
    expect(state.present).toBe(d3);
    expect(state.past).toEqual([g0]); // Only the initial g0 is pushed to past!

    // Undo takes us directly back to g0
    state = undoRedoReducer(state, { type: 'UNDO' });
    expect(state.present).toBe(g0);
  });

  it('supports replace action with and without undoable history', () => {
    const g0 = makeDummyGraph('0');
    const g1 = makeDummyGraph('1');
    const g2 = makeDummyGraph('2');

    let state = initUndoRedoState(g0);
    state = undoRedoReducer(state, { type: 'REPLACE', graph: g1, undoable: true });
    expect(state.past).toEqual([g0]);
    expect(state.present).toBe(g1);

    state = undoRedoReducer(state, { type: 'REPLACE', graph: g2, undoable: false });
    expect(state.past).toEqual([g0]);
    expect(state.present).toBe(g2);
  });
});

describe('useUndoRedo hook', () => {
  it('exposes reactive undo/redo status and handlers', () => {
    const initial = createEmptyCircuit();
    const { result } = renderHook(() => useUndoRedo(initial));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    const next1 = makeDummyGraph('1');
    act(() => {
      result.current.commit(next1);
    });

    expect(result.current.graph).toBe(next1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.undo();
    });

    expect(result.current.graph).toBe(initial);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });

    expect(result.current.graph).toBe(next1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });
});
