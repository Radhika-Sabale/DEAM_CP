/**
 * @file StateDiagramView.test.tsx
 * Tests for StateDiagramView: SVG title/desc, transition table accessibility alternative, and text labels.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { StateDiagramData } from '../../types/sequential';
import { StateDiagramView } from './StateDiagramView';

describe('StateDiagramView component', () => {
  const sampleDiagram: StateDiagramData = {
    machineKind: 'mealy',
    stateBits: 2,
    initialStateCode: 0,
    nodes: [
      { id: 's0', code: 0, name: 'S0', binaryCode: '00', isInitial: true },
      { id: 's1', code: 1, name: 'S1', binaryCode: '01', isInitial: false },
    ],
    edges: [
      {
        id: 'e0',
        fromCode: 0,
        toCode: 1,
        label: '1 / 0',
        conditions: [{ inputValue: 1, mealyOutput: 0 }],
        isSelfLoop: false,
      },
      {
        id: 'e1',
        fromCode: 1,
        toCode: 0,
        label: '0 / 1',
        conditions: [{ inputValue: 0, mealyOutput: 1 }],
        isSelfLoop: false,
      },
    ],
  };

  it('renders SVG with title, desc, and initial state marker text "start"', () => {
    render(<StateDiagramView diagram={sampleDiagram} />);

    expect(
      screen.getByText('Finite State Machine Transition Diagram')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Circular layout of 2 states and 2 directed transitions/i)
    ).toBeInTheDocument();
    expect(screen.getByText('start')).toBeInTheDocument();
  });

  it('renders text labels on edges without relying on color alone', () => {
    render(<StateDiagramView diagram={sampleDiagram} />);

    expect(screen.getByText('1 / 0')).toBeInTheDocument();
    expect(screen.getByText('0 / 1')).toBeInTheDocument();
  });

  it('provides a collapsible transitions table listing every edge for accessibility', () => {
    render(<StateDiagramView diagram={sampleDiagram} />);

    const toggleBtn = screen.getByRole('button', {
      name: /Show Accessible Transition Table/i,
    });
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);

    const table = screen.getByRole('table', {
      name: /Accessible State Transitions Table/i,
    });
    expect(table).toBeInTheDocument();

    // Headers with scope="col"
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(4);
    for (const h of headers) {
      expect(h).toHaveAttribute('scope', 'col');
    }

    // Both edges listed in table
    expect(screen.getAllByText('S0 (00)')).toHaveLength(2);
    expect(screen.getAllByText('S1 (01)')).toHaveLength(2);
  });
});
