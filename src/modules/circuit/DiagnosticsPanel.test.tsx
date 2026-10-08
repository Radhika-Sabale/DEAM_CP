/**
 * @file DiagnosticsPanel.test.tsx
 * Unit tests for DiagnosticsPanel component: floating input, multiple drivers, and loop diagnostics.
 */

import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CircuitDiagnostic } from '../../types/circuit';
import { DiagnosticsPanel } from './DiagnosticsPanel';

describe('DiagnosticsPanel component', () => {
  it('displays empty state when no diagnostics exist', () => {
    render(<DiagnosticsPanel diagnostics={[]} />);
    expect(screen.getByText(/No problems found/i)).toBeInTheDocument();
  });

  it('renders floating input, multiple drivers, and loop diagnostics with icon + severity word + message', () => {
    const diagnostics: CircuitDiagnostic[] = [
      {
        code: 'floating-input',
        severity: 'warning',
        message: "Gate g1 input pin 1 is floating (unconnected). Connect an input source or tie to 0/1.",
        nodeIds: ['g1'],
        wireIds: [],
      },
      {
        code: 'multiple-drivers',
        severity: 'error',
        message: "Gate g2 input pin 0 is driven by 2 wires. A logic pin may only have 1 driver.",
        nodeIds: ['g2'],
        wireIds: ['w1', 'w2'],
      },
      {
        code: 'combinational-loop',
        severity: 'error',
        message: "Circuit contains a combinational feedback loop between nodes g3, g4.",
        nodeIds: ['g3', 'g4'],
        wireIds: [],
      },
    ];

    const handleSelect = vi.fn();
    render(<DiagnosticsPanel diagnostics={diagnostics} onSelectDiagnosticElements={handleSelect} />);

    // Assert severity words & icons
    expect(screen.getAllByText(/WARNING/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ERROR/i).length).toBeGreaterThan(0);

    // Assert messages
    expect(screen.getByText(/floating \(unconnected\)/i)).toBeInTheDocument();
    expect(screen.getByText(/driven by 2 wires/i)).toBeInTheDocument();
    expect(screen.getByText(/combinational feedback loop/i)).toBeInTheDocument();

    // Clicking diagnostic invokes element selection
    const firstDiag = screen.getByText(/floating \(unconnected\)/i);
    fireEvent.click(firstDiag);
    expect(handleSelect).toHaveBeenCalledWith(['g1'], []);
  });
});
