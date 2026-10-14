# User Guide

## Student Quick Start (10 Lines)
1. Open the virtual lab in any modern web browser (no account or installation required).
2. Click **Project Menu** in the top header and select **Open Example...** to browse curated seed problems.
3. Start in **Boolean Expression Analysis** to parse an expression like `A'B + C(D xor E)` and view its truth table.
4. Click **Send to Karnaugh Map Minimizer** to hand off your truth table minterms to a 2–5 variable K-map.
5. In **Student Mode**, click adjacent power-of-two 1s or don't-cares and click **Add Group** to build prime implicants.
6. When grouping is complete, click **Send to Circuit Simulator** to synthesize a gate-level schematic netlist.
7. Click interactive input toggles or run the clock in the **Circuit Simulator** to verify discrete-event signal propagation.
8. To explore sequential logic, open **Flip-Flop & Latch Workbench**, select a flip-flop type (JK, D, T, SR), and click **Send to Sequential Designer**.
9. Follow the guided 8-step wizard in **Sequential Designer** to design a counter or sequence detector with automated lockout verification.
10. If you get stuck anywhere, expand the **Pedagogical Feedback** card for step-level hints that guide you without giving away answers.

## Teacher Quick Start (10 Lines)
1. Distribute the laboratory URL or static build folder to student devices (works completely offline).
2. For diagnostic evaluation, direct students to **Pre/Post Diagnostic Assessment** with assigned participant codes (e.g. `P001`).
3. Have students complete assigned exercises in **Adaptive Practice Workbench** or topic-specific **Conceptual Diagnostic Quizzes**.
4. All student problem-solving actions, hints viewed, and cognitive misconceptions are logged locally to client browser storage.
5. In research studies, ask students to complete the 10-item **System Usability Scale (SUS)** survey at the end of their session.
6. Direct students to click **Export CSV** in their session panel or dashboard to download their anonymized telemetry event log.
7. Open **Teacher & Researcher Dashboard** on your instructor device and click **Browse Files** to drag-and-drop all student CSV/JSON logs.
8. Review the **Misconceptions** tab to inspect cohort error rankings and pinpoint which topics caused the most frequent misconceptions.
9. Inspect the **Pre/Post Gains** tab to examine normalized Hake learning gains ($\langle g \rangle$), paired $t$-statistics, and effect sizes (Cohen's $d$).
10. Click **Export Summaries CSV** or **Export Full Model JSON** to export merged cohort data for analysis in R, Python, or SPSS.

*Note on Phase 2 Modules*: Phase 2 modules (Arithmetic Logic Unit (ALU), Intel 8086 Microprocessor, and 8259A Interrupt Controller) are not built in this delivery: they are reserved architectural slots listed as future work.

---

## Global Application Controls

### Project Menu & Persistence
Located in the upper-right corner of the application header:
- **Project Menu** dropdown button:
  - **New Project...**: Prompts for a new project name, initializes an empty `DesignProject` (version 2 schema), and autosaves to `localStorage`.
  - **Open Example...**: Opens the Curated Examples modal with filterable seed problems across all modules and difficulty levels.
  - **Switch Project...**: Displays saved projects in local storage with creation dates and deletion controls.
  - **Export JSON**: Downloads the current `DesignProject` as a formatted JSON document.
  - **Import JSON...**: Pastes or uploads a `DesignProject` JSON document with validation and schema migration.
  - **Delete Project**: Deletes the active project after explicit modal confirmation.
- **Inline Project Rename**: Click the project name in the header to activate an inline textbox; press `Enter` to commit or `Escape` to cancel.

### Theme & Accessibility Controls
- **Theme Toggle**: Located next to the Project Menu. Click to cycle sequentially through `Light`, `Dark`, and `System` preference. The button announces its state via accessible `aria-label` (e.g. `Theme: System preference. Click to switch to Light theme`).
- **Skip Link**: The very first tab stop on every page is `Skip to main content`, allowing screen-reader and keyboard users to bypass header navigation.
- **Global Keyboard Shortcuts**:
  - `Ctrl + K` or `/`: Opens the Quick Navigation search modal.
  - `Alt + 1` through `Alt + 6`: Jumps directly to corresponding pipeline modules.
  - `Escape`: Closes open modals, dropdown menus, and overlays.

---

## Module 1: Number Systems & Radix Arithmetic (`number-systems`)

### Purpose
Interactive multi-radix conversion workbench and signed binary arithmetic explorer supporting positional radix arithmetic, two's complement encoding, and Binary Coded Decimal (BCD) operations.

### Inputs & Outputs
- **Reads**: Standalone input values (does not require previous project data).
- **Writes**: Standalone exploration state; logs student step submissions and conversion operations.

### Step-by-Step Usage
1. Select a sub-panel from the top tabs:
   - **Radix Conversion**: Enter a source number, select the source base (Binary `2`, Octal `8`, Decimal `10`, Hexadecimal `16`), and choose the target base.
   - **Signed Representations**: Toggle word width (4, 8, 16 bits), enter signed or unsigned values, and view sign-magnitude, 1's complement, and 2's complement encodings.
   - **Binary Arithmetic**: Perform multi-bit binary addition and subtraction. View column-by-column carry and borrow propagation.
   - **Codes & Radix Arithmetic**: Explore Gray code reflection, BCD 8421 addition with `+0110` correction steps, and excess-3 conversion.
2. In the **Step-by-Step Practice** card, enter intermediate division remainders or positional weights and click **Check Step**.

### Feedback Panel Display
- Displays exact repeated division quotient and remainder rows.
- Highlights reading direction: emphasizes that the first remainder is the Least Significant Digit (LSD) and the final remainder is the Most Significant Digit (MSD).
- Displays carry bits ($C_{in}, C_{out}$) and signed arithmetic overflow flags ($V = C_{in} \oplus C_{out}$ at the sign bit).

### Keyboard Shortcuts
- `Tab` / `Shift+Tab`: Navigate between digit input cells and radix selectors.
- `0`-`9`, `A`-`F`: Direct digit entry in corresponding bases.
- `Enter`: Submit intermediate conversion step for verification.

### Common Misconceptions Detected
- [Reversed Division Remainder Order (`wrong-remainder-order`)](misconception-catalog.md#reversed-division-remainder-order)
- [Incorrect Positional Radix Weight or Exponent (`wrong-radix-weight`)](misconception-catalog.md#incorrect-positional-radix-weight-or-exponent)
- [Dropped or Erroneous Addition Carry Bit (`wrong-carry-propagation`)](misconception-catalog.md#dropped-or-erroneous-addition-carry-bit)
- [Reversed Bit Order (MSB vs LSB) (`wrong-bit-order`)](misconception-catalog.md#reversed-bit-order-msb-vs-lsb)
- [Flawed Two's or Radix Complement Calculation (`wrong-complement`)](misconception-catalog.md#flawed-two-s-or-radix-complement-calculation)
- [Confused Signed Overflow with Unsigned Carry (`wrong-overflow-rule`)](misconception-catalog.md#confused-signed-overflow-with-unsigned-carry)

---

## Module 2: Boolean Expression Analysis (`boolean-tool`)

### Purpose
Symbolic Boolean AST parsing, truth table generation, step-by-step algebraic reduction with rule justifications, and universal gate (NAND/NOR) equivalence mapping.

### Inputs & Outputs
- **Reads from DesignProject**: `variables`, `expression`, `truthTable`.
- **Writes to DesignProject**: `variables`, `expression`, `truthTable`.

### Step-by-Step Usage
1. In the **Boolean Expression** input field, type an algebraic expression using standard notations (e.g. `A'B + C(D + E)` or `not A and B or C and (D or E)`).
2. The interactive palette beneath the input provides one-click insertion of operators: `AND` ($\cdot$), `OR` ($+$), `NOT` ($'$), `XOR` ($\oplus$), and parentheses.
3. Select a sub-tab:
   - **Truth Table**: Inspect computed minterm rows ($2^n$, up to 64 rows for 6 variables). Canonical Sum-of-Products ($\Sigma m$) and Product-of-Sums ($\Pi M$) indices are automatically generated.
   - **Simplify**: Step through algebraic equivalence. In interactive practice mode, enter your transformed expression, select the governing Boolean law from the **Select Law** dropdown (Identity, Null, Idempotence, Complement, Involution, Commutative, Associative, Distributive, Absorption, De Morgan, Consensus), and click **Apply Law**.
   - **Equivalence**: Enter two distinct expressions to compute formal tautological equivalence with counterexample generation if non-equivalent.
   - **Universal Gates**: View equivalent all-NAND and all-NOR implementations derived via double-inversion and De Morgan expansion.
4. When satisfied with your expression and truth table, click the button **Send to Karnaugh Map Minimizer**.

### Pipeline Handoff to K-Map
Transmits `project.variables`, `project.expression`, and `project.truthTable` to `kmap-solver`. The K-map grid will pre-populate cell values with truth table outputs ($0, 1$) matching canonical minterm indices.

### Keyboard Shortcuts
- `'` (apostrophe): Inverts preceding literal.
- `+`: Inserts OR operator.
- `*` or space: Inserts AND operator.
- `^`: Inserts XOR operator.

### Common Misconceptions Detected
- [De Morgan's Law Misapplied (`demorgan-misapplied`)](misconception-catalog.md#de-morgan-s-law-misapplied-operator-or-bar)
- [Mislabeled or Incorrect Boolean Law Justification (`wrong-law-applied`)](misconception-catalog.md#mislabeled-or-incorrect-boolean-law-justification)
- [Algebraic Dual or Sign Error in Boolean Manipulation (`algebra-sign-error`)](misconception-catalog.md#algebraic-dual-or-sign-error-in-boolean-manipulation)

---

## Module 3: Karnaugh Map Minimizer (`kmap-solver`)

### Purpose
Spatial Boolean minimization supporting 2 to 5 variables ($2 \le n \le 5$) with interactive student grouping, prime implicant identification, essential prime implicant deduction, and automated Quine-McCluskey/Petrick solving.

### Inputs & Outputs
- **Reads from DesignProject**: `variables`, `expression`, `truthTable`, `kmap`.
- **Writes to DesignProject**: `kmap`, `minimizedExpression` (dual SOP and POS forms).

### Step-by-Step Usage
1. Use the **Variable Count** selector (2, 3, 4, or 5 variables) or load minterms from the pipeline handoff.
2. Click on any K-map grid cell to toggle its value through `0` $\rightarrow$ `1` $\rightarrow$ `X` (don't-care).
3. Choose your working mode:
   - **Auto-Solver Mode**: Click **Solve Map** to view all prime implicants, essential prime implicants, and minimal covers (SOP and POS).
   - **Student Mode**: Select adjacent cells on the grid (by clicking or using arrow keys and `Space`), then click **Add Group**. The system evaluates your group in real time.
4. Continue adding groups until all `1` cells are covered without redundant implicants.
5. Once a minimal cover is achieved, click **Send to Circuit Simulator**.

### Feedback Panel Display
- Identifies invalid grouping geometries (non-power-of-two cell count, irregular non-rectangular shapes).
- Identifies missed boundary wraparound opportunities on 4-variable and 5-variable toroids.
- Emits warnings when a group contains a `0` cell in SOP mode or leaves essential minterms uncovered.
- Evaluates cost equivalence: if a student's cover differs from the solver's pick but achieves identical minimal cost, it confirms validity with an affirmative note.

### Keyboard Shortcuts
- `Arrow Keys` (`Up`, `Down`, `Left`, `Right`): Move grid cursor across K-map cells with automatic toroidal wraparound.
- `Space` or `Enter`: Toggle cell selection in student grouping mode.
- `0`, `1`, `X`: Directly set value of focused cell.
- `G`: Commit currently selected cells as a group (**Add Group**).
- `Escape`: Clear active cell selection.

### Common Misconceptions Detected
- [Forgot Toroidal Wraparound on K-Map (`forgot-wraparound-grouping`)](misconception-catalog.md#forgot-toroidal-wraparound-on-k-map)
- [Grouped Non-Power-of-Two Cell Count (`grouped-non-power-of-two`)](misconception-catalog.md#grouped-non-power-of-two-cell-count)
- [Formed Non-Rectangular Group Shape (`group-not-rectangle`)](misconception-catalog.md#formed-non-rectangular-group-shape)
- [Suboptimal Non-Maximal Prime Implicant (`group-not-maximal`)](misconception-catalog.md#suboptimal-non-maximal-prime-implicant)
- [Included Redundant Group Already Covered (`redundant-group`)](misconception-catalog.md#included-redundant-group-already-covered)
- [Omitted Required Minterm from Cover (`missed-minterm`)](misconception-catalog.md#omitted-required-minterm-from-cover)
- [Covered a Zero in Sum-of-Products Group (`covered-a-zero`)](misconception-catalog.md#covered-a-zero-in-sum-of-products-group)
- [Ignored Beneficial Don't-Care Conditions (`missed-dont-cares`)](misconception-catalog.md#ignored-beneficial-don-t-care-conditions)

---

## Module 4: Digital Circuit Schematic Simulator (`circuit-simulator`)

### Purpose
Interactive gate-level schematic netlist editor and discrete-event logic simulator with continuous signal propagation, glitch and hazard detection, timing diagrams, and truth table verification.

### Inputs & Outputs
- **Reads from DesignProject**: `circuit`, `minimizedExpression`.
- **Writes to DesignProject**: `circuit`, `simulationTrace`.

### Step-by-Step Usage
1. If entering from the K-Map handoff, click **Synthesize Circuit from Expression** to automatically lay out an optimal two-level AND-OR (SOP) or OR-AND (POS) gate schematic.
2. To build or modify circuits manually:
   - Select components from the **Palette** on the left: Input Switches (`INPUT`), Clock Sources (`CLOCK`), Logic Gates (`AND`, `OR`, `NOT`, `NAND`, `NOR`, `XOR`, `XNOR`), and Output Probes (`OUTPUT`).
   - Click the canvas to place nodes, or drag-and-drop elements directly.
   - Click an output pin, then click an input pin to route an orthogonal Manhattan connection wire.
3. In the canvas, click any input switch node to toggle its binary state (`0` or `1`).
4. Click **Run / Pause** to toggle discrete-event simulation, or click **Step Clock** to advance one unit delay.
5. Switch tabs to inspect:
   - **Canvas**: Visual schematic with real-time green (`1`) and gray (`0`) wire voltage animations.
   - **List Editor**: Accessible textual table listing all gates, inputs, and output wiring.
   - **Timing Diagram**: Multi-trace waveform display recording signal transitions over time.
   - **Truth Table Verification**: Executes an automated sweep of all input combinations to verify that the schematic matches the intended Boolean specification.

### Keyboard Shortcuts
- `Delete` or `Backspace`: Delete currently selected gate or wire.
- `Ctrl + Z`: Undo last canvas edit.
- `Ctrl + Y` or `Ctrl + Shift + Z`: Redo canvas edit.
- `+` / `-`: Zoom in / Zoom out canvas viewport.
- `0`: Reset viewport zoom to fit.
- `Space`: Step clock in discrete simulation mode.

### Common Misconceptions Detected
- Structural loop oscillations (unclocked cyclic feedback).
- Unconnected input pins resulting in undefined (`X`) gate propagation.
- Mismatched truth table outputs indicating schematic wiring errors.

---

## Module 5: Flip-Flop & Latch Workbench (`flipflop-simulator`)

### Purpose
Bistable multivibrator laboratory providing comparative analysis of SR latches, clocked SR flip-flops, JK flip-flops, D flip-flops, and T flip-flops with edge-triggering, setup/hold timing hazards, and race-around condition visualization.

### Inputs & Outputs
- **Reads from DesignProject**: `flipFlopType`.
- **Writes to DesignProject**: `flipFlopType`, `simulationTrace`.

### Step-by-Step Usage
1. In the **Select Flip-Flop Type** control, choose among `SR`, `JK`, `D`, or `T`.
2. Toggle trigger modes: `Rising Edge` ($\uparrow$), `Falling Edge` ($\downarrow$), or `Level-Sensitive` (transparent latch mode).
3. Toggle input signals (e.g. `J` and `K` values) and click **Pulse Clock** to trigger state transitions.
4. Explore tabs:
   - **Interactive Workbench**: Live gate-level flip-flop schematic with internal cross-coupled NOR/NAND latches.
   - **Characteristic & Excitation**: Tabular comparison between the forward characteristic table ($Q, \text{inputs} \rightarrow Q_{next}$) and the inverse excitation table ($Q, Q_{next} \rightarrow \text{inputs}$).
   - **Timing Diagram**: Real-time multi-channel waveform displaying Clock, Inputs, and $Q / \bar{Q}$ outputs.
   - **Race-Around Explorer**: Demonstrates how level-triggered JK latches oscillate uncontrollably when $J=K=1$ and pulse width $t_p > t_{pd}$, contrasting with master-slave and edge-triggered architectures.
5. Click **Send to Sequential Designer** to carry the active flip-flop type forward.

### Pipeline Handoff to Sequential Designer
Carries `project.flipFlopType` to `sequential-designer`, pre-selecting excitation formulas for state table synthesis.

### Keyboard Shortcuts
- `C`: Pulse clock once.
- `R`: Reset flip-flop state to $Q=0$.
- `1`-`4`: Toggle respective data inputs ($S/R$, $J/K$, $D$, $T$).

### Common Misconceptions Detected
- [Confused Present State Q with Next State Q+ (`confused-q-and-qnext`)](misconception-catalog.md#confused-present-state-q-with-next-state-q)
- [Incorrect Flip-Flop Excitation Input Logic (`wrong-excitation-table`)](misconception-catalog.md#incorrect-flip-flop-excitation-input-logic)
- Invalid excitation entries (e.g., specifying `J=1, K=0` for a $0 \rightarrow 0$ transition instead of the correct don't-care condition `J=0, K=X`).

---

## Module 6: Synchronous Sequential Circuit Designer (`sequential-designer`)

### Purpose
Comprehensive finite state machine (FSM) synthesis workbench for synchronous counters and sequence detectors. Implements guided 8-step wizard navigation, excitation derivation, automated unused state lockout verification, and circuit netlist generation.

### Inputs & Outputs
- **Reads from DesignProject**: `flipFlopType`, `stateDiagram`, `stateTable`, `excitationTable`.
- **Writes to DesignProject**: `stateDiagram`, `stateTable`, `excitationTable`, `nextStateEquations`, `circuit`.

### Step-by-Step Usage
1. Choose machine type using top tabs:
   - **Synchronous Counter Designer**: Design arbitrary mod-N up, down, or custom sequence counters.
   - **Sequence Detector Designer**: Design Mealy or Moore sequence detectors for arbitrary bit strings with overlapping or non-overlapping semantics.
2. Advance through the accessible 8-step wizard stepper:
   - **Step 1: Choose Flip-Flop**: Pick `JK`, `D`, `T`, or `SR`.
   - **Step 2: Define Machine**: Set modulus (e.g. Mod-5), count direction (`Up` or `Down`), or target detection pattern (e.g. `1011`).
   - **Step 3: State Diagram**: View circular or force-directed state transition diagram. Click states to inspect transitions.
   - **Step 4: State Table**: Derive present state $\rightarrow$ next state binary codes ($Q_2 Q_1 Q_0 \rightarrow Q_2^+ Q_1^+ Q_0^+$).
   - **Step 5: Excitation Table**: Populate required flip-flop excitation inputs for each transition. The feedback engine checks each entry against target flip-flop characteristics.
   - **Step 6: K-Map Minimization**: Select each excitation input (e.g. $J_2, K_2, J_1, \dots$) from the dropdown and click **Open in K-Map** to minimize input combinational logic.
   - **Step 7: Circuit Synthesis**: Automatically generate the complete synchronous circuit netlist with interconnected flip-flops and clock distribution.
   - **Step 8: Simulation & Lockout**: Run multi-cycle clock simulations. Inspect the **Lockout / Deadlock Analysis** report: if unused states form closed dead-end cycles, apply the **Minimal Cost** or **All to Initial** automated repair to ensure 100% self-correcting behavior.

### Feedback Panel Display
- Pinpoints misidentified excitation requirements per row.
- Flags unused state cycles and explains deadlock risks upon power-on.
- Provides tiered hints explaining how to resolve state transitions without guessing.

### Keyboard Shortcuts
- `Alt + Right` / `Alt + Left`: Advance to next / previous wizard step.
- `Tab`: Cycle through excitation table input cells.
- `0`, `1`, `X`: Directly populate excitation cell values.

### Common Misconceptions Detected
- [Ignored Unused State Lockout / Deadlock (`ignored-lockout-state`)](misconception-catalog.md#ignored-unused-state-lockout-deadlock)
- [Confused Present State Q with Next State Q+ (`confused-q-and-qnext`)](misconception-catalog.md#confused-present-state-q-with-next-state-q)
- [Incorrect Flip-Flop Excitation Input Logic (`wrong-excitation-table`)](misconception-catalog.md#incorrect-flip-flop-excitation-input-logic)

---

## Module 7: Adaptive Practice Workbench (`practice`)

### Purpose
Autonomous, seed-based problem generation workbench providing multi-step practice exercises across all 6 core laboratory topics with continuous cognitive feedback and tiered hint ladders.

### Step-by-Step Usage
1. Select a practice topic: `Number Systems`, `Boolean Algebra`, `K-Map Simplification`, `Circuit Synthesis`, `Flip-Flop Analysis`, or `Sequential Design`.
2. Choose difficulty: `Easy` ($\star$), `Medium` ($\star\star$), or `Hard` ($\star\star\star$).
3. Click **New Problem** to generate a deterministic problem instance from a PRNG seed.
4. Work through the exercise steps sequentially. Enter answers into the input fields and click **Check Step**.
5. If unsure, click **Get Hint** to reveal Level 1 (Nudge). Click again if needed for Level 2 (Pointed) or Level 3 (Worked Step).
6. Upon completing all steps, review your attempt summary showing accuracy, hint usage, and diagnosed misconceptions.

---

## Module 8: Conceptual Diagnostic Quizzes (`quiz`)

### Purpose
Topic-based formative assessments comprising validated multiple-choice questions where every incorrect distractor maps to a specific cognitive misconception from the catalog.

### Step-by-Step Usage
1. Select a topic and difficulty level, then click **Start Quiz**.
2. Use the **Question Navigator** grid to jump between questions.
3. Select an option for each question. Unanswered questions are flagged with warning icons.
4. Click **Submit Quiz**. If unanswered questions remain, a confirmation modal alerts you before final grading.
5. In the **Quiz Review** screen, view your score, correct answers, detailed rationales, and diagnosed misconception descriptions for each incorrect choice.

---

## Module 9: Pre/Post Diagnostic Assessment (`prepost-test`)

### Purpose
Standardized instrument for empirical educational research evaluating student learning gains using parallel, counterbalanced diagnostic forms (Form A and Form B).

### Step-by-Step Usage
1. Enter the assigned researcher participant ID (e.g. `P042`).
2. The system automatically assigns Form A or Form B based on participant hash counterbalancing.
3. Complete all 20 multiple-choice questions across the 6 curriculum domains.
4. Click **Submit Assessment** to commit the test. Results are scored and logged locally with full timestamps.

---

## Module 10: System Usability Scale (SUS) (`sus-survey`)

### Purpose
Administers the standardized 10-item System Usability Scale (Brooke 1996) to collect subjective usability and learnability metrics for virtual lab evaluation.

### Step-by-Step Usage
1. Rate each of the 10 statements on a 5-point Likert scale from `1 - Strongly Disagree` to `5 - Strongly Agree`.
2. Odd items represent positive statements (e.g. *I think that I would like to use this system frequently*).
3. Even items represent negative statements (e.g. *I found the system unnecessarily complex*).
4. Click **Submit Usability Survey**. The system calculates the Brooke score ($0$ to $100$) and visualizes the benchmark grade ($A^+$ through $F$).

---

## Module 11: Teacher & Researcher Dashboard (`teacher-dashboard`)

### Purpose
Offline multi-student telemetry analysis suite allowing educators and researchers to import student session files, aggregate learning metrics, inspect misconception rankings, and compute pre/post inferential statistics.

### Step-by-Step Usage
1. Open the dashboard and import student logs using one of two methods:
   - Click **Use Device's Own Log** to analyze sessions completed on the local machine.
   - Click **Browse Files** or drag and drop multiple student `.csv` or `.json` telemetry exports into the drop zone.
2. The **Import Report** summarizes files read, events accepted, duplicates dropped, and malformed rows.
3. Navigate dashboard tabs:
   - **Overview**: Active students, total events, overall step correctness rate, and average hint usage.
   - **Module Analytics**: Per-module time-on-task, completion rates, and error distributions.
   - **Misconceptions**: Frequency ranking of diagnosed cognitive misconceptions across the student cohort.
   - **Pipelines**: Transition and drop-off analysis between combinational and sequential pipeline stages.
   - **Quizzes**: Formative quiz score distributions and distractor selection frequencies.
   - **Pre/Post Gains**: Evaluates paired student pre-test and post-test scores, computing average normalized Hake gain ($\langle g \rangle$), paired $t$-test statistic, $p$-value, and Cohen's $d$ effect size.
   - **Usability (SUS)**: Aggregated SUS scores, mean score with 95% confidence interval, and Sauro usability percentiles.
4. Export data for publication using toolbar buttons:
   - **Export Events CSV**: Clean RFC 4180 event dataset.
   - **Export Summaries CSV**: Aggregated session summaries.
   - **Export Misconceptions CSV**: Misconception frequency distribution table.
   - **Export Full Model JSON**: Complete aggregated analytics document.

---

## Phase 2 Architecture Modules (Future Work)

The following modules are registered in `MODULE_REGISTRY` as Phase 2 architectural slots and are explicitly not built in the current Phase 1 delivery:
- **Arithmetic Logic Unit (ALU)** (`alu`): Multi-function 4-bit and 8-bit arithmetic and logic processor slice.
- **Intel 8086 Microprocessor Architecture** (`8086-cpu`): Internal registers, EU/BIU pipelines, and 16-bit segmented memory simulation.
- **Programmable Interrupt Controller (8259A)** (`interrupt-controller`): Priority resolver, interrupt request mask registers, and vectoring sequences.

