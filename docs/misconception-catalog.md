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
- [Reversed Subtraction Borrow/Carry Convention (8086 CF=1 on Borrow) (`wrong-borrow-convention`)](#reversed-subtraction-borrow-carry-convention-8086-cf-1-on-borrow)
- [Omitted Operand Inversion in Two's Complement Subtraction (`forgot-invert-b-in-subtract`)](#omitted-operand-inversion-in-two-s-complement-subtraction)
- [Incorrect Bit Shifted into Carry Flag (`wrong-shift-carry-out`)](#incorrect-bit-shifted-into-carry-flag)
- [Incorrect Sign Flag Evaluation (`wrong-sign-flag`)](#incorrect-sign-flag-evaluation)
- [Incorrect Zero Flag Evaluation (`wrong-zero-flag`)](#incorrect-zero-flag-evaluation)
- [Mismatched Compare Condition Flags (Signed vs Unsigned) (`wrong-cmp-relation`)](#mismatched-compare-condition-flags-signed-vs-unsigned)
- [Assumed INC/DEC Modifies the Carry Flag (`inc-dec-changes-carry`)](#assumed-inc-dec-modifies-the-carry-flag)
- [Incorrect Conditional Branch Flag Condition (`wrong-jcc-condition`)](#incorrect-conditional-branch-flag-condition)
- [Incorrect PUSH/POP Stack Pointer Operation Sequence (`wrong-push-order`)](#incorrect-push-pop-stack-pointer-operation-sequence)
- [Inverted Stack Growth Direction (`wrong-stack-direction`)](#inverted-stack-growth-direction)
- [Inverted MOV Operand Direction (Source vs Destination) (`confused-mov-direction`)](#inverted-mov-operand-direction-source-vs-destination)
- [Assumed CMP Updates Destination Register (`cmp-stores-result`)](#assumed-cmp-updates-destination-register)
- [Assumed MOV Alters Status Flags (`mov-affects-flags`)](#assumed-mov-alters-status-flags)
- [Incorrect CALL Return Address on Stack (`wrong-call-return-address`)](#incorrect-call-return-address-on-stack)
- [Big-Endian Byte Layout in Little-Endian Memory (`wrong-byte-order`)](#big-endian-byte-layout-in-little-endian-memory)
- [Immediate Address vs Dereferenced Memory Value (`wrong-address-vs-value`)](#immediate-address-vs-dereferenced-memory-value)
- [Ignored Partial Register Overlap (AL/AH and AX) (`wrong-partial-register`)](#ignored-partial-register-overlap-al-ah-and-ax)
- [Incorrect Instruction Pointer Following Branch (`wrong-ip-after-jump`)](#incorrect-instruction-pointer-following-branch)
- [Incorrect Interrupt Vector Table Address Calculation (`wrong-ivt-address`)](#incorrect-interrupt-vector-table-address-calculation)
- [Uninstalled Interrupt Vector Assumed Valid (`unset-vector-assumed-valid`)](#uninstalled-interrupt-vector-assumed-valid)
- [Incorrect Interrupt Stack Frame Byte Size (`wrong-int-frame-size`)](#incorrect-interrupt-stack-frame-byte-size)
- [Incorrect Interrupt Stack Frame Word Ordering (`wrong-int-frame-order`)](#incorrect-interrupt-stack-frame-word-ordering)
- [Used RET Instead of IRET to Exit Interrupt Handler (`ret-instead-of-iret`)](#used-ret-instead-of-iret-to-exit-interrupt-handler)
- [Assumed IF and TF Retained Across Interrupt Entry (`if-tf-not-cleared-on-entry`)](#assumed-if-and-tf-retained-across-interrupt-entry)
- [Treated Non-Maskable Interrupt (NMI) as Blocked by IF=0 (`nmi-treated-as-maskable`)](#treated-non-maskable-interrupt-nmi-as-blocked-by-if-0)
- [Assumed INTR Serviced While Interrupt Flag (IF) is Cleared (`intr-ignores-if`)](#assumed-intr-serviced-while-interrupt-flag-if-is-cleared)
- [Expected Interrupt Nesting Without STI in Handler (`forgot-sti-in-handler-for-nesting`)](#expected-interrupt-nesting-without-sti-in-handler)
- [Incorrect Simultaneous Interrupt Servicing Priority (`wrong-interrupt-priority`)](#incorrect-simultaneous-interrupt-servicing-priority)
- [Premature Single-Step Trap Timing on TF Set (`tf-trap-timing`)](#premature-single-step-trap-timing-on-tf-set)

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
| `wrong-complement` | `numberSystems`, `alu` | 3 | 14 | 17 |
| `wrong-radix-weight` | `numberSystems` | 2 | 12 | 14 |
| `demorgan-misapplied` | `boolean` | 1 | 11 | 12 |
| `wrong-carry-propagation` | `numberSystems`, `alu` | 1 | 3 | 4 |
| `wrong-bit-order` | `numberSystems` | 2 | 1 | 3 |
| `wrong-remainder-order` | `numberSystems` | 1 | 1 | 2 |
| `wrong-overflow-rule` | `numberSystems`, `alu`, `cpu8086` | 1 | 8 | 9 |
| `wrong-law-applied` | `boolean` | 1 | 27 | 28 |
| `algebra-sign-error` | `boolean` | 2 | 0 | 2 |
| `other` | `kmap`, `sequential`, `numberSystems`, `boolean`, `alu`, `cpu8086` | 16 | 130 | 146 |
| `wrong-borrow-convention` | `alu`, `numberSystems`, `cpu8086` | 1 | 0 | 1 |
| `forgot-invert-b-in-subtract` | `alu` | 1 | 0 | 1 |
| `wrong-shift-carry-out` | `alu`, `cpu8086` | 1 | 0 | 1 |
| `wrong-sign-flag` | `alu`, `cpu8086` | 1 | 0 | 1 |
| `wrong-zero-flag` | `alu`, `cpu8086` | 1 | 0 | 1 |
| `wrong-cmp-relation` | `alu`, `cpu8086` | 1 | 0 | 1 |
| `inc-dec-changes-carry` | `alu`, `cpu8086` | 1 | 0 | 1 |
| `wrong-jcc-condition` | `cpu8086` | 1 | 0 | 1 |
| `wrong-push-order` | `cpu8086`, `interrupt-controller` | 2 | 0 | 2 |
| `wrong-stack-direction` | `cpu8086`, `interrupt-controller` | 2 | 0 | 2 |
| `confused-mov-direction` | `cpu8086` | 1 | 0 | 1 |
| `cmp-stores-result` | `cpu8086` | 1 | 0 | 1 |
| `mov-affects-flags` | `cpu8086` | 1 | 0 | 1 |
| `wrong-call-return-address` | `cpu8086`, `interrupt-controller` | 2 | 0 | 2 |
| `wrong-byte-order` | `cpu8086`, `interrupt-controller` | 2 | 0 | 2 |
| `wrong-address-vs-value` | `cpu8086` | 1 | 0 | 1 |
| `wrong-partial-register` | `cpu8086` | 1 | 0 | 1 |
| `wrong-ip-after-jump` | `cpu8086` | 1 | 0 | 1 |
| `wrong-ivt-address` | `interrupt-controller` | 1 | 0 | 1 |
| `unset-vector-assumed-valid` | `interrupt-controller` | 1 | 0 | 1 |
| `wrong-int-frame-size` | `interrupt-controller` | 1 | 0 | 1 |
| `wrong-int-frame-order` | `interrupt-controller` | 1 | 0 | 1 |
| `ret-instead-of-iret` | `interrupt-controller` | 1 | 0 | 1 |
| `if-tf-not-cleared-on-entry` | `interrupt-controller` | 1 | 0 | 1 |
| `nmi-treated-as-maskable` | `interrupt-controller` | 1 | 0 | 1 |
| `intr-ignores-if` | `interrupt-controller` | 1 | 0 | 1 |
| `forgot-sti-in-handler-for-nesting` | `interrupt-controller` | 1 | 0 | 1 |
| `wrong-interrupt-priority` | `interrupt-controller` | 1 | 0 | 1 |
| `tf-trap-timing` | `interrupt-controller` | 1 | 0 | 1 |

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
- **Affected Modules**: `numberSystems`, `alu`
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
- **Affected Modules**: `numberSystems`, `alu`
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
- **Affected Modules**: `numberSystems`, `alu`, `cpu8086`
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
- **Affected Modules**: `kmap`, `sequential`, `numberSystems`, `boolean`, `alu`, `cpu8086`
- **Concrete Example**: Submitting an arbitrary incorrect expression or calculation that fails logical equivalence.

#### Cognitive Description (Underlying Mental Model)
The student's step does not match any known common misconception pattern in the catalog. The submitted expression or value is mathematically non-equivalent to the correct state. A counterexample assignment demonstrates the logical divergence.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Your current step does not match the expected state for this transformation.
2. **Level 2 (Pointed)**: Compare your result against a truth table or step calculation to identify where it deviates.
3. **Level 3 (Worked Step)**: The correct value for this step is: <EXPECTED_VALUE>.

---

### Reversed Subtraction Borrow/Carry Convention (8086 CF=1 on Borrow)

- **Tag**: `wrong-borrow-convention`
- **Affected Modules**: `alu`, `numberSystems`, `cpu8086`
- **Concrete Example**: Computing 5 - 7 with 4-bit operands yields borrow; student predicts CF = 0 instead of CF = 1.

#### Cognitive Description (Underlying Mental Model)
The student misinterprets the Carry Flag during subtraction or comparison. In x86/8086 microprocessors, CF = 1 indicates that an unsigned borrow occurred (A < B). Students frequently assume CF = 1 indicates "no borrow" (as in 6502/ARM inverted carry conventions) or fail to realize that subtraction inverts the adder carry-out.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: In 8086 architecture, the Carry Flag (CF) acts as an active-high borrow indicator during subtraction.
2. **Level 2 (Pointed)**: Check whether operand A is strictly less than operand B (unsigned). If A < B, a borrow occurs and CF must be 1.
3. **Level 3 (Worked Step)**: Since A < B unsigned, a borrow is required, setting the Carry Flag: <EXPECTED_VALUE>.

---

### Omitted Operand Inversion in Two's Complement Subtraction

- **Tag**: `forgot-invert-b-in-subtract`
- **Affected Modules**: `alu`
- **Concrete Example**: Computing 7 - 3 = 4; student calculates 7 + 3 = 10 (binary 1010) instead of 7 + (~3) + 1.

#### Cognitive Description (Underlying Mental Model)
The student attempts subtraction (A - B) by computing A + B or A + B + 1 directly, omitting the bitwise inversion (~B) step required by two's complement hardware. An adder performs subtraction as A + ~B + 1.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Binary subtraction in hardware is performed by adding the two's complement of the subtrahend: A + NOT(B) + 1.
2. **Level 2 (Pointed)**: Make sure you invert all bits of operand B before feeding it into the adder with carry-in set to 1.
3. **Level 3 (Worked Step)**: Inverting B and adding 1 produces the correct subtraction result: <EXPECTED_VALUE>.

---

### Incorrect Bit Shifted into Carry Flag

- **Tag**: `wrong-shift-carry-out`
- **Affected Modules**: `alu`, `cpu8086`
- **Concrete Example**: Executing SHR 1100_2 by 1; student sets CF = 1 (copying the MSB) instead of CF = 0 (the bit shifted out of bit 0).

#### Cognitive Description (Underlying Mental Model)
The student misidentifies which bit is shifted into the Carry Flag during a shift or rotate operation. For SHL/ROL, the bit pushed out from the MSB enters CF; for SHR/SAR/ROR, the bit pushed out from the LSB enters CF.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: The Carry Flag receives the last bit shifted completely out of the operand register.
2. **Level 2 (Pointed)**: For left shifts/rotates, CF receives the former MSB; for right shifts/rotates, CF receives the former LSB.
3. **Level 3 (Worked Step)**: The bit shifted out of the boundary into CF is: <EXPECTED_VALUE>.

---

### Incorrect Sign Flag Evaluation

- **Tag**: `wrong-sign-flag`
- **Affected Modules**: `alu`, `cpu8086`
- **Concrete Example**: Computing 7 + 2 = 9 (1001_2 in 4-bit); student reports SF = 0 because inputs were positive, ignoring that MSB is 1.

#### Cognitive Description (Underlying Mental Model)
The student misdetermines the Sign Flag (SF) of the ALU result. In two's complement representation, SF must strictly mirror the Most Significant Bit (MSB) of the truncated result width, regardless of whether unsigned interpretation was intended.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: The Sign Flag (SF) is always equal to the Most Significant Bit (MSB) of the result.
2. **Level 2 (Pointed)**: Inspect the leftmost bit of your result; if MSB is 1, SF is 1, and if MSB is 0, SF is 0.
3. **Level 3 (Worked Step)**: The MSB of the result determines the Sign Flag: <EXPECTED_VALUE>.

---

### Incorrect Zero Flag Evaluation

- **Tag**: `wrong-zero-flag`
- **Affected Modules**: `alu`, `cpu8086`
- **Concrete Example**: Computing 5 - 5 = 0; student reports ZF = 0 believing "no error" means 0.

#### Cognitive Description (Underlying Mental Model)
The student sets ZF = 1 when the ALU output is non-zero, or leaves ZF = 0 when the output bits are all zero. The Zero Flag asserts if and only if all bits of the result slice are 0.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: The Zero Flag (ZF) indicates whether the entire result slice equals zero.
2. **Level 2 (Pointed)**: Check if all bits in the output are zero: if result == 0, ZF = 1, otherwise ZF = 0.
3. **Level 3 (Worked Step)**: Since the output is nonzero, the Zero Flag must be: <EXPECTED_VALUE>.

---

### Mismatched Compare Condition Flags (Signed vs Unsigned)

- **Tag**: `wrong-cmp-relation`
- **Affected Modules**: `alu`, `cpu8086`
- **Concrete Example**: Comparing signed numbers 7 and -2 using unsigned CF, concluding 7 < -2 because 7 - 0xFE generated a borrow.

#### Cognitive Description (Underlying Mental Model)
The student misinterprets condition codes following a CMP operation or in conditional jumps (Jcc), confusing unsigned conditions (based on CF and ZF) with signed conditions (based on SF, OF, and ZF). For example, evaluating signed JL using unsigned CF instead of checking whether SF != OF, or evaluating unsigned JA using signed flags.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Unsigned comparisons evaluate CF and ZF; signed comparisons evaluate whether SF matches OF.
2. **Level 2 (Pointed)**: For signed less-than (JL/LSS), test SF != OF; for unsigned below (JB/LO), test CF == 1.
3. **Level 3 (Worked Step)**: Evaluating the correct relational flag condition gives: <EXPECTED_VALUE>.

---

### Assumed INC/DEC Modifies the Carry Flag

- **Tag**: `inc-dec-changes-carry`
- **Affected Modules**: `alu`, `cpu8086`
- **Concrete Example**: Executing INC 0xFF (8-bit); student sets CF = 1 due to wraparound to 0x00, but CF is actually preserved.

#### Cognitive Description (Underlying Mental Model)
The student assumes INC or DEC modifies the Carry Flag (CF). In x86/8086 architectures, INC and DEC update ZF, SF, OF, AF, and PF, but deliberately preserve the existing CF to allow loop index updates without corrupting multi-precision arithmetic carry chains.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: In 8086 architecture, the INC and DEC instructions do NOT modify the Carry Flag.
2. **Level 2 (Pointed)**: INC and DEC affect ZF, SF, and OF, but preserve the previous state of CF untouched.
3. **Level 3 (Worked Step)**: Because INC/DEC preserves CF, the Carry Flag remains: <EXPECTED_VALUE>.

---

### Incorrect Conditional Branch Flag Condition

- **Tag**: `wrong-jcc-condition`
- **Affected Modules**: `cpu8086`
- **Concrete Example**: Executing JZ target when ZF = 0; student predicts branch taken believing JZ means "Jump if Zero flag is Clear".

#### Cognitive Description (Underlying Mental Model)
The student misidentifies the flag condition for a conditional jump mnemonic (excluding signed versus unsigned relationship mix-ups, which are classified under wrong-cmp-relation). Examples include inverting the Zero Flag (treating JZ as JNZ or JE as JNE), confusing strict versus non-strict inequality boundaries (treating JA as JAE or JG as JGE), or reading JNE as JE.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Review the flag condition associated with this jump mnemonic.
2. **Level 2 (Pointed)**: Inspect the Zero Flag (ZF) or boundary flag condition for this mnemonic; verify whether it tests for equality or inequality.
3. **Level 3 (Worked Step)**: Evaluating the correct branch condition produces next IP: <EXPECTED_VALUE>.

---

### Incorrect PUSH/POP Stack Pointer Operation Sequence

- **Tag**: `wrong-push-order`
- **Affected Modules**: `cpu8086`, `interrupt-controller`
- **Concrete Example**: Executing PUSH AX with SP = 0xFFFE; student predicts data is written to 0xFFFE instead of 0xFFFC.

#### Cognitive Description (Underlying Mental Model)
The student assumes memory write occurs at the old SP before decrementing (or forgets to decrement SP entirely on PUSH). For POP, assumes SP is incremented before reading the stack top.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Remember the exact order of stack pointer adjustment and memory access in 8086 architecture.
2. **Level 2 (Pointed)**: On PUSH, 8086 decrements SP first, then writes to the new address. On POP, it reads first, then increments SP.
3. **Level 3 (Worked Step)**: Following the proper stack sequence yields: <EXPECTED_VALUE>.

---

### Inverted Stack Growth Direction

- **Tag**: `wrong-stack-direction`
- **Affected Modules**: `cpu8086`, `interrupt-controller`
- **Concrete Example**: Executing PUSH with SP = 0x1000; student predicts SP becomes 0x1002 instead of 0x0FFE.

#### Cognitive Description (Underlying Mental Model)
The student assumes the stack grows upward toward higher memory addresses (incrementing SP on PUSH, decrementing on POP) rather than downward toward lower addresses.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Consider the direction in which the x86/8086 call and data stack grows in memory.
2. **Level 2 (Pointed)**: In 8086 architecture, the stack grows downward toward address 0x0000, so PUSH subtracts from SP.
3. **Level 3 (Worked Step)**: Stack grows downward; adjusting SP toward lower memory yields: <EXPECTED_VALUE>.

---

### Inverted MOV Operand Direction (Source vs Destination)

- **Tag**: `confused-mov-direction`
- **Affected Modules**: `cpu8086`
- **Concrete Example**: Executing MOV AX, BX; student assumes BX receives AX's value instead of AX receiving BX.

#### Cognitive Description (Underlying Mental Model)
The student confuses the Intel 8086 destination-first operand ordering (MOV dest, src) with AT&T syntax or natural reading order, assigning the destination value to the source register. This misconception is detected when predicting the post-instruction value of the source register.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Check the direction of data flow in standard Intel syntax: destination comes first.
2. **Level 2 (Pointed)**: In MOV dest, src, the second operand (src) is read and copied into the first operand (dest).
3. **Level 3 (Worked Step)**: Copying source to destination gives: <EXPECTED_VALUE>.

---

### Assumed CMP Updates Destination Register

- **Tag**: `cmp-stores-result`
- **Affected Modules**: `cpu8086`
- **Concrete Example**: Executing CMP AX, BX with AX=5, BX=3; student predicts AX becomes 2 instead of retaining 5.

#### Cognitive Description (Underlying Mental Model)
The student expects the CMP instruction to store the arithmetic difference (A - B) into the destination register, failing to recognize that CMP strictly modifies status flags while leaving both operands unchanged.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Remember the primary functional difference between SUB and CMP instructions.
2. **Level 2 (Pointed)**: CMP performs subtraction internally to update flags, but discards the result without writing back to the destination.
3. **Level 3 (Worked Step)**: Since CMP preserves its operands, the register value remains: <EXPECTED_VALUE>.

---

### Assumed MOV Alters Status Flags

- **Tag**: `mov-affects-flags`
- **Affected Modules**: `cpu8086`
- **Concrete Example**: Executing MOV AX, 0; student sets ZF = 1 assuming transferring zero sets the Zero Flag.

#### Cognitive Description (Underlying Mental Model)
The student expects data movement instructions (MOV, PUSH, POP) to update arithmetic and logic status flags (ZF, SF, CF, OF). This error is diagnosed when an unchanged flag is predicted to take on the value that a result-based flag update would produce.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Review which instruction classes update the status flags in 8086 architecture.
2. **Level 2 (Pointed)**: Data movement instructions (MOV, PUSH, POP) do not alter ZF, SF, CF, or OF; only arithmetic/logic operations update them.
3. **Level 3 (Worked Step)**: Flags remain untouched across data movement; flag value is: <EXPECTED_VALUE>.

---

### Incorrect CALL Return Address on Stack

- **Tag**: `wrong-call-return-address`
- **Affected Modules**: `cpu8086`, `interrupt-controller`
- **Concrete Example**: Executing CALL at IP=2 targeting IP=10; student predicts return address 10 or 2 pushed instead of 3.

#### Cognitive Description (Underlying Mental Model)
The student expects CALL to push the target routine address, the current instruction pointer, or zero onto the stack instead of the address of the immediately following sequential instruction.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Consider what instruction execution must resume at when a subroutine completes with RET.
2. **Level 2 (Pointed)**: CALL must save the address of the next instruction (IP + 1) onto the stack so RET can resume caller execution.
3. **Level 3 (Worked Step)**: The address pushed to the stack is the next sequential instruction: <EXPECTED_VALUE>.

---

### Big-Endian Byte Layout in Little-Endian Memory

- **Tag**: `wrong-byte-order`
- **Affected Modules**: `cpu8086`, `interrupt-controller`
- **Concrete Example**: Writing 0x1234 to memory; student expects byte 0x12 at base address and 0x34 at base+1.

#### Cognitive Description (Underlying Mental Model)
The student places the high-order byte at the lower memory address or reads memory words using big-endian ordering rather than 8086 little-endian byte ordering (least significant byte at the lower address).

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Remember the byte ordering convention used by 8086 memory architecture.
2. **Level 2 (Pointed)**: 8086 is strictly little-endian: the least significant byte (low byte) is stored at the lowest address.
3. **Level 3 (Worked Step)**: Applying little-endian byte ordering yields: <EXPECTED_VALUE>.

---

### Immediate Address vs Dereferenced Memory Value

- **Tag**: `wrong-address-vs-value`
- **Affected Modules**: `cpu8086`
- **Concrete Example**: Executing MOV AX, table; student loads memory contents stored at table instead of table's offset address.

#### Cognitive Description (Underlying Mental Model)
The student confuses an immediate address literal (e.g. MOV AX, label) with the dereferenced memory content stored at that address (e.g. MOV AX, [label]), or vice versa.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Check whether the instruction uses square brackets around the operand.
2. **Level 2 (Pointed)**: Square brackets [label] indicate memory dereferencing; bare label indicates the immediate offset address.
3. **Level 3 (Worked Step)**: Evaluating the correct addressing mode yields: <EXPECTED_VALUE>.

---

### Ignored Partial Register Overlap (AL/AH and AX)

- **Tag**: `wrong-partial-register`
- **Affected Modules**: `cpu8086`
- **Concrete Example**: AX holds 0x1234; executing MOV AL, 0x56; student assumes AX becomes 0x0056 instead of 0x1256.

#### Cognitive Description (Underlying Mental Model)
The student fails to account for 8-bit sub-registers (AL or AH) modifying the corresponding low or high byte of their enclosing 16-bit register (AX), assuming zero-extension or independent storage.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Recall how 8-bit registers map into their 16-bit parent registers in 8086 architecture.
2. **Level 2 (Pointed)**: AL occupies the low byte (bits 0..7) and AH occupies the high byte (bits 8..15); the opposite byte is preserved.
3. **Level 3 (Worked Step)**: Combining the modified byte with the preserved byte yields: <EXPECTED_VALUE>.

---

### Incorrect Instruction Pointer Following Branch

- **Tag**: `wrong-ip-after-jump`
- **Affected Modules**: `cpu8086`
- **Concrete Example**: Condition is met for JMP or Jcc; student predicts fallthrough to IP+1 instead of jumping to the target label.

#### Cognitive Description (Underlying Mental Model)
The student predicts that execution advances sequentially when a branch condition is satisfied, or jumps to the target address when the condition evaluates to false, without a specific condition code error.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Check whether the jump condition evaluated to true or false.
2. **Level 2 (Pointed)**: If the branch condition is met, IP updates to the target address; if false, execution falls through to IP + 1.
3. **Level 3 (Worked Step)**: Following the branch decision sets next IP to: <EXPECTED_VALUE>.

---

### Incorrect Interrupt Vector Table Address Calculation

- **Tag**: `wrong-ivt-address`
- **Affected Modules**: `interrupt-controller`
- **Concrete Example**: For vector 0x20 (32 decimal), student predicts IVT address 0x40 (32*2) or 0x24 (32+4) instead of 0x80 (32*4).

#### Cognitive Description (Underlying Mental Model)
The student calculates the IVT offset address incorrectly (such as n*2, n+4, n, or (n-1)*4 instead of n*4). Each 8086 IVT entry occupies 4 bytes (2 bytes for IP offset and 2 bytes for CS segment).

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Review the layout and sizing of each descriptor entry in the 8086 Interrupt Vector Table.
2. **Level 2 (Pointed)**: Each interrupt vector descriptor occupies 4 bytes in memory (2 bytes IP, 2 bytes CS), so vector n resides at byte address n * 4.
3. **Level 3 (Worked Step)**: Multiplying the vector number by 4 gives the correct IVT entry address: <EXPECTED_VALUE>.

---

### Uninstalled Interrupt Vector Assumed Valid

- **Tag**: `unset-vector-assumed-valid`
- **Affected Modules**: `interrupt-controller`
- **Concrete Example**: Executing INT 0x80 when vector 0x80 holds 0x0000:0x0000; student assumes handler execution begins rather than a fault/halt.

#### Cognitive Description (Underlying Mental Model)
The student assumes an interrupt vector table slot is valid and ready to service interrupts even though it contains all zeros (0x0000:0x0000) or has not been initialized with a valid handler pointer.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Check whether the operating system or program initialized the vector table entry before triggering the interrupt.
2. **Level 2 (Pointed)**: In 8086 systems, uninitialized IVT slots hold 0x0000:0x0000; triggering an unset vector will jump to unmapped memory or trigger a CPU fault.
3. **Level 3 (Worked Step)**: Since the IVT entry is not installed, the CPU cannot service it normally: <EXPECTED_VALUE>.

---

### Incorrect Interrupt Stack Frame Byte Size

- **Tag**: `wrong-int-frame-size`
- **Affected Modules**: `interrupt-controller`
- **Concrete Example**: Interrupt entry occurs; student predicts SP decreases by 2 or 4 instead of 6 bytes.

#### Cognitive Description (Underlying Mental Model)
The student predicts an interrupt stack frame pushes only 2 bytes (like a NEAR CALL with IP only) or 4 bytes (like a FAR CALL with CS and IP), omitting the 2-byte FLAGS register.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Consider all registers that 8086 hardware must preserve on the stack during an interrupt entry.
2. **Level 2 (Pointed)**: An 8086 hardware interrupt frame always pushes 3 words (6 bytes total): FLAGS, then CS, then IP.
3. **Level 3 (Worked Step)**: Accounting for all 6 bytes (3 words) of the interrupt frame yields: <EXPECTED_VALUE>.

---

### Incorrect Interrupt Stack Frame Word Ordering

- **Tag**: `wrong-int-frame-order`
- **Affected Modules**: `interrupt-controller`
- **Concrete Example**: On interrupt entry, student places FLAGS at TOS (SP) and IP at SP+4 instead of IP at TOS (SP) and FLAGS at SP+4.

#### Cognitive Description (Underlying Mental Model)
The student pushes the 3 words of the interrupt frame in the wrong sequence (for example, pushing IP first, CS second, and FLAGS third, or placing FLAGS at the top of the stack).

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Recall the chronological hardware micro-sequence when 8086 enters an interrupt.
2. **Level 2 (Pointed)**: 8086 hardware pushes FLAGS first (highest address), then CS, and finally IP (lowest address / top of stack).
3. **Level 3 (Worked Step)**: Ordering stack words from top of stack (SP) upward produces: <EXPECTED_VALUE>.

---

### Used RET Instead of IRET to Exit Interrupt Handler

- **Tag**: `ret-instead-of-iret`
- **Affected Modules**: `interrupt-controller`
- **Concrete Example**: Returning from ISR with RET; student expects SP restored to initial SP, but 4 bytes (CS and FLAGS) remain on stack.

#### Cognitive Description (Underlying Mental Model)
The student expects returning from an interrupt service routine using normal RET, which pops only IP (2 bytes), leaving the saved CS and FLAGS on the stack and failing to restore status flags.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Check which instruction is designed specifically to return from an interrupt handler versus a regular subroutine.
2. **Level 2 (Pointed)**: Standard RET only pops IP (2 bytes). Interrupt handlers require IRET to pop IP, CS, and the saved FLAGS register (6 bytes total).
3. **Level 3 (Worked Step)**: Using IRET rather than RET correctly restores flags and stack pointer: <EXPECTED_VALUE>.

---

### Assumed IF and TF Retained Across Interrupt Entry

- **Tag**: `if-tf-not-cleared-on-entry`
- **Affected Modules**: `interrupt-controller`
- **Concrete Example**: When IF = 1 and an interrupt occurs, student expects IF = 1 inside the handler, allowing uncontrolled nested interrupts.

#### Cognitive Description (Underlying Mental Model)
The student expects IF or TF to remain set after entering an interrupt service routine, failing to recognize that 8086 hardware automatically clears both IF and TF upon interrupt entry.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Consider what the CPU hardware does to interrupt control flags to prevent re-entrant interrupt cascades.
2. **Level 2 (Pointed)**: Upon acknowledging any interrupt, 8086 hardware automatically clears IF (disabling maskable INTR) and TF (disabling single-stepping).
3. **Level 3 (Worked Step)**: Both IF and TF are cleared to 0 by hardware upon entry: <EXPECTED_VALUE>.

---

### Treated Non-Maskable Interrupt (NMI) as Blocked by IF=0

- **Tag**: `nmi-treated-as-maskable`
- **Affected Modules**: `interrupt-controller`
- **Concrete Example**: NMI occurs while IF = 0; student predicts the CPU ignores the NMI until STI executes.

#### Cognitive Description (Underlying Mental Model)
The student assumes that clearing the Interrupt Flag (CLI / IF = 0) blocks Non-Maskable Interrupts (NMI), confusing maskable INTR with non-maskable NMI.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Review the distinction between maskable (INTR) and non-maskable (NMI) interrupt pins on 8086.
2. **Level 2 (Pointed)**: The Interrupt Flag (IF) controls only the INTR input. Non-Maskable Interrupts (NMI) are never blocked by IF = 0.
3. **Level 3 (Worked Step)**: Because NMI cannot be masked by IF, the interrupt is recognized: <EXPECTED_VALUE>.

---

### Assumed INTR Serviced While Interrupt Flag (IF) is Cleared

- **Tag**: `intr-ignores-if`
- **Affected Modules**: `interrupt-controller`
- **Concrete Example**: INTR arrives with IF = 0; student predicts immediate jump to the vector handler instead of remaining pending.

#### Cognitive Description (Underlying Mental Model)
The student predicts that a maskable hardware interrupt (INTR) is serviced immediately even though the Interrupt Flag is cleared (IF = 0).

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Check the state of the 8086 Interrupt Flag (IF) before determining whether INTR can be serviced.
2. **Level 2 (Pointed)**: When IF = 0, maskable interrupts on the INTR line are ignored and remain pending until IF is set to 1 by STI or IRET.
3. **Level 3 (Worked Step)**: Since IF = 0, INTR cannot be serviced at this time: <EXPECTED_VALUE>.

---

### Expected Interrupt Nesting Without STI in Handler

- **Tag**: `forgot-sti-in-handler-for-nesting`
- **Affected Modules**: `interrupt-controller`
- **Concrete Example**: Inside an ISR with no STI; another INTR arrives; student expects the CPU to preempt the current handler immediately.

#### Cognitive Description (Underlying Mental Model)
The student expects higher or equal priority maskable interrupts to nest inside an active ISR without an explicit STI instruction, forgetting that entry automatically cleared IF.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Remember that interrupt entry automatically clears IF; how can an ISR allow nested interrupts?
2. **Level 2 (Pointed)**: To allow nested interrupts inside a handler, the programmer must explicitly execute STI to re-enable INTR.
3. **Level 3 (Worked Step)**: Without an explicit STI inside the handler, nested INTR interrupts remain blocked: <EXPECTED_VALUE>.

---

### Incorrect Simultaneous Interrupt Servicing Priority

- **Tag**: `wrong-interrupt-priority`
- **Affected Modules**: `interrupt-controller`
- **Concrete Example**: NMI and INTR are asserted simultaneously; student services INTR first instead of NMI.

#### Cognitive Description (Underlying Mental Model)
The student prioritizes pending interrupts in the wrong architectural order when multiple interrupts occur at the same tick (such as prioritizing INTR over NMI).

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Review 8086 hardware priority arbitration between external pins and internal traps.
2. **Level 2 (Pointed)**: 8086 priority order prioritizes internal faults and single-step trap, then software INT, then NMI, and finally INTR.
3. **Level 3 (Worked Step)**: Following 8086 hardware priority arbitration rules yields: <EXPECTED_VALUE>.

---

### Premature Single-Step Trap Timing on TF Set

- **Tag**: `tf-trap-timing`
- **Affected Modules**: `interrupt-controller`
- **Concrete Example**: POPF sets TF = 1; student predicts Type 1 trap fires before executing the next instruction.

#### Cognitive Description (Underlying Mental Model)
The student predicts that the single-step trap (vector 1) fires immediately on the instruction that sets TF (such as POPF), rather than after the following instruction completes.

#### Three-Tiered Progressive Hint Templates
1. **Level 1 (Nudge)**: Check the exact instruction cycle boundary where the 8086 CPU samples and executes the Trap Flag (TF).
2. **Level 2 (Pointed)**: When TF is set by POPF, the trap does not trigger on POPF itself; it fires after the instruction following POPF has finished.
3. **Level 3 (Worked Step)**: The single-step trap occurs after completing the next instruction: <EXPECTED_VALUE>.

---
