# Digital Electronics Virtual Lab: Misconception Catalog

This catalog details the student cognitive misconceptions diagnosed by the deterministic feedback engine across all laboratory modules. Each entry defines the underlying flawed mental model, the affected modules, an illustrative concrete example, and three progressive hint levels (Nudge, Pointed, and Worked Step).

## Table of Contents

- [Forgot Toroidal Wraparound on K-Map (`forgot-wraparound-grouping`)](#forgot-toroidal-wraparound-on-k-map)
- [Grouped Non-Power-of-Two Cell Count (`grouped-non-power-of-two`)](#grouped-non-power-of-two-cell-count)
- [Formed Non-Rectangular Group Shape (`group-not-rectangle`)](#formed-non-rectangular-group-shape)
- [Suboptimal Non-Maximal Prime Implicant (`group-not-maximal`)](#suboptimal-non-maximal-prime-implicant)
- [Included Redundant Group Already Covered (`redundant-group`)](#included-redundant-group-already-covered)
- [Omitted Required Minterm from Cover (`missed-minterm`)](#omitted-required-minterm-from-cover)
- [Covered a Zero in Sum-of-Products Group (`covered-a-zero`)](#covered-a-zero-in-sum-of-products-group)
- [Ignored Beneficial Don't-Care Conditions (`missed-dont-cares`)](#ignored-beneficial-don-t-care-conditions)
- [Incorrect Flip-Flop Excitation Input Logic (`wrong-excitation-table`)](#incorrect-flip-flop-excitation-input-logic)
- [Confused Present State Q with Next State Q+ (`confused-q-and-qnext`)](#confused-present-state-q-with-next-state-q)
- [Ignored Unused State Lockout / Deadlock (`ignored-lockout-state`)](#ignored-unused-state-lockout-deadlock)
- [Flawed Two's or Radix Complement Calculation (`wrong-complement`)](#flawed-two-s-or-radix-complement-calculation)
- [Incorrect Positional Radix Weight or Exponent (`wrong-radix-weight`)](#incorrect-positional-radix-weight-or-exponent)
- [De Morgan's Law Misapplied (Operator or Bar) (`demorgan-misapplied`)](#de-morgan-s-law-misapplied-operator-or-bar)
- [Dropped or Erroneous Addition Carry Bit (`wrong-carry-propagation`)](#dropped-or-erroneous-addition-carry-bit)
- [Reversed Bit Order (MSB vs LSB) (`wrong-bit-order`)](#reversed-bit-order-msb-vs-lsb)
- [Reversed Division Remainder Order (`wrong-remainder-order`)](#reversed-division-remainder-order)
- [Confused Signed Overflow with Unsigned Carry (`wrong-overflow-rule`)](#confused-signed-overflow-with-unsigned-carry)
- [Mislabeled or Incorrect Boolean Law Justification (`wrong-law-applied`)](#mislabeled-or-incorrect-boolean-law-justification)
- [Algebraic Dual or Sign Error in Boolean Manipulation (`algebra-sign-error`)](#algebraic-dual-or-sign-error-in-boolean-manipulation)
- [General or Unclassified Step Discrepancy (`other`)](#general-or-unclassified-step-discrepancy)

## Summary Table

| Tag | Affected Modules | Emitting Validators | Emitting Distractors | Total Sources |
| :--- | :--- | :---: | :---: | :---: |
| `forgot-wraparound-grouping` | `kmap` | 1 | 10 | 11 |
| `grouped-non-power-of-two` | `kmap` | 3 | 22 | 25 |
| `group-not-rectangle` | `kmap` | 3 | 1 | 4 |
| `group-not-maximal` | `kmap` | 5 | 3 | 8 |
| `redundant-group` | `kmap` | 7 | 1 | 8 |
| `missed-minterm` | `kmap` | 2 | 0 | 2 |
| `covered-a-zero` | `kmap` | 3 | 2 | 5 |
| `missed-dont-cares` | `kmap` | 2 | 10 | 12 |
| `wrong-excitation-table` | `sequential` | 1 | 14 | 15 |
| `confused-q-and-qnext` | `sequential` | 4 | 23 | 27 |
| `ignored-lockout-state` | `sequential` | 1 | 8 | 9 |
| `wrong-complement` | `numberSystems` | 3 | 14 | 17 |
| `wrong-radix-weight` | `numberSystems` | 2 | 12 | 14 |
| `demorgan-misapplied` | `boolean` | 1 | 11 | 12 |
| `wrong-carry-propagation` | `numberSystems` | 1 | 3 | 4 |
| `wrong-bit-order` | `numberSystems` | 2 | 1 | 3 |
| `wrong-remainder-order` | `numberSystems` | 1 | 1 | 2 |
| `wrong-overflow-rule` | `numberSystems` | 1 | 8 | 9 |
| `wrong-law-applied` | `boolean` | 1 | 27 | 28 |
| `algebra-sign-error` | `boolean` | 2 | 0 | 2 |
| `other` | `kmap`, `sequential`, `numberSystems`, `boolean` | 15 | 130 | 145 |

---

## Cognitive Misconception Details

### Forgot Toroidal Wraparound on K-Map

- **Tag**: `forgot-wraparound-grouping`
- **Affected Modules**: `kmap`
- **Concrete Example**: Grouping cell 0 and cell 2 as separate isolated singletons instead of wrapping across columns.

#### Cognitive Description (Underlying Mental Model)
The student views the Karnaugh map as a flat, disconnected grid rather than a continuous topological torus. They fail to recognize that the leftmost and rightmost columns (and top/bottom rows) differ by exactly one Gray-code bit. Consequently, they miss opportunities to form larger, more optimal prime implicants across boundaries.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Remember that Karnaugh map edges are logically adjacent due to Gray code reflection.
2. **Level 2 (Pointed)**: Check whether minterms in outer columns or top/bottom rows can merge across boundary borders.
3. **Level 3 (Worked Step)**: Merge the cells across opposite boundaries to form the maximal group: <EXPECTED_VALUE>.

---

### Grouped Non-Power-of-Two Cell Count

- **Tag**: `grouped-non-power-of-two`
- **Affected Modules**: `kmap`
- **Concrete Example**: Attempting to circle 3 adjacent minterm 1s in a row on a 4-variable map.

#### Cognitive Description (Underlying Mental Model)
The student misunderstands Boolean simplification geometry, attempting to group arbitrary cluster sizes such as 3, 5, or 6 cells. Each combined variable eliminated requires doubling the cell count (2^k). Non-power-of-two groups cannot algebraically eliminate literals using the consensus theorem.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Valid Karnaugh map groupings must contain an exact power-of-two number of cells.
2. **Level 2 (Pointed)**: Count the number of 1s circled in your group; size must be 1, 2, 4, 8, or 16.
3. **Level 3 (Worked Step)**: Split or expand your group into valid power-of-two rectangular clusters such as <EXPECTED_VALUE>.

---

### Formed Non-Rectangular Group Shape

- **Tag**: `group-not-rectangle`
- **Affected Modules**: `kmap`
- **Concrete Example**: Circling cells 0, 1, and 5 together forming an L-shape.

#### Cognitive Description (Underlying Mental Model)
The student groups cells based on visual proximity or diagonal adjacency rather than rectangular hypercube sub-cubes. Boolean algebraic adjacency requires coordinates that differ in exactly one literal per dimension. Irregular shapes like L-shapes, diagonal pairs, or T-clusters are algebraically invalid.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Every prime implicant on a Karnaugh map must form a solid rectangular or square block.
2. **Level 2 (Pointed)**: Check the shape of your circled selection; diagonal and L-shaped clusters are not algebraically valid.
3. **Level 3 (Worked Step)**: Adjust your selection to form valid solid sub-rectangles: <EXPECTED_VALUE>.

---

### Suboptimal Non-Maximal Prime Implicant

- **Tag**: `group-not-maximal`
- **Affected Modules**: `kmap`
- **Concrete Example**: Circling a 2-cell group when an adjacent pair would allow forming an 8-cell octet.

#### Cognitive Description (Underlying Mental Model)
The student isolates smaller groups (such as pairs) when a larger valid super-group (such as a quad or octet) is available. They treat grouping as merely covering ones rather than minimizing literal count. A non-maximal group leaves unnecessary literals in the resulting Boolean product term.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Always seek the largest possible power-of-two group to minimize literals.
2. **Level 2 (Pointed)**: Look around your chosen group to see if it can double in size by merging with adjacent 1s or don't-cares.
3. **Level 3 (Worked Step)**: Expand your current group into the maximal implicant: <EXPECTED_VALUE>.

---

### Included Redundant Group Already Covered

- **Tag**: `redundant-group`
- **Affected Modules**: `kmap`
- **Concrete Example**: Adding a middle 4-cell group when its corners are already covered by two outer 4-cell groups.

#### Cognitive Description (Underlying Mental Model)
The student circles an additional group whose minterms are already completely covered by other essential prime implicants. They treat every valid rectangle as necessary rather than finding the minimal essential cover. This inflates hardware gate count and cost without altering logic correctness.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Only include prime implicants that cover at least one minterm not covered by other groups.
2. **Level 2 (Pointed)**: Inspect each minterm in this group; if all of its cells are already included elsewhere, it is redundant.
3. **Level 3 (Worked Step)**: Eliminate this redundant group to achieve the minimal cover: <EXPECTED_VALUE>.

---

### Omitted Required Minterm from Cover

- **Tag**: `missed-minterm`
- **Affected Modules**: `kmap`
- **Concrete Example**: Leaving minterm m15 uncircled on a 4-variable map after forming other groups.

#### Cognitive Description (Underlying Mental Model)
The student finishes grouping before all minterms (1s) in the truth table are covered. They lose track of uncovered singletons or believe some 1s can remain unaddressed. The resulting Boolean expression fails to compute true for omitted input combinations.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: All 1s in the Karnaugh map must be included in at least one prime implicant.
2. **Level 2 (Pointed)**: Scan the entire map grid for any remaining uncircled 1s that have not yet been covered.
3. **Level 3 (Worked Step)**: Include the remaining uncovered minterm into a valid group: <EXPECTED_VALUE>.

---

### Covered a Zero in Sum-of-Products Group

- **Tag**: `covered-a-zero`
- **Affected Modules**: `kmap`
- **Concrete Example**: Circling cells 0, 1, 2, 3 when cell 2 contains a 0.

#### Cognitive Description (Underlying Mental Model)
The student accidentally circles a 0 cell while building a Sum-of-Products (SOP) group. They confuse SOP rules with POS rules or overlook grid cell coordinates. Including a 0 changes the logic function, producing unwanted active-high outputs.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: In Sum-of-Products (SOP) grouping, groups may only contain 1s and don't-care (X) cells.
2. **Level 2 (Pointed)**: Check each cell inside your selection; one or more cells contain a 0.
3. **Level 3 (Worked Step)**: Exclude all 0 cells from the selection and reform the group as: <EXPECTED_VALUE>.

---

### Ignored Beneficial Don't-Care Conditions

- **Tag**: `missed-dont-cares`
- **Affected Modules**: `kmap`
- **Concrete Example**: Leaving an X uncircled when combining it with a pair of 1s would create an 8-cell octet.

#### Cognitive Description (Underlying Mental Model)
The student treats don't-care (X) states strictly as 0s rather than optional wildcards. They fail to realize that including an X can double a group size and eliminate additional literals. Consequently, they generate unnecessarily complex circuit equations.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Don't-care (X) conditions can be treated as 1s whenever they help enlarge a group.
2. **Level 2 (Pointed)**: Look for adjacent don't-care cells that allow your group to expand to a larger power of two.
3. **Level 3 (Worked Step)**: Incorporate the available don't-care cells to yield the simplified term: <EXPECTED_VALUE>.

---

### Incorrect Flip-Flop Excitation Input Logic

- **Tag**: `wrong-excitation-table`
- **Affected Modules**: `sequential`
- **Concrete Example**: Writing J=1, K=0 for a 0->0 transition instead of J=0, K=X on a JK flip-flop.

#### Cognitive Description (Underlying Mental Model)
The student confuses the flip-flop characteristic table with its inverse excitation table. Instead of asking "what inputs are required to transition from Q to Q_next?", they evaluate "what will Q_next be given inputs?". This leads to incorrect input values for state synthesis.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Recall that excitation tables specify the required inputs to cause a desired Q -> Q(next) transition.
2. **Level 2 (Pointed)**: Review the specific flip-flop excitation requirements for the current present and next state pair.
3. **Level 3 (Worked Step)**: For this transition, the correct excitation entry is: <EXPECTED_VALUE>.

---

### Confused Present State Q with Next State Q+

- **Tag**: `confused-q-and-qnext`
- **Affected Modules**: `sequential`
- **Concrete Example**: Using Q(t+1) as the row index to look up transition behavior for state Q(t).

#### Cognitive Description (Underlying Mental Model)
The student interchanges present state Q(t) and next state Q(t+1) during synchronous state table analysis. They conceptualize the system backwards in time, attempting to derive the prior condition from the future outcome. This corrupts state transition arrows and excitation equations.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Ensure present state Q represents the current condition and Q+ represents state after the clock edge.
2. **Level 2 (Pointed)**: Verify whether you are indexing by present state or mistakenly reading next state column data.
3. **Level 3 (Worked Step)**: The transition evaluated from present state should yield: <EXPECTED_VALUE>.

---

### Ignored Unused State Lockout / Deadlock

- **Tag**: `ignored-lockout-state`
- **Affected Modules**: `sequential`
- **Concrete Example**: Designing a mod-5 counter (states 0-4) but failing to verify where unused states 5, 6, 7 transition.

#### Cognitive Description (Underlying Mental Model)
The student assumes unused states in an incomplete state counter will naturally self-correct without verification. If an unused state transitions into another unused state cycle, the circuit can become permanently locked in an invalid loop upon power-up. Robust design requires explicitly verifying recovery paths to initialized states.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Every unused state in a sequential circuit must have a defined path back to a valid operational state.
2. **Level 2 (Pointed)**: Trace transitions for all unused binary combinations to verify they recover to valid states.
3. **Level 3 (Worked Step)**: Direct the unused state transition toward: <EXPECTED_VALUE>.

---

### Flawed Two's or Radix Complement Calculation

- **Tag**: `wrong-complement`
- **Affected Modules**: `numberSystems`
- **Concrete Example**: Computing 2's complement of 0101 as 1010 instead of 1011 (forgot to add 1).

#### Cognitive Description (Underlying Mental Model)
The student inverts the bits for two's complement but forgets to add 1 to the least significant bit. Alternatively, they confuse 1's complement with 2's complement or apply diminishing radix complement rules incorrectly. This causes an off-by-one error in signed arithmetic representations.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Remember the definition of two's complement: invert all bits, then add 1 to the LSB.
2. **Level 2 (Pointed)**: Check whether you completed the addition of 1 after performing bitwise inversion.
3. **Level 3 (Worked Step)**: Inverting the bits and adding 1 produces the correct complement: <EXPECTED_VALUE>.

---

### Incorrect Positional Radix Weight or Exponent

- **Tag**: `wrong-radix-weight`
- **Affected Modules**: `numberSystems`
- **Concrete Example**: Computing 101_2 as 1*2^3 + 0*2^2 + 1*2^1 = 10 instead of 1*2^2 + 0*2^1 + 1*2^0 = 5.

#### Cognitive Description (Underlying Mental Model)
The student misassigns positional weights, such as numbering integer bit positions from 1 instead of 0 or indexing fractional bits with positive powers. They fail to understand that position i has weight r^i where i = 0 at the radix point. This scales numbers by powers of the radix.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Positional weights start at radix^0 immediately to the left of the radix point.
2. **Level 2 (Pointed)**: Verify the exponent indices assigned to each column, starting at 0 for the least significant integer digit.
3. **Level 3 (Worked Step)**: Evaluating each digit with proper radix weights yields: <EXPECTED_VALUE>.

---

### De Morgan's Law Misapplied (Operator or Bar)

- **Tag**: `demorgan-misapplied`
- **Affected Modules**: `boolean`
- **Concrete Example**: Rewriting (A + B)' as A' + B' instead of A' * B'.

#### Cognitive Description (Underlying Mental Model)
The student splits a complement bar across terms but forgets to interchange AND with OR (or vice versa). Alternatively, they partially complement terms while leaving the operator unchanged, breaking algebraic equivalence. De Morgan's theorem requires both complementing individual terms and dualizing the binary operator.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: De Morgan's law requires two simultaneous changes: break the complement bar AND flip the operator.
2. **Level 2 (Pointed)**: Check your operator; an OR (+) under a negation must become an AND (*), and vice versa.
3. **Level 3 (Worked Step)**: Applying De Morgan's theorem correctly transforms the expression to: <EXPECTED_VALUE>.

---

### Dropped or Erroneous Addition Carry Bit

- **Tag**: `wrong-carry-propagation`
- **Affected Modules**: `numberSystems`
- **Concrete Example**: Computing 1 + 1 = 0 but failing to carry 1 to the next column, leaving sum 0 instead of 10.

#### Cognitive Description (Underlying Mental Model)
The student forgets to propagate carry-out bits to the next higher significance column during binary addition. They treat each bit position as an isolated half-adder or misplace the carry in subsequent operations. This corrupts all higher-order bits of the sum.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: When the sum in a binary bit column equals 2 or 3, a carry bit must propagate to the next column.
2. **Level 2 (Pointed)**: Examine the carry generated from the previous column and ensure it is included in this bit's sum.
3. **Level 3 (Worked Step)**: Including the carry bit produces the correct column sum and carry: <EXPECTED_VALUE>.

---

### Reversed Bit Order (MSB vs LSB)

- **Tag**: `wrong-bit-order`
- **Affected Modules**: `numberSystems`
- **Concrete Example**: Writing binary 1100 as 0011, confusing MSB and LSB.

#### Cognitive Description (Underlying Mental Model)
The student reverses the significance order of binary digits, writing the Most Significant Bit where the Least Significant Bit belongs. This commonly occurs when grouping bits for octal/hex conversion or assembling division remainders. Reversing bit order distorts the numeric value completely.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Check the direction of significance: the Most Significant Bit (MSB) must remain on the far left.
2. **Level 2 (Pointed)**: Ensure bit grouping and assembly proceeds in the proper order from least to most significant.
3. **Level 3 (Worked Step)**: Arranging the bits in correct left-to-right order yields: <EXPECTED_VALUE>.

---

### Reversed Division Remainder Order

- **Tag**: `wrong-remainder-order`
- **Affected Modules**: `numberSystems`
- **Concrete Example**: Dividing 13 by 2 yields remainders 1, 0, 1, 1; student writes 1011 instead of reading upward 1101.

#### Cognitive Description (Underlying Mental Model)
The student reads successive division remainders from top to bottom instead of bottom to top. The first remainder produced by repeated division corresponds to the least significant digit (r^0), not the most significant. Writing remainders top-to-bottom inverts the radix representation.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: The first remainder calculated represents the Least Significant Digit (LSD) of the converted number.
2. **Level 2 (Pointed)**: Read the remainders from bottom to top (last remainder becomes the Most Significant Digit).
3. **Level 3 (Worked Step)**: Assembling the remainders from bottom to top yields: <EXPECTED_VALUE>.

---

### Confused Signed Overflow with Unsigned Carry

- **Tag**: `wrong-overflow-rule`
- **Affected Modules**: `numberSystems`
- **Concrete Example**: Claiming overflow occurred in 7 + 1 = 8 (unsigned) when interpreting as signed 4-bit numbers.

#### Cognitive Description (Underlying Mental Model)
The student confuses unsigned carry-out (C_out) with signed two's complement overflow (V). In two's complement, overflow occurs if and only if adding two numbers of the same sign produces a result with the opposite sign (or when C_in != C_out at the sign bit). Relying solely on final carry-out yields erroneous overflow verdicts.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Signed two's complement overflow depends on sign agreement, not simply the final carry-out bit.
2. **Level 2 (Pointed)**: Check if two positive numbers produced a negative sum, or two negative numbers produced a positive sum.
3. **Level 3 (Worked Step)**: Applying the signed overflow rule reveals: <EXPECTED_VALUE>.

---

### Mislabeled or Incorrect Boolean Law Justification

- **Tag**: `wrong-law-applied`
- **Affected Modules**: `boolean`
- **Concrete Example**: Simplifying A + AB to A and claiming it was justified by the Complement law rather than Absorption.

#### Cognitive Description (Underlying Mental Model)
The student performs a valid algebraic step but cites an incorrect governing Boolean law (e.g. citing De Morgan instead of Distributive). Alternatively, they invent an invalid rule to justify an ungrounded manipulation. In formal digital proofs, the deductive justification must accurately match the transformation.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Verify that the law cited precisely describes the identity used in this simplification step.
2. **Level 2 (Pointed)**: Check the algebraic form of your transformation against standard Boolean axiom definitions.
3. **Level 3 (Worked Step)**: The correct governing law for this algebraic identity is: <EXPECTED_VALUE>.

---

### Algebraic Dual or Sign Error in Boolean Manipulation

- **Tag**: `algebra-sign-error`
- **Affected Modules**: `boolean`
- **Concrete Example**: Distributing A + (B + C) as (A + B) * (A + C).

#### Cognitive Description (Underlying Mental Model)
The student incorrectly distributes an operator over an identical operator or drops a literal during factoring. For instance, distributing OR over OR (A + (B + C) -> (A + B) + (A + C)) or treating Boolean addition like arithmetic addition. Boolean algebra requires strict adherence to lattice dualities.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Review the distributive and associative laws; operations with identical operators do not distribute.
2. **Level 2 (Pointed)**: Verify whether parentheses and operators follow boolean lattice properties without arithmetic assumptions.
3. **Level 3 (Worked Step)**: The correct simplification following boolean rules is: <EXPECTED_VALUE>.

---

### General or Unclassified Step Discrepancy

- **Tag**: `other`
- **Affected Modules**: `kmap`, `sequential`, `numberSystems`, `boolean`
- **Concrete Example**: Submitting an arbitrary incorrect expression or calculation that fails logical equivalence.

#### Cognitive Description (Underlying Mental Model)
The student's step does not match any known common misconception pattern in the catalog. The submitted expression or value is mathematically non-equivalent to the correct state. A counterexample assignment demonstrates the logical divergence.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Your current step does not match the expected state for this transformation.
2. **Level 2 (Pointed)**: Compare your result against a truth table or step calculation to identify where it deviates.
3. **Level 3 (Worked Step)**: The correct value for this step is: <EXPECTED_VALUE>.

---
