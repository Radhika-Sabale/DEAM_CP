/**
 * @file GroupOverlay.test.tsx
 * Tests for GroupOverlay:
 * - Toroidal wrap-around decomposition (row wrap, column wrap, four corners, dual-layer span)
 * - Verifies rendered SVG pieces match decomposition output
 * - Verifies wrap markers are present as text
 * - Verifies group legend labels distinguish groups without relying on colour
 */

import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { GroupOverlay, type VisualGroup } from './GroupOverlay';
import { cellsToCube, decomposeCubeToRectangles } from '../../engine/kmap/layout';

describe('GroupOverlay', () => {
  it('renders row-wrap groups with matching piece counts and wrap marker text', () => {
    // 4-variable row wrap: m(0, 1, 8, 9) -> rows 0 (00) and 3 (10)
    const cube = cellsToCube([0, 1, 8, 9], 4);
    expect(cube.ok).toBe(true);
    if (!cube.ok) return;

    const expectedDecomp = decomposeCubeToRectangles(cube.cube, 4);
    expect(expectedDecomp.length).toBe(2);

    const group: VisualGroup = {
      id: 'grp-row-wrap',
      cube: cube.cube,
      cellIndices: [0, 1, 8, 9],
      termString: "B'C'",
    };

    const { container } = render(
      <GroupOverlay groups={[group]} variableCount={4} showLegend={true} />
    );

    // Number of rendered pieces matches decomposition output
    const pieces = container.querySelectorAll('.implicant-piece');
    expect(pieces.length).toBe(2);

    // Assert wrap markers are present as text
    expect(screen.getByText('↑ wrap')).toBeInTheDocument();
    expect(screen.getByText('↓ wrap')).toBeInTheDocument();
  });

  it('renders column-wrap groups with matching piece counts and wrap marker text', () => {
    // 4-variable column wrap: m(0, 2, 4, 6) -> cols 0 (00) and 3 (10)
    const cube = cellsToCube([0, 2, 4, 6], 4);
    expect(cube.ok).toBe(true);
    if (!cube.ok) return;

    const expectedDecomp = decomposeCubeToRectangles(cube.cube, 4);
    expect(expectedDecomp.length).toBe(2);

    const group: VisualGroup = {
      id: 'grp-col-wrap',
      cube: cube.cube,
      cellIndices: [0, 2, 4, 6],
      termString: "A'D'",
    };

    const { container } = render(
      <GroupOverlay groups={[group]} variableCount={4} showLegend={true} />
    );

    const pieces = container.querySelectorAll('.implicant-piece');
    expect(pieces.length).toBe(2);

    expect(screen.getByText('← wrap')).toBeInTheDocument();
    expect(screen.getByText('wrap →')).toBeInTheDocument();
  });

  it('renders four-corner wrap groups as four corner pieces with corner markers', () => {
    // 4-variable four corners: m(0, 2, 8, 10)
    const cube = cellsToCube([0, 2, 8, 10], 4);
    expect(cube.ok).toBe(true);
    if (!cube.ok) return;

    const expectedDecomp = decomposeCubeToRectangles(cube.cube, 4);
    expect(expectedDecomp.length).toBe(4);

    const group: VisualGroup = {
      id: 'grp-four-corners',
      cube: cube.cube,
      cellIndices: [0, 2, 8, 10],
      termString: "B'D'",
      isEssential: true,
    };

    const { container } = render(
      <GroupOverlay groups={[group]} variableCount={4} showLegend={true} />
    );

    const pieces = container.querySelectorAll('.implicant-piece');
    expect(pieces.length).toBe(4);

    // Verify all four corner wrap text markers are present
    expect(screen.getByText('↖ corner wrap')).toBeInTheDocument();
    expect(screen.getByText('↗ corner wrap')).toBeInTheDocument();
    expect(screen.getByText('↙ corner wrap')).toBeInTheDocument();
    expect(screen.getByText('↘ corner wrap')).toBeInTheDocument();
  });

  it('renders 5-variable dual-layer spanning groups with layer continuation labels', () => {
    // 5-variable dual-layer corners: m(0, 2, 8, 10, 16, 18, 24, 26)
    const cells = [0, 2, 8, 10, 16, 18, 24, 26];
    const cube = cellsToCube(cells, 5);
    expect(cube.ok).toBe(true);
    if (!cube.ok) return;

    const expectedDecomp = decomposeCubeToRectangles(cube.cube, 5);
    expect(expectedDecomp.length).toBe(8); // 4 in layer 0, 4 in layer 1

    const group: VisualGroup = {
      id: 'grp-5var-dual',
      cube: cube.cube,
      cellIndices: cells,
      termString: "C'E'",
    };

    // Render for Layer 0
    render(
      <GroupOverlay
        groups={[group]}
        variableCount={5}
        layerFilter={0}
        showLegend={false}
      />
    );

    // Verify continuation label is present as text
    const continuationLabels = screen.getAllByText('continues in layer A=1');
    expect(continuationLabels.length).toBeGreaterThan(0);
  });

  it('distinguishes multiple groups in the legend without relying on colour', () => {
    const groups: VisualGroup[] = [
      { id: 'g1', cellIndices: [0, 1], termString: "A'B'C'", isEssential: true },
      { id: 'g2', cellIndices: [2, 3], termString: "A'B'C", isEssential: false },
    ];

    render(
      <GroupOverlay groups={groups} variableCount={4} showLegend={true} />
    );

    // Labels G1 and G2 present
    expect(screen.getAllByText('G1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('G2').length).toBeGreaterThanOrEqual(1);

    // Border style descriptions present in plain text
    expect(screen.getByText(/solid/i)).toBeInTheDocument();
    expect(screen.getByText(/dashed/i)).toBeInTheDocument();

    // Essential PI text badge present
    expect(screen.getByText('Essential PI')).toBeInTheDocument();
  });
});
