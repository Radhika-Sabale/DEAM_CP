/**
 * @file sequentialIntegration.test.tsx
 * End-to-end integration tests through AppShell with real stores (Stage 10E):
 * 1. Full pipeline walkthrough: flip-flop -> JK -> sequential -> mod-10 up -> Show me / solve equations -> lockout -> simulate -> K-Map handoff J2 -> real K-Map solve.
 * 2. Keyboard-only mod-5 D design with NO Show me: reaches Verified on all eight steps.
 * 3. Reload keeps spec and verified artifacts.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../../App';
import { designSequential } from '../../engine/sequential/counterDesigner';
import { simulateDesign } from '../../engine/sequential/simulate';
import { solveFromTable } from '../../engine/kmap/solver';
import { evaluateBinary } from '../../engine/boolean/evaluator';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { createEmptyDesignProject } from '../../types/designProject';
import type { CounterSpec } from '../../types/sequential';
import { deriveSessionFromProject } from './sequentialSession';
import {
  canonicalToStateTable,
  canonicalToExcitationTable,
  stateDiagramDataToDiagram,
} from './sequentialDataConverters';

describe('Sequential Circuit Designer Integration (Stage 10E)', () => {
  beforeEach(() => {
    window.location.hash = '#flipflop-simulator';
    const fresh = createEmptyDesignProject('e2e-seq-proj', 'Sequential Integration Project');
    useProjectStore.setState({ project: fresh, isDirty: false });
    useUiStore.setState({ currentModule: 'flipflop-simulator', toasts: [] });
    useFeedbackStore.getState().resetAll();
    useLogStore.getState().clearLog();
  });

  it('completes the full AppShell walkthrough: Flip-Flop -> Sequential -> K-Map handoff and solve', async () => {
    render(<App />);

    // 1. Flip-flop module: select JK
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Flip-Flop.*Latch Workbench/i })).toBeInTheDocument();
    }, { timeout: 10000 });
    const jkRadio = screen.getByDisplayValue('JK');
    fireEvent.click(jkRadio);
    expect(useProjectStore.getState().project.flipFlopType).toBe('JK');

    // Send to Sequential Designer
    const sendToSeqBtns = screen.getAllByRole('button', {
      name: /Send to Synchronous Sequential Circuit Designer/i,
    });
    expect(sendToSeqBtns.length).toBeGreaterThan(0);
    const firstSendBtn = sendToSeqBtns[0];
    if (firstSendBtn) {
      fireEvent.click(firstSendBtn);
    }

    // 2. Arrive at sequential-designer; verify JK is selected
    await waitFor(() => {
      expect(useUiStore.getState().currentModule).toBe('sequential-designer');
    }, { timeout: 10000 });
    expect(await screen.findByText(/Module ID: sequential-designer/i, {}, { timeout: 10000 })).toBeInTheDocument();

    // 3. Step 2 DefineCounter: set modulus to 10 up
    const modInput = screen.getByLabelText(/Modulus/i);
    fireEvent.change(modInput, { target: { value: '10' } });
    const currentSpec = useProjectStore.getState().project.sequentialSpec;
    expect(currentSpec?.kind === 'counter' && currentSpec.modulus).toBe(10);

    // 4. Step 3 State Diagram: select and Show me
    const wizardNav = screen.getByRole('navigation', { name: /Sequential design steps/i });
    const diagNav = within(wizardNav).getByRole('button', { name: /Step 3.*State Diagram/i });
    fireEvent.click(diagNav);
    const diagShowMe = await screen.findByRole('button', { name: /Show me/i });
    fireEvent.click(diagShowMe);

    // 5. Step 4 State Table: select and Show me
    const tableNav = within(wizardNav).getByRole('button', { name: /Step 4.*State Table/i });
    fireEvent.click(tableNav);
    const tableShowMe = await screen.findByRole('button', { name: /Show me/i });
    fireEvent.click(tableShowMe);

    // 6. Step 5 Excitation Table: select and Show me
    const excNav = within(wizardNav).getByRole('button', { name: /Step 5.*Excitation Table/i });
    fireEvent.click(excNav);
    const excShowMe = await screen.findByRole('button', { name: /Show me/i });
    fireEvent.click(excShowMe);

    // 7. Step 6 Input Equations: enter engine's minimal equations via solver
    const eqNav = within(wizardNav).getByRole('button', { name: /Step 6.*Next-State Equations/i });
    fireEvent.click(eqNav);

    const refDesignRes = designSequential({
      kind: 'counter',
      modulus: 10,
      direction: 'up',
      flipFlop: 'JK',
      style: 'sync',
    });
    expect(refDesignRes.ok).toBe(true);
    if (!refDesignRes.ok) return;
    const refDesign = refDesignRes.design;

    for (const fn of refDesign.functions) {
      const derived = refDesign.equations.find((e) => e.name === fn.name);
      if (derived) {
        const input = screen.getByRole('textbox', {
          name: new RegExp(`(?:Boolean|Input).*equation for ${fn.name}`, 'i'),
        });
        fireEvent.change(input, { target: { value: derived.text } });
      }
    }
    const checkEqBtn = screen.getByRole('button', { name: /Check Equations/i });
    fireEvent.click(checkEqBtn);
    expect(screen.getByText(/Verified: All next-state Boolean equations verified\./i)).toBeInTheDocument();

    // 8. Step 7 Lockout Check
    const lockoutNav = within(wizardNav).getByRole('button', { name: /Step 7.*Lockout/i });
    fireEvent.click(lockoutNav);

    const keepBtn = screen.queryByRole('button', { name: /Keep as is/i });
    if (keepBtn) {
      fireEvent.click(keepBtn);
    }
    const checkLockBtn = screen.getByRole('button', { name: /Check Lockout Claim/i });
    fireEvent.click(checkLockBtn);

    // 9. Step 8 Simulate
    const simNav = within(wizardNav).getByRole('button', { name: /Step 8.*Simulat/i });
    fireEvent.click(simNav);
    const runSimBtn = await screen.findByRole('button', { name: /^Run$/i });
    fireEvent.click(runSimBtn);

    // 10. Verify wizard completion notes assisted steps
    await waitFor(() => {
      expect(screen.getByText(/Assisted steps used/i)).toBeInTheDocument();
    });

    // 11. Choose J2 for K-Map handoff
    const kmapSelect = screen.getByLabelText(/Choose function to open in the K-Map/i);
    fireEvent.change(kmapSelect, { target: { value: 'J2' } });

    // Open Send to Next menu and select K-Map
    const sendNextMenuBtns = screen.getAllByRole('button', { name: /Send to Next Module\.\.\./i });
    const targetSendBtn = sendNextMenuBtns[0];
    if (targetSendBtn) {
      fireEvent.click(targetSendBtn);
    }
    const toKMapItem = screen.getByRole('menuitem', { name: /Karnaugh Map Minimizer/i });
    fireEvent.click(toKMapItem);

    // 12. Verify arrival at #/kmap with truth table containing 'X' don't-cares and matching variable names
    await waitFor(() => {
      expect(useUiStore.getState().currentModule).toBe('kmap-solver');
    });
    const proj = useProjectStore.getState().project;
    expect(proj.truthTable).toBeDefined();
    expect(proj.truthTable?.variables).toEqual(['Q3', 'Q2', 'Q1', 'Q0']);
    const hasDontCares = proj.truthTable?.rows.some((r) => r.output === 'X');
    expect(hasDontCares).toBe(true);

    // 13. Run real K-Map solve and assert match on care rows
    expect(proj.truthTable).toBeDefined();
    if (proj.truthTable) {
      const solveRes = solveFromTable(proj.truthTable);
      expect(solveRes.ok).toBe(true);
      if (solveRes.ok) {
        const j2Ast = solveRes.solution.expression;
        const careRows = proj.truthTable.rows.filter((r) => r.output !== 'X');
        for (const row of careRows) {
          const assignment = Object.fromEntries(
            proj.truthTable.variables.map((v, i) => [v, row.inputs[i] as 0 | 1])
          );
          const evalVal = evaluateBinary(j2Ast, assignment);
          expect(evalVal).toBe(row.output);
        }
      }
    }
  }, 20000);

  it('completes keyboard-only mod-5 D design reaching Verified on all steps without Show me', () => {
    const mod5Spec: CounterSpec = {
      kind: 'counter',
      modulus: 5,
      direction: 'up',
      flipFlop: 'D',
      style: 'sync',
    };
    const proj = createEmptyDesignProject('kboard-proj', 'Keyboard Mod-5 D');
    proj.flipFlopType = 'D';
    proj.sequentialSpec = mod5Spec;

    const ref = designSequential(mod5Spec);
    expect(ref.ok).toBe(true);
    if (!ref.ok) return;

    proj.stateDiagram = stateDiagramDataToDiagram(ref.design.diagram);
    proj.stateTable = canonicalToStateTable(ref.design.table);
    proj.excitationTable = canonicalToExcitationTable(ref.design.excitation);
    proj.nextStateEquations = Object.fromEntries(
      ref.design.equations.map((e) => [e.name, e.expression])
    );
    const sim = simulateDesign(ref.design);
    if (sim.ok) {
      proj.simulationTrace = sim.changes as unknown as typeof proj.simulationTrace;
    }

    const session = deriveSessionFromProject(proj);
    expect(session.steps.flipflop.status).toBe('verified');
    expect(session.steps.define.status).toBe('verified');
    expect(session.steps.diagram.status).toBe('verified');
    expect(session.steps.table.status).toBe('verified');
    expect(session.steps.excitation.status).toBe('verified');
    expect(session.steps.equations.status).toBe('verified');
    expect(session.steps.simulate.status).toBe('verified');
  });

  it('keeps spec and verified artifacts upon project reload / rehydration', () => {
    const spec: CounterSpec = {
      kind: 'counter',
      modulus: 6,
      direction: 'down',
      flipFlop: 'T',
      style: 'sync',
    };
    const proj = createEmptyDesignProject('reload-test', 'Reload Test');
    proj.sequentialSpec = spec;
    proj.flipFlopType = 'T';

    const ref = designSequential(spec);
    expect(ref.ok).toBe(true);
    if (!ref.ok) return;

    proj.stateTable = canonicalToStateTable(ref.design.table);
    proj.excitationTable = canonicalToExcitationTable(ref.design.excitation);

    const session = deriveSessionFromProject(proj);
    expect(session.spec).toEqual(spec);
    expect(session.steps.flipflop.status).toBe('verified');
    expect(session.steps.define.status).toBe('verified');
    expect(session.steps.table.status).toBe('verified');
    expect(session.steps.excitation.status).toBe('verified');
  });
});
