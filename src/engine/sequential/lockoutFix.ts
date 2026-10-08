/**
 * @file lockoutFix.ts
 * Automated self-correcting lockout repair proposal synthesizer (Stage 10B).
 * Supports minimal-cost greedy optimization and deterministic all-to-initial redirection strategies.
 */

import type { SequentialSpec } from '../../types/sequential';
import {
  designSequential,
  type SequentialDesign,
} from './counterDesigner';
import {
  analyzeLockout,
  type LockoutReport,
} from './lockout';
import type { EquationCost } from './nextStateEquations';

/** Lockout fix optimization strategy. */
export type LockoutFixStrategy = 'minimal-cost' | 'all-to-initial';

/** Successful result of lockout repair synthesis. */
export interface LockoutFixResult {
  readonly ok: true;
  readonly redirects: Record<number, number>;
  readonly design: SequentialDesign;
  readonly costBefore: EquationCost;
  readonly costAfter: EquationCost;
  readonly resultingLockout: LockoutReport;
  readonly notes: readonly string[];
}

/** Lockout repair synthesis error. */
export interface LockoutFixError {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

/** Discriminated response of proposeLockoutFix. */
export type ProposeLockoutFixResponse = LockoutFixResult | LockoutFixError;

/**
 * Proposes and applies minimal-cost or all-to-initial unused state redirects to ensure
 * the sequential circuit is 100% self-correcting from any power-on state.
 *
 * @param spec High-level sequential machine specification
 * @param strategy Repair strategy: 'minimal-cost' (greedy optimal) or 'all-to-initial' (redirect to S0)
 * @returns Self-correcting design, redirect map, cost comparison, and lockout report
 */
export function proposeLockoutFix(
  spec: SequentialSpec,
  strategy: LockoutFixStrategy = 'minimal-cost'
): ProposeLockoutFixResponse {
  // 1. Synthesize baseline design with unconstrained don't-cares
  const initialRes = designSequential(spec);
  if (!initialRes.ok) {
    const firstErr = initialRes.errors[0];
    return {
      ok: false,
      error: {
        code: firstErr?.code ?? 'design-failed',
        message: firstErr?.message ?? 'Initial design synthesis failed.',
      },
    };
  }

  const initialDesign = initialRes.design;
  const flipFlop = initialDesign.spec.flipFlop;

  // 2. Perform baseline lockout analysis
  const initialLockout = analyzeLockout({
    table: initialDesign.table,
    equations: initialDesign.equations,
    flipFlop,
  });

  // 3. Return immediately if circuit is already self-correcting
  if (initialLockout.isSelfCorrecting) {
    return {
      ok: true,
      redirects: {},
      design: initialDesign,
      costBefore: initialDesign.totalCost,
      costAfter: initialDesign.totalCost,
      resultingLockout: initialLockout,
      notes: [
        'Circuit is already self-correcting under natural don`t-care minimization; no unused state redirects required.',
      ],
    };
  }

  // 4. Strategy: All-to-initial (redirect every unused state to initial state)
  if (strategy === 'all-to-initial') {
    const targetState = initialDesign.table.initialStateCode;
    const redirects: Record<number, number> = {};
    for (const u of initialDesign.table.unusedCodes) {
      redirects[u] = targetState;
    }

    const fixedRes = designSequential(spec, { unusedRedirects: redirects });
    if (!fixedRes.ok) {
      const firstErr = fixedRes.errors[0];
      return {
        ok: false,
        error: {
          code: firstErr?.code ?? 'redesign-failed',
          message: firstErr?.message ?? 'Failed to synthesize redirected design.',
        },
      };
    }

    const fixedDesign = fixedRes.design;
    const resultingLockout = analyzeLockout({
      table: fixedDesign.table,
      equations: fixedDesign.equations,
      flipFlop,
    });

    return {
      ok: true,
      redirects,
      design: fixedDesign,
      costBefore: initialDesign.totalCost,
      costAfter: fixedDesign.totalCost,
      resultingLockout,
      notes: [
        `Redirected all ${initialDesign.table.unusedCodes.length} unused state(s) to initial state S${targetState}.`,
      ],
    };
  }

  // 5. Strategy: Minimal-cost (greedy search over valid target states for lockout-prone states)
  const currentRedirects: Record<number, number> = {};
  let currentDesign = initialDesign;
  let currentLockout = initialLockout;

  const maxIterations = 1 << initialDesign.table.stateBits;
  let iteration = 0;

  while (!currentLockout.isSelfCorrecting && iteration < maxIterations) {
    iteration++;

    // Find problematic unused states in ascending code order
    const problemCodes = Array.from(
      new Set([...currentLockout.lockedStates, ...currentLockout.indeterminateStates])
    ).sort((a, b) => a - b);

    if (problemCodes.length === 0) break;
    const codeToFix = problemCodes[0];
    if (codeToFix === undefined) break;

    let bestTarget: number | null = null;
    let bestDesign: SequentialDesign | null = null;
    let bestCost: EquationCost | null = null;
    let bestLockout: LockoutReport | null = null;

    // Test each valid state as redirect target
    for (const validTarget of initialDesign.table.validCodes) {
      const candidateRedirects = {
        ...currentRedirects,
        [codeToFix]: validTarget,
      };

      const candRes = designSequential(spec, {
        unusedRedirects: candidateRedirects,
      });
      if (!candRes.ok) continue;

      const candDesign = candRes.design;
      const candCost = candDesign.totalCost;
      const candLockout = analyzeLockout({
        table: candDesign.table,
        equations: candDesign.equations,
        flipFlop,
      });

      // Comparison: terms, then literals, ties by lowest target code
      let isBetter = false;
      if (bestCost === null) {
        isBetter = true;
      } else if (candCost.terms < bestCost.terms) {
        isBetter = true;
      } else if (candCost.terms === bestCost.terms) {
        if (candCost.literals < bestCost.literals) {
          isBetter = true;
        } else if (candCost.literals === bestCost.literals) {
          if (bestTarget !== null && validTarget < bestTarget) {
            isBetter = true;
          }
        }
      }

      if (isBetter) {
        bestTarget = validTarget;
        bestDesign = candDesign;
        bestCost = candCost;
        bestLockout = candLockout;
      }
    }

    if (bestTarget !== null && bestDesign !== null && bestLockout !== null) {
      currentRedirects[codeToFix] = bestTarget;
      currentDesign = bestDesign;
      currentLockout = bestLockout;
    } else {
      // Fallback: redirect to initial state if no valid candidate improved
      currentRedirects[codeToFix] = initialDesign.table.initialStateCode;
      const fallbackRes = designSequential(spec, {
        unusedRedirects: currentRedirects,
      });
      if (fallbackRes.ok) {
        currentDesign = fallbackRes.design;
        currentLockout = analyzeLockout({
          table: currentDesign.table,
          equations: currentDesign.equations,
          flipFlop,
        });
      } else {
        break;
      }
    }
  }

  const redirectedCount = Object.keys(currentRedirects).length;
  const notes = [
    `Applied minimal-cost redirects for ${redirectedCount} unused state(s): ${Object.entries(
      currentRedirects
    )
      .map(([u, tgt]) => `${u}->S${tgt}`)
      .join(', ')}.`,
  ];

  return {
    ok: true,
    redirects: currentRedirects,
    design: currentDesign,
    costBefore: initialDesign.totalCost,
    costAfter: currentDesign.totalCost,
    resultingLockout: currentLockout,
    notes,
  };
}
