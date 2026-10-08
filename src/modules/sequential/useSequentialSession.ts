/**
 * @file useSequentialSession.ts
 * React hook orchestrating the Sequential Designer wizard session (Stage 10D).
 *
 * Implements reference design derivation (via designSequential / designAsyncRipple),
 * spec change draft-invalidation confirmation dialog state, and selective persistence
 * of verified/assisted artifacts through 10C patch builders.
 */

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import {
  designAsyncRipple,
  type AsyncRippleDesign,
} from '../../engine/sequential/asyncRipple';
import {
  designSequential,
  type SequentialDesign,
} from '../../engine/sequential/counterDesigner';
import { validateSpec } from '../../engine/sequential/specs';
import { useProjectStore } from '../../store/projectStore';
import type {
  FlipFlopType,
  SequentialSpec,
} from '../../types/sequential';
import {
  createSequentialPatch,
  type SequentialModuleOutputs,
} from './sequentialModuleLogic';
import {
  deriveSessionFromProject,
  hasLaterDrafts,
  isStepUnlocked,
  sequentialSessionReducer,
  type SequentialSessionState,
  type SequentialStepId,
} from './sequentialSession';

/** Discriminated reference design product. */
export type ActiveReferenceDesign =
  | { readonly kind: 'sync'; readonly design: SequentialDesign }
  | { readonly kind: 'async'; readonly design: AsyncRippleDesign }
  | null;

/** Hook return interface for the sequential session controller. */
export interface UseSequentialSessionResult {
  readonly state: SequentialSessionState;
  readonly referenceDesign: SequentialDesign | null;
  readonly asyncDesign: AsyncRippleDesign | null;
  readonly activeDesign: ActiveReferenceDesign;
  readonly errors: readonly string[];
  readonly isUnlocked: (stepId: SequentialStepId) => boolean;
  readonly setSpec: (spec: SequentialSpec | null) => void;
  readonly selectStep: (stepId: SequentialStepId) => void;
  readonly updateDraft: (stepId: SequentialStepId, draft: unknown) => void;
  readonly markVerified: (
    stepId: SequentialStepId,
    draft?: unknown,
    artifact?: SequentialModuleOutputs
  ) => void;
  readonly markAssisted: (
    stepId: SequentialStepId,
    draft?: unknown,
    artifact?: SequentialModuleOutputs
  ) => void;
  readonly resetStep: (stepId: SequentialStepId) => void;
  readonly resetAll: () => void;
  readonly specChangeConfirm: {
    readonly isOpen: boolean;
    readonly pendingSpec: SequentialSpec | null;
    readonly confirm: () => void;
    readonly cancel: () => void;
  };
}

/**
 * Custom React hook managing the sequential wizard session, reactive reference derivation,
 * and selective artifact persistence.
 */
