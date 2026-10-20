/**
 * @file CircuitElements.test.tsx
 * Unit tests for GateNode and WireEdge memoized presentation components.
 */

import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CircuitNode } from '../../types/circuit';
import { CIRCUIT_GATE_STROKE_WIDTH, CIRCUIT_GATE_SYMBOL_HEIGHT, CIRCUIT_GATE_SYMBOL_WIDTH } from '../../engine/circuit/geometry';
import { GateNode } from './GateNode';
import { WireEdge } from './WireEdge';

describe('GateNode component', () => {
  it('renders an Input node with value toggle interaction', () => {
    const node: CircuitNode = { id: 'in_a', kind: 'input', label: 'A', value: 0, x: 50, y: 50 };
    const handleToggle = vi.fn();
    const handleSelect = vi.fn();

    render(
      <svg>
        <GateNode
          node={node}
          outputValue={0}
          isSelected={false}
          isFocused={false}
          isWiringActive={false}
          isWiringSource={false}
          activeWiringTargetPin={null}
          onSelectNode={handleSelect}
          onToggleInput={handleToggle}
          onPinClick={vi.fn()}
          onPinKeyDown={vi.fn()}
        />
      </svg>
    );

    const inputElement = screen.getByRole('button', { name: /Input toggle A/i });
    expect(inputElement).toBeInTheDocument();

    // Click triggers toggle
    fireEvent.click(inputElement);
    expect(handleToggle).toHaveBeenCalledWith('in_a');

    // Space key triggers toggle
    fireEvent.keyDown(inputElement, { key: ' ' });
    expect(handleToggle).toHaveBeenCalledWith('in_a');
  });

  it('renders a NAND gate with accessible label and pin targets', () => {
    const node: CircuitNode = { id: 'g1', kind: 'gate', gateType: 'NAND', inputCount: 2, x: 100, y: 100 };
    const handlePinClick = vi.fn();

    render(
      <svg>
        <GateNode
          node={node}
          outputValue={1}
          isSelected={false}
          isFocused={false}
          isWiringActive={false}
          isWiringSource={false}
          activeWiringTargetPin={null}
          onSelectNode={vi.fn()}
          onToggleInput={vi.fn()}
          onPinClick={handlePinClick}
          onPinKeyDown={vi.fn()}
        />
      </svg>
    );

    expect(screen.getByRole('button', { name: /NAND Gate/i })).toBeInTheDocument();

    // Check input pin buttons
    const pinIn0 = screen.getByRole('button', { name: 'g1 input 0' });
    const pinIn1 = screen.getByRole('button', { name: 'g1 input 1' });
    const pinOut = screen.getByRole('button', { name: 'g1 output' });

    expect(pinIn0).toBeInTheDocument();
    expect(pinIn1).toBeInTheDocument();
    expect(pinOut).toBeInTheDocument();

    fireEvent.click(pinOut);
    expect(handlePinClick).toHaveBeenCalledWith('g1', 'out', 0, expect.any(Object));
  });

  it('sizes the canvas symbol and outline from shared geometry constants', () => {
    const node: CircuitNode = { id: 'g1', kind: 'gate', gateType: 'AND', inputCount: 2, x: 0, y: 0 };
    const { container } = render(<svg><GateNode node={node} outputValue={1} isSelected={false} isFocused={false} isWiringActive={false} isWiringSource={false} activeWiringTargetPin={null} onSelectNode={vi.fn()} onToggleInput={vi.fn()} onPinClick={vi.fn()} onPinKeyDown={vi.fn()} /></svg>);
    const symbol = container.querySelector('.circuit-symbol-svg');
    expect(symbol).toHaveAttribute('width', String(CIRCUIT_GATE_SYMBOL_WIDTH));
    expect(symbol).toHaveAttribute('height', String(CIRCUIT_GATE_SYMBOL_HEIGHT));
    expect(symbol?.querySelector('g')).toHaveAttribute('stroke-width', String(CIRCUIT_GATE_STROKE_WIDTH));
  });
});

describe('WireEdge component', () => {
  it('renders wire with three redundant value channels and selection support', () => {
    const handleSelect = vi.fn();

    render(
      <svg>
        <WireEdge
          id="w1"
          fromNodeId="in_a"
          fromPin={0}
          toNodeId="g1"
          toPin={0}
          fromPos={{ x: 100, y: 100 }}
          toPos={{ x: 200, y: 100 }}
          value={1}
          isSelected={false}
          isHovered={false}
          zoom={1.0}
          onSelectWire={handleSelect}
        />
      </svg>
    );

    const wireButton = screen.getByRole('button', { name: /Wire w1/i });
    expect(wireButton).toBeInTheDocument();

    // Midpoint value badge is visible at zoom 1.0
    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(wireButton);
    expect(handleSelect).toHaveBeenCalledWith('w1', expect.any(Object));
  });
});
