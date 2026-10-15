/**
 * @file catalogDataCore.ts
 * Core misconception catalog entries for K-Map and Sequential modules.
 */

import type { MisconceptionCatalogEntry } from './types';

export const CORE_MISCONCEPTION_ENTRIES_1: readonly MisconceptionCatalogEntry[] = [
  {
    tag: 'forgot-wraparound-grouping',
    title: 'Forgot Toroidal Wraparound on K-Map',
    description:
      'The student views the Karnaugh map as a flat, disconnected grid rather than a continuous topological torus. They fail to recognize that the leftmost and rightmost columns (and top/bottom rows) differ by exactly one Gray-code bit. Consequently, they miss opportunities to form larger, more optimal prime implicants across boundaries.',
    affectedModules: ['kmap'],
    example: 'Grouping cell 0 and cell 2 as separate isolated singletons instead of wrapping across columns.',
    hints: {
      level1: () => 'Remember that Karnaugh map edges are logically adjacent due to Gray code reflection.',
      level2: () => 'Check whether minterms in outer columns or top/bottom rows can merge across boundary borders.',
      level3: (ctx) => `Merge the cells across opposite boundaries to form the maximal group: ${ctx.expected}.`,
    },
  },
  {
    tag: 'grouped-non-power-of-two',
    title: 'Grouped Non-Power-of-Two Cell Count',
    description:
      'The student misunderstands Boolean simplification geometry, attempting to group arbitrary cluster sizes such as 3, 5, or 6 cells. Each combined variable eliminated requires doubling the cell count (2^k). Non-power-of-two groups cannot algebraically eliminate literals using the consensus theorem.',
    affectedModules: ['kmap'],
    example: 'Attempting to circle 3 adjacent minterm 1s in a row on a 4-variable map.',
    hints: {
      level1: () => 'Valid Karnaugh map groupings must contain an exact power-of-two number of cells.',
      level2: () => 'Count the number of 1s circled in your group; size must be 1, 2, 4, 8, or 16.',
      level3: (ctx) => `Split or expand your group into valid power-of-two rectangular clusters such as ${ctx.expected}.`,
    },
  },
  {
    tag: 'group-not-rectangle',
    title: 'Formed Non-Rectangular Group Shape',
    description:
      'The student groups cells based on visual proximity or diagonal adjacency rather than rectangular hypercube sub-cubes. Boolean algebraic adjacency requires coordinates that differ in exactly one literal per dimension. Irregular shapes like L-shapes, diagonal pairs, or T-clusters are algebraically invalid.',
    affectedModules: ['kmap'],
    example: 'Circling cells 0, 1, and 5 together forming an L-shape.',
    hints: {
      level1: () => 'Every prime implicant on a Karnaugh map must form a solid rectangular or square block.',
      level2: () => 'Check the shape of your circled selection; diagonal and L-shaped clusters are not algebraically valid.',
      level3: (ctx) => `Adjust your selection to form valid solid sub-rectangles: ${ctx.expected}.`,
    },
  },
  {
    tag: 'group-not-maximal',
    title: 'Suboptimal Non-Maximal Prime Implicant',
    description:
      'The student isolates smaller groups (such as pairs) when a larger valid super-group (such as a quad or octet) is available. They treat grouping as merely covering ones rather than minimizing literal count. A non-maximal group leaves unnecessary literals in the resulting Boolean product term.',
    affectedModules: ['kmap'],
    example: 'Circling a 2-cell group when an adjacent pair would allow forming an 8-cell octet.',
    hints: {
      level1: () => 'Always seek the largest possible power-of-two group to minimize literals.',
      level2: () => 'Look around your chosen group to see if it can double in size by merging with adjacent 1s or don\'t-cares.',
      level3: (ctx) => `Expand your current group into the maximal implicant: ${ctx.expected}.`,
    },
  },
  {
    tag: 'redundant-group',
    title: 'Included Redundant Group Already Covered',
    description:
      'The student circles an additional group whose minterms are already completely covered by other essential prime implicants. They treat every valid rectangle as necessary rather than finding the minimal essential cover. This inflates hardware gate count and cost without altering logic correctness.',
    affectedModules: ['kmap'],
    example: 'Adding a middle 4-cell group when its corners are already covered by two outer 4-cell groups.',
    hints: {
      level1: () => 'Only include prime implicants that cover at least one minterm not covered by other groups.',
      level2: () => 'Inspect each minterm in this group; if all of its cells are already included elsewhere, it is redundant.',
      level3: (ctx) => `Eliminate this redundant group to achieve the minimal cover: ${ctx.expected}.`,
    },
  },
  {
    tag: 'missed-minterm',
    title: 'Omitted Required Minterm from Cover',
    description:
      'The student finishes grouping before all minterms (1s) in the truth table are covered. They lose track of uncovered singletons or believe some 1s can remain unaddressed. The resulting Boolean expression fails to compute true for omitted input combinations.',
    affectedModules: ['kmap'],
    example: 'Leaving minterm m15 uncircled on a 4-variable map after forming other groups.',
    hints: {
      level1: () => 'All 1s in the Karnaugh map must be included in at least one prime implicant.',
      level2: () => 'Scan the entire map grid for any remaining uncircled 1s that have not yet been covered.',
      level3: (ctx) => `Include the remaining uncovered minterm into a valid group: ${ctx.expected}.`,
    },
  },
  {
    tag: 'covered-a-zero',
    title: 'Covered a Zero in Sum-of-Products Group',
    description:
      'The student accidentally circles a 0 cell while building a Sum-of-Products (SOP) group. They confuse SOP rules with POS rules or overlook grid cell coordinates. Including a 0 changes the logic function, producing unwanted active-high outputs.',
    affectedModules: ['kmap'],
    example: 'Circling cells 0, 1, 2, 3 when cell 2 contains a 0.',
    hints: {
      level1: () => 'In Sum-of-Products (SOP) grouping, groups may only contain 1s and don\'t-care (X) cells.',
      level2: () => 'Check each cell inside your selection; one or more cells contain a 0.',
      level3: (ctx) => `Exclude all 0 cells from the selection and reform the group as: ${ctx.expected}.`,
    },
  },
  {
    tag: 'missed-dont-cares',
    title: 'Ignored Beneficial Don\'t-Care Conditions',
    description:
      'The student treats don\'t-care (X) states strictly as 0s rather than optional wildcards. They fail to realize that including an X can double a group size and eliminate additional literals. Consequently, they generate unnecessarily complex circuit equations.',
    affectedModules: ['kmap'],
    example: 'Leaving an X uncircled when combining it with a pair of 1s would create an 8-cell octet.',
    hints: {
      level1: () => 'Don\'t-care (X) conditions can be treated as 1s whenever they help enlarge a group.',
      level2: () => 'Look for adjacent don\'t-care cells that allow your group to expand to a larger power of two.',
      level3: (ctx) => `Incorporate the available don't-care cells to yield the simplified term: ${ctx.expected}.`,
    },
  },
  {
    tag: 'wrong-excitation-table',
    title: 'Incorrect Flip-Flop Excitation Input Logic',
    description:
      'The student confuses the flip-flop characteristic table with its inverse excitation table. Instead of asking "what inputs are required to transition from Q to Q_next?", they evaluate "what will Q_next be given inputs?". This leads to incorrect input values for state synthesis.',
    affectedModules: ['sequential'],
    example: 'Writing J=1, K=0 for a 0->0 transition instead of J=0, K=X on a JK flip-flop.',
    hints: {
      level1: () => 'Recall that excitation tables specify the required inputs to cause a desired Q -> Q(next) transition.',
      level2: () => 'Review the specific flip-flop excitation requirements for the current present and next state pair.',
      level3: (ctx) => `For this transition, the correct excitation entry is: ${ctx.expected}.`,
    },
  },
  {
    tag: 'confused-q-and-qnext',
    title: 'Confused Present State Q with Next State Q+',
    description:
      'The student interchanges present state Q(t) and next state Q(t+1) during synchronous state table analysis. They conceptualize the system backwards in time, attempting to derive the prior condition from the future outcome. This corrupts state transition arrows and excitation equations.',
    affectedModules: ['sequential'],
    example: 'Using Q(t+1) as the row index to look up transition behavior for state Q(t).',
    hints: {
      level1: () => 'Ensure present state Q represents the current condition and Q+ represents state after the clock edge.',
      level2: () => 'Verify whether you are indexing by present state or mistakenly reading next state column data.',
      level3: (ctx) => `The transition evaluated from present state should yield: ${ctx.expected}.`,
    },
  },
  {
    tag: 'ignored-lockout-state',
    title: 'Ignored Unused State Lockout / Deadlock',
    description:
      'The student assumes unused states in an incomplete state counter will naturally self-correct without verification. If an unused state transitions into another unused state cycle, the circuit can become permanently locked in an invalid loop upon power-up. Robust design requires explicitly verifying recovery paths to initialized states.',
    affectedModules: ['sequential'],
    example: 'Designing a mod-5 counter (states 0-4) but failing to verify where unused states 5, 6, 7 transition.',
    hints: {
      level1: () => 'Every unused state in a sequential circuit must have a defined path back to a valid operational state.',
      level2: () => 'Trace transitions for all unused binary combinations to verify they recover to valid states.',
      level3: (ctx) => `Direct the unused state transition toward: ${ctx.expected}.`,
    },
  },
];
