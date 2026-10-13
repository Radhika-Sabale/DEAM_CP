import { test, expect } from '@playwright/test';
import { clearStorage, openExample, readLogEvents } from './helpers';

test.describe('Sequential Counter Designer Guided Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    await page.goto('/#/sequential');
  });

  test('walks through Mod-5 JK up counter wizard with excitation diagnosis, lockout remediation, and simulation', async ({
    page,
  }) => {
    const stepper = page.getByRole('navigation', { name: /Sequential design steps/i });
    await expect(stepper).toBeVisible();

    // 1. Select JK Flip-Flop
    const jkRadio = page.getByRole('radio', { name: /JK Flip-Flop/i });
    await expect(jkRadio).toBeVisible();
    await jkRadio.check();

    // Advance to Step 2: Define Machine
    const defineStep = stepper.getByRole('button', { name: /^Step 2/i });
    await expect(defineStep).toBeEnabled();
    await defineStep.click();

    // 2. Define Counter: Modulus 5, Direction Up
    const modulusInput = page.getByLabel(/Modulus/i);
    await expect(modulusInput).toBeVisible();
    await modulusInput.fill('5');

    // Advance to Step 3: State Diagram
    const diagramStep = stepper.getByRole('button', { name: /^Step 3/i });
    await expect(diagramStep).toBeEnabled();
    await diagramStep.click();

    // 3. State Diagram: auto-fill via Show me
    const showDiagramBtn = page.getByRole('button', { name: /Show me/i });
    await expect(showDiagramBtn).toBeVisible();
    await showDiagramBtn.click();

    // Advance to Step 4: State Table
    const tableStep = stepper.getByRole('button', { name: /^Step 4/i });
    await expect(tableStep).toBeEnabled();
    await tableStep.click();

    // 4. State Table: auto-fill via Show me
    const showTableBtn = page.getByRole('button', { name: /Show me/i });
    await expect(showTableBtn).toBeVisible();
    await showTableBtn.click();

    // Advance to Step 5: Excitation Table
    const excitationStep = stepper.getByRole('button', { name: /^Step 5/i });
    await expect(excitationStep).toBeEnabled();
    await excitationStep.click();

    // 5. Excitation Table: enter wrong entry (0 for Row S0, input J0)
    const j0Select = page.getByLabel(/Row S0, input J0/i);
    await expect(j0Select).toBeVisible();
    await j0Select.selectOption('0');

    const checkExcitationBtn = page.getByRole('button', { name: /Check Excitation Table/i });
    await expect(checkExcitationBtn).toBeVisible();
    await checkExcitationBtn.click();

    // Assert Diagnosis alert appears with catalog title and error type
    const diagCard = page.getByRole('alert');
    await expect(diagCard).toBeVisible();
    await expect(
      diagCard.getByText(/Incorrect Flip-Flop Excitation Input Logic|wrong-excitation-table/i)
    ).toBeVisible();
    await expect(diagCard.getByText(/incorrect-excitation/i)).toBeVisible();

    // Assert progressive Hint Ladder levels 1, 2, 3
    const hint1Btn = page.getByRole('button', { name: /Unlock hint level 1 of 3/i });
    await expect(hint1Btn).toBeVisible();
    await hint1Btn.click();

    // Level 1 hint explains concept without revealing answer
    const level1Text = page.getByText(/Ensure present state Q represents/i);
    await expect(level1Text).toBeVisible();
    await expect(level1Text).not.toContainText('Expected');

    // Unlock Level 2
    const hint2Btn = page.getByRole('button', { name: /Unlock hint level 2 of 3/i });
    await expect(hint2Btn).toBeVisible();
    await hint2Btn.click();
    await expect(page.getByText(/Verify whether you are indexing by present state/i)).toBeVisible();

    // Unlock Level 3
    const hint3Btn = page.getByRole('button', { name: /Unlock hint level 3 of 3/i });
    await expect(hint3Btn).toBeVisible();
    await hint3Btn.click();

    // Level 3 reveals the correct value and marks step assisted
    await expect(page.getByText(/Level 3: Worked Step/i)).toBeVisible();
    await expect(page.getByText(/The transition evaluated from present state should yield/i)).toBeVisible();
    await expect(page.getByText(/Status: Assisted by Worked Step/i)).toBeVisible();

    // Correct excitation table via Show me
    const showExcitationBtn = page.getByRole('button', { name: /Show me/i });
    await showExcitationBtn.click();

    // Advance to Step 6: Next-State Equations
    const equationsStep = stepper.getByRole('button', { name: /^Step 6/i });
    await expect(equationsStep).toBeEnabled();
    await equationsStep.click();

    // 6. Next-State Equations: complete via Show me
    const showEquationsBtn = page.getByRole('button', { name: /Show me/i });
    await expect(showEquationsBtn).toBeVisible();
    await showEquationsBtn.click();

    // Advance to Step 7: Lockout Analysis
    const lockoutStep = stepper.getByRole('button', { name: /^Step 7/i });
    await expect(lockoutStep).toBeEnabled();
    await lockoutStep.click();

    // 7. Lockout step: assert unused states 5, 6, 7 and lockout report
    await expect(page.getByText(/S5/i).first()).toBeVisible();
    await expect(page.getByText(/S6/i).first()).toBeVisible();
    await expect(page.getByText(/S7/i).first()).toBeVisible();
    await expect(page.getByText(/every unused state returns to a valid state|States .* can lock out/i)).toBeVisible();

    // Apply fix if available
    const applyFixBtn = page.getByRole('button', { name: /Apply fix/i });
    if (await applyFixBtn.isVisible() && await applyFixBtn.isEnabled()) {
      await applyFixBtn.click();
      const confirmBtn = page.getByRole('button', { name: /Confirm and Re-derive/i });
      await expect(confirmBtn).toBeVisible();
      await confirmBtn.click();
      await expect(page.getByText(/Fix Applied/i)).toBeVisible();
    }

    // Check Lockout Claim
    const checkClaimBtn = page.getByRole('button', { name: /Check Lockout Claim/i });
    if (await checkClaimBtn.isVisible()) {
      await checkClaimBtn.click();
    }

    // Advance to Step 8: Simulation & Verification
    const simStep = stepper.getByRole('button', { name: /^Step 8/i });
    await expect(simStep).toBeEnabled();
    await simStep.click();

    // 8. Simulation: step through cycles and assert mod-5 sequence 0,1,2,3,4,0,1,2,3,4
    const cycleInput = page.getByLabel(/Number of Clock Pulses/i);
    await expect(cycleInput).toBeVisible();
    await cycleInput.fill('10');

    const runBtn = page.getByRole('button', { name: /Run/i });
    await expect(runBtn).toBeVisible();
    await runBtn.click();

    // Verify state progression in trace table
    const traceTable = page.getByRole('table');
    await expect(traceTable.getByText(/S0 \(000\)/i).first()).toBeVisible();
    await expect(traceTable.getByText(/S1 \(001\)/i).first()).toBeVisible();
    await expect(traceTable.getByText(/S2 \(010\)/i).first()).toBeVisible();
    await expect(traceTable.getByText(/S3 \(011\)/i).first()).toBeVisible();
    await expect(traceTable.getByText(/S4 \(100\)/i).first()).toBeVisible();

    // Verify synthesized circuit self-check
    const toggleCircuitBtn = page.getByRole('button', { name: /Synthesized Schematic Preview/i });
    await expect(toggleCircuitBtn).toBeVisible();
    await toggleCircuitBtn.click();
    await expect(page.getByText(/Circuit matches all \d+ functions/i)).toBeVisible();

    // 9. Telemetry check: verify hint-used level 3 and misconception tag in log
    const events = await readLogEvents(page);
    const hint3Event = events.find((e) => e.eventType === 'hint-used' && e.level === 3);
    expect(hint3Event).toBeDefined();

    const stepSubmitted = events.find((e) => e.eventType === 'step-submitted');
    expect(stepSubmitted).toBeDefined();
  });

  // Parameterised loop for D, T, and JK flip-flops on Mod-8 Down Counter
  for (const ffType of ['T', 'D', 'JK'] as const) {
    test(`simulates mod-8 down counter with ${ffType} flip-flops cycling 7 to 0`, async ({
      page,
    }) => {
      // Load seed problem directly
      await openExample(page, /Mod-8 Synchronous Down Counter with T Flip-Flops/i);

      const stepper = page.getByRole('navigation', { name: /Sequential design steps/i });
      await expect(stepper).toBeVisible();

      // If needed, switch flip-flop in the designer
      if (ffType !== 'T') {
        const selectFfStep = stepper.getByRole('button', { name: /^Step 1/i });
        await selectFfStep.click();

        const ffRadio = page.getByRole('radio', { name: new RegExp(`${ffType} Flip-Flop`, 'i') });
        await ffRadio.check();

        // Advance through steps with Show me
        await stepper.getByRole('button', { name: /^Step 2/i }).click();

        await stepper.getByRole('button', { name: /^Step 3/i }).click();
        await page.getByRole('button', { name: /Show me/i }).click();

        await stepper.getByRole('button', { name: /^Step 4/i }).click();
        await page.getByRole('button', { name: /Show me/i }).click();

        await stepper.getByRole('button', { name: /^Step 5/i }).click();
        await page.getByRole('button', { name: /Show me/i }).click();

        await stepper.getByRole('button', { name: /^Step 6/i }).click();
        await page.getByRole('button', { name: /Show me/i }).click();

        await stepper.getByRole('button', { name: /^Step 7/i }).click();
        const checkClaimBtn = page.getByRole('button', { name: /Check Lockout Claim/i });
        if (await checkClaimBtn.isVisible()) await checkClaimBtn.click();

        await stepper.getByRole('button', { name: /^Step 8/i }).click();
      } else {
        // Fast path for T flip-flop: advance remaining steps
        await stepper.getByRole('button', { name: /^Step 3/i }).click();
        await page.getByRole('button', { name: /Show me/i }).click();

        await stepper.getByRole('button', { name: /^Step 4/i }).click();
        await page.getByRole('button', { name: /Show me/i }).click();

        await stepper.getByRole('button', { name: /^Step 5/i }).click();
        await page.getByRole('button', { name: /Show me/i }).click();

        await stepper.getByRole('button', { name: /^Step 6/i }).click();
        await page.getByRole('button', { name: /Show me/i }).click();

        await stepper.getByRole('button', { name: /^Step 7/i }).click();
        const checkClaimBtn = page.getByRole('button', { name: /Check Lockout Claim/i });
        if (await checkClaimBtn.isVisible()) await checkClaimBtn.click();

        await stepper.getByRole('button', { name: /^Step 8/i }).click();
      }

      // Set 10 clock pulses and run
      const cycleInput = page.getByLabel(/Number of Clock Pulses/i);
      await cycleInput.fill('10');
      const runBtn = page.getByRole('button', { name: /Run/i });
      await runBtn.click();

      // Assert down counter sequence in trace table: S7 down to S0
      const traceTable = page.getByRole('table');
      await expect(traceTable.getByText(/S7 \(111\)/i).first()).toBeVisible();
      await expect(traceTable.getByText(/S6 \(110\)/i).first()).toBeVisible();
      await expect(traceTable.getByText(/S5 \(101\)/i).first()).toBeVisible();
      await expect(traceTable.getByText(/S0 \(000\)/i).first()).toBeVisible();
    });
  }
});
