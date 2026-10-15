import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ScenarioEditor } from './ScenarioEditor';
import type { InterruptScenario } from '../../engine/interrupts';

describe('ScenarioEditor', () => {
  const emptyScenario: InterruptScenario = { events: [] };

  it('renders empty scenario message', () => {
    render(
      <ScenarioEditor
        scenario={emptyScenario}
        onAddEvent={vi.fn()}
        onRemoveEvent={vi.fn()}
        onSetScenario={vi.fn()}
        onImportJson={vi.fn()}
        onExportJson={vi.fn()}
      />
    );

    expect(screen.getByText(/No external events scheduled/i)).toBeInTheDocument();
  });

  it('applies presets when clicked', () => {
    const onSetScenario = vi.fn();
    render(
      <ScenarioEditor
        scenario={emptyScenario}
        onAddEvent={vi.fn()}
        onRemoveEvent={vi.fn()}
        onSetScenario={onSetScenario}
        onImportJson={vi.fn()}
        onExportJson={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /NMI @ 10/i }));
    expect(onSetScenario).toHaveBeenCalledWith({
      events: [{ atTick: 10, kind: 'nmi' }],
    });

    fireEvent.click(screen.getByRole('button', { name: /INTR 8 @ 15/i }));
    expect(onSetScenario).toHaveBeenCalledWith({
      events: [{ atTick: 15, kind: 'intr', vector: 8 }],
    });
  });

  it('adds an event through the form', () => {
    const onAddEvent = vi.fn();
    render(
      <ScenarioEditor
        scenario={emptyScenario}
        onAddEvent={onAddEvent}
        onRemoveEvent={vi.fn()}
        onSetScenario={vi.fn()}
        onImportJson={vi.fn()}
        onExportJson={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/At Tick:/i), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText(/Vector:/i), { target: { value: '33' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Event/i }));

    expect(onAddEvent).toHaveBeenCalledWith({
      atTick: 25,
      kind: 'intr',
      vector: 33,
    });
  });

  it('renders events table and handles remove', () => {
    const scenario: InterruptScenario = {
      events: [
        { atTick: 10, kind: 'nmi' },
        { atTick: 20, kind: 'intr', vector: 8 },
      ],
    };
    const onRemoveEvent = vi.fn();

    render(
      <ScenarioEditor
        scenario={scenario}
        currentTick={15}
        onAddEvent={vi.fn()}
        onRemoveEvent={onRemoveEvent}
        onSetScenario={vi.fn()}
        onImportJson={vi.fn()}
        onExportJson={vi.fn()}
      />
    );

    expect(screen.getByText('Vector 2 (Fixed)')).toBeInTheDocument();
    expect(screen.getByText('Vector 8')).toBeInTheDocument();
    expect(screen.getByText('Past')).toBeInTheDocument();
    expect(screen.getByText('In 5 ticks')).toBeInTheDocument();

    const removeButtons = screen.getAllByRole('button', { name: /Remove event at tick/i });
    const removeBtn = removeButtons[0];
    expect(removeBtn).toBeDefined();
    if (removeBtn) fireEvent.click(removeBtn);
    expect(onRemoveEvent).toHaveBeenCalledWith(0);
  });
});