export function useSequentialSession(): UseSequentialSessionResult {
  const project = useProjectStore((s) => s.project);
  const applyPatch = useProjectStore((s) => s.applyPatch);

  const [state, dispatch] = useReducer(
    sequentialSessionReducer,
    undefined,
    () => deriveSessionFromProject(project)
  );

  // Sync session on project switch
  useEffect(() => {
    dispatch({ type: 'loadFromProject', project });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Derived reference design from current specification
  const { referenceDesign, asyncDesign, activeDesign, errors } = useMemo(() => {
    const spec = state.spec;
    if (!spec) {
      return {
        referenceDesign: null,
        asyncDesign: null,
        activeDesign: null,
        errors: [],
      };
    }

    const valRes = validateSpec(spec);
    if (!valRes.ok) {
      return {
        referenceDesign: null,
        asyncDesign: null,
        activeDesign: null,
        errors: valRes.errors.map((e) => e.message),
      };
    }

    if (valRes.spec.kind === 'counter' && valRes.spec.style === 'async') {
      const asyncRes = designAsyncRipple(valRes.spec);
      if (asyncRes.ok) {
        return {
          referenceDesign: null,
          asyncDesign: asyncRes.design,
          activeDesign: { kind: 'async', design: asyncRes.design } as const,
          errors: [],
        };
      }
      return {
        referenceDesign: null,
        asyncDesign: null,
        activeDesign: null,
        errors: asyncRes.errors.map((e) => e.message),
      };
    }

    const syncRes = designSequential(valRes.spec);
    if (syncRes.ok) {
      return {
        referenceDesign: syncRes.design,
        asyncDesign: null,
        activeDesign: { kind: 'sync', design: syncRes.design } as const,
        errors: [],
      };
    }
    return {
      referenceDesign: null,
      asyncDesign: null,
      activeDesign: null,
      errors: syncRes.errors.map((e) => e.message),
    };
  }, [state.spec]);

  // Confirmation state for specification changes when later drafts exist
  const [pendingSpec, setPendingSpec] = useState<SequentialSpec | null>(null);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);

  const setSpec = useCallback(
    (newSpec: SequentialSpec | null) => {
      if (hasLaterDrafts(state, 'define') && newSpec !== null) {
        setPendingSpec(newSpec);
        setConfirmOpen(true);
      } else {
        dispatch({ type: 'setSpec', spec: newSpec });
        if (newSpec) {
          applyPatch(createSequentialPatch({ sequentialSpec: newSpec }));
        }
      }
    },
    [state, applyPatch]
  );

  const confirmSpecChange = useCallback(() => {
    if (pendingSpec) {
      dispatch({ type: 'setSpec', spec: pendingSpec });
      applyPatch(createSequentialPatch({ sequentialSpec: pendingSpec }));
    }
    setPendingSpec(null);
    setConfirmOpen(false);
  }, [pendingSpec, applyPatch]);

  const cancelSpecChange = useCallback(() => {
    setPendingSpec(null);
    setConfirmOpen(false);
  }, []);

  const selectStep = useCallback((stepId: SequentialStepId) => {
    dispatch({ type: 'selectStep', stepId });
  }, []);

  const updateDraft = useCallback(
    (stepId: SequentialStepId, draft: unknown) => {
      dispatch({ type: 'updateDraft', stepId, draft });
    },
    []
  );

  const markVerified = useCallback(
    (
      stepId: SequentialStepId,
      draft?: unknown,
      artifact?: SequentialModuleOutputs
    ) => {
      dispatch({ type: 'markVerified', stepId, draft });
      // Persist ONLY verified artifacts to the project store
      if (artifact) {
        applyPatch(createSequentialPatch(artifact, stepId));
      } else if (stepId === 'flipflop' && typeof draft === 'string') {
        applyPatch({ flipFlopType: draft as FlipFlopType });
      }
    },
    [applyPatch]
  );

  const markAssisted = useCallback(
    (
      stepId: SequentialStepId,
      draft?: unknown,
      artifact?: SequentialModuleOutputs
    ) => {
      dispatch({ type: 'markAssisted', stepId, draft });
      // Persist assisted artifacts to the project store
      if (artifact) {
        applyPatch(createSequentialPatch(artifact, stepId));
      }
    },
    [applyPatch]
  );

  const resetStep = useCallback((stepId: SequentialStepId) => {
    dispatch({ type: 'resetStep', stepId });
  }, []);

  const resetAll = useCallback(() => {
    dispatch({ type: 'resetAll' });
  }, []);

  const isUnlocked = useCallback(
    (stepId: SequentialStepId) => isStepUnlocked(state, stepId),
    [state]
  );

  return {
    state,
    referenceDesign,
    asyncDesign,
    activeDesign,
    errors,
    isUnlocked,
    setSpec,
    selectStep,
    updateDraft,
    markVerified,
    markAssisted,
    resetStep,
    resetAll,
    specChangeConfirm: {
      isOpen: confirmOpen,
      pendingSpec,
      confirm: confirmSpecChange,
      cancel: cancelSpecChange,
    },
  };
}
