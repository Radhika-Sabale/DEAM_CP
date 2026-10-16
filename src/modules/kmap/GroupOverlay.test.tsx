/** Cell-local, wrap-aware group-outline rendering and legend coverage. */

import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { getCellOutline, getGroupStyle, GroupOverlay, groupsWithCareCells, type VisualGroup } from './GroupOverlay';

const group = (id: string, cellIndices: number[], termString = id): VisualGroup => ({ id, cellIndices, termString });

describe('GroupOverlay', () => {
  it('renders row-wrap groups as fragments inside member cells', () => {
    const wrapped = group('grp-row-wrap', [0, 1, 8, 9], "B'C'");
    const outline = getCellOutline(wrapped.cellIndices, 4, 0);
    expect(outline).toMatchObject({ top: false, right: false, bottom: true, left: true, extendRight: true });
    const { container } = render(<GroupOverlay groups={[wrapped]} variableCount={4} cellIndex={0} />);
    expect(container.querySelectorAll('.group-overlay-fragment')).toHaveLength(1);
  });

  it('renders column-wrap groups with open wrapped edges', () => {
    const wrapped = group('grp-col-wrap', [0, 2, 4, 6], "A'D'");
    const outline = getCellOutline(wrapped.cellIndices, 4, 0);
    expect(outline).toMatchObject({ top: true, right: true, bottom: false, left: false, extendBottom: true });
  });

  it('keeps four-corner wrap fragments within the four corner cells', () => {
    const corners = group('grp-four-corners', [0, 2, 8, 10], "B'D'");
    const { container } = render(<div>{corners.cellIndices.map((cellIndex) => <GroupOverlay key={cellIndex} groups={[corners]} variableCount={4} cellIndex={cellIndex} />)}</div>);
    expect([...container.querySelectorAll('.group-overlay-fragment')].map((node) => node.getAttribute('data-cell-index'))).toEqual(['0', '2', '8', '10']);
    expect(getCellOutline(corners.cellIndices, 4, 0)).toMatchObject({ top: false, left: false, right: true, bottom: true, radiusBottomRight: true });
  });

  it('shows one fragment in each of the two 5-variable layer containers', () => {
    const spanning = group('grp-5var-dual', [0, 2, 8, 10, 16, 18, 24, 26], "C'E'");
    const { container } = render(<div><div data-layer="0"><GroupOverlay groups={[spanning]} variableCount={5} layerFilter={0} cellIndex={0} /></div><div data-layer="1"><GroupOverlay groups={[spanning]} variableCount={5} layerFilter={1} cellIndex={16} /></div></div>);
    expect(container.querySelectorAll('.group-overlay-fragment')).toHaveLength(2);
    render(<GroupOverlay groups={[spanning]} variableCount={5} showLegend />);
    expect(screen.getByText('Across layers')).toBeInTheDocument();
  });

  it('distinguishes groups in the legend and keeps essential status available', () => {
    const groups: VisualGroup[] = [
      { ...group('g1', [0, 1], "A'B'C'"), isEssential: true },
      group('g2', [2, 3], "A'B'C"),
    ];
    const { container } = render(<GroupOverlay groups={groups} variableCount={4} showLegend />);
    expect(screen.getByText('G1')).toBeInTheDocument();
    expect(screen.getByText('G2')).toBeInTheDocument();
    expect(screen.getByText('Essential PI')).toBeInTheDocument();
    expect(container.querySelectorAll('.group-legend-item')).toHaveLength(2);
  });

  it('keeps the end borders on a group spanning a full row', () => {
    const fullRow = group('full-row', [0, 1, 2, 3]);
    expect(getCellOutline(fullRow.cellIndices, 3, 0)).toMatchObject({ left: true, right: false, top: true, bottom: true });
    expect(getCellOutline(fullRow.cellIndices, 3, 1)).toMatchObject({ left: false, right: false, extendRight: true });
  });

  it('retains both colored outlines where two groups overlap', () => {
    const groups = [group('g1', [0, 1]), group('g2', [0, 2])];
    const { container } = render(<GroupOverlay groups={groups} variableCount={4} cellIndex={0} />);
    const fragments = [...container.querySelectorAll<HTMLElement>('.group-overlay-fragment')];
    expect(fragments).toHaveLength(2);
    expect(fragments[0]?.style.top).not.toBe(fragments[1]?.style.top);
    expect(getGroupStyle(0).stroke).not.toBe(getGroupStyle(1).stroke);
  });

  it('shows no group on all-zero maps and a single perimeter on all-one maps', () => {
    const zeroGroup = group('zero-map', Array.from({ length: 16 }, (_, index) => index));
    expect(groupsWithCareCells([zeroGroup], Array.from({ length: 16 }, () => 0))).toEqual([]);
    const allOne = group('all-one', Array.from({ length: 16 }, (_, index) => index));
    expect(groupsWithCareCells([allOne], Array.from({ length: 16 }, () => 1))).toEqual([allOne]);
    expect(getCellOutline(allOne.cellIndices, 4, 0)).toMatchObject({ top: true, left: true, right: false, bottom: false });
  });

  it('draws a dont-care join only when the group also covers a true cell', () => {
    const joined = group('joined', [1, 3]);
    const redundant = group('dont-care-only', [4, 5]);
    const values = Array.from({ length: 16 }, () => 0 as 0 | 1 | 'X');
    values[1] = 1;
    values[3] = 'X';
    values[4] = 'X';
    values[5] = 'X';
    expect(groupsWithCareCells([joined, redundant], values)).toEqual([joined]);
    expect(groupsWithCareCells([joined, redundant], values, 0)).toEqual([]);
    expect(getCellOutline(joined.cellIndices, 4, 3)).not.toBeNull();
  });

  it('computes wrap-aware outlines on 2-, 3-, and 5-variable maps', () => {
    expect(getCellOutline([0, 2], 2, 0)?.bottom).toBe(false);
    expect(getCellOutline([0, 2], 3, 0)?.left).toBe(false);
    expect(getCellOutline([0, 16], 5, 0)?.top).toBe(true);
  });
});
