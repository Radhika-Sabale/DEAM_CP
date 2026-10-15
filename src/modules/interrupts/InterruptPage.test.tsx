import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { InterruptPage } from './InterruptPage';
import { useProjectStore } from '../../store/projectStore';

describe('InterruptPage', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject();
  });

  it('renders page header, title, and initial controls', () => {
    render(<InterruptPage />);

    expect(screen.getByText(/8086 Interrupt Controller & Subsystem/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simulate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Practice' })).toBeInTheDocument();
  });

  it('switches between Simulate and Practice modes', () => {
    render(<InterruptPage />);

    const practiceBtn = screen.getByRole('button', { name: 'Practice' });
    fireEvent.click(practiceBtn);

    expect(screen.getByText(/Interrupt Adaptive Practice Workbench/i)).toBeInTheDocument();

    const simulateBtn = screen.getByRole('button', { name: 'Simulate' });
    fireEvent.click(simulateBtn);

    expect(screen.getByText(/Hardware Interrupt Scenario/i)).toBeInTheDocument();
    expect(screen.getByText(/Interrupt Lines & Priorities/i)).toBeInTheDocument();
  });

  it('selects a sample program and updates editor source', () => {
    render(<InterruptPage />);

    const select = screen.getByLabelText(/Sample:/i);
    fireEvent.change(select, { target: { value: 'software-int' } });

    // CodeEditor should receive the source code
    expect(screen.getByText(/INT 20H/i)).toBeInTheDocument();
  });

  it('renders IVT and hardware line status', () => {
    render(<InterruptPage />);

    expect(screen.getByText(/NMI Pin/i)).toBeInTheDocument();
    expect(screen.getByText(/INTR Pin/i)).toBeInTheDocument();
    expect(screen.getAllByText(/IF Flag/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/TF \(Trap\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/STI Shadow/i).length).toBeGreaterThanOrEqual(1);
  });
});
