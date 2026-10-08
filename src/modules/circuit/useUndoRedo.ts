/**
 * @file useUndoRedo.ts
 * Pure undo/redo history reducer and React hook supporting transaction coalescing,
 * bounded history cap (100 entries), and global keyboard shortcuts.
 */

import { useCallback, useEffect, useReducer } from 'react';
import type { CircuitGraph } from '../../types/circuit';

export const MAX_HISTORY_CAP = 100;

/**
 * State container for undo/redo history.
 */
export interface UndoRedoState {
  readonly past: readonly CircuitGraph[];
  readonly present: CircuitGraph;
  readonly future: readonly CircuitGraph[];
  readonly isTransaction: boolean;
  readonly transactionStart: CircuitGraph | null;
}

/**
 * Discriminated union of undo/redo reducer actions.
 */
export type UndoRedoAction =
  | { readonly type: 'PUSH'; readonly graph: CircuitGraph }
  | { readonly type: 'UNDO' }
  | { readonly type: 'REDO' }
  | { readonly type: 'REPLACE'; readonly graph: CircuitGraph; readonly undoable?: boolean }
  | { readonly type: 'BEGIN_TRANSACTION' }
  | { readonly type: 'UPDATE_TRANSACTION'; readonly graph: CircuitGraph }
  | { readonly type: 'COMMIT_TRANSACTION' }
  | { readonly type: 'CANCEL_TRANSACTION' };

/**
 * Initializes the undo/redo history state with an initial circuit graph.
 *
 * @param initialGraph Starting circuit graph
 * @returns Fresh UndoRedoState
 */
export function initUndoRedoState(initialGraph: CircuitGraph): UndoRedoState {
  return {
    past: [],
    present: initialGraph,
    future: [],
    isTransaction: false,
    transactionStart: null,
  };
}

/**
 * Pure reducer handling immutable history transformations and transaction coalescing.
 *
 * @param state Current UndoRedoState
 * @param action Reducer action
 * @returns Next UndoRedoState
 */
export function undoRedoReducer(state: UndoRedoState, action: UndoRedoAction): UndoRedoState {
  switch (action.type) {
    case 'PUSH': {
      if (state.present === action.graph) {
        return state;
      }
      if (state.isTransaction) {
        return {
          ...state,
          present: action.graph,
        };
      }
      const newPast = [...state.past, state.present];
      if (newPast.length > MAX_HISTORY_CAP) {
        newPast.shift();
      }
      return {
        ...state,
        past: newPast,
        present: action.graph,
        future: [],
      };
    }

    case 'UNDO': {
      if (state.past.length === 0 || state.isTransaction) {
        return state;
      }
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      const nextPast = state.past.slice(0, state.past.length - 1);
      return {
        ...state,
        past: nextPast,
        present: previous,
        future: [state.present, ...state.future],
      };
    }

    case 'REDO': {
      if (state.future.length === 0 || state.isTransaction) {
        return state;
      }
      const next = state.future[0];
      if (!next) return state;
      const nextFuture = state.future.slice(1);
      const nextPast = [...state.past, state.present];
      if (nextPast.length > MAX_HISTORY_CAP) {
        nextPast.shift();
      }
      return {
        ...state,
        past: nextPast,
        present: next,
        future: nextFuture,
      };
    }

    case 'REPLACE': {
      if (action.undoable) {
        const nextPast = [...state.past, state.present];
        if (nextPast.length > MAX_HISTORY_CAP) {
          nextPast.shift();
        }
        return {
          past: nextPast,
          present: action.graph,
          future: [],
          isTransaction: false,
          transactionStart: null,
        };
      }
      return {
        past: state.past,
        present: action.graph,
        future: state.future,
        isTransaction: false,
        transactionStart: null,
      };
    }

    case 'BEGIN_TRANSACTION': {
      if (state.isTransaction) {
        return state;
      }
      return {
        ...state,
        isTransaction: true,
        transactionStart: state.present,
      };
    }

    case 'UPDATE_TRANSACTION': {
      if (!state.isTransaction) {
        return undoRedoReducer(state, { type: 'PUSH', graph: action.graph });
      }
      return {
        ...state,
        present: action.graph,
      };
    }

    case 'COMMIT_TRANSACTION': {
      if (!state.isTransaction) {
        return state;
      }
      const start = state.transactionStart;
      if (start && start !== state.present) {
        const nextPast = [...state.past, start];
        if (nextPast.length > MAX_HISTORY_CAP) {
          nextPast.shift();
        }
        return {
          ...state,
          past: nextPast,
          future: [],
          isTransaction: false,
          transactionStart: null,
        };
      }
      return {
        ...state,
        isTransaction: false,
        transactionStart: null,
      };
    }

    case 'CANCEL_TRANSACTION': {
      if (!state.isTransaction || !state.transactionStart) {
        return {
          ...state,
          isTransaction: false,
          transactionStart: null,
        };
      }
      return {
        ...state,
        present: state.transactionStart,
        isTransaction: false,
        transactionStart: null,
      };
    }
  }
}

/**
 * Return type of the useUndoRedo hook.
 */
export interface UseUndoRedoResult {
  readonly graph: CircuitGraph;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly commit: (nextGraph: CircuitGraph) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly replace: (graph: CircuitGraph, options?: { readonly undoable?: boolean }) => void;
  readonly beginTransaction: () => void;
  readonly updateTransaction: (graph: CircuitGraph) => void;
  readonly commitTransaction: () => void;
  readonly cancelTransaction: () => void;
}

/**
 * Hook providing undo/redo state management and hotkey bindings for circuit editing.
 *
 * @param initialGraph Initial circuit graph
 * @returns History state and mutation handlers
 */
export function useUndoRedo(initialGraph: CircuitGraph): UseUndoRedoResult {
  const [state, dispatch] = useReducer(undoRedoReducer, initialGraph, initUndoRedoState);

  const commit = useCallback((graph: CircuitGraph) => {
    dispatch({ type: 'PUSH', graph });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const replace = useCallback((graph: CircuitGraph, options?: { readonly undoable?: boolean }) => {
    dispatch({ type: 'REPLACE', graph, undoable: options?.undoable });
  }, []);

  const beginTransaction = useCallback(() => {
    dispatch({ type: 'BEGIN_TRANSACTION' });
  }, []);

  const updateTransaction = useCallback((graph: CircuitGraph) => {
    dispatch({ type: 'UPDATE_TRANSACTION', graph });
  }, []);

  const commitTransaction = useCallback(() => {
    dispatch({ type: 'COMMIT_TRANSACTION' });
  }, []);

  const cancelTransaction = useCallback(() => {
    dispatch({ type: 'CANCEL_TRANSACTION' });
  }, []);

  // Wire global keyboard shortcuts (Ctrl/Cmd+Z, Ctrl+Y, Ctrl/Cmd+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier) return;

      // Ignore if user is actively typing in an input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo]);

  return {
    graph: state.present,
    canUndo: state.past.length > 0 && !state.isTransaction,
    canRedo: state.future.length > 0 && !state.isTransaction,
    commit,
    undo,
    redo,
    replace,
    beginTransaction,
    updateTransaction,
    commitTransaction,
    cancelTransaction,
  };
}
