/**
 * @file StudentModePanel.test.tsx
 * Integration tests for StudentModePanel:
 * - 3-cell group triggers 'grouped-non-power-of-two' diagnosis
 * - Edge cells needing wrap trigger 'forgot-wraparound-grouping' diagnosis
 * - Group covering zero triggers 'covered-a-zero' diagnosis
 * - Valid maximal group is accepted and calls onAddGroup
 * - Final correct set is accepted
 * - Answer-trap banner appears when final answer is correct after earlier wrong group
 * - "Show correct groups" logs assisted Level 3 event
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useLogStore } from '../../store/logStore';
import { solveSOP } from '../../engine/kmap/solver';
import { StudentModePanel } from './StudentModePanel';

describe('StudentModePanel', () => {
  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
    useLogStore.getState().clearLog();
  });

  it('diagnoses a 3-cell group with grouped-non-power-of-two error', () => {
    const sol = solveSOP(4, [0, 1, 2, 3]);
    const onAddGroup = vi.fn();

    render(
      <StudentModePanel
        variableCount={4}
        variableNames={['A', 'B', 'C', 'D']}
        minterms={[0, 1, 2, 3]}
        dontCares={[]}
        selectedCells={[0, 1, 2]} // 3 cells -> non-power-of-two
        onClearSelection={vi.fn()}
        studentGroups={[]}
        onAddGroup={onAddGroup}
        onRemoveGroup={vi.fn()}
        onResetStudentGroups={vi.fn()}
        onSetHighlight={vi.fn()}
        onRevealSolution={vi.fn()}
        solverSolution={sol.ok ? sol.solution : null}
        mode="SOP"
        onModeChange={vi.fn()}
      />
    );

    const addBtn = screen.getByRole('button', { name: /Add Group \(3 cells\)/i });
    fireEvent.click(addBtn);

    expect(onAddGroup).not.toHaveBeenCalled();
    // Diagnosis card shows power-of-two diagnosis
    expect(screen.getByText(/Grouped Non-Power-of-Two/i)).toBeInTheDocument();
  });

  it('diagnoses a group covering a zero with covered-a-zero error', () => {
    // Only cells 0 and 1 are 1s. Cell 2 is 0.
    const sol = solveSOP(4, [0, 1]);
    const onAddGroup = vi.fn();

    render(
      <StudentModePanel
        variableCount={4}
        variableNames={['A', 'B', 'C', 'D']}
        minterms={[0, 1]}
        dontCares={[]}
        selectedCells={[0, 2]} // Cell 2 is 0
        onClearSelection={vi.fn()}
        studentGroups={[]}
        onAddGroup={onAddGroup}
        onRemoveGroup={vi.fn()}
        onResetStudentGroups={vi.fn()}
        onSetHighlight={vi.fn()}
        onRevealSolution={vi.fn()}
        solverSolution={sol.ok ? sol.solution : null}
        mode="SOP"
        onModeChange={vi.fn()}
      />
    );

    const addBtn = screen.getByRole('button', { name: /Add Group \(2 cells\)/i });
    fireEvent.click(addBtn);

    expect(onAddGroup).not.toHaveBeenCalled();
    expect(screen.getByText(/Covered a Zero/i)).toBeInTheDocument();
  });

  it('diagnoses non-maximal edge cells needing wrap with forgot-wraparound-grouping', () => {
    // Four corners: m(0, 2, 8, 10). Selecting only m(0, 2) is a 2-cell group that could be 4-cell with wrap.
    const sol = solveSOP(4, [0, 2, 8, 10]);
    const onAddGroup = vi.fn();

    render(
      <StudentModePanel
        variableCount={4}
        variableNames={['A', 'B', 'C', 'D']}
        minterms={[0, 2, 8, 10]}
        dontCares={[]}
        selectedCells={[0, 2]} // Could wrap with 8, 10
        onClearSelection={vi.fn()}
        studentGroups={[]}
        onAddGroup={onAddGroup}
        onRemoveGroup={vi.fn()}
        onResetStudentGroups={vi.fn()}
        onSetHighlight={vi.fn()}
        onRevealSolution={vi.fn()}
        solverSolution={sol.ok ? sol.solution : null}
        mode="SOP"
        onModeChange={vi.fn()}
      />
    );

    const addBtn = screen.getByRole('button', { name: /Add Group \(2 cells\)/i });
    fireEvent.click(addBtn);

    expect(onAddGroup).not.toHaveBeenCalled();
    // Verify wrap-around diagnosis or larger group reminder
    expect(screen.getByText(/wraparound|wrap-around|group can be doubled/i)).toBeInTheDocument();
  });

  it('accepts a valid maximal prime group and calls onAddGroup', () => {
    const sol = solveSOP(4, [0, 1, 2, 3]);
    const onAddGroup = vi.fn();
    const onClearSelection = vi.fn();

    render(
      <StudentModePanel
        variableCount={4}
        variableNames={['A', 'B', 'C', 'D']}
        minterms={[0, 1, 2, 3]}
        dontCares={[]}
        selectedCells={[0, 1, 2, 3]} // Valid row group
        onClearSelection={onClearSelection}
        studentGroups={[]}
        onAddGroup={onAddGroup}
        onRemoveGroup={vi.fn()}
        onResetStudentGroups={vi.fn()}
        onSetHighlight={vi.fn()}
        onRevealSolution={vi.fn()}
        solverSolution={sol.ok ? sol.solution : null}
        mode="SOP"
        onModeChange={vi.fn()}
      />
    );

    const addBtn = screen.getByRole('button', { name: /Add Group \(4 cells\)/i });
    fireEvent.click(addBtn);

    expect(onAddGroup).toHaveBeenCalledWith([0, 1, 2, 3]);
    expect(onClearSelection).toHaveBeenCalled();
  });

  it('accepts a final complete set of groups on Check My Solution', () => {
    const sol = solveSOP(4, [0, 1, 2, 3]);

    render(
      <StudentModePanel
        variableCount={4}
        variableNames={['A', 'B', 'C', 'D']}
        minterms={[0, 1, 2, 3]}
        dontCares={[]}
        selectedCells={[]}
        onClearSelection={vi.fn()}
        studentGroups={[[0, 1, 2, 3]]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onResetStudentGroups={vi.fn()}
        onSetHighlight={vi.fn()}
        onRevealSolution={vi.fn()}
        solverSolution={sol.ok ? sol.solution : null}
        mode="SOP"
        onModeChange={vi.fn()}
      />
    );

    const checkBtn = screen.getByRole('button', { name: /Check My Solution/i });
    fireEvent.click(checkBtn);

    expect(screen.getByText(/Valid & Minimal Solution!/i)).toBeInTheDocument();
  });

  it('shows AnswerTrapBanner when final answer is correct after an earlier wrong group attempt', () => {
    const sol = solveSOP(4, [0, 1, 2, 3]);

    const { rerender } = render(
      <StudentModePanel
        variableCount={4}
        variableNames={['A', 'B', 'C', 'D']}
        minterms={[0, 1, 2, 3]}
        dontCares={[]}
        selectedCells={[0, 1, 2]} // wrong 3-cell group
        onClearSelection={vi.fn()}
        studentGroups={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onResetStudentGroups={vi.fn()}
        onSetHighlight={vi.fn()}
        onRevealSolution={vi.fn()}
        solverSolution={sol.ok ? sol.solution : null}
        mode="SOP"
        onModeChange={vi.fn()}
      />
    );

    // Submit wrong group first
    const addBtn = screen.getByRole('button', { name: /Add Group \(3 cells\)/i });
    fireEvent.click(addBtn);

    // Now re-render with correct group [0, 1, 2, 3] in studentGroups
    rerender(
      <StudentModePanel
        variableCount={4}
        variableNames={['A', 'B', 'C', 'D']}
        minterms={[0, 1, 2, 3]}
        dontCares={[]}
        selectedCells={[]}
        onClearSelection={vi.fn()}
        studentGroups={[[0, 1, 2, 3]]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onResetStudentGroups={vi.fn()}
        onSetHighlight={vi.fn()}
        onRevealSolution={vi.fn()}
        solverSolution={sol.ok ? sol.solution : null}
        mode="SOP"
        onModeChange={vi.fn()}
      />
    );

    // Check solution
    const checkBtn = screen.getByRole('button', { name: /Check My Solution/i });
    fireEvent.click(checkBtn);

    // Verify AnswerTrapBanner is displayed
    const trapBanner = screen.getByRole('region', { name: /Pedagogical reasoning alert/i });
    expect(trapBanner).toBeInTheDocument();
    expect(screen.getByText(/Your final answer is right, but/i)).toBeInTheDocument();
  });

  it('logs an assisted hint event when Show Correct Groups is clicked', () => {
    const onRevealSolution = vi.fn();
    const sol = solveSOP(4, [0, 1]);

    render(
      <StudentModePanel
        variableCount={4}
        variableNames={['A', 'B', 'C', 'D']}
        minterms={[0, 1]}
        dontCares={[]}
        selectedCells={[]}
        onClearSelection={vi.fn()}
        studentGroups={[]}
        onAddGroup={vi.fn()}
        onRemoveGroup={vi.fn()}
        onResetStudentGroups={vi.fn()}
        onSetHighlight={vi.fn()}
        onRevealSolution={onRevealSolution}
        solverSolution={sol.ok ? sol.solution : null}
        mode="SOP"
        onModeChange={vi.fn()}
      />
    );

    const revealBtn = screen.getByRole('button', { name: /Show Correct Groups \(Assisted\)/i });
    fireEvent.click(revealBtn);

    expect(onRevealSolution).toHaveBeenCalled();

    // Verify telemetry event was recorded with level 3
    const events = useLogStore.getState().events;
    const assistedLog = events.find(
      (e) => e.eventType === 'hint-used' && e.stepId === 'reveal-solution' && e.level === 3
    );
    expect(assistedLog).toBeDefined();
  });
});
