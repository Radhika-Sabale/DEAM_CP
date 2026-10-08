/**
 * @file sequentialValidatorHints.ts
 * Three-tier pedagogical hint ladder generators for sequential circuit design steps (Stage 10C).
 *
 * Enforces the strict no-leak invariant on hint tiers 1 and 2:
 * - Level 1: Conceptual heuristic or definition (no values leaked)
 * - Level 2: Targeted guiding prompt (no specific expected target values or expressions leaked)
 * - Level 3: Worked solution step (marks step as assisted)
 */

import type { LogicValue } from '../../../types/ast';
import type { HintLevel } from '../../../types/feedback';

export interface SequentialHint {
  readonly level: HintLevel;
  readonly text: string;
}

/**
 * Generates a 3-tier hint ladder for a state table cell step.
 */
export function generateSeqTableCellHints(
  stateCode: number,
  field: 'next' | 'output',
  expectedVal: string | number | LogicValue
): readonly [SequentialHint, SequentialHint, SequentialHint] {
  if (field === 'next') {
    return [
      {
        level: 1,
        text: 'Review the state diagram or counting sequence: determine the subsequent state following the active state under the given input.',
      },
      {
        level: 2,
        text: `From state S${stateCode}, trace the next designated transition in binary or named state ordering.`,
      },
      {
        level: 3,
        text: `The correct next state from S${stateCode} is S${expectedVal}.`,
      },
    ];
  }

  return [
    {
      level: 1,
      text: 'Check the output condition for this machine: Moore outputs depend only on the present state, while Mealy outputs depend on both state and input.',
    },
    {
      level: 2,
      text: `Evaluate the output logic definition for state S${stateCode}.`,
    },
    {
      level: 3,
      text: `The correct output value for this state condition is ${expectedVal}.`,
    },
  ];
}

/**
 * Generates a 3-tier hint ladder for an excitation equation step.
 */
export function generateSeqEquationHints(
  functionName: string,
  variables: readonly string[],
  solverExpression: string
): readonly [SequentialHint, SequentialHint, SequentialHint] {
  return [
    {
      level: 1,
      text: `Construct a Karnaugh map for flip-flop input ${functionName} using the variables [${variables.join(', ')}]. Plot all 1s and don't-care conditions.`,
    },
    {
      level: 2,
      text: `Group adjacent 1s and available 'X' cells into the largest possible power-of-two rectangles to form prime implicants for ${functionName}.`,
    },
    {
      level: 3,
      text: `The minimal sum-of-products equation for ${functionName} is: ${solverExpression}`,
    },
  ];
}

/**
 * Generates a 3-tier hint ladder for a lockout claim step.
 */
export function generateSeqLockoutHints(
  nonRecoveringStates: readonly number[]
): readonly [SequentialHint, SequentialHint, SequentialHint] {
  return [
    {
      level: 1,
      text: 'For all unused state binary encodings, calculate their next-state transitions using your derived flip-flop input equations.',
    },
    {
      level: 2,
      text: 'Follow the transition paths from unused states. Any state that loops among unused states or forms a closed dead-end cycle is a lockout state.',
    },
    {
      level: 3,
      text: `The non-recovering lockout states for this design are: [${nonRecoveringStates.join(', ')}].`,
    },
  ];
}
